import { DEFAULT_WORKFLOW_NODES } from '@/types/application'
import type {
  AppStateData,
  Application,
  ApplicationDraft,
  ApplicationNodeProgress,
  ApplicationStatus,
  InterviewReview,
  KnowledgeNote,
  StatusHistory,
  ThemeMode,
  WorkflowNode,
} from '@/types/application'
import { isValidLocalDateTime, toDateInput } from '@/utils/date'
import { createId } from '@/utils/id'
import { findPreviousWorkflowNode } from '@/utils/workflow'

export type AppAction =
  | { type: 'LOAD'; state: AppStateData }
  | { type: 'ADD_APPLICATION'; draft: ApplicationDraft }
  | { type: 'UPDATE_APPLICATION'; id: string; draft: ApplicationDraft }
  | { type: 'DELETE_APPLICATION'; id: string }
  | { type: 'ADD_REVIEW'; review: InterviewReview }
  | { type: 'UPDATE_REVIEW'; id: string; changes: Partial<Pick<InterviewReview, 'applicationId' | 'workflowNodeId' | 'stageName' | 'title' | 'content'>> }
  | { type: 'DELETE_REVIEW'; id: string }
  | { type: 'ADD_KNOWLEDGE_NOTE'; note: KnowledgeNote }
  | { type: 'UPDATE_KNOWLEDGE_NOTE'; id: string; changes: Partial<Pick<KnowledgeNote, 'title' | 'content'>> }
  | { type: 'DELETE_KNOWLEDGE_NOTE'; id: string }
  | { type: 'UPDATE_STATUS'; id: string; status: ApplicationStatus; event?: { date?: string; time?: string; note?: string } }
  | { type: 'UNDO_STATUS'; id: string }
  | { type: 'REPLACE_DATA'; data: AppStateData }
  | { type: 'CLEAR_DATA' }
  | { type: 'REMOVE_DEMO' }
  | { type: 'SET_THEME'; theme: ThemeMode }
  | { type: 'SET_WORKFLOW_NODES'; nodes: WorkflowNode[] }
  | { type: 'SET_NODE_PROGRESS'; applicationId: string; node: WorkflowNode; changes: Partial<Omit<ApplicationNodeProgress, 'workflowNodeId' | 'updatedAt'>> }

export function createEmptyState(): AppStateData {
  return {
    version: 1,
    applications: [],
    reviews: [],
    knowledgeNotes: [],
    workflowNodes: DEFAULT_WORKFLOW_NODES.map((node) => ({ ...node })),
    theme: 'system',
    initialized: false,
  }
}

function createHistory(applicationId: string, status: ApplicationStatus, date: string, time?: string, note?: string): StatusHistory {
  return {
    id: createId(),
    applicationId,
    status,
    date,
    time: time || undefined,
    note: note?.trim() || undefined,
    createdAt: Date.now(),
  }
}

function applicationFromDraft(draft: ApplicationDraft, nodes: WorkflowNode[]): Application {
  const id = createId()
  const now = Date.now()
  const currentNode = nodes.find((node) => node.name === draft.status) ?? nodes[0]
  const status = currentNode?.name ?? draft.status
  const scheduledAt = draft.eventDate && draft.eventTime ? `${draft.eventDate}T${draft.eventTime}` : undefined
  return {
    id,
    companyName: draft.companyName.trim(),
    positionName: draft.positionName.trim(),
    preferenceOrder: draft.preferenceOrder ? Number(draft.preferenceOrder) : undefined,
    applicationDate: draft.applicationDate,
    deadline: draft.deadline || undefined,
    status,
    location: draft.location.trim() || undefined,
    source: draft.source.trim() || undefined,
    jobType: draft.jobType.trim() || undefined,
    link: draft.link.trim() || undefined,
    salary: draft.salary.trim() || undefined,
    notes: draft.notes.trim() || undefined,
    histories: [createHistory(id, status, draft.eventDate || draft.applicationDate, draft.eventTime, status === '已投递' ? '新增投递记录' : `当前阶段：${status}`)],
    nodeProgress: currentNode ? [{ workflowNodeId: currentNode.id, scheduledAt, state: 'active', updatedAt: now }] : [],
    createdAt: now,
    updatedAt: now,
  }
}

