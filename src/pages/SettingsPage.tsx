import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { BookOpenText, ChevronLeft, Database, Download, FileJson, FileSpreadsheet, GripVertical, Monitor, Moon, Plus, Power, RotateCcw, Settings2, Sun, Trash2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { applicationsToCsv, createBackup, parseBackup } from '@/services/backup'
import type { AppStateData, ThemeMode, WorkflowNode } from '@/types/application'
import { toDateInput } from '@/utils/date'
import { createId } from '@/utils/id'

interface SettingsPageProps {
  data: AppStateData
  onBack: () => void
  onReplaceData: (data: AppStateData) => void
  onClearData: () => void
  onRemoveDemo: () => void
  onThemeChange: (theme: ThemeMode) => void
  onSetWorkflowNodes: (nodes: WorkflowNode[]) => void
  onPreviewReminder: () => void
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

export function SettingsPage({ data, onBack, onReplaceData, onClearData, onRemoveDemo, onThemeChange, onSetWorkflowNodes, onPreviewReminder, onNotify }: SettingsPageProps): JSX.Element {
  const [clearOpen, setClearOpen] = useState(false)
  const [pendingImport, setPendingImport] = useState<AppStateData>()
  const [newStatus, setNewStatus] = useState('')
  const [newStatusHasReview, setNewStatusHasReview] = useState(false)
  const [draggedNodeId, setDraggedNodeId] = useState<string>()
  const [dragTargetNodeId, setDragTargetNodeId] = useState<string>()
  const [workflowOrderChanged, setWorkflowOrderChanged] = useState(false)
  const [autoLaunch, setAutoLaunch] = useState(false)
  const [autoLaunchLoading, setAutoLaunchLoading] = useState(true)
  const fileInput = useRef<HTMLInputElement>(null)
  const workflowRowRefs = useRef(new Map<string, HTMLDivElement>())
  const previousWorkflowPositions = useRef(new Map<string, number>())
  const demoCount = data.applications.filter((item) => item.isDemo).length

  useEffect(() => {
    let active = true
    const syncAutoLaunch = async (): Promise<void> => {
      if (!window.desktopApi) {
        if (active) setAutoLaunchLoading(false)
        return
      }
      setAutoLaunchLoading(true)
      try {
        const enabled = await window.desktopApi.getAutoLaunch()
        if (active) setAutoLaunch(enabled)
      } finally {
        if (active) setAutoLaunchLoading(false)
      }
    }
    const syncWhenVisible = (): void => {
      if (document.visibilityState === 'visible') void syncAutoLaunch()
    }

    void syncAutoLaunch()
    window.addEventListener('focus', syncWhenVisible)
    document.addEventListener('visibilitychange', syncWhenVisible)
    return () => {
      active = false
      window.removeEventListener('focus', syncWhenVisible)
      document.removeEventListener('visibilitychange', syncWhenVisible)
    }
  }, [])

  useLayoutEffect(() => {
    workflowRowRefs.current.forEach((element, id) => {
      const previousTop = previousWorkflowPositions.current.get(id)
      if (previousTop === undefined) return
      const delta = previousTop - element.getBoundingClientRect().top
      if (Math.abs(delta) < 1) return
      element.animate([
        { transform: `translateY(${delta}px)` },
        { transform: 'translateY(0)' },
      ], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' })
    })
    previousWorkflowPositions.current.clear()
  }, [data.workflowNodes])

  const toggleAutoLaunch = async (): Promise<void> => {
    if (!window.desktopApi || autoLaunchLoading) return
    setAutoLaunchLoading(true)
    try {
      const enabled = await window.desktopApi.setAutoLaunch(!autoLaunch)
      setAutoLaunch(enabled)
      onNotify(enabled ? '已开启开机自启' : '已关闭开机自启')
    } catch {
      onNotify('无法更新开机自启设置', 'error')
    } finally {
      setAutoLaunchLoading(false)
    }
  }

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
    if (data.workflowNodes.some((node) => node.name === status)) {
      onNotify('这个流程节点已经存在', 'error')
      return
    }
    onSetWorkflowNodes([...data.workflowNodes, { id: createId(), name: status, hasReview: newStatusHasReview }])
    setNewStatus('')
    setNewStatusHasReview(false)
    onNotify(`已添加流程节点「${status}」`)
  }

  const moveNode = (event: DragEvent, targetId: string): void => {
    event.preventDefault()
    if (!draggedNodeId || draggedNodeId === targetId) return
    setDragTargetNodeId(targetId)
    const nodes = [...data.workflowNodes]
    const fromIndex = nodes.findIndex((node) => node.id === draggedNodeId)
    const targetIndex = nodes.findIndex((node) => node.id === targetId)
    if (fromIndex < 0 || targetIndex < 0) return
    workflowRowRefs.current.forEach((element, id) => previousWorkflowPositions.current.set(id, element.getBoundingClientRect().top))
    const [moved] = nodes.splice(fromIndex, 1)
    nodes.splice(targetIndex, 0, moved)
    onSetWorkflowNodes(nodes)
    setWorkflowOrderChanged(true)
  }

  return (
    <div className="page settings-page">
      <div className="settings-nav">
        <button className="settings-back" onClick={onBack}><ChevronLeft size={16} />返回</button>
        <span className="settings-nav-title"><Settings2 size={15} />设置中心</span>
      </div>
      <header className="settings-hero">
        <div><span className="eyebrow">Preferences</span><h1>设置</h1><p>管理界面外观、本地数据和招聘流程节点。</p></div>
        <span className="settings-summary"><Database size={15} />{data.applications.length} 条投递 · {data.reviews.length} 篇复盘 · {data.knowledgeNotes.length} 篇知识笔记</span>
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
          <div className="system-setting-row">
            <span className="settings-icon"><Power size={17} /></span>
            <div><strong>开机后台启动</strong><small>登录 Windows 后静默驻留系统托盘；提醒始终在桌面右下角弹窗并播放音乐，点击“查看节点”才打开主界面。</small></div>
            <Button size="sm" onClick={onPreviewReminder}>试听提醒</Button>
            <button className={`switch-control ${autoLaunch ? 'active' : ''}`} role="switch" aria-checked={autoLaunch} disabled={autoLaunchLoading || !window.desktopApi} onClick={() => void toggleAutoLaunch()}><span /></button>
          </div>
        </section>

        <section className="settings-section panel">
          <div className="settings-copy"><span className="settings-icon"><Database size={18} /></span><div><h2>数据管理</h2><p>{data.applications.length} 条投递、{data.reviews.length} 篇复盘和 {data.knowledgeNotes.length} 篇知识笔记已保存在本地 IndexedDB。</p></div></div>
          <div className="data-actions">
            <button onClick={() => void exportJson()}><span className="data-action-icon"><FileJson size={19} /></span><span><strong>导出 JSON</strong><small>完整备份投递、复盘、知识笔记、流程历史和设置</small></span><Download size={16} /></button>
            <button onClick={() => void exportCsv()}><span className="data-action-icon"><FileSpreadsheet size={19} /></span><span><strong>导出 CSV</strong><small>可用 Excel 继续分析投递数据</small></span><Download size={16} /></button>
            <button onClick={() => void importJson()}><span className="data-action-icon"><Upload size={19} /></span><span><strong>导入备份</strong><small>校验 JSON 后完整恢复本地数据</small></span><RotateCcw size={16} /></button>
            <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={handleFile} />
          </div>
          {demoCount > 0 && <div className="demo-row"><div><strong>示例数据</strong><span>当前有 {demoCount} 条示例记录，可在开始正式使用前移除。</span></div><Button size="sm" onClick={() => { onRemoveDemo(); onNotify('示例数据已移除') }}>移除示例数据</Button></div>}
          <div className="danger-row"><div><strong>清空本地数据</strong><span>永久删除全部投递、面试复盘、知识笔记和流程历史。</span></div><Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => setClearOpen(true)}>清空数据</Button></div>
        </section>

        <section className="settings-section panel">
          <div className="settings-copy"><span className="settings-icon"><Plus size={18} /></span><div><h2>招聘流程编排</h2><p>拖动所有节点调整顺序，并为需要记录笔试或面试过程的节点开启复盘。</p></div></div>
          <div className="custom-status-editor workflow-editor">
            <div className="status-input-row workflow-create-row">
              <input maxLength={20} value={newStatus} onChange={(event) => setNewStatus(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submitStatus() }} placeholder="例如：主管面 / 群面 / 技术笔试" />
              <label className="review-toggle"><input type="checkbox" checked={newStatusHasReview} onChange={(event) => setNewStatusHasReview(event.target.checked)} /><BookOpenText size={14} /><span>需要复盘</span></label>
              <Button variant="primary" size="sm" onClick={submitStatus}>添加节点</Button>
            </div>
            <div className="workflow-node-list">
              {data.workflowNodes.map((node, index) => {
                const inUse = data.applications.some((item) => item.status === node.name || item.histories.some((history) => history.status === node.name) || item.nodeProgress.some((progress) => progress.workflowNodeId === node.id)) || data.reviews.some((review) => review.workflowNodeId === node.id)
                return <div
                  ref={(element) => { if (element) workflowRowRefs.current.set(node.id, element); else workflowRowRefs.current.delete(node.id) }}
                  className={`workflow-node-row ${draggedNodeId === node.id ? 'dragging' : ''} ${dragTargetNodeId === node.id && draggedNodeId !== node.id ? 'drag-target' : ''}`}
                  key={node.id}
                  onDragEnter={(event) => moveNode(event, node.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => { event.preventDefault(); setDragTargetNodeId(undefined) }}
                >
                  <span
                    className="workflow-drag"
                    title="拖动调整顺序"
                    draggable
                    onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', node.id); setDraggedNodeId(node.id); setWorkflowOrderChanged(false) }}
                    onDragEnd={() => { setDraggedNodeId(undefined); setDragTargetNodeId(undefined); if (workflowOrderChanged) onNotify('招聘流程顺序已更新') }}
                  ><GripVertical size={15} /></span>
                  <span className="workflow-index">{index + 1}</span>
                  <strong>{node.name}</strong>
                  {node.isTerminal && <small>结束状态</small>}
                  <label className="review-toggle compact"><input type="checkbox" checked={node.hasReview} onChange={(event) => onSetWorkflowNodes(data.workflowNodes.map((item) => item.id === node.id ? { ...item, hasReview: event.target.checked } : item))} /><BookOpenText size={13} /><span>{node.hasReview ? '需要复盘' : '无需复盘'}</span></label>
                  <button className="workflow-delete" disabled={inUse || data.workflowNodes.length <= 1} title={inUse ? '仍有投递使用此节点' : '删除节点'} onClick={() => { onSetWorkflowNodes(data.workflowNodes.filter((item) => item.id !== node.id)); onNotify(`已删除流程节点「${node.name}」`) }}><X size={13} /></button>
                </div>
              })}
            </div>
          </div>
        </section>
      </div>
      <ConfirmDialog open={clearOpen} title="确定清空所有本地数据吗？" description="全部投递、面试复盘、知识笔记和流程历史都会被永久删除，此操作无法撤销。建议先导出 JSON 备份。" confirmText="确认清空" onClose={() => setClearOpen(false)} onConfirm={() => { onClearData(); setClearOpen(false); onNotify('本地数据已清空') }} />
      <ConfirmDialog
        open={Boolean(pendingImport)}
        title="导入并覆盖当前数据？"
        description={pendingImport ? `备份包含 ${pendingImport.applications.length} 条投递、${pendingImport.reviews.length} 篇复盘和 ${pendingImport.knowledgeNotes.length} 篇知识笔记。导入后会替换当前全部数据，建议先导出 JSON 备份。` : ''}
        confirmText="确认导入"
        tone="normal"
        onClose={() => setPendingImport(undefined)}
        onConfirm={() => {
          if (!pendingImport) return
          onReplaceData(pendingImport)
          onNotify(`已恢复 ${pendingImport.applications.length} 条投递、${pendingImport.reviews.length} 篇复盘和 ${pendingImport.knowledgeNotes.length} 篇知识笔记`)
          setPendingImport(undefined)
        }}
      />
    </div>
  )
}
