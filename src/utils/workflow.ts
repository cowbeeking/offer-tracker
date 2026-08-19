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