export function normalizeWorkflowNodes(state: Partial<AppStateData>): WorkflowNode[] {
  const savedNodes = Array.isArray(state.workflowNodes) ? state.workflowNodes : []
  const legacyStatuses = Array.isArray(state.customStatuses) ? state.customStatuses : []
  const source: WorkflowNode[] = savedNodes.length
    ? savedNodes
    : [...DEFAULT_WORKFLOW_NODES, ...legacyStatuses.map((name) => ({ id: createId(), name, hasReview: false }))]
  const names = new Set<string>()
  const ids = new Set<string>()
  const nodes = source.flatMap((node) => {
    if (!node || typeof node.name !== 'string' || !node.name.trim()) return []
    const name = node.name.trim()
    if (names.has(name)) return []
    names.add(name)
    const requestedId = typeof node.id === 'string' && node.id.trim() ? node.id.trim() : createId()
    const id = ids.has(requestedId) ? createId() : requestedId
    ids.add(id)
    return [{ id, name, hasReview: Boolean(node.hasReview), isTerminal: Boolean(node.isTerminal) }]
  })
  return nodes.length ? nodes : DEFAULT_WORKFLOW_NODES.map((node) => ({ ...node }))
}

export function normalizeApplications(applications: Application[], nodes: WorkflowNode[]): Application[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const nodeByName = new Map(nodes.map((node) => [node.name, node]))
  const nodeOrder = new Map(nodes.map((node, index) => [node.id, index]))
  return applications.map((application) => {
    const currentNode = nodeByName.get(application.status) ?? nodes[0]
    const status = currentNode?.name ?? application.status
    const byNode = new Map<string, ApplicationNodeProgress>()
    const saved = Array.isArray(application.nodeProgress) ? application.nodeProgress : []
    saved.forEach((progress) => {
      if (!progress || !nodeById.has(progress.workflowNodeId)) return
      const previous = byNode.get(progress.workflowNodeId)
      if (!previous || progress.updatedAt >= previous.updatedAt) byNode.set(progress.workflowNodeId, { ...progress })
    })
    if (!byNode.size) {
      application.histories.forEach((history) => {
        const node = nodeByName.get(history.status)
        if (!node) return
        byNode.set(node.id, {
          workflowNodeId: node.id,
          scheduledAt: history.time ? `${history.date}T${history.time}` : undefined,
          state: node.id === currentNode?.id ? 'active' : 'completed',
          updatedAt: history.createdAt,
        })
      })
    }
    if (currentNode && !byNode.has(currentNode.id)) {
      byNode.set(currentNode.id, { workflowNodeId: currentNode.id, state: 'active', updatedAt: application.updatedAt })
    }
    const nodeProgress = [...byNode.values()]
      .map((progress) => progress.workflowNodeId === currentNode?.id
        ? { ...progress, state: 'active' as const }
        : { ...progress, state: 'completed' as const, reminderMinutesBefore: undefined, reminderSentAt: undefined })
      .sort((a, b) => (nodeOrder.get(a.workflowNodeId) ?? Number.MAX_SAFE_INTEGER) - (nodeOrder.get(b.workflowNodeId) ?? Number.MAX_SAFE_INTEGER))
    return { ...application, status, nodeProgress }
  })
}

