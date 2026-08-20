import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { CalendarDays, GripVertical, MapPin, Search } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { StatusTag } from '@/components/StatusTag'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import type { Application, WorkflowNode } from '@/types/application'
import { formatShortDateTime, isValidLocalDateTime, toLocalDateTimeInput } from '@/utils/date'
import { getCurrentNodeDateTime } from '@/utils/workflow'

interface BoardPageProps {
  applications: Application[]
  statuses: string[]
  workflowNodes: WorkflowNode[]
  onOpen: (application: Application) => void
  onStatusChange: (id: string, status: string, event: { date: string; time: string; note?: string }) => void
  onInvalidMove: (message: string) => void
}

export function BoardPage({ applications, statuses, workflowNodes, onOpen, onStatusChange, onInvalidMove }: BoardPageProps): JSX.Element {
  const [query, setQuery] = useState('')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [overStatus, setOverStatus] = useState<string | null>(null)
  const [pendingDrop, setPendingDrop] = useState<{ application: Application; status: string; scheduledAt: string; note: string }>()
  const boardScrollRef = useRef<HTMLDivElement>(null)
  const dragAutoScrollFrameRef = useRef<number | null>(null)
  const dragAutoScrollVelocityRef = useRef(0)
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return applications.filter((item) => !needle || `${item.companyName} ${item.positionName} ${item.preferenceOrder ? `第${item.preferenceOrder}志愿` : ''}`.toLocaleLowerCase().includes(needle))
  }, [applications, query])
  const boardStatuses = statuses

  const stopDragAutoScroll = (): void => {
    dragAutoScrollVelocityRef.current = 0
    if (dragAutoScrollFrameRef.current !== null) {
      cancelAnimationFrame(dragAutoScrollFrameRef.current)
      dragAutoScrollFrameRef.current = null
    }
  }

  const startDragAutoScroll = (): void => {
    if (dragAutoScrollFrameRef.current !== null) return

    const scroll = (): void => {
      const container = boardScrollRef.current
      const velocity = dragAutoScrollVelocityRef.current
      if (!container || velocity === 0) {
        dragAutoScrollFrameRef.current = null
        return
      }

      const previousScrollLeft = container.scrollLeft
      container.scrollLeft += velocity
      if (container.scrollLeft === previousScrollLeft) {
        dragAutoScrollVelocityRef.current = 0
        dragAutoScrollFrameRef.current = null
        return
      }

      dragAutoScrollFrameRef.current = requestAnimationFrame(scroll)
    }

    dragAutoScrollFrameRef.current = requestAnimationFrame(scroll)
  }

  const handleBoardDragOver = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    if (!draggedId) return

    const container = boardScrollRef.current
    if (!container) return
    const bounds = container.getBoundingClientRect()
    const edgeZone = Math.min(120, Math.max(72, bounds.width * 0.14))
    const distanceFromLeft = event.clientX - bounds.left
    const distanceFromRight = bounds.right - event.clientX
    const minSpeed = 4
    const maxSpeed = 18
    let velocity = 0

    if (distanceFromLeft < edgeZone) {
      const intensity = 1 - Math.max(0, distanceFromLeft) / edgeZone
      velocity = -(minSpeed + (maxSpeed - minSpeed) * intensity)
    } else if (distanceFromRight < edgeZone) {
      const intensity = 1 - Math.max(0, distanceFromRight) / edgeZone
      velocity = minSpeed + (maxSpeed - minSpeed) * intensity
    }

    dragAutoScrollVelocityRef.current = velocity
    if (velocity === 0) stopDragAutoScroll()
    else startDragAutoScroll()
  }

  const handleDrop = (event: DragEvent, status: string): void => {
    event.preventDefault()
    const application = applications.find((item) => item.id === draggedId)
    if (application && application.status !== status) {
      const currentIndex = statuses.indexOf(application.status)
      const targetIndex = statuses.indexOf(status)
      const targetNode = workflowNodes.find((node) => node.name === status)
      const alreadyExperienced = Boolean(targetNode && application.nodeProgress.some((progress) => progress.workflowNodeId === targetNode.id))
      if (currentIndex >= 0 && targetIndex >= 0 && targetIndex < currentIndex) {
        onInvalidMove('招聘流程不能向前拖动；如需回退，请使用卡片上的“撤销”')
      } else if (alreadyExperienced) {
        onInvalidMove('这个节点已经经历过，不能重复进入；如需回退，请在招聘流程中撤销')
      } else {
        setPendingDrop({ application, status, scheduledAt: toLocalDateTimeInput(), note: '' })
      }
    }
    stopDragAutoScroll()
    setDraggedId(null)
    setOverStatus(null)
  }

  const confirmDrop = (event: FormEvent): void => {
    event.preventDefault()
    if (!pendingDrop?.scheduledAt) return
    if (!isValidLocalDateTime(pendingDrop.scheduledAt) || pendingDrop.scheduledAt.slice(0, 10) < pendingDrop.application.applicationDate) {
      onInvalidMove('节点时间不能早于投递日期')
      return
    }
    onStatusChange(pendingDrop.application.id, pendingDrop.status, {
      date: pendingDrop.scheduledAt.slice(0, 10),
      time: pendingDrop.scheduledAt.slice(11, 16),
      note: pendingDrop.note.trim() || undefined,
    })
    setPendingDrop(undefined)
  }

  useEffect(() => {
    const container = boardScrollRef.current
    if (!container) return

    const handleWheel = (event: WheelEvent): void => {
      if (!event.ctrlKey) return
      event.preventDefault()
      const maxScrollLeft = container.scrollWidth - container.clientWidth
      if (maxScrollLeft <= 0) return
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
      container.scrollLeft = Math.max(0, Math.min(maxScrollLeft, container.scrollLeft + delta))
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      container.removeEventListener('wheel', handleWheel)
      dragAutoScrollVelocityRef.current = 0
      if (dragAutoScrollFrameRef.current !== null) cancelAnimationFrame(dragAutoScrollFrameRef.current)
    }
  }, [])

  return (
    <div className="page board-page">
      <header className="page-heading">
        <div><span className="eyebrow">Pipeline board</span><h1>流程看板</h1><p>只能向后拖动并填写节点时间；误拖请在投递详情的招聘流程中撤销。</p></div>
      </header>
      <div className="board-toolbar">
        <label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索看板中的公司 / 岗位" /></label>
        <div className="board-toolbar-meta">
          <span>{visible.length} 个机会 · {boardStatuses.length} 个阶段</span>
          <span className="board-scroll-hint"><kbd>Ctrl</kbd> + 滚轮横向浏览</span>
        </div>
      </div>
      {applications.length ? (
        <div
          className="board-scroll"
          ref={boardScrollRef}
          onDragOver={handleBoardDragOver}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) stopDragAutoScroll() }}
        >
          <div className="kanban-board">
            {boardStatuses.map((status) => {
              const items = visible
                .filter((application) => application.status === status)
                .sort((first, second) => getCurrentNodeDateTime(first, workflowNodes).localeCompare(getCurrentNodeDateTime(second, workflowNodes)) || first.createdAt - second.createdAt)
              const draggedApplication = applications.find((application) => application.id === draggedId)
              const targetNode = workflowNodes.find((node) => node.name === status)
              const isEarlierTarget = Boolean(draggedApplication && status !== draggedApplication.status && (statuses.indexOf(status) < statuses.indexOf(draggedApplication.status) || (targetNode && draggedApplication.nodeProgress.some((progress) => progress.workflowNodeId === targetNode.id))))
              return (
                <section
                  className={`kanban-column ${overStatus === status ? isEarlierTarget ? 'drag-blocked' : 'drag-over' : ''}`}
                  key={status}
                  onDragOver={(event) => { event.preventDefault(); setOverStatus(status) }}
                  onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOverStatus(null) }}
                  onDrop={(event) => handleDrop(event, status)}
                >
                  <header><StatusTag status={status} /><span>{items.length}</span></header>
                  <div className="kanban-list">
                    {items.map((application) => (
                      <article
                        key={application.id}
                        className={`kanban-card ${draggedId === application.id ? 'dragging' : ''}`}
                        draggable
                        onDragStart={(event) => { setDraggedId(application.id); event.dataTransfer.effectAllowed = 'move' }}
                        onDragEnd={() => { stopDragAutoScroll(); setDraggedId(null); setOverStatus(null) }}
                        onDoubleClick={() => onOpen(application)}
                      >
                        <button className="card-main" onClick={() => onOpen(application)}>
                          <span className="company-avatar">{application.companyName.slice(0, 1)}</span>
                          <span className="card-copy"><strong>{application.companyName}</strong><small>{application.positionName}</small></span>
                          {application.preferenceOrder && <span className="preference-badge">第 {application.preferenceOrder} 志愿</span>}
                        </button>
                        <div className="card-meta">
                          <span title="当前节点时间"><CalendarDays size={13} />{formatShortDateTime(getCurrentNodeDateTime(application, workflowNodes))}</span>
                          {application.location && <span><MapPin size={13} />{application.location}</span>}
                          <div className="card-actions">
                            <GripVertical size={15} className="drag-handle" />
                          </div>
                        </div>
                      </article>
                    ))}
                    {!items.length && <div className="column-empty">拖到这里更新为「{status}」</div>}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      ) : <section className="panel"><EmptyState title="看板还是空的" description="请先在投递记录中添加机会，再到这里推进招聘阶段。" /></section>}
      <Modal open={Boolean(pendingDrop)} width="sm" title={`进入「${pendingDrop?.status ?? ''}」`} description={pendingDrop ? `${pendingDrop.application.companyName} · ${pendingDrop.application.positionName}` : ''} onClose={() => setPendingDrop(undefined)}>
        <form className="board-drop-form" onSubmit={confirmDrop}>
          <label className="field"><span>节点日期与时间 <em>*</em></span><input autoFocus required type="datetime-local" step="60" min={pendingDrop ? `${pendingDrop.application.applicationDate}T00:00` : undefined} value={pendingDrop?.scheduledAt ?? ''} onChange={(event) => setPendingDrop((current) => current ? { ...current, scheduledAt: event.target.value } : current)} /></label>
          <label className="field"><span>节点备注</span><input value={pendingDrop?.note ?? ''} onChange={(event) => setPendingDrop((current) => current ? { ...current, note: event.target.value } : current)} placeholder="例如：收到一面通知" /></label>
          <footer className="modal-footer"><Button type="button" onClick={() => setPendingDrop(undefined)}>取消</Button><Button type="submit" variant="primary">确认更新</Button></footer>
        </form>
      </Modal>
    </div>
  )
}
