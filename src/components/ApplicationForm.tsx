import { useMemo, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import type { Application, ApplicationDraft } from '@/types/application'
import { toDateInput } from '@/utils/date'

function draftFromApplication(application?: Application): ApplicationDraft {
  const today = toDateInput()
  return {
    companyName: application?.companyName ?? '',
    positionName: application?.positionName ?? '',
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
    eventTime: '',
  }
}

interface ApplicationFormProps {
  application?: Application
  statuses: string[]
  companies: string[]
  onSubmit: (draft: ApplicationDraft) => void
  onCancel: () => void
}

export function ApplicationForm({ application, statuses, companies, onSubmit, onCancel }: ApplicationFormProps): JSX.Element {
  const [draft, setDraft] = useState<ApplicationDraft>(() => draftFromApplication(application))
  const [error, setError] = useState('')
  const [eventDateTouched, setEventDateTouched] = useState(false)
  const companyOptions = useMemo(() => [...new Set(companies)].sort((a, b) => a.localeCompare(b, 'zh-CN')), [companies])

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
    if (draft.deadline && draft.deadline < draft.applicationDate) {
      setError('截止日期不能早于投递日期。')
      return
    }
    const recordsNewEvent = !application || application.status !== draft.status
    if (recordsNewEvent && draft.eventDate && draft.eventDate < draft.applicationDate) {
      setError('流程事件日期不能早于投递日期。')
      return
    }
    onSubmit(draft)
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
          <span>当前状态</span>
          <select value={draft.status} onChange={(event) => setField('status', event.target.value)}>
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
        <label className="field field-span-2">
          <span>招聘链接</span>
          <input value={draft.link} onChange={(event) => setField('link', event.target.value)} placeholder="https://..." />
        </label>
        <div className="field-group field-span-2">
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
        </div>
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