export function uniqueReviewLinks(reviews: InterviewReview[], applications: Application[], nodes: WorkflowNode[]): InterviewReview[] {
  const applicationById = new Map(applications.map((application) => [application.id, application]))
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const linkedNodes = new Set<string>()
  return reviews.map((review) => {
    const application = review.applicationId ? applicationById.get(review.applicationId) : undefined
    if (review.applicationId && !application) {
      return { ...review, applicationId: undefined, workflowNodeId: undefined, stageName: undefined }
    }
    const validSavedNode = review.workflowNodeId && nodeById.get(review.workflowNodeId)?.hasReview ? nodeById.get(review.workflowNodeId) : undefined
    const inferredNode = !validSavedNode && application
      ? nodes.find((node) => node.hasReview && (
          node.name === review.stageName ||
          node.name === application.status ||
          review.title.includes(node.name) ||
          review.content.includes(`**当前阶段：** ${node.name}`) ||
          review.content.includes(`**复盘节点：** ${node.name}`)
        )) ?? [...application.histories].reverse().flatMap((history) => nodes.filter((node) => node.hasReview && node.name === history.status))[0]
      : undefined
    const workflowNodeId = validSavedNode?.id ?? inferredNode?.id
    const stageName = workflowNodeId ? (nodeById.get(workflowNodeId)?.name ?? review.stageName) : undefined
    if (!application || !workflowNodeId) return { ...review, applicationId: application?.id, workflowNodeId: undefined, stageName: undefined }
    const key = `${application.id}:${workflowNodeId}`
    if (linkedNodes.has(key)) return { ...review, applicationId: undefined, workflowNodeId: undefined, stageName: undefined }
    linkedNodes.add(key)
    return { ...review, applicationId: application.id, workflowNodeId, stageName }
  })
}

function normalizeState(data: AppStateData): AppStateData {
  const workflowNodes = normalizeWorkflowNodes(data)
  const applications = normalizeApplications(data.applications ?? [], workflowNodes)
  return {
    ...createEmptyState(),
    ...data,
    applications,
    reviews: uniqueReviewLinks(data.reviews ?? [], applications, workflowNodes),
    knowledgeNotes: data.knowledgeNotes ?? [],
    workflowNodes,
    customStatuses: undefined,
    initialized: true,
  }
}

function updateApplicationFields(application: Application, draft: ApplicationDraft): Application {
  return {
    ...application,
    companyName: draft.companyName.trim(),
    positionName: draft.positionName.trim(),
    preferenceOrder: draft.preferenceOrder ? Number(draft.preferenceOrder) : undefined,
    applicationDate: draft.applicationDate,
    deadline: draft.deadline || undefined,
    location: draft.location.trim() || undefined,
    source: draft.source.trim() || undefined,
    jobType: draft.jobType.trim() || undefined,
    link: draft.link.trim() || undefined,
    salary: draft.salary.trim() || undefined,
    notes: draft.notes.trim() || undefined,
    isDemo: false,
    updatedAt: Date.now(),
  }
}

function updateLatestHistoryTime(histories: StatusHistory[], status: string, scheduledAt?: string): StatusHistory[] {
  if (!scheduledAt) return histories
  const index = histories.map((history) => history.status).lastIndexOf(status)
  if (index < 0) return histories
  return histories.map((history, historyIndex) => historyIndex === index
    ? { ...history, date: scheduledAt.slice(0, 10), time: scheduledAt.slice(11, 16) || undefined }
    : history)
}

