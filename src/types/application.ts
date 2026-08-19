export const DEFAULT_STATUSES = [
  '待投递',
  '已投递',
  '笔试',
  '一面',
  '二面',
  '三面',
  'HR面',
  'Offer',
  '已拒绝',
  '已结束',
] as const

export interface WorkflowNode {
  id: string
  name: string
  hasReview: boolean
  isTerminal?: boolean
}

export const DEFAULT_WORKFLOW_NODES: WorkflowNode[] = [
  { id: 'waiting', name: '待投递', hasReview: false },
  { id: 'applied', name: '已投递', hasReview: false },
  { id: 'written-test', name: '笔试', hasReview: true },
  { id: 'interview-1', name: '一面', hasReview: true },
  { id: 'interview-2', name: '二面', hasReview: true },
  { id: 'interview-3', name: '三面', hasReview: true },
  { id: 'hr-interview', name: 'HR面', hasReview: true },
  { id: 'offer', name: 'Offer', hasReview: false },
  { id: 'rejected', name: '已拒绝', hasReview: false, isTerminal: true },
  { id: 'ended', name: '已结束', hasReview: false, isTerminal: true },
]

export type DefaultApplicationStatus = (typeof DEFAULT_STATUSES)[number]
export type ApplicationStatus = DefaultApplicationStatus | string

export interface StatusHistory {
  id: string
  applicationId: string
  status: ApplicationStatus
  date: string
  time?: string
  note?: string
  createdAt: number
}

export type ApplicationNodeState = 'active' | 'completed'

export interface ApplicationNodeProgress {
  workflowNodeId: string
  scheduledAt?: string
  state: ApplicationNodeState
  reminderMinutesBefore?: number
  reminderSentAt?: number
  updatedAt: number
}

export interface Application {
  id: string
  companyName: string
  positionName: string
  preferenceOrder?: number
  applicationDate: string
  deadline?: string
  status: ApplicationStatus
  location?: string
  source?: string
  jobType?: string
  link?: string
  salary?: string
  notes?: string
  histories: StatusHistory[]
  nodeProgress: ApplicationNodeProgress[]
  isDemo?: boolean
  createdAt: number
  updatedAt: number
}

export interface ApplicationDraft {
  companyName: string
  positionName: string
  preferenceOrder: string
  applicationDate: string
  deadline: string
  status: ApplicationStatus
  location: string
  source: string
  jobType: string
  link: string
  salary: string
  notes: string
  eventDate: string
  eventTime: string
}

export interface InterviewReview {
  id: string
  applicationId?: string
  workflowNodeId?: string
  stageName?: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
}

export interface KnowledgeNote {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
}

export type ThemeMode = 'light' | 'dark' | 'system'
export type PersistenceStatus = 'saving' | 'saved' | 'error'
export type PageKey = 'dashboard' | 'applications' | 'board' | 'reviews' | 'knowledge' | 'statistics' | 'settings'

export interface AppStateData {
  version: 1
  applications: Application[]
  reviews: InterviewReview[]
  knowledgeNotes: KnowledgeNote[]
  workflowNodes: WorkflowNode[]
  /** 兼容旧版本地数据，保存时不再使用。 */
  customStatuses?: string[]
  theme: ThemeMode
  initialized: boolean
}

export interface BackupData {
  app: 'autumn-offer-tracker'
  version: 1
  exportedAt: string
  data: AppStateData
}
