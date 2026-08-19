import type { Application, InterviewReview, WorkflowNode } from '@/types/application'
import { createId } from '@/utils/id'

function reviewHeading(application?: Application, node?: WorkflowNode): string {
  return application ? `${application.companyName} · ${application.positionName} · ${node?.name ?? '面试'}复盘` : '面试复盘'
}

export function createReviewTemplate(application?: Application, node?: WorkflowNode): string {
  const linkedDetails = application
    ? `- **公司：** ${application.companyName}\n- **岗位：** ${application.positionName}\n- **复盘节点：** ${node?.name ?? application.status}\n`
    : ''
  return `# ${reviewHeading(application, node)}

## 面试信息

${linkedDetails}- **日期：**
- **轮次：**
- **面试官：**
- **时长：**

## 问题记录

### 1. 问题标题

- **问题：**
- **我的回答：**
- **更好的回答：**

## 表现复盘

### 做得好的

-

### 可以改进的

-

## 知识点补充

在这里整理面试中暴露的知识盲区。

## 后续行动

- [ ] 补充知识点
- [ ] 整理高频问题
- [ ] 准备下一轮面试
`
}

export function createInterviewReview(application?: Application, node?: WorkflowNode): InterviewReview {
  const now = Date.now()
  return {
    id: createId(),
    applicationId: application?.id,
    workflowNodeId: node?.id,
    stageName: node?.name,
    title: application ? reviewHeading(application, node) : '未命名面试复盘',
    content: createReviewTemplate(application, node),
    createdAt: now,
    updatedAt: now,
  }
}
