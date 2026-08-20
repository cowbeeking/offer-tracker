import { describe, expect, it } from 'vitest'
import { appReducer, createEmptyState, normalizeApplications, normalizePreferenceOrders } from '@/domain/appState'
import type { AppStateData, Application, ApplicationDraft, InterviewReview, WorkflowNode } from '@/types/application'

const nodes: WorkflowNode[] = [
  { id: 'a', name: '已投递', hasReview: false },
  { id: 'b', name: '笔试', hasReview: true },
  { id: 'c', name: '一面', hasReview: true },
]

function application(overrides: Partial<Application> = {}): Application {
  return {
    id: 'app-1',
    companyName: '示例公司',
    positionName: '开发工程师',
    applicationDate: '2026-08-01',
    status: '笔试',
    histories: [
      { id: 'h1', applicationId: 'app-1', status: '已投递', date: '2026-08-01', createdAt: 1 },
      { id: 'h2', applicationId: 'app-1', status: '笔试', date: '2026-08-10', time: '09:00', createdAt: 2 },
    ],
    nodeProgress: [
      { workflowNodeId: 'a', state: 'completed', updatedAt: 1 },
      { workflowNodeId: 'b', scheduledAt: '2026-08-10T09:00', state: 'active', reminderMinutesBefore: 30, updatedAt: 2 },
    ],
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  }
}

