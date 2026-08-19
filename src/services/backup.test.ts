import { describe, expect, it } from 'vitest'
import { applicationsToCsv, parseBackup } from '@/services/backup'
import type { Application } from '@/types/application'

function rawBackup(application: Record<string, unknown>): string {
  return JSON.stringify({
    app: 'autumn-offer-tracker', version: 1,
    data: { applications: [application], reviews: [], knowledgeNotes: [], workflowNodes: [{ id: 'applied', name: '已投递', hasReview: false }], theme: 'system' },
  })
}

const validApplication = {
  id: 'a', companyName: '公司', positionName: '岗位', applicationDate: '2026-08-01', status: '已投递', histories: [], nodeProgress: [], createdAt: 1, updatedAt: 1,
}

describe('backup validation', () => {
  it('rejects malformed, foreign, and unsupported backups', () => {
    expect(() => parseBackup('{')).toThrow('有效的 JSON')
    expect(() => parseBackup(JSON.stringify({ app: 'other', data: {} }))).toThrow('不是秋招 Tracker')
    expect(() => parseBackup(JSON.stringify({ app: 'autumn-offer-tracker', version: 2, data: {} }))).toThrow('版本不受支持')
  })

  it('rejects impossible local node dates', () => {
    expect(() => parseBackup(rawBackup({ ...validApplication, nodeProgress: [{ workflowNodeId: 'applied', scheduledAt: '2026-02-30T10:00', state: 'active', updatedAt: 1 }] }))).toThrow('节点时间格式错误')
  })

  it('rejects a deadline before the application date', () => {
    expect(() => parseBackup(rawBackup({ ...validApplication, deadline: '2026-07-31' }))).toThrow('截止日期不能早于投递日期')
  })

  it('repairs duplicate application IDs and history ownership', () => {
    const raw = JSON.stringify({ app: 'autumn-offer-tracker', version: 1, data: {
      applications: [validApplication, { ...validApplication, companyName: '另一公司' }], reviews: [], knowledgeNotes: [], workflowNodes: [], theme: 'system',
    } })
    const data = parseBackup(raw)
    expect(new Set(data.applications.map((item) => item.id)).size).toBe(2)
    expect(data.applications[1].histories.every((history) => history.applicationId === data.applications[1].id)).toBe(true)
  })
})

describe('CSV export safety', () => {
  it('neutralizes spreadsheet formulas from user-entered fields', () => {
    const application = { ...validApplication, companyName: '=HYPERLINK("https://bad")', notes: ' @SUM(1,2)' } as Application
    const csv = applicationsToCsv([application])
    expect(csv).toContain("'=HYPERLINK")
    expect(csv).toContain("' @SUM")
  })
})
