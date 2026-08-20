import type { Application, WorkflowNode } from '@/types/application'

export function findPreviousWorkflowNode(application: Application, workflowNodes: WorkflowNode[]): WorkflowNode | undefined {
  const experiencedNodeIds = new Set(application.nodeProgress.map((progress) => progress.workflowNodeId))
  const currentHistoryIndex = application.histories.map((history) => history.status).lastIndexOf(application.status)
  for (let index = currentHistoryIndex - 1; index >= 0; index -= 1) {
    const node = workflowNodes.find((item) => item.name === application.histories[index].status)
    if (node && experiencedNodeIds.has(node.id)) return node
  }
  return application.nodeProgress
    .filter((progress) => progress.state === 'completed')
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .flatMap((progress) => workflowNodes.filter((node) => node.id === progress.workflowNodeId && node.name !== application.status))[0]
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