function review(overrides: Partial<InterviewReview> = {}): InterviewReview {
  return {
    id: 'review-1',
    applicationId: 'app-1',
    workflowNodeId: 'b',
    stageName: '笔试',
    title: '复盘',
    content: '内容',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

function state(app = application(), reviews = [review()]): AppStateData {
  return { ...createEmptyState(), workflowNodes: nodes, applications: [app], reviews, initialized: true }
}

function draft(status = '一面'): ApplicationDraft {
  return {
    companyName: ' 更新公司 ', positionName: ' 新岗位 ', preferenceOrder: '2', applicationDate: '2026-08-02', deadline: '', status,
    location: '', source: '', jobType: '', link: '', salary: '', notes: '', eventDate: '2026-08-20', eventTime: '10:30',
  }
}

describe('appReducer workflow invariants', () => {
  it('only allows forward status transitions and completes the previous reminder', () => {
    const unchanged = appReducer(state(), { type: 'UPDATE_STATUS', id: 'app-1', status: '已投递' })
    expect(unchanged.applications[0].status).toBe('笔试')

    const moved = appReducer(state(), { type: 'UPDATE_STATUS', id: 'app-1', status: '一面', event: { date: '2026-08-20', time: '10:30' } })
    expect(moved.applications[0].status).toBe('一面')
    expect(moved.applications[0].nodeProgress).toEqual(expect.arrayContaining([
      expect.objectContaining({ workflowNodeId: 'b', state: 'completed', reminderMinutesBefore: undefined }),
      expect.objectContaining({ workflowNodeId: 'c', state: 'active', scheduledAt: '2026-08-20T10:30' }),
    ]))
  })

  it('does not let the edit form bypass board-only workflow changes', () => {
    const updated = appReducer(state(), { type: 'UPDATE_APPLICATION', id: 'app-1', draft: draft('一面') })
    expect(updated.applications[0]).toMatchObject({ status: '笔试', companyName: '更新公司', positionName: '新岗位', preferenceOrder: 1 })
    expect(updated.applications[0].histories).toHaveLength(2)
  })

  it('undoes monotonically without cycling and removes later reviews', () => {
    const atInterview = appReducer(state(), { type: 'UPDATE_STATUS', id: 'app-1', status: '一面', event: { date: '2026-08-20', time: '10:30' } })
    const withReview = { ...atInterview, reviews: [...atInterview.reviews, review({ id: 'review-2', workflowNodeId: 'c', stageName: '一面' })] }
    const firstUndo = appReducer(withReview, { type: 'UNDO_STATUS', id: 'app-1' })
    expect(firstUndo.applications[0].status).toBe('笔试')
    expect(firstUndo.reviews.map((item) => item.id)).not.toContain('review-2')
    const secondUndo = appReducer(firstUndo, { type: 'UNDO_STATUS', id: 'app-1' })
    expect(secondUndo.applications[0].status).toBe('已投递')
    const thirdUndo = appReducer(secondUndo, { type: 'UNDO_STATUS', id: 'app-1' })
    expect(thirdUndo).toBe(secondUndo)
  })

  it('uses application history rather than a later global reorder when undoing', () => {
    const atInterview = appReducer(state(), { type: 'UPDATE_STATUS', id: 'app-1', status: '一面', event: { date: '2026-08-20', time: '10:30' } })
    const reordered = { ...atInterview, workflowNodes: [nodes[2], nodes[0], nodes[1]] }
    const undone = appReducer(reordered, { type: 'UNDO_STATUS', id: 'app-1' })
    expect(undone.applications[0].status).toBe('笔试')
  })

  it('updates a node time and its latest matching history together', () => {
    const updated = appReducer(state(), {
      type: 'SET_NODE_PROGRESS', applicationId: 'app-1', node: nodes[1], changes: { scheduledAt: '2026-08-12T14:20' },
    })
    expect(updated.applications[0].histories[1]).toMatchObject({ date: '2026-08-12', time: '14:20' })
    expect(updated.applications[0].nodeProgress[1]).toMatchObject({ scheduledAt: '2026-08-12T14:20', reminderSentAt: undefined })
  })
})

describe('appReducer relationship integrity', () => {
  it('supports explicitly unlinking a review', () => {
    const next = appReducer(state(), { type: 'UPDATE_REVIEW', id: 'review-1', changes: { applicationId: undefined } })
    expect(next.reviews[0]).toMatchObject({ applicationId: undefined, workflowNodeId: undefined, stageName: undefined })
  })

  it('does not link a review to a workflow node the application has not reached', () => {
    const next = appReducer(state(), {
      type: 'UPDATE_REVIEW',
      id: 'review-1',
      changes: { workflowNodeId: 'c', stageName: '一面' },
    })

    expect(next.reviews[0]).toMatchObject({ applicationId: 'app-1', workflowNodeId: undefined, stageName: undefined })
  })

  it('preserves notes but fully unlinks them when an application is deleted', () => {
    const next = appReducer(state(), { type: 'DELETE_APPLICATION', id: 'app-1' })
    expect(next.applications).toHaveLength(0)
    expect(next.reviews[0]).toMatchObject({ applicationId: undefined, workflowNodeId: undefined, stageName: undefined, content: '内容' })
  })

  it('unlinks reviews belonging to removed demo data', () => {
    const next = appReducer(state(application({ isDemo: true })), { type: 'REMOVE_DEMO' })
    expect(next.applications).toHaveLength(0)
    expect(next.reviews[0].applicationId).toBeUndefined()
  })

  it('normalizes duplicate progress and enforces exactly one current active node', () => {
    const normalized = normalizeApplications([application({
      nodeProgress: [
        { workflowNodeId: 'a', state: 'active', updatedAt: 1 },
        { workflowNodeId: 'b', state: 'completed', updatedAt: 1 },
        { workflowNodeId: 'b', state: 'active', updatedAt: 3 },
      ],
    })], nodes)[0]
    expect(normalized.nodeProgress).toHaveLength(2)
    expect(normalized.nodeProgress.filter((item) => item.state === 'active')).toEqual([expect.objectContaining({ workflowNodeId: 'b' })])
  })
})

describe('application preference invariants', () => {
  it('assigns an appended preference after the current company maximum', () => {
    const current = {
      ...state(),
      applications: [
        application({ id: 'first', preferenceOrder: 1, createdAt: 1 }),
        application({ id: 'second', positionName: '算法工程师', preferenceOrder: 2, createdAt: 2 }),
      ],
    }
    const appendedDraft = {
      ...draft('已投递'),
      companyName: '示例公司',
      positionName: '测试工程师',
      preferenceOrder: '2',
    }
    const next = appReducer(current, { type: 'ADD_APPLICATION', draft: appendedDraft })

    expect(next.applications.find((item) => item.positionName === '测试工程师')?.preferenceOrder).toBe(3)
  })

  it('repairs duplicate and gapped preference orders per company', () => {
    const normalized = normalizePreferenceOrders([
      application({ id: 'first', preferenceOrder: 1, createdAt: 1 }),
      application({ id: 'second', positionName: '算法工程师', preferenceOrder: 2, createdAt: 2 }),
      application({ id: 'third', positionName: '测试工程师', preferenceOrder: 2, createdAt: 3 }),
      application({ id: 'other', companyName: '另一家公司', preferenceOrder: 4, createdAt: 4 }),
    ])

    expect(normalized.map((item) => item.preferenceOrder)).toEqual([1, 2, 3, 1])
  })

  it('closes the numbering gap after deleting a preference', () => {
    const withPreferences = {
      ...state(),
      applications: [
        application({ id: 'first', preferenceOrder: 1, createdAt: 1 }),
        application({ id: 'second', preferenceOrder: 2, createdAt: 2 }),
        application({ id: 'third', preferenceOrder: 3, createdAt: 3 }),
      ],
    }
    const next = appReducer(withPreferences, { type: 'DELETE_APPLICATION', id: 'second' })

    expect(next.applications.map((item) => item.preferenceOrder)).toEqual([1, 2])
  })
})
