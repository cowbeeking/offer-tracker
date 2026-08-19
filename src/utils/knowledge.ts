import type { KnowledgeNote } from '@/types/application'
import { createId } from '@/utils/id'

export function createKnowledgeTemplate(): string {
  return `# 知识笔记

> 用一句话概括这篇笔记解决的问题。

## 核心概念

-

## 原理与细节

在这里整理概念、原理、推导或代码示例。

## 示例

\`\`\`

\`\`\`

## 易错点

-

## 延伸阅读

- [ ]
`
}

export function createKnowledgeNote(): KnowledgeNote {
  const now = Date.now()
  return {
    id: createId(),
    title: '未命名知识笔记',
    content: createKnowledgeTemplate(),
    createdAt: now,
    updatedAt: now,
  }
}
