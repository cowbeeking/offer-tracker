// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { deadlineLabel, daysUntil, formatChineseDate, formatShortDate, formatShortDateTime, isWithinDays, lastNDays } from '@/utils/date'
import { openExternalUrl } from '@/utils/external'
import { createKnowledgeNote, createKnowledgeTemplate } from '@/utils/knowledge'
import { readMarkdownFile } from '@/utils/markdownImport'
import { createInterviewReview, createReviewTemplate, createReviewTitle } from '@/utils/review'
import { findPreviousWorkflowNode, getCurrentNodeDateTime } from '@/utils/workflow'
import type { Application, WorkflowNode } from '@/types/application'

const nodes: WorkflowNode[] = [
  { id: 'a', name: '已投递', hasReview: false },
  { id: 'b', name: '一面', hasReview: true },
]
const application: Application = {
  id: 'app', companyName: '公司', positionName: '岗位', applicationDate: '2026-08-01', status: '一面',
  histories: [
    { id: 'h1', applicationId: 'app', status: '已投递', date: '2026-08-01', createdAt: 1 },
    { id: 'h2', applicationId: 'app', status: '一面', date: '2026-08-10', time: '09:00', createdAt: 2 },
  ],
  nodeProgress: [
    { workflowNodeId: 'a', state: 'completed', updatedAt: 1 },
    { workflowNodeId: 'b', scheduledAt: '2026-08-11T10:00', state: 'active', updatedAt: 2 },
  ],
  createdAt: 1, updatedAt: 2,
}

describe('content factories', () => {
  it('builds linked and unlinked review templates', () => {
    expect(createReviewTitle(application, nodes[1])).toBe('公司 · 岗位 · 一面复盘')
    expect(createReviewTitle()).toBe('面试复盘')
    expect(createReviewTemplate(application, nodes[1])).toContain('**复盘节点：** 一面')
    const linked = createInterviewReview(application, nodes[1])
    expect(linked).toMatchObject({ applicationId: 'app', workflowNodeId: 'b', stageName: '一面' })
    expect(createInterviewReview().title).toBe('未命名面试复盘')
  })

  it('builds knowledge note defaults', () => {
    expect(createKnowledgeTemplate()).toContain('## 核心概念')
    expect(createKnowledgeNote()).toMatchObject({ title: '未命名知识笔记' })
  })
})

describe('workflow utilities', () => {
  it('finds the previous experienced node and current scheduled time', () => {
    expect(findPreviousWorkflowNode(application, nodes)?.id).toBe('a')
    expect(getCurrentNodeDateTime(application, nodes)).toBe('2026-08-11T10:00')
  })

  it('falls back to history and application date', () => {
    expect(getCurrentNodeDateTime({ ...application, nodeProgress: [] }, nodes)).toBe('2026-08-10T09:00')
    expect(getCurrentNodeDateTime({ ...application, status: '未知', nodeProgress: [], histories: [] }, nodes)).toBe('2026-08-01')
    expect(findPreviousWorkflowNode({ ...application, status: '已投递' }, nodes)).toBeUndefined()
  })
})

describe('formatting and deadline utilities', () => {
  it('formats optional values', () => {
    expect(formatShortDate()).toBe('—')
    expect(formatShortDate('2026-08-20')).toBe('08-20')
    expect(formatShortDateTime('2026-08-20T09:05')).toBe('08-20 09:05')
    expect(formatChineseDate()).toBe('未设置')
    expect(formatChineseDate('2026-08-20')).toBe('8月20日')
  })

  it('calculates deadline labels relative to today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 20, 12))
    expect(daysUntil('2026-08-20')).toBe(0)
    expect(deadlineLabel('2026-08-20')?.label).toBe('今日截止')
    expect(deadlineLabel('2026-08-22')?.label).toBe('剩余 2 天')
    expect(deadlineLabel('2026-08-19')?.expired).toBe(true)
    expect(deadlineLabel()).toBeNull()
    expect(deadlineLabel('2026-08-30')?.urgent).toBe(false)
    expect(isWithinDays('2026-08-19', 2)).toBe(true)
    expect(lastNDays(3)).toEqual(['2026-08-18', '2026-08-19', '2026-08-20'])
    vi.useRealTimers()
  })
})

describe('Markdown import', () => {
  it('strips a BOM and derives a title', async () => {
    const file = { name: '  笔记.md', size: 8, text: async () => '\uFEFF# 内容' } as File
    const result = await readMarkdownFile(file, '后备')
    expect(result).toEqual({ title: '笔记', content: '# 内容' })
  })

  it('rejects unsupported and oversized files', async () => {
    await expect(readMarkdownFile({ name: 'note.txt', size: 1 } as File, '后备')).rejects.toThrow('请选择')
    const oversized = { name: 'note.md', size: 20 * 1024 * 1024 + 1 } as File
    await expect(readMarkdownFile(oversized, '后备')).rejects.toThrow('20 MB')
  })
})

describe('external links', () => {
  it('rejects invalid and unsafe protocols', async () => {
    expect(await openExternalUrl('not a url')).toBe(false)
    expect(await openExternalUrl('javascript:alert(1)')).toBe(false)
  })

  it('uses the desktop bridge when present', async () => {
    const openExternal = vi.fn().mockResolvedValue(true)
    Object.defineProperty(window, 'desktopApi', { configurable: true, value: { openExternal } })
    expect(await openExternalUrl('https://example.com/path')).toBe(true)
    expect(openExternal).toHaveBeenCalledWith('https://example.com/path')
    Object.defineProperty(window, 'desktopApi', { configurable: true, value: undefined })
  })
})
