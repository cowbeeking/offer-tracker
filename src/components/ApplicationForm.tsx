import { useMemo, useState, type FormEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { Application, ApplicationDraft } from '@/types/application'
import { toDateInput } from '@/utils/date'

function draftFromApplication(application?: Application): ApplicationDraft {
  const today = toDateInput()
  const now = new Date()
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return {
    companyName: application?.companyName ?? '',
    positionName: application?.positionName ?? '',
    preferenceOrder: application?.preferenceOrder ? String(application.preferenceOrder) : '',
    applicationDate: application?.applicationDate ?? today,
    deadline: application?.deadline ?? '',
    status: application?.status ?? '已投递',
    location: application?.location ?? '',
    source: application?.source ?? '',
    jobType: application?.jobType ?? '',
    link: application?.link ?? '',
    salary: application?.salary ?? '',
    notes: application?.notes ?? '',
    eventDate: today,
    eventTime: currentTime,
  }
}

interface ApplicationFormProps {
  application?: Application
  applications: Application[]
  statuses: string[]
  companies: string[]
  onSubmit: (draft: ApplicationDraft, additionalDrafts?: ApplicationDraft[]) => void
  onCancel: () => void
}

export function ApplicationForm({ application, applications, statuses, companies, onSubmit, onCancel }: ApplicationFormProps): JSX.Element {
  const [draft, setDraft] = useState<ApplicationDraft>(() => draftFromApplication(application))
  const [error, setError] = useState('')
  const [eventDateTouched, setEventDateTouched] = useState(false)
  const [additionalPositions, setAdditionalPositions] = useState<string[]>([])
  const companyOptions = useMemo(() => [...new Set(companies)].sort((a, b) => a.localeCompare(b, 'zh-CN')), [companies])
  const companyKey = draft.companyName.trim().toLocaleLowerCase()
  const existingMaxPreference = applications.reduce((maximum, item) => {
    if (!companyKey || item.companyName.trim().toLocaleLowerCase() !== companyKey) return maximum
    return Math.max(maximum, item.preferenceOrder ?? 0)
  }, 0)
  const requestedPrimaryOrder = /^\d+$/.test(draft.preferenceOrder) && Number(draft.preferenceOrder) > 0
    ? Number(draft.preferenceOrder)
    : undefined
  const inferredPrimaryOrder = requestedPrimaryOrder ?? existingMaxPreference + 1
  const primaryAlreadyNumberedInCompany = Boolean(
    application?.preferenceOrder && application.companyName.trim().toLocaleLowerCase() === companyKey,
  )
  const firstAdditionalOrder = existingMaxPreference + (primaryAlreadyNumberedInCompany ? 1 : 2)

  const setField = <K extends keyof ApplicationDraft>(field: K, value: ApplicationDraft[K]): void => {
    if (error) setError('')
    setDraft((current) => ({ ...current, [field]: value }))
  }

  const handleSubmit = (event: FormEvent): void => {
    event.preventDefault()
    if (!draft.companyName.trim() || !draft.positionName.trim() || !draft.applicationDate) {
      setError('请填写公司名称、岗位名称和投递日期。')
      return
    }
    if (draft.link && !/^https?:\/\//i.test(draft.link)) {
      setError('招聘链接需要以 http:// 或 https:// 开头。')
      return
    }
    if (draft.preferenceOrder && (!/^\d+$/.test(draft.preferenceOrder) || Number(draft.preferenceOrder) < 1)) {
      setError('志愿顺序需要填写大于 0 的整数。')
      return
    }
    if (additionalPositions.some((position) => !position.trim())) {
      setError('请填写所有追加志愿的岗位名称。')
      return
    }
    const positions = [draft.positionName, ...additionalPositions].map((position) => position.trim())
    if (new Set(positions).size !== positions.length) {
      setError('同一公司的多个志愿岗位不能完全相同。')
      return
    }
    if (draft.deadline && draft.deadline < draft.applicationDate) {
      setError('截止日期不能早于投递日期。')
      return
    }
    const recordsNewEvent = !application || application.status !== draft.status
    if (recordsNewEvent && draft.eventDate && draft.eventDate < draft.applicationDate) {
      setError('流程事件日期不能早于投递日期。')
      return
    }
    const primaryDraft = additionalPositions.length && !draft.preferenceOrder
      ? { ...draft, preferenceOrder: String(inferredPrimaryOrder) }
      : draft
    const additionalDrafts = additionalPositions.map((positionName, index) => ({
      ...draft,
      positionName: positionName.trim(),
      preferenceOrder: String(firstAdditionalOrder + index),
    }))
    onSubmit(primaryDraft, additionalDrafts)
  }

  return (
    <form onSubmit={handleSubmit} className="application-form">
      <div className="form-grid">
        <label className="field field-span-2">
          <span>公司名称 <em>*</em></span>
          <input
            autoFocus
            list="company-history"
            value={draft.companyName}
            onChange={(event) => setField('companyName', event.target.value)}
            placeholder="例如：字节跳动"
          />
          <datalist id="company-history">
            {companyOptions.map((company) => <option value={company} key={company} />)}
          </datalist>
        </label>
        <label className="field field-span-2">
          <span>岗位名称 <em>*</em></span>
          <input
            value={draft.positionName}
            onChange={(event) => setField('positionName', event.target.value)}
            placeholder="例如：后端开发工程师"
          />
        </label>
        <div className="additional-preferences field-span-2">
          <div className="additional-preferences-head">
            <div><strong>更多志愿</strong><span>沿用同一公司的日期、状态和其他信息，每个志愿保存为独立投递。</span></div>
            <Button type="button" size="sm" icon={<Plus size={13} />} onClick={() => {
              if (!draft.preferenceOrder) setField('preferenceOrder', '1')
              setAdditionalPositions((current) => [...current, ''])
            }}>更多志愿</Button>
          </div>
          {additionalPositions.length > 0 && <div className="additional-preference-list">
            {additionalPositions.map((position, index) => {
              const order = firstAdditionalOrder + index
              const isLast = index === additionalPositions.length - 1
              return <label className="field additional-preference-field" key={index}>
                <span>第 {order} 志愿岗位名称 <em>*</em></span>
                <div className="additional-preference-input">
                  <input value={position} onChange={(event) => {
                    if (error) setError('')
                    const next = event.target.value
                    setAdditionalPositions((current) => current.map((item, itemIndex) => itemIndex === index ? next : item))
                  }} placeholder={`例如：第 ${order} 志愿岗位`} />
                  {isLast && <button type="button" aria-label={`删除第 ${order} 志愿`} title="删除最后一个志愿" onClick={() => setAdditionalPositions((current) => current.slice(0, -1))}><X size={14} /></button>}
                </div>
              </label>
            })}
          </div>}
        </div>
        <label className="field">
          <span>投递日期 <em>*</em></span>
          <input type="date" value={draft.applicationDate} onChange={(event) => {
            const value = event.target.value
            if (error) setError('')
            setDraft((current) => ({
              ...current,
              applicationDate: value,
              eventDate: !application && !eventDateTouched ? value : current.eventDate,
            }))
          }} />
        </label>
        <label className="field">
          <span>截止日期</span>
          <input type="date" value={draft.deadline} onChange={(event) => setField('deadline', event.target.value)} />
        </label>
        <label className="field">
          <span>{application ? '当前状态（请在流程看板拖动）' : '初始状态'}</span>
          <select disabled={Boolean(application)} value={draft.status} onChange={(event) => setField('status', event.target.value)}>
            {statuses.map((status) => <option value={status} key={status}>{status}</option>)}
          </select>
        </label>
        <label className="field">
          <span>工作地点</span>
          <input value={draft.location} onChange={(event) => setField('location', event.target.value)} placeholder="城市 / 远程" />
        </label>
        <label className="field">
          <span>投递渠道</span>
          <input value={draft.source} onChange={(event) => setField('source', event.target.value)} placeholder="官网 / 内推 / 招聘平台" />
        </label>
        <label className="field">
          <span>岗位类型</span>
          <input value={draft.jobType} onChange={(event) => setField('jobType', event.target.value)} placeholder="技术研发 / 产品 / 运营" />
        </label>
        <label className="field">
          <span>薪资</span>
          <input value={draft.salary} onChange={(event) => setField('salary', event.target.value)} placeholder="例如：25k-40k · 15薪" />
        </label>
        <label className="field">
          <span>志愿顺序</span>
          <input type="number" min="1" step="1" value={draft.preferenceOrder} onChange={(event) => setField('preferenceOrder', event.target.value)} placeholder="例如：1（第 1 志愿）" />
        </label>
        <label className="field field-span-2">
          <span>招聘链接</span>
          <input value={draft.link} onChange={(event) => setField('link', event.target.value)} placeholder="https://..." />
        </label>
        {!application && <div className="field-group field-span-2">
          <span className="field-group-title">当前阶段事件（用于今日待办）</span>
          <div className="event-fields">
            <label className="field">
              <span>事件日期</span>
              <input type="date" value={draft.eventDate} onChange={(event) => { setEventDateTouched(true); setField('eventDate', event.target.value) }} />
            </label>
            <label className="field">
              <span>事件时间</span>
              <input type="time" value={draft.eventTime} onChange={(event) => setField('eventTime', event.target.value)} />
            </label>
          </div>
        </div>}
        <label className="field field-span-2">
          <span>备注</span>
          <textarea value={draft.notes} onChange={(event) => setField('notes', event.target.value)} rows={4} placeholder="记录准备事项、联系人、面试反馈等" />
        </label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <footer className="modal-footer form-footer">
        <Button type="button" onClick={onCancel}>取消</Button>
        <Button type="submit" variant="primary">{application ? '保存更改' : '创建投递'}</Button>
      </footer>
    </form>
  )
}
