/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { createDemoApplications } from '@/constants/demo'
import { appReducer, createEmptyState } from '@/domain/appState'
import { loadState, saveState } from '@/services/storage'
import type {
  AppStateData,
  ApplicationDraft,
  ApplicationNodeProgress,
  ApplicationStatus,
  InterviewReview,
  KnowledgeNote,
  PersistenceStatus,
  ThemeMode,
  WorkflowNode,
} from '@/types/application'

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
  updateStatus: (id: string, status: ApplicationStatus, event?: { date?: string; time?: string; note?: string }) => void
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
  const [state, dispatch] = useReducer(appReducer, undefined, createEmptyState)
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
          state: saved ?? { ...createEmptyState(), applications: createDemoApplications(), initialized: true },
        })
        setPersistenceStatus('saved')
        setPersistenceError(undefined)
      })
      .catch((error: unknown) => {
        console.error('读取本地数据失败', error)
        if (mountedRef.current && requestId === loadRequestRef.current) setLoadError('无法读取本地数据。请重试，应用不会覆盖原有数据。')
      })
      .finally(() => {
        if (mountedRef.current && requestId === loadRequestRef.current) setLoading(false)
      })
  }, [])

  const persist = useCallback((snapshot: AppStateData, revision = ++saveRevisionRef.current): void => {
    setPersistenceStatus('saving')
    setPersistenceError(undefined)
    const task = saveQueueRef.current.catch(() => undefined).then(() => saveState(snapshot))
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
    const revision = ++saveRevisionRef.current
    setPersistenceStatus('saving')
    setPersistenceError(undefined)
    const timer = window.setTimeout(() => persist(state, revision), 250)
    return () => window.clearTimeout(timer)
  }, [loading, persist, state])

  const value = useMemo<AppStoreValue>(() => ({
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
  }), [loadError, loading, persist, persistenceError, persistenceStatus, readState, state])

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}

export function useAppStore(): AppStoreValue {
  const store = useContext(AppStoreContext)
  if (!store) throw new Error('useAppStore 必须在 AppStoreProvider 内使用')
  return store
}
