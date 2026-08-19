/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { createDemoApplications } from '@/constants/demo'
import { DEFAULT_WORKFLOW_NODES } from '@/types/application'
import type {
  AppStateData,
  Application,
  ApplicationDraft,
  ApplicationNodeProgress,
  ApplicationStatus,
  InterviewReview,
  KnowledgeNote,
  PersistenceStatus,
  StatusHistory,
  ThemeMode,
  WorkflowNode,
} from '@/types/application'
import { loadState, saveState } from '@/services/storage'
import { toDateInput } from '@/utils/date'
import { createId } from '@/utils/id'

const EMPTY_STATE: AppStateData = {
  version: 1,
  applications: [],
  reviews: [],
  knowledgeNotes: [],
  workflowNodes: DEFAULT_WORKFLOW_NODES,
  theme: 'system',
  initialized: false,
}

type Action =
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
  | {
      type: 'UPDATE_STATUS'
      id: string
      status: ApplicationStatus
      event?: { date?: string; time?: string; note?: string }
    }
  | { type: 'UNDO_STATUS'; id: string }
  | { type: 'REPLACE_DATA'; data: AppStateData }
  | { type: 'CLEAR_DATA' }
  | { type: 'REMOVE_DEMO' }
  | { type: 'SET_THEME'; theme: ThemeMode }
  | { type: 'SET_WORKFLOW_NODES'; nodes: WorkflowNode[] }
  | { type: 'SET_NODE_PROGRESS'; applicationId: string; node: WorkflowNode; changes: Partial<Omit<ApplicationNodeProgress, 'workflowNodeId' | 'updatedAt'>> }

function createHistory(
  applicationId: string,
  status: ApplicationStatus,
  date: string,
  time?: string,
  note?: string,
): StatusHistory {
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
  const currentNode = nodes.find((node) => node.name === draft.status)
  return {
    id,
    companyName: draft.companyName.trim(),
    positionName: draft.positionName.trim(),
    preferenceOrder: draft.preferenceOrder ? Number(draft.preferenceOrder) : undefined,
    applicationDate: draft.applicationDate,
    deadline: draft.deadline || undefined,
    status: draft.status,
    location: draft.location.trim() || undefined,
    source: draft.source.trim() || undefined,
    jobType: draft.jobType.trim() || undefined,
    link: draft.link.trim() || undefined,
    salary: draft.salary.trim() || undefined,
    notes: draft.notes.trim() || undefined,
    histories: [
      createHistory(
        id,
        draft.status,
        draft.eventDate || draft.applicationDate,
        draft.eventTime,
        draft.status === '已投递' ? '新增投递记录' : `当前阶段：${draft.status}`,
      ),
    ],
    nodeProgress: currentNode ? [{
      workflowNodeId: currentNode.id,
      scheduledAt: draft.eventDate && draft.eventTime ? `${draft.eventDate}T${draft.eventTime}` : undefined,
      state: 'active',
      updatedAt: now,
    }] : [],
    createdAt: now,
    updatedAt: now,
  }
}

function normalizeWorkflowNodes(state: Partial<AppStateData>): WorkflowNode[] {
  const savedNodes = Array.isArray(state.workflowNodes) ? state.workflowNodes : []
  const legacyStatuses = Array.isArray(state.customStatuses) ? state.customStatuses : []
  const source: WorkflowNode[] = savedNodes.length
    ? savedNodes
    : [
        ...DEFAULT_WORKFLOW_NODES,
        ...legacyStatuses.map((name) => ({ id: createId(), name, hasReview: false, isTerminal: false })),
      ]
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
    return [{
      id,
      name,
      hasReview: Boolean(node.hasReview),
      isTerminal: Boolean(node.isTerminal),
    }]
  })
  return nodes.length ? nodes : DEFAULT_WORKFLOW_NODES
}

