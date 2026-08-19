import type { Application, InterviewReview } from '@/types/application'
import { createId } from '@/utils/id'

function reviewHeading(application?: Application): string {
  return application ? `${application.companyName} · ${application.positionName} 面试复盘` : '面试复盘'
}

export function createReviewTemplate(application?: Application): string {
  const linkedDetails = application
    ? `- **公司：** ${application.companyName}\n- **岗位：** ${application.positionName}\n- **当前阶段：** ${application.status}\n`
    : ''
  return `# ${reviewHeading(application)}

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

export function createInterviewReview(application?: Application): InterviewReview {
  const now = Date.now()
  return {
    id: createId(),
    applicationId: application?.id,
    title: application ? reviewHeading(application) : '未命名面试复盘',
    content: createReviewTemplate(application),
    createdAt: now,
    updatedAt: now,
  }
}
