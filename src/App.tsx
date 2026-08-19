import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, BellRing, Check, Clock3, Plus, RefreshCw, Search, X } from 'lucide-react'
import { ApplicationDetail } from '@/components/ApplicationDetail'
import { ApplicationModal } from '@/components/ApplicationModal'
import { Sidebar } from '@/components/Sidebar'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/stores/AppStore'
import { ApplicationsPage } from '@/pages/ApplicationsPage'
import { BoardPage } from '@/pages/BoardPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { StatisticsPage } from '@/pages/StatisticsPage'
import { ReviewsPage } from '@/pages/ReviewsPage'
import { KnowledgeNotesPage } from '@/pages/KnowledgeNotesPage'
import type { Application, ApplicationDraft, ApplicationNodeProgress, PageKey, WorkflowNode } from '@/types/application'
import { createInterviewReview } from '@/utils/review'

const PAGE_LABELS: Record<PageKey, string> = {
  dashboard: '概览',
  applications: '投递记录',
  board: '流程看板',
  reviews: '面试复盘',
  knowledge: '知识笔记',
  statistics: '数据统计',
  settings: '设置',
}

function playReminderSound(): void {
  const AudioContextClass = window.AudioContext
  const context = new AudioContextClass()
  const now = context.currentTime
  ;[660, 880].forEach((frequency, index) => {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, now + index * 0.16)
    gain.gain.exponentialRampToValueAtTime(0.16, now + index * 0.16 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.16 + 0.32)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(now + index * 0.16)
    oscillator.stop(now + index * 0.16 + 0.34)
  })
  window.setTimeout(() => void context.close(), 900)
}