function normalizeApplications(applications: Application[], nodes: WorkflowNode[]): Application[] {
  const nodeIds = new Set(nodes.map((node) => node.id))
  return applications.map((application) => {
    const saved = Array.isArray(application.nodeProgress)
      ? application.nodeProgress.filter((progress) => progress && nodeIds.has(progress.workflowNodeId))
      : []
    if (saved.length) return { ...application, nodeProgress: saved }
    const byNode = new Map<string, ApplicationNodeProgress>()
    application.histories.forEach((history) => {
      const node = nodes.find((item) => item.name === history.status)
      if (!node) return
      byNode.set(node.id, {
        workflowNodeId: node.id,
        scheduledAt: history.time ? `${history.date}T${history.time}` : undefined,
        state: history.status === application.status ? 'active' : 'completed',
        updatedAt: history.createdAt,
      })
    })
    const currentNode = nodes.find((node) => node.name === application.status)
    if (currentNode && !byNode.has(currentNode.id)) {
      byNode.set(currentNode.id, { workflowNodeId: currentNode.id, state: 'active', updatedAt: application.updatedAt })
    }
    return { ...application, nodeProgress: [...byNode.values()] }
  })
}

function dedupeNodeProgress(progresses: ApplicationNodeProgress[]): ApplicationNodeProgress[] {
  const byNode = new Map<string, ApplicationNodeProgress>()
  progresses.forEach((progress) => byNode.set(progress.workflowNodeId, progress))
  return [...byNode.values()]
}

function uniqueReviewLinks(reviews: InterviewReview[], applications: Application[], nodes: WorkflowNode[]): InterviewReview[] {
  const linkedNodes = new Set<string>()
  return reviews.map((review) => {
    const application = review.applicationId ? applications.find((item) => item.id === review.applicationId) : undefined
    const inferredNode = !review.workflowNodeId && application
      ? nodes.find((node) => node.hasReview && (
          node.name === review.stageName ||
          node.name === application.status ||
          review.title.includes(node.name) ||
          review.content.includes(`**当前阶段：** ${node.name}`)
        )) ?? [...application.histories].reverse().flatMap((history) => nodes.filter((node) => node.hasReview && node.name === history.status))[0]
      : undefined
    const workflowNodeId = review.workflowNodeId ?? inferredNode?.id
    const stageName = review.stageName ?? inferredNode?.name ?? nodes.find((node) => node.id === workflowNodeId)?.name
    if (!review.applicationId || !workflowNodeId) return { ...review, workflowNodeId, stageName }
    const key = `${review.applicationId}:${workflowNodeId}`
    if (linkedNodes.has(key)) return { ...review, workflowNodeId: undefined, stageName: undefined }
    linkedNodes.add(key)
    return { ...review, workflowNodeId, stageName }
  })
}

