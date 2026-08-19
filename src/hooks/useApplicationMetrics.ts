import { useMemo } from 'react'
import { CLOSED_STATUSES, INTERVIEW_STATUSES } from '@/constants/statuses'
import type { Application } from '@/types/application'
import { daysUntil, lastNDays, toDateInput } from '@/utils/date'

export function useApplicationMetrics(applications: Application[]) {
  return useMemo(() => {
    const total = applications.length
    const interviews = applications.filter((item) => INTERVIEW_STATUSES.includes(item.status)).length
    const offers = applications.filter((item) => item.status === 'Offer').length
    const closed = applications.filter((item) => ['已拒绝', '已结束'].includes(item.status)).length
    const reachedWritten = applications.filter((item) => item.histories.some((history) => history.status === '笔试')).length
    const reachedInterview = applications.filter((item) => item.histories.some((history) => INTERVIEW_STATUSES.includes(history.status))).length
    const upcomingDeadlines = applications
      .filter((item) => !CLOSED_STATUSES.includes(item.status))
      .map((item) => ({ application: item, days: daysUntil(item.deadline) }))
      .filter((item): item is { application: Application; days: number } => item.days !== null && item.days >= 0 && item.days <= 3)
      .sort((a, b) => a.days - b.days)
    const today = toDateInput()
    const todayEvents = applications
      .flatMap((application) =>
        application.histories
          .filter((history) => history.date === today && (history.time || INTERVIEW_STATUSES.includes(history.status) || history.status === '笔试'))
          .map((history) => ({ application, history })),
      )
      .sort((a, b) => (a.history.time || '23:59').localeCompare(b.history.time || '23:59'))
    const trend = lastNDays(30).map((date) => ({
      date,
      count: applications.filter((item) => item.applicationDate === date).length,
    }))
    return {
      total,
      interviews,
      offers,
      closed,
      reachedWritten,
      reachedInterview,
      writtenRate: total ? (reachedWritten / total) * 100 : 0,
      interviewRate: total ? (reachedInterview / total) * 100 : 0,
      offerRate: total ? (offers / total) * 100 : 0,
      upcomingDeadlines,
      todayEvents,
      trend,
    }
  }, [applications])
}
