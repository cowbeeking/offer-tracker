import clsx from 'clsx'
import { getStatusTone } from '@/constants/statuses'
import type { StatusTone } from '@/constants/statuses'

const TONE_CLASSES: Record<StatusTone, string> = {
  slate: 'status-slate',
  blue: 'status-blue',
  purple: 'status-purple',
  orange: 'status-orange',
  green: 'status-green',
  red: 'status-red',
}

export function StatusTag({ status, dot = true }: { status: string; dot?: boolean }): JSX.Element {
  const tone = getStatusTone(status)
  return (
    <span className={clsx('status-tag', TONE_CLASSES[tone])}>
      {dot && <span className="status-dot" />}
      {status}
    </span>
  )
}
