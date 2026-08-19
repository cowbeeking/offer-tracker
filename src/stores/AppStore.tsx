/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { createDemoApplications } from '@/constants/demo'
import { DEFAULT_STATUSES } from '@/types/application'
import type {
  AppStateData,
  Application,
  ApplicationDraft,
  ApplicationStatus,
  PersistenceStatus,
  StatusHistory,
  ThemeMode,
} from '@/types/application'
import { loadState, saveState } from '@/services/storage'
import { toDateInput } from '@/utils/date'
import { createId } from '@/utils/id'

const EMPTY_STATE: AppStateData = {
  version: 1,
  applications: [],
  customStatuses: [],
  theme: 'system',
  initialized: false,
}

type Action =
  | { type: 'LOAD'; state: AppStateData }
  | { type: 'ADD_APPLICATION'; draft: ApplicationDraft }
  | { type: 'UPDATE_APPLICATION'; id: string; draft: ApplicationDraft }
  | { type: 'DELETE_APPLICATION'; id: string }
  | {
      type: 'UPDATE_STATUS'
      id: string
      status: ApplicationStatus
      event?: { date?: string; time?: string; note?: string }
    }
  | { type: 'REPLACE_DATA'; data: AppStateData }
  | { type: 'CLEAR_DATA' }
  | { type: 'REMOVE_DEMO' }
  | { type: 'SET_THEME'; theme: ThemeMode }
  | { type: 'ADD_STATUS'; status: string }
  | { type: 'REMOVE_STATUS'; status: string }

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

function applicationFromDraft(draft: ApplicationDraft): Application {
  const id = createId()
  const now = Date.now()
  return {
    id,
    companyName: draft.companyName.trim(),
    positionName: draft.positionName.trim(),
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
    createdAt: now,
    updatedAt: now,
  }
}

function reducer(state: AppStateData, action: Action): AppStateData {
  switch (action.type) {
    case 'LOAD':
      return { ...action.state, initialized: true }
    case 'ADD_APPLICATION':
      return { ...state, applications: [applicationFromDraft(action.draft), ...state.applications] }
    case 'UPDATE_APPLICATION':
      return {
        ...state,
        applications: state.applications.map((application) => {
          if (application.id !== action.id) return application
          const statusChanged = application.status !== action.draft.status
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
            isDemo: false,
            updatedAt: Date.now(),
          }
        }),
      }
    case 'DELETE_APPLICATION':
      return { ...state, applications: state.applications.filter(({ id }) => id !== action.id) }
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
          return {
            ...application,
            status: action.status,
            histories: [...application.histories, history],
            isDemo: false,
            updatedAt: Date.now(),
          }
        }),
      }
    case 'REPLACE_DATA':
      return { ...action.data, initialized: true }
    case 'CLEAR_DATA':
      return { ...state, applications: [] }
    case 'REMOVE_DEMO':
      return { ...state, applications: state.applications.filter(({ isDemo }) => !isDemo) }
    case 'SET_THEME':
      return { ...state, theme: action.theme }
    case 'ADD_STATUS': {
      const status = action.status.trim()
      if (!status || DEFAULT_STATUSES.includes(status as (typeof DEFAULT_STATUSES)[number])) return state
      if (state.customStatuses.includes(status)) return state
      return { ...state, customStatuses: [...state.customStatuses, status] }
    }
    case 'REMOVE_STATUS':
      return { ...state, customStatuses: state.customStatuses.filter((status) => status !== action.status) }
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
  updateStatus: (
    id: string,
    status: ApplicationStatus,
    event?: { date?: string; time?: string; note?: string },
  ) => void
  replaceData: (data: AppStateData) => void
  clearData: () => void
  removeDemoData: () => void
  setTheme: (theme: ThemeMode) => void
  addCustomStatus: (status: string) => void
  removeCustomStatus: (status: string) => void
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
      statuses: [...DEFAULT_STATUSES, ...state.customStatuses],
      addApplication: (draft) => dispatch({ type: 'ADD_APPLICATION', draft }),
      updateApplication: (id, draft) => dispatch({ type: 'UPDATE_APPLICATION', id, draft }),
      deleteApplication: (id) => dispatch({ type: 'DELETE_APPLICATION', id }),
      updateStatus: (id, status, event) => dispatch({ type: 'UPDATE_STATUS', id, status, event }),
      replaceData: (data) => dispatch({ type: 'REPLACE_DATA', data }),
      clearData: () => dispatch({ type: 'CLEAR_DATA' }),
      removeDemoData: () => dispatch({ type: 'REMOVE_DEMO' }),
      setTheme: (theme) => dispatch({ type: 'SET_THEME', theme }),
      addCustomStatus: (status) => dispatch({ type: 'ADD_STATUS', status }),
      removeCustomStatus: (status) => dispatch({ type: 'REMOVE_STATUS', status }),
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
