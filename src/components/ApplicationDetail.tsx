import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Calendar, Check, Clock3, MapPin, Pencil, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { StatusTag } from '@/components/StatusTag'
import type { Application } from '@/types/application'
import { formatChineseDate, toDateInput } from '@/utils/date'

interface ApplicationDetailProps {
  application?: Application
  statuses: string[]
  onClose: () => void
  onEdit: (application: Application) => void
  onDelete: (application: Application) => void
  onStatusChange: (id: string, status: string, event: { date: string; time?: string; note?: string }) => void
}

export function ApplicationDetail({ application, statuses, onClose, onEdit, onDelete, onStatusChange }: ApplicationDetailProps): JSX.Element | null {
  const [nextDate, setNextDate] = useState(toDateInput())
  const [nextTime, setNextTime] = useState('')
  const [note, setNote] = useState('')
  const mainStatuses = useMemo(() => statuses.filter((status) => !['已拒绝', '已结束'].includes(status)), [statuses])
  const endStatuses = useMemo(() => statuses.filter((status) => ['已拒绝', '已结束'].includes(status)), [statuses])
  const currentIndex = application ? mainStatuses.indexOf(application.status) : -1
  const terminalStatus = application ? ['Offer', '已拒绝', '已结束'].includes(application.status) : false
  const nextStatus = currentIndex >= 0 && !terminalStatus ? mainStatuses[currentIndex + 1] : undefined
  const furthestHistoryIndex = application
    ? Math.max(-1, ...application.histories.map((history) => mainStatuses.indexOf(history.status)))
    : -1
  const sortedHistories = useMemo(
    () => [...(application?.histories ?? [])].sort((a, b) => b.createdAt - a.createdAt),
    [application?.histories],
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!application) return null
  const advance = (status: string): void => {
    onStatusChange(application.id, status, { date: nextDate, time: nextTime || undefined, note: note || undefined })
    setNote('')
  }

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside className="detail-drawer" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header className="detail-header">
          <div className="detail-title-row">
            <div>
              <span className="eyebrow">投递详情</span>
              <h2>{application.companyName}</h2>
              <p>{application.positionName}</p>
            </div>
            <button className="icon-button" onClick={onClose} aria-label="关闭"><X size={18} /></button>
          </div>
          <div className="detail-actions">
            <Button size="sm" icon={<Pencil size={14} />} onClick={() => onEdit(application)}>编辑</Button>
            <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => onDelete(application)}>删除</Button>
          </div>
        </header>

        <div className="detail-scroll">
          <div className="detail-meta">
            <div><Calendar size={15} /><span>投递于 {formatChineseDate(application.applicationDate)}</span></div>
            <div><MapPin size={15} /><span>{application.location || '未填写地点'}</span></div>
            {application.source && <div><ArrowUpRight size={15} /><span>{application.source}</span></div>}
          </div>
          <section className="detail-section">
            <div className="section-heading-row">
              <div>
                <h3>招聘流程</h3>
                <p className="section-description">点击阶段可直接更新当前进度</p>
              </div>
              <StatusTag status={application.status} />
            </div>
            <div className="status-stepper">
              {mainStatuses.map((status, index) => {
                const isCurrent = status === application.status
                const isPast = currentIndex >= 0 ? index < currentIndex : index <= furthestHistoryIndex
                return (
                  <button
                    key={status}
                    className={`status-step ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''}`}
                    onClick={() => advance(status)}
                    title={`更新为${status}`}
                  >
                    <span className="step-marker">
                      {isPast ? <Check size={11} /> : isCurrent ? <span className="current-marker" /> : <span>{index + 1}</span>}
                    </span>
                    <span className="step-content">
                      <strong>{status}</strong>
                      <small>{isPast ? '已完成' : isCurrent ? '正在进行' : '待进行'}</small>
                    </span>
                    {isCurrent && <span className="current-label">当前</span>}
                  </button>
                )
              })}
            </div>
            {endStatuses.length > 0 && (
              <div className="end-statuses">
                <span>结束状态</span>
                <div>
                  {endStatuses.map((status) => (
                    <button
                      key={status}
                      className={application.status === status ? 'current' : ''}
                      aria-pressed={application.status === status}
                      onClick={() => advance(status)}
                    >
                      <span />{status}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="detail-section advance-panel">
            <div className="section-heading-row">
              <div>
                <span className="section-kicker">Next action</span>
                <h3>更新进度</h3>
              </div>
            </div>
            <div className="advance-fields">
              <label className="field"><span>事件日期</span><input type="date" value={nextDate} onChange={(event) => setNextDate(event.target.value)} /></label>
              <label className="field"><span>时间</span><input type="time" value={nextTime} onChange={(event) => setNextTime(event.target.value)} /></label>
            </div>
            <label className="field"><span>备注</span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="例如：收到笔试通知" /></label>
            {nextStatus ? (
              <Button variant="primary" className="advance-button" onClick={() => advance(nextStatus)}>
                进入下一阶段 · {nextStatus}
              </Button>
            ) : <p className="detail-hint">当前已是流程中的最后一个阶段。</p>}
          </section>

          <section className="detail-section">
            <div className="section-heading-row">
              <div>
                <span className="section-kicker">Activity</span>
                <h3>流程历史</h3>
              </div>
              <span className="count-badge">{sortedHistories.length}</span>
            </div>
            <div className="history-list">
              {sortedHistories.map((history) => (
                <div className="history-item" key={history.id}>
                  <span className="history-node" />
                  <div>
                    <div className="history-title"><strong>{history.status}</strong><span>{history.date}</span></div>
                    {(history.time || history.note) && <p>{history.time && <><Clock3 size={12} /> {history.time}</>} {history.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {(application.salary || application.link || application.notes) && (
            <section className="detail-section">
              <div className="section-heading-row"><h3>岗位信息</h3></div>
              <dl className="detail-definition">
                {application.salary && <><dt>薪资</dt><dd>{application.salary}</dd></>}
                {application.jobType && <><dt>类型</dt><dd>{application.jobType}</dd></>}
                {application.link && <><dt>链接</dt><dd><button onClick={() => void window.desktopApi?.openExternal(application.link!)}>打开招聘页面 <ArrowUpRight size={13} /></button></dd></>}
                {application.notes && <><dt>备注</dt><dd>{application.notes}</dd></>}
              </dl>
            </section>
          )}
        </div>
      </aside>
    </div>
  )
}
