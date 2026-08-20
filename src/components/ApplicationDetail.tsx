import { useEffect, useMemo } from 'react'
import { ArrowUpRight, BookCheck, BookOpenText, Calendar, Check, Clock3, MapPin, Pencil, RotateCcw, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { StatusTag } from '@/components/StatusTag'
import type { Application, ApplicationNodeProgress, InterviewReview, WorkflowNode } from '@/types/application'
import { formatChineseDate } from '@/utils/date'
import { findPreviousWorkflowNode } from '@/utils/workflow'
import { openExternalUrl } from '@/utils/external'

interface ApplicationDetailProps {
  application?: Application
  workflowNodes: WorkflowNode[]
  reviews: InterviewReview[]
  onClose: () => void
  onEdit: (application: Application) => void
  onDelete: (application: Application) => void
  onUndo: (application: Application) => void
  onReview: (application: Application, node: WorkflowNode) => void
  onNodeProgress: (applicationId: string, node: WorkflowNode, changes: Partial<Omit<ApplicationNodeProgress, 'workflowNodeId' | 'updatedAt'>>) => void
}

export function ApplicationDetail({ application, workflowNodes, reviews, onClose, onEdit, onDelete, onUndo, onReview, onNodeProgress }: ApplicationDetailProps): JSX.Element | null {
  const experiencedNodes = useMemo(() => (application?.nodeProgress ?? []).flatMap((progress) => {
    const node = workflowNodes.find((item) => item.id === progress.workflowNodeId)
    return node ? [{ node, progress }] : []
  }).sort((a, b) => workflowNodes.findIndex((node) => node.id === a.node.id) - workflowNodes.findIndex((node) => node.id === b.node.id)), [application?.nodeProgress, workflowNodes])
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
  const canUndo = Boolean(findPreviousWorkflowNode(application, workflowNodes))

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside className="detail-drawer" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <header className="detail-header">
          <div className="detail-title-row">
            <div>
              <span className="eyebrow">投递详情</span>
              <h2>{application.companyName}</h2>
              <div className="detail-position-row"><p>{application.positionName}</p>{application.preferenceOrder && <span className="preference-badge">第 {application.preferenceOrder} 志愿</span>}</div>
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
                <p className="section-description">节点顺序和状态只读；时间可编辑，流程只能从看板推进或在此撤销</p>
              </div>
              <div className="workflow-heading-actions">
                <StatusTag status={application.status} />
                {canUndo && <Button size="sm" icon={<RotateCcw size={13} />} onClick={() => onUndo(application)}>撤销到上一节点</Button>}
              </div>
            </div>
            <div className="status-stepper">
              {experiencedNodes.map(({ node, progress }, index) => {
                const status = node.name
                const isCurrent = progress.state === 'active' && status === application.status
                const isPast = progress.state === 'completed'
                const review = reviews.find((item) => item.applicationId === application.id && item.workflowNodeId === node.id)
                const effectiveState = progress.state
                return (
                  <div key={node.id} className={`status-step-row ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''}`}>
                    <div className="status-step-primary">
                      <div className="status-step">
                        <span className="step-marker">
                          {effectiveState === 'completed' ? <Check size={11} /> : isCurrent ? <span className="current-marker" /> : <span>{index + 1}</span>}
                        </span>
                        <span className="step-content">
                          <strong>{status}</strong>
                          <small>{node.isTerminal ? '结束状态' : effectiveState === 'completed' ? '已完成' : '正在进行'}</small>
                        </span>
                        {isCurrent && <span className="current-label">当前</span>}
                      </div>
                      {node.hasReview && <button
                        className={`node-review-action ${review ? 'completed' : 'pending'}`}
                        onClick={() => onReview(application, node)}
                        title={review ? `打开${status}复盘` : `创建${status}复盘`}
                      >{review ? <BookCheck size={13} /> : <BookOpenText size={13} />}{review ? '已复盘' : '写复盘'}</button>}
                    </div>
                    <div className="node-progress-editor">
                      <label><span>节点时间</span><input type="datetime-local" step="60" min={`${application.applicationDate}T00:00`} value={progress.scheduledAt ?? ''} onChange={(event) => onNodeProgress(application.id, node, { scheduledAt: event.target.value || undefined })} /></label>
                      <label><span>状态</span><strong className={`node-state-readonly ${effectiveState}`}>{effectiveState === 'completed' ? '已完成' : '进行中'}</strong></label>
                      <label className="reminder-field"><span>提前提醒{progress.reminderSentAt ? ' · 已提醒' : ''}</span><span><input type="number" min="0" max="525600" step="1" disabled={!isCurrent || !progress.scheduledAt} value={isCurrent ? progress.reminderMinutesBefore ?? '' : ''} onChange={(event) => onNodeProgress(application.id, node, { reminderMinutesBefore: event.target.value === '' ? undefined : Math.max(0, Math.min(525600, Math.floor(Number(event.target.value)))) })} placeholder={isCurrent && progress.scheduledAt ? '不提醒' : '仅当前节点'} /><i>分钟</i></span></label>
                    </div>
                  </div>
                )
              })}
            </div>
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

          {(application.preferenceOrder || application.salary || application.jobType || application.link || application.notes) && (
            <section className="detail-section">
              <div className="section-heading-row"><h3>岗位信息</h3></div>
              <dl className="detail-definition">
                {application.preferenceOrder && <><dt>志愿</dt><dd>第 {application.preferenceOrder} 志愿</dd></>}
                {application.salary && <><dt>薪资</dt><dd>{application.salary}</dd></>}
                {application.jobType && <><dt>类型</dt><dd>{application.jobType}</dd></>}
                {application.link && <><dt>链接</dt><dd><button onClick={() => void openExternalUrl(application.link!)}>打开招聘页面 <ArrowUpRight size={13} /></button></dd></>}
                {application.notes && <><dt>备注</dt><dd>{application.notes}</dd></>}
              </dl>
            </section>
          )}
        </div>
      </aside>
    </div>
  )
}