function reducer(state: AppStateData, action: Action): AppStateData {
  switch (action.type) {
    case 'LOAD': {
      const workflowNodes = normalizeWorkflowNodes(action.state)
      const applications = normalizeApplications(action.state.applications ?? [], workflowNodes)
      return {
        ...EMPTY_STATE,
        ...action.state,
        applications,
        reviews: uniqueReviewLinks(action.state.reviews ?? [], applications, workflowNodes),
        knowledgeNotes: action.state.knowledgeNotes ?? [],
        workflowNodes,
        customStatuses: undefined,
        initialized: true,
      }
    }
    case 'ADD_APPLICATION':
      return { ...state, applications: [applicationFromDraft(action.draft, state.workflowNodes), ...state.applications] }
    case 'UPDATE_APPLICATION':
      return {
        ...state,
        applications: state.applications.map((application) => {
          if (application.id !== action.id) return application
          const statusChanged = application.status !== action.draft.status
          const targetNode = state.workflowNodes.find((node) => node.name === action.draft.status)
          const existingTargetProgress = targetNode ? (application.nodeProgress ?? []).find((progress) => progress.workflowNodeId === targetNode.id) : undefined
          const targetScheduledAt = action.draft.eventDate && action.draft.eventTime
            ? `${action.draft.eventDate}T${action.draft.eventTime}`
            : existingTargetProgress?.scheduledAt
          const nodeProgress = statusChanged && targetNode
            ? dedupeNodeProgress([
                ...(application.nodeProgress ?? []).map((progress) => progress.state === 'active'
                  ? { ...progress, state: 'completed' as const, updatedAt: Date.now() }
                  : progress),
                {
                  ...existingTargetProgress,
                  workflowNodeId: targetNode.id,
                  scheduledAt: targetScheduledAt,
                  state: 'active' as const,
                  reminderSentAt: targetScheduledAt !== existingTargetProgress?.scheduledAt ? undefined : existingTargetProgress?.reminderSentAt,
                  updatedAt: Date.now(),
                },
              ])
            : application.nodeProgress ?? []
          const histories = statusChanged
            ? [
                ...application.histories,
                createHistory(
                  application.id,
                  action.draft.status,
                  action.draft.eventDate || toDateInput(),
                  action.draft.eventTime,
                  `状态由${application.status}更新为${action.draft.status}`,
                ),
              ]
            : application.histories
          return {
            ...application,
            companyName: action.draft.companyName.trim(),
            positionName: action.draft.positionName.trim(),
            preferenceOrder: action.draft.preferenceOrder ? Number(action.draft.preferenceOrder) : undefined,
            applicationDate: action.draft.applicationDate,
            deadline: action.draft.deadline || undefined,
            status: action.draft.status,
            location: action.draft.location.trim() || undefined,
            source: action.draft.source.trim() || undefined,
            jobType: action.draft.jobType.trim() || undefined,
            link: action.draft.link.trim() || undefined,
            salary: action.draft.salary.trim() || undefined,
            notes: action.draft.notes.trim() || undefined,
            histories,
            nodeProgress,
            isDemo: false,
            updatedAt: Date.now(),
          }
        }),
      }
    case 'DELETE_APPLICATION':
      return {
        ...state,
        applications: state.applications.filter(({ id }) => id !== action.id),
        reviews: state.reviews.map((review) => review.applicationId === action.id
          ? { ...review, applicationId: undefined, updatedAt: Date.now() }
          : review),
      }
    case 'ADD_REVIEW':
      if (action.review.applicationId && action.review.workflowNodeId && state.reviews.some((review) =>
        review.applicationId === action.review.applicationId && review.workflowNodeId === action.review.workflowNodeId)) return state
      return { ...state, reviews: [action.review, ...state.reviews] }
    case 'UPDATE_REVIEW':
      {
        const current = state.reviews.find((review) => review.id === action.id)
        const applicationId = action.changes.applicationId ?? current?.applicationId
        const workflowNodeId = action.changes.workflowNodeId ?? current?.workflowNodeId
        if (applicationId && workflowNodeId && state.reviews.some((review) =>
          review.id !== action.id && review.applicationId === applicationId && review.workflowNodeId === workflowNodeId)) return state
      }
      return {
        ...state,
        reviews: state.reviews.map((review) => review.id === action.id
          ? { ...review, ...action.changes, updatedAt: Date.now() }
          : review),
      }
    case 'DELETE_REVIEW':
      return { ...state, reviews: state.reviews.filter(({ id }) => id !== action.id) }
    case 'ADD_KNOWLEDGE_NOTE':
      return { ...state, knowledgeNotes: [action.note, ...state.knowledgeNotes] }
    case 'UPDATE_KNOWLEDGE_NOTE':
      return {
        ...state,
        knowledgeNotes: state.knowledgeNotes.map((note) => note.id === action.id
          ? { ...note, ...action.changes, updatedAt: Date.now() }
          : note),
      }
    case 'DELETE_KNOWLEDGE_NOTE':
      return { ...state, knowledgeNotes: state.knowledgeNotes.filter(({ id }) => id !== action.id) }
    case 'UPDATE_STATUS':
      return {
        ...state,
        applications: state.applications.map((application) => {
          if (application.id !== action.id || application.status === action.status) return application
          const history = createHistory(
            application.id,
            action.status,
            action.event?.date || toDateInput(),
            action.event?.time,
            action.event?.note || `状态由${application.status}更新为${action.status}`,
          )
          const targetNode = state.workflowNodes.find((node) => node.name === action.status)
          const scheduledAt = action.event?.date && action.event.time ? `${action.event.date}T${action.event.time}` : undefined
          const existingTargetProgress = targetNode ? (application.nodeProgress ?? []).find((progress) => progress.workflowNodeId === targetNode.id) : undefined
          const nodeProgress = targetNode ? dedupeNodeProgress([
            ...(application.nodeProgress ?? []).map((progress) => progress.state === 'active'
              ? { ...progress, state: 'completed' as const, updatedAt: Date.now() }
              : progress),
            {
              ...existingTargetProgress,
              workflowNodeId: targetNode.id,
              scheduledAt: scheduledAt ?? existingTargetProgress?.scheduledAt,
              state: 'active' as const,
              reminderSentAt: scheduledAt && scheduledAt !== existingTargetProgress?.scheduledAt ? undefined : existingTargetProgress?.reminderSentAt,
              updatedAt: Date.now(),
            },
          ]) : application.nodeProgress ?? []
          return {
            ...application,
            status: action.status,
            histories: [...application.histories, history],
            nodeProgress,
            isDemo: false,
            updatedAt: Date.now(),
          }
        }),
      }
    case 'UNDO_STATUS': {
      const application = state.applications.find((item) => item.id === action.id)
      if (!application) return state
      const currentNode = state.workflowNodes.find((node) => node.name === application.status)
      if (!currentNode) return state
      const latestCurrentHistoryIndex = application.histories.map((history) => history.status).lastIndexOf(application.status)
      const previousHistory = latestCurrentHistoryIndex > 0
        ? [...application.histories.slice(0, latestCurrentHistoryIndex)].reverse().find((history) =>
            history.status !== application.status && state.workflowNodes.some((node) => node.name === history.status))
        : undefined
      const previousNode = previousHistory ? state.workflowNodes.find((node) => node.name === previousHistory.status) : undefined
      if (!previousNode) return state
      const now = Date.now()
      return {
        ...state,
        applications: state.applications.map((item) => {
          if (item.id !== action.id) return item
          return {
            ...item,
            status: previousNode.name,
            histories: item.histories.filter((_, index) => index !== latestCurrentHistoryIndex),
            nodeProgress: item.nodeProgress
              .filter((progress) => progress.workflowNodeId !== currentNode.id)
              .map((progress) => progress.workflowNodeId === previousNode.id
                ? { ...progress, state: 'active' as const, updatedAt: now }
                : progress.state === 'active' ? { ...progress, state: 'completed' as const, updatedAt: now } : progress),
            isDemo: false,
            updatedAt: now,
          }
        }),
        reviews: state.reviews.filter((review) => !(review.applicationId === action.id && review.workflowNodeId === currentNode.id)),
      }
    }
    case 'REPLACE_DATA': {
      const workflowNodes = normalizeWorkflowNodes(action.data)
      const applications = normalizeApplications(action.data.applications ?? [], workflowNodes)
      return {
        ...EMPTY_STATE,
        ...action.data,
        applications,
        reviews: uniqueReviewLinks(action.data.reviews ?? [], applications, workflowNodes),
        knowledgeNotes: action.data.knowledgeNotes ?? [],
        workflowNodes,
        customStatuses: undefined,
        initialized: true,
      }
    }
    case 'CLEAR_DATA':
      return { ...state, applications: [], reviews: [], knowledgeNotes: [] }
    case 'REMOVE_DEMO':
      return { ...state, applications: state.applications.filter(({ isDemo }) => !isDemo) }
    case 'SET_THEME':
      return { ...state, theme: action.theme }
    case 'SET_WORKFLOW_NODES':
      return { ...state, workflowNodes: normalizeWorkflowNodes({ workflowNodes: action.nodes }) }
    case 'SET_NODE_PROGRESS':
      return {
        ...state,
        applications: state.applications.map((application) => {
          if (application.id !== action.applicationId) return application
          const now = Date.now()
          const current = (application.nodeProgress ?? []).find((progress) => progress.workflowNodeId === action.node.id)
          const nextState = action.changes.state ?? current?.state ?? 'active'
          const scheduleChanged = Object.prototype.hasOwnProperty.call(action.changes, 'scheduledAt') || Object.prototype.hasOwnProperty.call(action.changes, 'reminderMinutesBefore')
          const nextProgress: ApplicationNodeProgress = {
            workflowNodeId: action.node.id,
            ...current,
            ...action.changes,
            state: nextState,
            reminderSentAt: scheduleChanged ? undefined : action.changes.reminderSentAt ?? current?.reminderSentAt,
            updatedAt: now,
          }
          const existing = (application.nodeProgress ?? []).filter((progress) => progress.workflowNodeId !== action.node.id)
          const explicitlyActivating = action.changes.state === 'active'
          const nodeProgress = [
            ...existing.map((progress) => explicitlyActivating && progress.state === 'active'
              ? { ...progress, state: 'completed' as const, updatedAt: now }
              : progress),
            nextProgress,
          ]
          const statusChanged = explicitlyActivating && application.status !== action.node.name
          const scheduledDate = nextProgress.scheduledAt?.slice(0, 10)
          const scheduledTime = nextProgress.scheduledAt?.slice(11, 16)
          return {
            ...application,
            status: statusChanged ? action.node.name : application.status,
            nodeProgress,
            histories: statusChanged ? [...application.histories, createHistory(
              application.id,
              action.node.name,
              scheduledDate || toDateInput(),
              scheduledTime,
              `节点状态更新为进行中`,
            )] : application.histories,
            isDemo: false,
            updatedAt: now,
          }
        }),
      }
    default:
      return state
  }
}

