import { useRef, useState, type ChangeEvent } from 'react'
import { ChevronLeft, Database, Download, FileJson, FileSpreadsheet, Monitor, Moon, Plus, RotateCcw, Settings2, Sun, Trash2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { applicationsToCsv, createBackup, parseBackup } from '@/services/backup'
import { DEFAULT_STATUSES } from '@/types/application'
import type { AppStateData, ThemeMode } from '@/types/application'
import { toDateInput } from '@/utils/date'

interface SettingsPageProps {
  data: AppStateData
  onBack: () => void
  onReplaceData: (data: AppStateData) => void
  onClearData: () => void
  onRemoveDemo: () => void
  onThemeChange: (theme: ThemeMode) => void
  onAddStatus: (status: string) => void
  onRemoveStatus: (status: string) => void
  onNotify: (message: string, tone?: 'success' | 'error') => void
}

async function downloadFallback(content: string, name: string, type: string): Promise<void> {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

export function SettingsPage({ data, onBack, onReplaceData, onClearData, onRemoveDemo, onThemeChange, onAddStatus, onRemoveStatus, onNotify }: SettingsPageProps): JSX.Element {
  const [clearOpen, setClearOpen] = useState(false)
  const [pendingImport, setPendingImport] = useState<AppStateData>()
  const [newStatus, setNewStatus] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const demoCount = data.applications.filter((item) => item.isDemo).length

  const exportJson = async (): Promise<void> => {
    try {
      const content = JSON.stringify(createBackup(data), null, 2)
      const name = `job-applications-backup-${toDateInput()}.json`
      const saved = window.desktopApi
        ? await window.desktopApi.saveFile(content, name, 'json')
        : (await downloadFallback(content, name, 'application/json'), true)
      if (saved) onNotify('JSON 备份已导出')
    } catch {
      onNotify('JSON 备份导出失败', 'error')
    }
  }

  const exportCsv = async (): Promise<void> => {
    try {
      const content = applicationsToCsv(data.applications)
      const name = `job-applications-${toDateInput()}.csv`
      const saved = window.desktopApi
        ? await window.desktopApi.saveFile(content, name, 'csv')
        : (await downloadFallback(content, name, 'text/csv;charset=utf-8'), true)
      if (saved) onNotify('CSV 表格已导出')
    } catch {
      onNotify('CSV 表格导出失败', 'error')
    }
  }

  const importRaw = (raw: string): void => {
    try {
      const parsed = parseBackup(raw)
      setPendingImport(parsed)
    } catch (error: unknown) {
      onNotify(error instanceof Error ? error.message : '导入失败，请检查文件', 'error')
    }
  }

  const importJson = async (): Promise<void> => {
    if (!window.desktopApi) {
      fileInput.current?.click()
      return
    }
    try {
      const raw = await window.desktopApi.openJsonFile()
      if (raw) importRaw(raw)
    } catch {
      onNotify('无法读取备份文件', 'error')
    }
  }

  const handleFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0]
    if (!file) return
    void file.text().then(importRaw).catch(() => onNotify('无法读取备份文件', 'error'))
    event.target.value = ''
  }

  const submitStatus = (): void => {
    const status = newStatus.trim()
    if (!status) return
    if (DEFAULT_STATUSES.includes(status as (typeof DEFAULT_STATUSES)[number]) || data.customStatuses.includes(status)) {
      onNotify('这个流程节点已经存在', 'error')
      return
    }
    onAddStatus(status)
    setNewStatus('')
    onNotify(`已添加流程节点「${status}」`)
  }

  return (
    <div className="page settings-page">
      <div className="settings-nav">
        <button className="settings-back" onClick={onBack}><ChevronLeft size={16} />返回</button>
        <span className="settings-nav-title"><Settings2 size={15} />设置中心</span>
      </div>
      <header className="settings-hero">
        <div><span className="eyebrow">Preferences</span><h1>设置</h1><p>管理界面外观、本地数据和招聘流程节点。</p></div>
        <span className="settings-summary"><Database size={15} />{data.applications.length} 条投递 · {data.reviews.length} 篇复盘</span>
      </header>
      <div className="settings-stack">
        <section className="settings-section panel">
          <div className="settings-copy"><span className="settings-icon"><Sun size={18} /></span><div><h2>外观</h2><p>选择舒适的界面主题，系统模式会跟随 Windows 设置。</p></div></div>
          <div className="theme-options">
            {([
              { value: 'light' as const, label: 'Light', icon: Sun },
              { value: 'dark' as const, label: 'Dark', icon: Moon },
              { value: 'system' as const, label: 'System', icon: Monitor },
            ]).map((item) => {
              const Icon = item.icon
              return <button key={item.value} className={data.theme === item.value ? 'active' : ''} onClick={() => onThemeChange(item.value)}><Icon size={16} /><span>{item.label}</span>{data.theme === item.value && <i />}</button>
            })}
          </div>
        </section>

        <section className="settings-section panel">
          <div className="settings-copy"><span className="settings-icon"><Database size={18} /></span><div><h2>数据管理</h2><p>{data.applications.length} 条投递和 {data.reviews.length} 篇复盘已保存在本地 IndexedDB。</p></div></div>
          <div className="data-actions">
            <button onClick={() => void exportJson()}><span className="data-action-icon"><FileJson size={19} /></span><span><strong>导出 JSON</strong><small>完整备份投递、复盘、流程历史和设置</small></span><Download size={16} /></button>
            <button onClick={() => void exportCsv()}><span className="data-action-icon"><FileSpreadsheet size={19} /></span><span><strong>导出 CSV</strong><small>可用 Excel 继续分析投递数据</small></span><Download size={16} /></button>
            <button onClick={() => void importJson()}><span className="data-action-icon"><Upload size={19} /></span><span><strong>导入备份</strong><small>校验 JSON 后完整恢复本地数据</small></span><RotateCcw size={16} /></button>
            <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={handleFile} />
          </div>
          {demoCount > 0 && <div className="demo-row"><div><strong>示例数据</strong><span>当前有 {demoCount} 条示例记录，可在开始正式使用前移除。</span></div><Button size="sm" onClick={() => { onRemoveDemo(); onNotify('示例数据已移除') }}>移除示例数据</Button></div>}
          <div className="danger-row"><div><strong>清空本地数据</strong><span>永久删除全部投递、面试复盘和流程历史。</span></div><Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => setClearOpen(true)}>清空数据</Button></div>
        </section>

        <section className="settings-section panel">
          <div className="settings-copy"><span className="settings-icon"><Plus size={18} /></span><div><h2>自定义流程节点</h2><p>默认节点保持稳定，也可以补充适合自己的招聘阶段。</p></div></div>
          <div className="custom-status-editor">
            <div className="status-input-row"><input maxLength={20} value={newStatus} onChange={(event) => setNewStatus(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submitStatus() }} placeholder="例如：主管面 / 意向书" /><Button variant="primary" size="sm" onClick={submitStatus}>添加节点</Button></div>
            {data.customStatuses.length ? <div className="custom-status-list">{data.customStatuses.map((status) => {
              const inUse = data.applications.some((item) => item.status === status)
              return <span key={status}>{status}<button disabled={inUse} title={inUse ? '仍有投递使用此节点' : '删除节点'} onClick={() => onRemoveStatus(status)}><X size={13} /></button></span>
            })}</div> : <p className="settings-hint">还没有自定义节点。</p>}
          </div>
        </section>
      </div>
      <ConfirmDialog open={clearOpen} title="确定清空所有本地数据吗？" description="全部投递、面试复盘和流程历史都会被永久删除，此操作无法撤销。建议先导出 JSON 备份。" confirmText="确认清空" onClose={() => setClearOpen(false)} onConfirm={() => { onClearData(); setClearOpen(false); onNotify('本地数据已清空') }} />
      <ConfirmDialog
        open={Boolean(pendingImport)}
        title="导入并覆盖当前数据？"
        description={pendingImport ? `备份包含 ${pendingImport.applications.length} 条投递和 ${pendingImport.reviews.length} 篇复盘。导入后会替换当前全部数据，建议先导出 JSON 备份。` : ''}
        confirmText="确认导入"
        tone="normal"
        onClose={() => setPendingImport(undefined)}
        onConfirm={() => {
          if (!pendingImport) return
          onReplaceData(pendingImport)
          onNotify(`已恢复 ${pendingImport.applications.length} 条投递和 ${pendingImport.reviews.length} 篇复盘`)
          setPendingImport(undefined)
        }}
      />
    </div>
  )
}
