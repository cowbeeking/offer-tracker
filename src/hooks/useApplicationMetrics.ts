import { useMemo } from 'react'
import { CLOSED_STATUSES, INTERVIEW_STATUSES } from '@/constants/statuses'
import type { Application, WorkflowNode } from '@/types/application'
import { daysUntil, lastNDays, toDateInput } from '@/utils/date'

export function useApplicationMetrics(applications: Application[], workflowNodes: WorkflowNode[] = []) {
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
        application.nodeProgress
          .filter((progress) => progress.state === 'active' && progress.scheduledAt?.slice(0, 10) === today)
          .flatMap((progress) => {
            const node = workflowNodes.find((item) => item.id === progress.workflowNodeId)
            return node ? [{ application, progress, node }] : []
          }),
      )
      .sort((a, b) => (a.progress.scheduledAt ?? '').localeCompare(b.progress.scheduledAt ?? ''))
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
  }, [applications, workflowNodes])
}