interface AppStoreValue {
  state: AppStateData
  loading: boolean
  loadError?: string
  persistenceStatus: PersistenceStatus
  persistenceError?: string
  statuses: string[]
  addApplication: (draft: ApplicationDraft) => void
  updateApplication: (id: string, draft: ApplicationDraft) => void
  deleteApplication: (id: string) => void
  addReview: (review: InterviewReview) => void
  updateReview: (id: string, changes: Partial<Pick<InterviewReview, 'applicationId' | 'workflowNodeId' | 'stageName' | 'title' | 'content'>>) => void
  deleteReview: (id: string) => void
  addKnowledgeNote: (note: KnowledgeNote) => void
  updateKnowledgeNote: (id: string, changes: Partial<Pick<KnowledgeNote, 'title' | 'content'>>) => void
  deleteKnowledgeNote: (id: string) => void
  updateStatus: (
    id: string,
    status: ApplicationStatus,
    event?: { date?: string; time?: string; note?: string },
  ) => void
  undoStatus: (id: string) => void
  replaceData: (data: AppStateData) => void
  clearData: () => void
  removeDemoData: () => void
  setTheme: (theme: ThemeMode) => void
  setWorkflowNodes: (nodes: WorkflowNode[]) => void
  updateNodeProgress: (applicationId: string, node: WorkflowNode, changes: Partial<Omit<ApplicationNodeProgress, 'workflowNodeId' | 'updatedAt'>>) => void
  retryLoad: () => void
  retrySave: () => void
}

