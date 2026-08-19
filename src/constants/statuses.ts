import type { ApplicationStatus } from '@/types/application'

export const INTERVIEW_STATUSES = ['一面', '二面', '三面', 'HR面']
export const REVIEWABLE_STATUSES = ['笔试', ...INTERVIEW_STATUSES]
export const ACTIVE_STATUSES = ['已投递', '笔试', ...INTERVIEW_STATUSES]
export const CLOSED_STATUSES = ['Offer', '已拒绝', '已结束']

export type StatusTone = 'slate' | 'blue' | 'purple' | 'orange' | 'green' | 'red'

export function getStatusTone(status: ApplicationStatus): StatusTone {
  if (status === 'Offer') return 'green'
  if (status === '已拒绝' || status === '已结束') return 'red'
  if (INTERVIEW_STATUSES.includes(status)) return 'orange'
  if (status === '笔试') return 'purple'
  if (status === '已投递') return 'blue'
  return 'slate'
}