export function appReducer(state: AppStateData, action: AppAction): AppStateData {
  switch (action.type) {
    case 'LOAD':
    case 'REPLACE_DATA':
      return normalizeState(action.type === 'LOAD' ? action.state : action.data)
    case 'ADD_APPLICATION':
      return { ...state, applications: [applicationFromDraft(action.draft, state.workflowNodes), ...state.applications] }
    case 'UPDATE_APPLICATION':
      return { ...state, applications: state.applications.map((application) => application.id === action.id ? updateApplicationFields(application, action.draft) : application) }
    case 'DELETE_APPLICATION':
      return {
        ...state,
        applications: state.applications.filter(({ id }) => id !== action.id),
        reviews: state.reviews.map((review) => review.applicationId === action.id
          ? { ...review, applicationId: undefined, workflowNodeId: undefined, stageName: undefined, updatedAt: Date.now() }
          : review),
      }
    case 'ADD_REVIEW': {
      const linked = action.review.applicationId && action.review.workflowNodeId
      if (linked && state.reviews.some((review) => review.applicationId === action.review.applicationId && review.workflowNodeId === action.review.workflowNodeId)) return state
      return { ...state, reviews: [action.review, ...state.reviews] }
    }
    case 'UPDATE_REVIEW': {
      const current = state.reviews.find((review) => review.id === action.id)
      if (!current) return state
      const hasApplication = Object.prototype.hasOwnProperty.call(action.changes, 'applicationId')
      const hasNode = Object.prototype.hasOwnProperty.call(action.changes, 'workflowNodeId')
      const applicationId = hasApplication ? action.changes.applicationId : current.applicationId
      const requestedNodeId = hasNode ? action.changes.workflowNodeId : current.workflowNodeId
      const workflowNodeId = applicationId ? requestedNodeId : undefined
      const node = workflowNodeId ? state.workflowNodes.find((item) => item.id === workflowNodeId && item.hasReview) : undefined
      const normalizedNodeId = node?.id
      if (applicationId && normalizedNodeId && state.reviews.some((review) => review.id !== action.id && review.applicationId === applicationId && review.workflowNodeId === normalizedNodeId)) return state
      const changes = {
        ...action.changes,
        applicationId,
        workflowNodeId: normalizedNodeId,
        stageName: normalizedNodeId ? (action.changes.stageName ?? node?.name) : undefined,
      }
      return { ...state, reviews: state.reviews.map((review) => review.id === action.id ? { ...review, ...changes, updatedAt: Date.now() } : review) }
    }
    case 'DELETE_REVIEW':
      return { ...state, reviews: state.reviews.filter(({ id }) => id !== action.id) }
    case 'ADD_KNOWLEDGE_NOTE':
      return { ...state, knowledgeNotes: [action.note, ...state.knowledgeNotes] }
    case 'UPDATE_KNOWLEDGE_NOTE':
      return { ...state, knowledgeNotes: state.knowledgeNotes.map((note) => note.id === action.id ? { ...note, ...action.changes, updatedAt: Date.now() } : note) }
    case 'DELETE_KNOWLEDGE_NOTE':
      return { ...state, knowledgeNotes: state.knowledgeNotes.filter(({ id }) => id !== action.id) }
    case 'UPDATE_STATUS':
      return {
        ...state,
        applications: state.applications.map((application) => {
          if (application.id !== action.id || application.status === action.status) return application
          const currentIndex = state.workflowNodes.findIndex((node) => node.name === application.status)
          const targetIndex = state.workflowNodes.findIndex((node) => node.name === action.status)
          const targetNode = state.workflowNodes[targetIndex]
          if (currentIndex < 0 || targetIndex <= currentIndex || application.nodeProgress.some((progress) => progress.workflowNodeId === targetNode?.id)) return application
          const now = Date.now()
          const scheduledAt = action.event?.date && action.event.time ? `${action.event.date}T${action.event.time}` : undefined
          const existingTarget = application.nodeProgress.find((progress) => progress.workflowNodeId === targetNode.id)
          const nodeProgress = application.nodeProgress
            .filter((progress) => progress.workflowNodeId !== targetNode.id)
            .map((progress) => progress.state === 'active'
              ? { ...progress, state: 'completed' as const, reminderMinutesBefore: undefined, reminderSentAt: undefined, updatedAt: now }
              : progress)
            .concat({ ...existingTarget, workflowNodeId: targetNode.id, scheduledAt: scheduledAt ?? existingTarget?.scheduledAt, state: 'active', reminderSentAt: undefined, updatedAt: now })
          return {
            ...application,
            status: targetNode.name,
            histories: [...application.histories, createHistory(application.id, targetNode.name, action.event?.date || toDateInput(), action.event?.time, action.event?.note || `状态由${application.status}更新为${targetNode.name}`)],
            nodeProgress,
            isDemo: false,
            updatedAt: now,
          }
        }),
      }
    case 'UNDO_STATUS': {
      const application = state.applications.find((item) => item.id === action.id)
      if (!application) return state
      const previousNode = findPreviousWorkflowNode(application, state.workflowNodes)
      if (!previousNode) return state
      const historyCutoff = application.histories.map((history) => history.status).lastIndexOf(previousNode.name)
      const retainedHistories = historyCutoff >= 0 ? application.histories.slice(0, historyCutoff + 1) : application.histories
      const retainedStatusNames = new Set(retainedHistories.map((history) => history.status))
      const retainedNodeIds = new Set(state.workflowNodes.filter((node) => retainedStatusNames.has(node.name)).map((node) => node.id))
      retainedNodeIds.add(previousNode.id)
      const now = Date.now()
      return {
        ...state,
        applications: state.applications.map((item) => item.id !== action.id ? item : {
          ...item,
          status: previousNode.name,
          histories: retainedHistories,
          nodeProgress: item.nodeProgress
            .filter((progress) => retainedNodeIds.has(progress.workflowNodeId))
            .map((progress) => progress.workflowNodeId === previousNode.id
              ? { ...progress, state: 'active' as const, reminderSentAt: undefined, updatedAt: now }
              : { ...progress, state: 'completed' as const, reminderMinutesBefore: undefined, reminderSentAt: undefined }),
          isDemo: false,
          updatedAt: now,
        }),
        reviews: state.reviews.filter((review) => review.applicationId !== action.id || !review.workflowNodeId || retainedNodeIds.has(review.workflowNodeId)),
      }
    }
    case 'CLEAR_DATA':
      return { ...state, applications: [], reviews: [], knowledgeNotes: [] }
    case 'REMOVE_DEMO': {
      const demoIds = new Set(state.applications.filter(({ isDemo }) => isDemo).map(({ id }) => id))
      return {
        ...state,
        applications: state.applications.filter(({ isDemo }) => !isDemo),
        reviews: state.reviews.map((review) => review.applicationId && demoIds.has(review.applicationId)
          ? { ...review, applicationId: undefined, workflowNodeId: undefined, stageName: undefined, updatedAt: Date.now() }
          : review),
      }
    }
    case 'SET_THEME':
      return { ...state, theme: action.theme }
    case 'SET_WORKFLOW_NODES':
      return { ...state, workflowNodes: normalizeWorkflowNodes({ workflowNodes: action.nodes }) }
    case 'SET_NODE_PROGRESS':
      return {
        ...state,
        applications: state.applications.map((application) => {
          if (application.id !== action.applicationId) return application
          const current = application.nodeProgress.find((progress) => progress.workflowNodeId === action.node.id)
          if (!current) return application
          const now = Date.now()
          const scheduleChanged = Object.prototype.hasOwnProperty.call(action.changes, 'scheduledAt')
          const reminderChanged = Object.prototype.hasOwnProperty.call(action.changes, 'reminderMinutesBefore')
          const isCurrentNode = application.status === action.node.name
          const requestedSchedule = action.changes.scheduledAt
          const scheduledAt = scheduleChanged
            ? (!requestedSchedule || (isValidLocalDateTime(requestedSchedule) && requestedSchedule.slice(0, 10) >= application.applicationDate) ? requestedSchedule : current.scheduledAt)
            : current.scheduledAt
          const requestedReminder = action.changes.reminderMinutesBefore
          const reminderMinutesBefore = requestedReminder === undefined
            ? undefined
            : Number.isInteger(requestedReminder) && requestedReminder >= 0 && requestedReminder <= 525600 ? requestedReminder : current.reminderMinutesBefore
          const nextProgress: ApplicationNodeProgress = {
            ...current,
            scheduledAt,
            reminderMinutesBefore: isCurrentNode && reminderChanged ? reminderMinutesBefore : isCurrentNode ? current.reminderMinutesBefore : undefined,
            reminderSentAt: scheduleChanged || reminderChanged ? undefined : current.reminderSentAt,
            state: isCurrentNode ? 'active' : 'completed',
            updatedAt: now,
          }
          return {
            ...application,
            nodeProgress: application.nodeProgress.map((progress) => progress.workflowNodeId === action.node.id ? nextProgress : progress),
            histories: scheduleChanged ? updateLatestHistoryTime(application.histories, action.node.name, nextProgress.scheduledAt) : application.histories,
            isDemo: false,
            updatedAt: now,
          }
        }),
      }
    default:
      return state
  }
}