const AppStoreContext = createContext<AppStoreValue | null>(null)

export function AppStoreProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(reducer, EMPTY_STATE)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string>()
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>('saved')
  const [persistenceError, setPersistenceError] = useState<string>()
  const loadRequestRef = useRef(0)
  const saveRevisionRef = useRef(0)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const mountedRef = useRef(true)

  const readState = useCallback((): void => {
    const requestId = ++loadRequestRef.current
    setLoading(true)
    setLoadError(undefined)
    loadState()
      .then((saved) => {
        if (!mountedRef.current || requestId !== loadRequestRef.current) return
        dispatch({
          type: 'LOAD',
          state: saved ?? {
            ...EMPTY_STATE,
            applications: createDemoApplications(),
            initialized: true,
          },
        })
        setPersistenceStatus('saved')
        setPersistenceError(undefined)
      })
      .catch((error: unknown) => {
        console.error('读取本地数据失败', error)
        if (mountedRef.current && requestId === loadRequestRef.current) {
          setLoadError('无法读取本地数据。请重试，应用不会覆盖原有数据。')
        }
      })
      .finally(() => {
        if (mountedRef.current && requestId === loadRequestRef.current) setLoading(false)
      })
  }, [])

  const persist = useCallback((snapshot: AppStateData): void => {
    const revision = ++saveRevisionRef.current
    setPersistenceStatus('saving')
    setPersistenceError(undefined)
    const task = saveQueueRef.current
      .catch(() => undefined)
      .then(() => saveState(snapshot))
    saveQueueRef.current = task
    void task
      .then(() => {
        if (!mountedRef.current || revision !== saveRevisionRef.current) return
        setPersistenceStatus('saved')
      })
      .catch((error: unknown) => {
        console.error('保存本地数据失败', error)
        if (!mountedRef.current || revision !== saveRevisionRef.current) return
        setPersistenceStatus('error')
        setPersistenceError('保存失败，点击重试')
      })
  }, [])

  useEffect(() => {
    mountedRef.current = true
    readState()
    return () => {
      mountedRef.current = false
      loadRequestRef.current += 1
    }
  }, [readState])

  useEffect(() => {
    if (loading || !state.initialized) return
    persist(state)
  }, [loading, persist, state])

  const value = useMemo<AppStoreValue>(
    () => ({
      state,
      loading,
      loadError,
      persistenceStatus,
      persistenceError,
      statuses: state.workflowNodes.map((node) => node.name),
      addApplication: (draft) => dispatch({ type: 'ADD_APPLICATION', draft }),
      updateApplication: (id, draft) => dispatch({ type: 'UPDATE_APPLICATION', id, draft }),
      deleteApplication: (id) => dispatch({ type: 'DELETE_APPLICATION', id }),
      addReview: (review) => dispatch({ type: 'ADD_REVIEW', review }),
      updateReview: (id, changes) => dispatch({ type: 'UPDATE_REVIEW', id, changes }),
      deleteReview: (id) => dispatch({ type: 'DELETE_REVIEW', id }),
      addKnowledgeNote: (note) => dispatch({ type: 'ADD_KNOWLEDGE_NOTE', note }),
      updateKnowledgeNote: (id, changes) => dispatch({ type: 'UPDATE_KNOWLEDGE_NOTE', id, changes }),
      deleteKnowledgeNote: (id) => dispatch({ type: 'DELETE_KNOWLEDGE_NOTE', id }),
      updateStatus: (id, status, event) => dispatch({ type: 'UPDATE_STATUS', id, status, event }),
      undoStatus: (id) => dispatch({ type: 'UNDO_STATUS', id }),
      replaceData: (data) => dispatch({ type: 'REPLACE_DATA', data }),
      clearData: () => dispatch({ type: 'CLEAR_DATA' }),
      removeDemoData: () => dispatch({ type: 'REMOVE_DEMO' }),
      setTheme: (theme) => dispatch({ type: 'SET_THEME', theme }),
      setWorkflowNodes: (nodes) => dispatch({ type: 'SET_WORKFLOW_NODES', nodes }),
      updateNodeProgress: (applicationId, node, changes) => dispatch({ type: 'SET_NODE_PROGRESS', applicationId, node, changes }),
      retryLoad: readState,
      retrySave: () => persist(state),
    }),
    [loadError, loading, persist, persistenceError, persistenceStatus, readState, state],
  )

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}

export function useAppStore(): AppStoreValue {
  const store = useContext(AppStoreContext)
  if (!store) throw new Error('useAppStore 必须在 AppStoreProvider 内使用')
  return store
}
