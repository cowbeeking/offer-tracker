import { DEFAULT_STATUSES } from '@/types/application'
import type { AppStateData, Application, BackupData, StatusHistory } from '@/types/application'
import { createId } from '@/utils/id'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`字段 ${field} 缺失或格式错误`)
  return value
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function parseHistory(value: unknown, applicationId: string): StatusHistory {
  if (!isRecord(value)) throw new Error('流程历史格式错误')
  return {
    id: optionalString(value.id) ?? createId(),
    applicationId,
    status: requiredString(value.status, 'history.status'),
    date: requiredString(value.date, 'history.date'),
    time: optionalString(value.time),
    note: optionalString(value.note),
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
  }
}

function parseApplication(value: unknown): Application {
  if (!isRecord(value)) throw new Error('投递记录格式错误')
  const id = optionalString(value.id) ?? createId()
  const status = requiredString(value.status, 'status')
  const histories = Array.isArray(value.histories)
    ? value.histories.map((history) => parseHistory(history, id))
    : []
  return {
    id,
    companyName: requiredString(value.companyName, 'companyName'),
    positionName: requiredString(value.positionName, 'positionName'),
    applicationDate: requiredString(value.applicationDate, 'applicationDate'),
    deadline: optionalString(value.deadline),
    status,
    location: optionalString(value.location),
    source: optionalString(value.source),
    jobType: optionalString(value.jobType),
    link: optionalString(value.link),
    salary: optionalString(value.salary),
    notes: optionalString(value.notes),
    histories,
    isDemo: false,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : Date.now(),
  }
}

export function createBackup(data: AppStateData): BackupData {
  return {
    app: 'autumn-offer-tracker',
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  }
}

export function parseBackup(raw: string): AppStateData {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('文件不是有效的 JSON')
  }
  if (!isRecord(parsed) || parsed.app !== 'autumn-offer-tracker' || !isRecord(parsed.data)) {
    throw new Error('这不是秋招 Tracker 的备份文件')
  }
  const data = parsed.data
  if (!Array.isArray(data.applications)) throw new Error('备份中缺少投递记录')
  const customStatuses = Array.isArray(data.customStatuses)
    ? data.customStatuses.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
  const discoveredStatuses = data.applications
    .map((item) => (isRecord(item) && typeof item.status === 'string' ? item.status : ''))
    .filter(
      (status) =>
        status &&
        !DEFAULT_STATUSES.includes(status as (typeof DEFAULT_STATUSES)[number]) &&
        !customStatuses.includes(status),
    )
  return {
    version: 1,
    applications: data.applications.map(parseApplication),
    customStatuses: [...customStatuses, ...new Set(discoveredStatuses)],
    theme: data.theme === 'light' || data.theme === 'dark' || data.theme === 'system' ? data.theme : 'system',
    initialized: true,
  }
}

function csvCell(value: string | number | undefined): string {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

export function applicationsToCsv(applications: Application[]): string {
  const header = ['公司', '岗位', '投递日期', '截止日期', '当前进度', '地点', '渠道', '岗位类型', '薪资', '链接', '备注']
  const rows = applications.map((item) => [
    item.companyName,
    item.positionName,
    item.applicationDate,
    item.deadline,
    item.status,
    item.location,
    item.source,
    item.jobType,
    item.salary,
    item.link,
    item.notes,
  ])
  return `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`
}
