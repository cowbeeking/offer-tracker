import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Plus, RefreshCw, Search, X } from 'lucide-react'
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
import type { Application, ApplicationDraft, PageKey } from '@/types/application'
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
    replaceData,
    clearData,
    removeDemoData,
    setTheme,
    addCustomStatus,
    removeCustomStatus,
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

  const saveApplication = (draft: ApplicationDraft, secondaryDraft?: ApplicationDraft): void => {
    if (editing) {
      updateApplication(editing.id, draft)
      if (secondaryDraft) addApplication(secondaryDraft)
      notify(secondaryDraft ? '投递信息已更新，并创建了第 2 志愿' : '投递信息已更新')
    } else {
      addApplication(draft)
      if (secondaryDraft) addApplication(secondaryDraft)
      notify(secondaryDraft ? '投递记录及第 2 志愿已创建' : '投递记录已创建')
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

  const changeStatus = (id: string, status: string, event?: { date?: string; time?: string; note?: string }): void => {
    const current = state.applications.find((item) => item.id === id)
    if (!current || current.status === status) return
    updateStatus(id, status, event)
    notify(`已将 ${current.companyName} 更新为「${status}」`)
  }

  const openApplicationReview = (application: Application): void => {
    const existing = state.reviews.find((review) => review.applicationId === application.id)
    const review = existing ?? createInterviewReview(application)
    if (!existing) addReview(review)
    setReviewOpenRequest({ id: review.id, token: Date.now() })
    navigateTo('reviews')
    notify(existing ? `已打开 ${application.companyName} 的复盘` : `已为 ${application.companyName} 创建关联复盘`)
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
          {page === 'dashboard' && <DashboardPage applications={state.applications} statuses={statuses} onNavigate={navigateTo} onOpen={(item) => setDetailId(item.id)} />}
          {page === 'applications' && <ApplicationsPage applications={state.applications} statuses={statuses} searchRequest={searchRequest} onAdd={openCreate} onOpen={(item) => setDetailId(item.id)} onEdit={openEdit} onDelete={setDeleting} />}
          {page === 'board' && <BoardPage applications={state.applications} reviews={state.reviews} statuses={statuses} onOpen={(item) => setDetailId(item.id)} onReview={openApplicationReview} onStatusChange={changeStatus} />}
          {page === 'reviews' && <ReviewsPage applications={state.applications} reviews={state.reviews} openRequest={reviewOpenRequest} onAdd={addReview} onUpdate={updateReview} onDelete={deleteReview} onNotify={notify} />}
          {page === 'knowledge' && <KnowledgeNotesPage notes={state.knowledgeNotes} onAdd={addKnowledgeNote} onUpdate={updateKnowledgeNote} onDelete={deleteKnowledgeNote} onNotify={notify} />}
          {page === 'statistics' && <StatisticsPage applications={state.applications} />}
          {page === 'settings' && <SettingsPage data={state} onBack={() => navigateTo(lastWorkspacePage)} onReplaceData={replaceData} onClearData={clearData} onRemoveDemo={removeDemoData} onThemeChange={setTheme} onAddStatus={addCustomStatus} onRemoveStatus={removeCustomStatus} onNotify={notify} />}
        </div>
      </main>

      <ApplicationModal open={formOpen} application={editing} statuses={statuses} companies={companies} onSave={saveApplication} onClose={() => { setFormOpen(false); setEditing(undefined) }} />
      <ApplicationDetail application={detailApplication} statuses={statuses} onClose={() => setDetailId(undefined)} onEdit={openEdit} onDelete={setDeleting} onStatusChange={changeStatus} />
      <ConfirmDialog open={Boolean(deleting)} title="删除这条投递记录？" description={deleting ? `将永久删除「${deleting.companyName} · ${deleting.positionName}」及全部流程历史，此操作无法撤销。` : ''} confirmText="确认删除" onClose={() => setDeleting(undefined)} onConfirm={confirmDelete} />
      {toast && <div className={`toast ${toast.tone === 'success' ? 'toast-success' : 'toast-error'}`}><span>{toast.tone === 'success' ? <Check size={15} /> : <X size={15} />}</span>{toast.message}</div>}
    </div>
  )
}