function localDateTimeValue(date = new Date()): string {
  const datePart = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return `${datePart}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function App(): JSX.Element {
  const {
    state,
    loading,
    loadError,
    persistenceStatus,
    persistenceError,
    statuses,
    addApplication,
    updateApplication,
    deleteApplication,
    addReview,
    updateReview,
    deleteReview,
    addKnowledgeNote,
    updateKnowledgeNote,
    deleteKnowledgeNote,
    updateStatus,
    undoStatus,
    replaceData,
    clearData,
    removeDemoData,
    setTheme,
    setWorkflowNodes,
    updateNodeProgress,
    retryLoad,
    retrySave,
  } = useAppStore()
  const [page, setPage] = useState<PageKey>('dashboard')
  const [lastWorkspacePage, setLastWorkspacePage] = useState<Exclude<PageKey, 'settings'>>('dashboard')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Application | undefined>()
  const [detailId, setDetailId] = useState<string>()
  const [deleting, setDeleting] = useState<Application>()
  const [reviewOpenRequest, setReviewOpenRequest] = useState<{ id: string; token: number }>()
  const [searchRequest, setSearchRequest] = useState(0)
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' }>()
  const [reminderAlert, setReminderAlert] = useState<{ application: Application; node: WorkflowNode; scheduledAt: string }>()
  const presentedReminderKeys = useRef(new Set<string>())
  const reminderTimers = useRef(new Map<string, number>())
  const detailApplication = state.applications.find((application) => application.id === detailId)
  const companies = useMemo(() => state.applications.map((item) => item.companyName), [state.applications])

  const navigateTo = useCallback((nextPage: PageKey): void => {
    if (nextPage === 'settings') {
      if (page !== 'settings') setLastWorkspacePage(page)
      setFormOpen(false)
      setEditing(undefined)
      setDetailId(undefined)
      setDeleting(undefined)
    } else {
      setLastWorkspacePage(nextPage)
    }
    setPage(nextPage)
  }, [page])

  const notify = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    setToast({ message, tone })
  }, [])

  const presentReminder = useCallback((application: Application, node: WorkflowNode, progress: ApplicationNodeProgress): void => {
    if (!progress.scheduledAt) return
    const key = `${application.id}:${node.id}:${progress.scheduledAt}:${progress.reminderMinutesBefore ?? ''}`
    if (presentedReminderKeys.current.has(key)) return
    presentedReminderKeys.current.add(key)
    updateNodeProgress(application.id, node, { reminderSentAt: Date.now() })
    setReminderAlert({ application, node, scheduledAt: progress.scheduledAt })
    void window.desktopApi?.showReminder()
    try { playReminderSound() } catch { /* 系统禁用音频时仍显示提醒。 */ }
  }, [updateNodeProgress])

  const handleNodeProgress = useCallback((applicationId: string, node: WorkflowNode, changes: Partial<Omit<ApplicationNodeProgress, 'workflowNodeId' | 'updatedAt'>>): void => {
    const application = state.applications.find((item) => item.id === applicationId)
    const current = application?.nodeProgress.find((progress) => progress.workflowNodeId === node.id)
    updateNodeProgress(applicationId, node, changes)
    if (!application) return
    const scheduleChanged = Object.prototype.hasOwnProperty.call(changes, 'scheduledAt') || Object.prototype.hasOwnProperty.call(changes, 'reminderMinutesBefore')
    const next: ApplicationNodeProgress = {
      workflowNodeId: node.id,
      ...current,
      ...changes,
      state: changes.state ?? current?.state ?? 'active',
      reminderSentAt: scheduleChanged ? undefined : changes.reminderSentAt ?? current?.reminderSentAt,
      updatedAt: Date.now(),
    }
    const timerKey = `${applicationId}:${node.id}`
    const existingTimer = reminderTimers.current.get(timerKey)
    if (existingTimer !== undefined) window.clearTimeout(existingTimer)
    reminderTimers.current.delete(timerKey)
    if (next.state !== 'active' || !next.scheduledAt || next.reminderMinutesBefore === undefined || next.reminderSentAt) return
    const scheduledTime = new Date(next.scheduledAt).getTime()
    const now = Date.now()
    const delay = Math.max(0, scheduledTime - next.reminderMinutesBefore * 60_000 - now)
    if (now > scheduledTime + 60 * 60_000 || delay > 2_147_000_000) return
    const timer = window.setTimeout(() => {
      reminderTimers.current.delete(timerKey)
      presentReminder(application, node, next)
    }, delay)
    reminderTimers.current.set(timerKey, timer)
  }, [presentReminder, state.applications, updateNodeProgress])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(undefined), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = (): void => {
      const dark = state.theme === 'dark' || (state.theme === 'system' && media.matches)
      document.documentElement.classList.toggle('dark', dark)
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
    }
    applyTheme()
    media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [state.theme])

  useEffect(() => {
    const checkReminders = (): void => {
      if (reminderAlert) return
      const now = Date.now()
      const due = state.applications.flatMap((application) => application.nodeProgress.flatMap((progress) => {
        if (progress.state !== 'active' || !progress.scheduledAt || progress.reminderMinutesBefore === undefined || progress.reminderSentAt) return []
        const node = state.workflowNodes.find((item) => item.id === progress.workflowNodeId)
        if (!node) return []
        const scheduledTime = new Date(progress.scheduledAt).getTime()
        const reminderTime = scheduledTime - progress.reminderMinutesBefore * 60_000
        if (now < reminderTime || now > scheduledTime + 60 * 60_000) return []
        return [{ application, node, progress, scheduledTime }]
      })).sort((a, b) => a.scheduledTime - b.scheduledTime)[0]
      if (!due) return
      presentReminder(due.application, due.node, due.progress)
    }
    checkReminders()
    const timer = window.setInterval(checkReminders, 30_000)
    return () => window.clearInterval(timer)
  }, [presentReminder, reminderAlert, state.applications, state.workflowNodes])

  const openCreate = useCallback(() => {
    setEditing(undefined)
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((application: Application) => {
    setEditing(application)
    setDetailId(undefined)
    setFormOpen(true)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setFormOpen(false)
        setDetailId(undefined)
        return
      }
      const target = event.target
      if (target instanceof HTMLElement && target.matches('input, textarea, select, [contenteditable="true"]')) return
      if (page === 'settings' || formOpen || detailId || deleting) return
      if (!(event.ctrlKey || event.metaKey)) return
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault()
        openCreate()
      }
      if (event.key.toLowerCase() === 'k') {
        event.preventDefault()
        navigateTo('applications')
        setSearchRequest((value) => value + 1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [deleting, detailId, formOpen, navigateTo, openCreate, page])

  const saveApplication = (draft: ApplicationDraft, additionalDrafts: ApplicationDraft[] = []): void => {
    if (editing) {
      updateApplication(editing.id, draft)
      additionalDrafts.forEach(addApplication)
      notify(additionalDrafts.length ? `投递信息已更新，并创建了 ${additionalDrafts.length} 条追加志愿` : '投递信息已更新')
    } else {
      addApplication(draft)
      additionalDrafts.forEach(addApplication)
      notify(additionalDrafts.length ? `已创建 ${additionalDrafts.length + 1} 条志愿投递` : '投递记录已创建')
    }
    setFormOpen(false)
    setEditing(undefined)
  }

  const confirmDelete = (): void => {
    if (!deleting) return
    deleteApplication(deleting.id)
    if (detailId === deleting.id) setDetailId(undefined)
    setDeleting(undefined)
    notify('投递记录已删除')
  }

  const moveBoardCard = (id: string, status: string, event: { date: string; time: string; note?: string }): void => {
    const current = state.applications.find((item) => item.id === id)
    if (!current || current.status === status) return
    updateStatus(id, status, event)
    notify(`已将 ${current.companyName} 更新为「${status}」，原节点已完成`)
  }

  const undoApplicationStatus = (application: Application): void => {
    const currentHistoryIndex = application.histories.map((history) => history.status).lastIndexOf(application.status)
    const previousHistory = currentHistoryIndex > 0
      ? [...application.histories.slice(0, currentHistoryIndex)].reverse().find((history) =>
          history.status !== application.status && state.workflowNodes.some((node) => node.name === history.status))
      : undefined
    if (!previousHistory) {
      notify('当前已经是该投递的第一个节点，无法继续撤销', 'error')
      return
    }
    const currentNode = state.workflowNodes.find((node) => node.name === application.status)
    if (currentNode) {
      const timerKey = `${application.id}:${currentNode.id}`
      const timer = reminderTimers.current.get(timerKey)
      if (timer !== undefined) window.clearTimeout(timer)
      reminderTimers.current.delete(timerKey)
      if (reminderAlert?.application.id === application.id && reminderAlert.node.id === currentNode.id) setReminderAlert(undefined)
    }
    undoStatus(application.id)
    notify(`已撤销到「${previousHistory.status}」，并清理后一节点的待办与复盘`)
  }

  const openApplicationReview = (application: Application, node: WorkflowNode): void => {
    const existing = state.reviews.find((review) => review.applicationId === application.id && review.workflowNodeId === node.id)
    const review = existing ?? createInterviewReview(application, node)
    if (!existing) addReview(review)
    setReviewOpenRequest({ id: review.id, token: Date.now() })
    setDetailId(undefined)
    navigateTo('reviews')
    notify(existing ? `已打开 ${application.companyName} 的「${node.name}」复盘` : `已创建 ${application.companyName} 的「${node.name}」复盘`)
  }

  const previewReminder = (): void => {
    const application = state.applications[0]
    const node = state.workflowNodes.find((item) => item.name === application?.status) ?? state.workflowNodes[0]
    if (!application || !node) {
      notify('请先添加一条投递记录再试听提醒', 'error')
      return
    }
    setReminderAlert({ application, node, scheduledAt: localDateTimeValue() })
    void window.desktopApi?.showReminder()
    try { playReminderSound() } catch { /* 系统禁用音频时仍显示提醒。 */ }
  }

  if (loading) {
    return <div className="app-loading"><span className="brand-mark">秋</span><div><strong>秋招 Tracker</strong><small>正在读取本地数据…</small></div></div>
  }

  if (loadError) {
    return <div className="storage-error"><span><AlertTriangle size={22} /></span><h1>本地数据读取失败</h1><p>{loadError}</p><Button variant="primary" icon={<RefreshCw size={14} />} onClick={retryLoad}>重新读取</Button></div>
  }

  return (
    <div className={`app-shell ${page === 'settings' ? 'settings-mode' : ''}`}>
      {page !== 'settings' && <Sidebar page={page} persistenceStatus={persistenceStatus} persistenceError={persistenceError} onNavigate={navigateTo} onRetrySave={retrySave} />}
      <main className={`app-main ${page === 'settings' ? 'settings-main' : ''}`}>
        {page !== 'settings' && <div className="app-topbar">
          <div className="breadcrumb"><span>Autumn Tracker</span><i>/</i><strong>{PAGE_LABELS[page]}</strong></div>
          <div className="topbar-actions">
            <button className="topbar-search" onClick={() => { navigateTo('applications'); setSearchRequest((value) => value + 1) }}><Search size={15} /><span>快速搜索</span><kbd>Ctrl K</kbd></button>
            {page === 'applications' && <Button className="topbar-create" variant="primary" size="sm" icon={<Plus size={14} />} onClick={openCreate}>新增投递</Button>}
          </div>
        </div>}
        <div className={`page-container ${page === 'settings' ? 'settings-container' : ''}`}>
          {page === 'dashboard' && <DashboardPage applications={state.applications} statuses={statuses} workflowNodes={state.workflowNodes} onNavigate={navigateTo} onOpen={(item) => setDetailId(item.id)} />}
          {page === 'applications' && <ApplicationsPage applications={state.applications} statuses={statuses} searchRequest={searchRequest} onAdd={openCreate} onOpen={(item) => setDetailId(item.id)} onEdit={openEdit} onDelete={setDeleting} />}
          {page === 'board' && <BoardPage applications={state.applications} statuses={statuses} onOpen={(item) => setDetailId(item.id)} onStatusChange={moveBoardCard} onInvalidMove={(message) => notify(message, 'error')} />}
          {page === 'reviews' && <ReviewsPage applications={state.applications} reviews={state.reviews} workflowNodes={state.workflowNodes} openRequest={reviewOpenRequest} onAdd={addReview} onUpdate={updateReview} onDelete={deleteReview} onNotify={notify} />}
          {page === 'knowledge' && <KnowledgeNotesPage notes={state.knowledgeNotes} onAdd={addKnowledgeNote} onUpdate={updateKnowledgeNote} onDelete={deleteKnowledgeNote} onNotify={notify} />}
          {page === 'statistics' && <StatisticsPage applications={state.applications} />}
          {page === 'settings' && <SettingsPage data={state} onBack={() => navigateTo(lastWorkspacePage)} onReplaceData={replaceData} onClearData={clearData} onRemoveDemo={removeDemoData} onThemeChange={setTheme} onSetWorkflowNodes={setWorkflowNodes} onPreviewReminder={previewReminder} onNotify={notify} />}
        </div>
      </main>

      <ApplicationModal open={formOpen} application={editing} statuses={statuses} companies={companies} onSave={saveApplication} onClose={() => { setFormOpen(false); setEditing(undefined) }} />
      <ApplicationDetail application={detailApplication} workflowNodes={state.workflowNodes} reviews={state.reviews} onClose={() => setDetailId(undefined)} onEdit={openEdit} onDelete={setDeleting} onUndo={undoApplicationStatus} onReview={openApplicationReview} onNodeProgress={handleNodeProgress} />
      <ConfirmDialog open={Boolean(deleting)} title="删除这条投递记录？" description={deleting ? `将永久删除「${deleting.companyName} · ${deleting.positionName}」及全部流程历史，此操作无法撤销。` : ''} confirmText="确认删除" onClose={() => setDeleting(undefined)} onConfirm={confirmDelete} />
      {reminderAlert && <div className="node-reminder" role="alertdialog" aria-label="招聘节点提醒">
        <button className="node-reminder-close" aria-label="关闭提醒" onClick={() => setReminderAlert(undefined)}><X size={14} /></button>
        <span className="node-reminder-icon"><BellRing size={21} /></span>
        <div className="node-reminder-copy"><small>节点提醒</small><strong>{reminderAlert.application.companyName} · {reminderAlert.node.name}</strong><p>{reminderAlert.application.positionName}</p><time><Clock3 size={12} />{new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(reminderAlert.scheduledAt))}</time></div>
        <button className="node-reminder-open" onClick={() => { setDetailId(reminderAlert.application.id); setReminderAlert(undefined) }}>查看节点</button>
      </div>}
      {toast && <div className={`toast ${toast.tone === 'success' ? 'toast-success' : 'toast-error'}`}><span>{toast.tone === 'success' ? <Check size={15} /> : <X size={15} />}</span>{toast.message}</div>}
    </div>
  )
}
