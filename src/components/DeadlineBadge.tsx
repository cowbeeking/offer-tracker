import clsx from 'clsx'
import { deadlineLabel } from '@/utils/date'

export function DeadlineBadge({ deadline }: { deadline?: string }): JSX.Element {
  const info = deadlineLabel(deadline)
  if (!info) return <span className="text-muted">—</span>
  return (
    <span className={clsx('deadline-label', info.urgent && 'deadline-urgent', info.expired && 'deadline-expired')}>
      {info.label}
    </span>
  )
}
