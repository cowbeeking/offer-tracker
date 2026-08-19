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

export interface Application {
  id: string
  companyName: string
  positionName: string
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
  isDemo?: boolean
  createdAt: number
  updatedAt: number
}

export interface ApplicationDraft {
  companyName: string
  positionName: string
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

export type ThemeMode = 'light' | 'dark' | 'system'
export type PersistenceStatus = 'saving' | 'saved' | 'error'
export type PageKey = 'dashboard' | 'applications' | 'board' | 'statistics' | 'settings'

export interface AppStateData {
  version: 1
  applications: Application[]
  customStatuses: string[]
  theme: ThemeMode
  initialized: boolean
}

export interface BackupData {
  app: 'autumn-offer-tracker'
  version: 1
  exportedAt: string
  data: AppStateData
}
