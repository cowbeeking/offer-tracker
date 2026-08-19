import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { BookOpenText, CalendarDays, GripVertical, MapPin, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/EmptyState'
import { StatusTag } from '@/components/StatusTag'
import type { Application } from '@/types/application'
import { formatShortDate } from '@/utils/date'

interface BoardPageProps {
  applications: Application[]
  statuses: string[]
  onAdd: () => void
  onOpen: (application: Application) => void
  onCreateReview: (application: Application) => void
  onStatusChange: (id: string, status: string) => void
}

export function BoardPage({ applications, statuses, onAdd, onOpen, onCreateReview, onStatusChange }: BoardPageProps): JSX.Element {
  const [query, setQuery] = useState('')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [overStatus, setOverStatus] = useState<string | null>(null)
  const boardScrollRef = useRef<HTMLDivElement>(null)
  const dragAutoScrollFrameRef = useRef<number | null>(null)
  const dragAutoScrollVelocityRef = useRef(0)
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return applications.filter((item) => !needle || `${item.companyName} ${item.positionName} ${item.preferenceOrder ? `第${item.preferenceOrder}志愿` : ''}`.toLocaleLowerCase().includes(needle))
  }, [applications, query])
  const boardStatuses = statuses.filter((status) => status !== '待投递' || visible.some((item) => item.status === status))

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
    if (draggedId) onStatusChange(draggedId, status)
    stopDragAutoScroll()
    setDraggedId(null)
    setOverStatus(null)
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
        <div><span className="eyebrow">Pipeline board</span><h1>流程看板</h1><p>拖动卡片即可更新招聘阶段，并自动记录流程历史。</p></div>
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
                .sort((first, second) => first.applicationDate.localeCompare(second.applicationDate) || first.createdAt - second.createdAt)
              return (
                <section
                  className={`kanban-column ${overStatus === status ? 'drag-over' : ''}`}
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
                          <span><CalendarDays size={13} />{formatShortDate(application.applicationDate)}</span>
                          {application.location && <span><MapPin size={13} />{application.location}</span>}
                          <button
                            className="card-review-action"
                            draggable={false}
                            aria-label={`为 ${application.companyName} 创建面试复盘`}
                            title="创建关联复盘"
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => { event.stopPropagation(); onCreateReview(application) }}
                          ><BookOpenText size={13} />复盘</button>
                          <GripVertical size={15} className="drag-handle" />
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
      ) : <section className="panel"><EmptyState title="看板还是空的" description="新增投递后，可在不同招聘阶段之间直接拖动。" action={<Button variant="primary" size="sm" onClick={onAdd}>新增投递</Button>} /></section>}
    </div>
  )
}
