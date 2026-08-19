const DAY_MS = 24 * 60 * 60 * 1000

export function toDateInput(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatShortDate(value?: string): string {
  if (!value) return '—'
  const [, month, day] = value.split('-')
  return `${month}-${day}`
}

export function formatShortDateTime(value?: string): string {
  if (!value) return '—'
  const [date, time] = value.split('T')
  return `${formatShortDate(date)}${time ? ` ${time.slice(0, 5)}` : ''}`
}

export function formatChineseDate(value?: string): string {
  if (!value) return '未设置'
  const date = parseLocalDate(value)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function startOfToday(): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

export function daysUntil(value?: string): number | null {
  if (!value) return null
  return Math.round((parseLocalDate(value).getTime() - startOfToday().getTime()) / DAY_MS)
}

export function deadlineLabel(value?: string): { label: string; urgent: boolean; expired: boolean } | null {
  const days = daysUntil(value)
  if (days === null) return null
  if (days < 0) return { label: '已截止', urgent: true, expired: true }
  if (days === 0) return { label: '今日截止', urgent: true, expired: false }
  if (days <= 3) return { label: `剩余 ${days} 天`, urgent: true, expired: false }
  return { label: formatShortDate(value), urgent: false, expired: false }
}

export function isWithinDays(value: string, days: number): boolean {
  const diff = (startOfToday().getTime() - parseLocalDate(value).getTime()) / DAY_MS
  return diff >= 0 && diff < days
}

export function lastNDays(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (count - index - 1))
    return toDateInput(date)
  })
}
