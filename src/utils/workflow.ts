import type { Application, WorkflowNode } from '@/types/application'

export function findPreviousWorkflowNode(application: Application, workflowNodes: WorkflowNode[]): WorkflowNode | undefined {
  const currentIndex = workflowNodes.findIndex((node) => node.name === application.status)
  if (currentIndex <= 0) return undefined
  const experiencedNodeIds = new Set(application.nodeProgress.map((progress) => progress.workflowNodeId))
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    if (experiencedNodeIds.has(workflowNodes[index].id)) return workflowNodes[index]
  }
  return undefined
}

export function getCurrentNodeDateTime(application: Application, workflowNodes: WorkflowNode[]): string {
  const currentNode = workflowNodes.find((node) => node.name === application.status)
  const currentProgress = currentNode
    ? application.nodeProgress.find((progress) => progress.workflowNodeId === currentNode.id)
    : undefined
  if (currentProgress?.scheduledAt) return currentProgress.scheduledAt

  const currentHistory = [...application.histories].reverse().find((history) => history.status === application.status)
  if (currentHistory) return `${currentHistory.date}${currentHistory.time ? `T${currentHistory.time}` : ''}`
  return application.applicationDate
}
