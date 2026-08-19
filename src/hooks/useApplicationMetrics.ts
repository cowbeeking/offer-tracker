import { useMemo } from 'react'
import { INTERVIEW_STATUSES } from '@/constants/statuses'
import type { Application, WorkflowNode } from '@/types/application'
import { daysUntil, lastNDays, toDateInput } from '@/utils/date'

export function useApplicationMetrics(applications: Application[], workflowNodes: WorkflowNode[] = []) {
  return useMemo(() => {
    const total = applications.length
    const terminalStatuses = new Set(workflowNodes.filter((node) => node.isTerminal).map((node) => node.name))
    const configuredReviewStatuses = workflowNodes.filter((node) => node.hasReview).map((node) => node.name)
    const writtenStatuses = new Set(['笔试', ...configuredReviewStatuses.filter((status) => /(笔试|测评|机试)/.test(status))])
    const interviewStatusNames = configuredReviewStatuses.filter((status) => !writtenStatuses.has(status))
    const effectiveInterviewStatuses = interviewStatusNames.length ? interviewStatusNames : [...INTERVIEW_STATUSES]
    const interviews = applications.filter((item) => effectiveInterviewStatuses.includes(item.status)).length
    const offers = applications.filter((item) => item.status === 'Offer').length
    const closed = applications.filter((item) => terminalStatuses.has(item.status)).length
    const reachedWritten = applications.filter((item) => item.histories.some((history) => writtenStatuses.has(history.status))).length
    const reachedInterview = applications.filter((item) => item.histories.some((history) => effectiveInterviewStatuses.includes(history.status))).length
    const upcomingDeadlines = applications
      .filter((item) => !terminalStatuses.has(item.status) && item.status !== 'Offer')
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
      interviewStatusNames: effectiveInterviewStatuses,
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
