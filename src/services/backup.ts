import { DEFAULT_STATUSES, DEFAULT_WORKFLOW_NODES } from '@/types/application'
import type { AppStateData, Application, ApplicationNodeProgress, BackupData, InterviewReview, KnowledgeNote, StatusHistory, WorkflowNode } from '@/types/application'
import { createId } from '@/utils/id'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`字段 ${field} 缺失或格式错误`)
  return value.trim()
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function dateString(value: unknown, field: string): string {
  const text = requiredString(value, field)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(`字段 ${field} 不是有效日期`)
  const date = new Date(`${text}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new Error(`字段 ${field} 不是有效日期`)
  }
  return text
}

function optionalTime(value: unknown): string | undefined {
  const text = optionalString(value)
  if (text && !/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) throw new Error('流程历史时间格式错误')
  return text
}

function optionalPreference(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const preference = typeof value === 'string' ? Number(value) : value
  if (typeof preference !== 'number' || !Number.isInteger(preference) || preference < 1) {
    throw new Error('志愿顺序需要是大于 0 的整数')
  }
  return preference
}

function timestamp(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : Date.now()
}

function parseReview(value: unknown, applicationIds: Set<string>): InterviewReview {
  if (!isRecord(value)) throw new Error('面试复盘格式错误')
  const applicationId = optionalString(value.applicationId)
  if (typeof value.content !== 'string') throw new Error('面试复盘正文格式错误')
  return {
    id: optionalString(value.id) ?? createId(),
    applicationId: applicationId && applicationIds.has(applicationId) ? applicationId : undefined,
    workflowNodeId: optionalString(value.workflowNodeId),
    stageName: optionalString(value.stageName),
    title: optionalString(value.title) ?? '未命名面试复盘',
    content: value.content,
    createdAt: timestamp(value.createdAt),
    updatedAt: timestamp(value.updatedAt),
  }
}

function parseWorkflowNodes(value: unknown, legacyStatuses: string[]): WorkflowNode[] {
  const rawNodes = Array.isArray(value) ? value : []
  const source: unknown[] = rawNodes.length
    ? rawNodes
    : [...DEFAULT_WORKFLOW_NODES, ...legacyStatuses.map((name) => ({ id: createId(), name, hasReview: false }))]
  const ids = new Set<string>()
  const names = new Set<string>()
  const nodes = source.flatMap((item) => {
    if (!isRecord(item)) return []
    const name = optionalString(item.name)
    if (!name || names.has(name)) return []
    names.add(name)
    const requestedId = optionalString(item.id) ?? createId()
    const id = ids.has(requestedId) ? createId() : requestedId
    ids.add(id)
    return [{ id, name, hasReview: item.hasReview === true, isTerminal: item.isTerminal === true }]
  })
  return nodes.length ? nodes : DEFAULT_WORKFLOW_NODES
}

function parseKnowledgeNote(value: unknown): KnowledgeNote {
  if (!isRecord(value)) throw new Error('知识笔记格式错误')
  if (typeof value.content !== 'string') throw new Error('知识笔记正文格式错误')
  return {
    id: optionalString(value.id) ?? createId(),
    title: optionalString(value.title) ?? '未命名知识笔记',
    content: value.content,
    createdAt: timestamp(value.createdAt),
    updatedAt: timestamp(value.updatedAt),
  }
}

function parseHistory(value: unknown, applicationId: string): StatusHistory {
  if (!isRecord(value)) throw new Error('流程历史格式错误')
  return {
    id: optionalString(value.id) ?? createId(),
    applicationId,
    status: requiredString(value.status, 'history.status'),
    date: dateString(value.date, 'history.date'),
    time: optionalTime(value.time),
    note: optionalString(value.note),
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
  }
}

function parseNodeProgress(value: unknown): ApplicationNodeProgress {
  if (!isRecord(value)) throw new Error('节点进度格式错误')
  const scheduledAt = optionalString(value.scheduledAt)
  if (scheduledAt && !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(scheduledAt)) throw new Error('节点时间格式错误')
  const reminder = value.reminderMinutesBefore
  return {
    workflowNodeId: requiredString(value.workflowNodeId, 'nodeProgress.workflowNodeId'),
    scheduledAt,
    state: value.state === 'completed' ? 'completed' : 'active',
    reminderMinutesBefore: typeof reminder === 'number' && Number.isInteger(reminder) && reminder >= 0 ? reminder : undefined,
    reminderSentAt: typeof value.reminderSentAt === 'number' && value.reminderSentAt > 0 ? value.reminderSentAt : undefined,
    updatedAt: timestamp(value.updatedAt),
  }
}

function parseApplication(value: unknown): Application {
  if (!isRecord(value)) throw new Error('投递记录格式错误')
  const id = optionalString(value.id) ?? createId()
  const status = requiredString(value.status, 'status')
  const applicationDate = dateString(value.applicationDate, 'applicationDate')
  const parsedHistories = Array.isArray(value.histories)
    ? value.histories.map((history) => parseHistory(history, id))
    : []
  const histories = parsedHistories.length
    ? parsedHistories
    : [{
        id: createId(),
        applicationId: id,
        status,
        date: applicationDate,
        note: '从备份恢复',
        createdAt: Date.now(),
      }]
  return {
    id,
    companyName: requiredString(value.companyName, 'companyName'),
    positionName: requiredString(value.positionName, 'positionName'),
    preferenceOrder: optionalPreference(value.preferenceOrder),
    applicationDate,
    deadline: value.deadline ? dateString(value.deadline, 'deadline') : undefined,
    status,
    location: optionalString(value.location),
    source: optionalString(value.source),
    jobType: optionalString(value.jobType),
    link: optionalString(value.link),
    salary: optionalString(value.salary),
    notes: optionalString(value.notes),
    histories,
    nodeProgress: Array.isArray(value.nodeProgress) ? value.nodeProgress.map(parseNodeProgress) : [],
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
  if (parsed.version !== 1) throw new Error('备份版本不受支持，请使用当前版本导出的文件')
  const data = parsed.data
  if (!Array.isArray(data.applications)) throw new Error('备份中缺少投递记录')
  const customStatuses = [...new Set(Array.isArray(data.customStatuses)
    ? data.customStatuses
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim())
        .filter((status) => !DEFAULT_STATUSES.includes(status as (typeof DEFAULT_STATUSES)[number]))
    : [])]
  const discoveredStatuses = data.applications
    .map((item) => (isRecord(item) && typeof item.status === 'string' ? item.status.trim() : ''))
    .filter(
      (status) =>
        status &&
        !DEFAULT_STATUSES.includes(status as (typeof DEFAULT_STATUSES)[number]) &&
        !customStatuses.includes(status),
    )
  const seenIds = new Set<string>()
  const applications = data.applications.map(parseApplication).map((application) => {
    if (!seenIds.has(application.id)) {
      seenIds.add(application.id)
      return application
    }
    const id = createId()
    seenIds.add(id)
    return { ...application, id, histories: application.histories.map((history) => ({ ...history, applicationId: id })) }
  })
  const applicationIds = new Set(applications.map(({ id }) => id))
  const workflowNodes = parseWorkflowNodes(data.workflowNodes, customStatuses)
  const workflowNames = new Set(workflowNodes.map((node) => node.name))
  discoveredStatuses.forEach((name) => {
    if (!workflowNames.has(name)) workflowNodes.push({ id: createId(), name, hasReview: false })
  })
  const workflowNodeIds = new Set(workflowNodes.map((node) => node.id))
  const reviewIds = new Set<string>()
  const linkedNodeKeys = new Set<string>()
  const reviews = (Array.isArray(data.reviews) ? data.reviews : []).map((value) => parseReview(value, applicationIds)).map((review) => {
    const id = reviewIds.has(review.id) ? createId() : review.id
    reviewIds.add(id)
    const workflowNodeId = review.workflowNodeId && workflowNodeIds.has(review.workflowNodeId) ? review.workflowNodeId : undefined
    const key = review.applicationId && workflowNodeId ? `${review.applicationId}:${workflowNodeId}` : undefined
    if (key && linkedNodeKeys.has(key)) return { ...review, id, workflowNodeId: undefined, stageName: undefined }
    if (key) linkedNodeKeys.add(key)
    return { ...review, id, workflowNodeId }
  })
  const knowledgeNoteIds = new Set<string>()
  const knowledgeNotes = (Array.isArray(data.knowledgeNotes) ? data.knowledgeNotes : []).map(parseKnowledgeNote).map((note) => {
    const id = knowledgeNoteIds.has(note.id) ? createId() : note.id
    knowledgeNoteIds.add(id)
    return { ...note, id }
  })
  return {
    version: 1,
    applications,
    reviews,
    knowledgeNotes,
    workflowNodes,
    theme: data.theme === 'light' || data.theme === 'dark' || data.theme === 'system' ? data.theme : 'system',
    initialized: true,
  }
}

function csvCell(value: string | number | undefined): string {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

export function applicationsToCsv(applications: Application[]): string {
  const header = ['公司', '岗位', '志愿顺序', '投递日期', '截止日期', '当前进度', '地点', '渠道', '岗位类型', '薪资', '链接', '备注']
  const rows = applications.map((item) => [
    item.companyName,
    item.positionName,
    item.preferenceOrder ? `第${item.preferenceOrder}志愿` : undefined,
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
