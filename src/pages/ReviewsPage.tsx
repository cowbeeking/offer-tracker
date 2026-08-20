import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Code2, Download, Eye, FileDown, FileText, Link2, Plus, Search, Sparkles, Trash2, Upload } from 'lucide-react'
import { LiveMarkdownEditor } from '@/components/LiveMarkdownEditor'
import { MarkdownContent } from '@/components/MarkdownContent'
import { MarkdownSourceEditor } from '@/components/MarkdownSourceEditor'
import { MarkdownToolbar } from '@/components/MarkdownToolbar'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Modal } from '@/components/ui/Modal'
import { useMarkdownDrafts } from '@/hooks/useMarkdownDrafts'
import type { Application, InterviewReview, WorkflowNode } from '@/types/application'
import { createInterviewReview, createReviewTitle } from '@/utils/review'
import { exportMarkdown, exportMarkdownPdf } from '@/utils/markdownExport'
import type { MarkdownEditorHandle } from '@/utils/markdownEditing'
import { readMarkdownFile } from '@/utils/markdownImport'
import { getReachedReviewNodes } from '@/utils/workflow'

interface ReviewsPageProps {
  applications: Application[]
  reviews: InterviewReview[]
  workflowNodes: WorkflowNode[]
  openRequest?: { id: string; token: number }
  onAdd: (review: InterviewReview) => void
  onUpdate: (id: string, changes: Partial<Pick<InterviewReview, 'applicationId' | 'workflowNodeId' | 'stageName' | 'title' | 'content'>>) => void
  onDelete: (id: string) => void
  onNotify: (message: string, tone?: 'success' | 'error') => void
}

type ReviewMode = 'source' | 'live' | 'preview'

function formatUpdatedAt(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

export function ReviewsPage({ applications, reviews, workflowNodes, openRequest, onAdd, onUpdate, onDelete, onNotify }: ReviewsPageProps): JSX.Element {
  const [selectedId, setSelectedId] = useState<string>()
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<ReviewMode>('live')
  const [deleting, setDeleting] = useState<InterviewReview>()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createApplicationId, setCreateApplicationId] = useState('')
  const [createWorkflowNodeId, setCreateWorkflowNodeId] = useState('')
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importApplicationId, setImportApplicationId] = useState('')
  const [importWorkflowNodeId, setImportWorkflowNodeId] = useState('')
  const markdownEditorRef = useRef<MarkdownEditorHandle>(null)
  const markdownFileInputRef = useRef<HTMLInputElement>(null)
  const applicationById = useMemo(() => new Map(applications.map((item) => [item.id, item])), [applications])
  const sortedApplications = useMemo(() => [...applications].sort((a, b) =>
    `${a.companyName}${a.positionName}`.localeCompare(`${b.companyName}${b.positionName}`, 'zh-CN')),
  [applications])
  const sortedReviews = useMemo(() => [...reviews].sort((a, b) => b.updatedAt - a.updatedAt), [reviews])
  const reviewByApplicationNode = useMemo(() => new Map<string, string>(reviews.flatMap((review) =>
    review.applicationId && review.workflowNodeId ? [[`${review.applicationId}:${review.workflowNodeId}`, review.id] as const] : [])), [reviews])
  const filteredReviews = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    if (!needle) return sortedReviews
    return sortedReviews.filter((review) => {
      const application = review.applicationId ? applicationById.get(review.applicationId) : undefined
      return `${review.title} ${review.content} ${application?.companyName ?? ''} ${application?.positionName ?? ''}`
        .toLocaleLowerCase()
        .includes(needle)
    })
  }, [applicationById, query, sortedReviews])
  const selected = reviews.find(({ id }) => id === selectedId)
  const drafts = useMarkdownDrafts(reviews, selectedId, (id, content) => onUpdate(id, { content }))
  const selectedContent = selected ? drafts.contentFor(selected) : ''
  const selectedApplication = selected?.applicationId ? applicationById.get(selected.applicationId) : undefined
  const selectedReviewNodes = useMemo(() => selectedApplication
    ? getReachedReviewNodes(selectedApplication, workflowNodes)
    : [], [selectedApplication, workflowNodes])
  const createApplication = applications.find((application) => application.id === createApplicationId)
  const createReviewNodes = useMemo(() => createApplication
    ? getReachedReviewNodes(createApplication, workflowNodes)
    : [], [createApplication, workflowNodes])
  const createNode = createReviewNodes.find((node) => node.id === createWorkflowNodeId)
  const createLinkExists = Boolean(createApplicationId && createWorkflowNodeId && reviewByApplicationNode.get(`${createApplicationId}:${createWorkflowNodeId}`))
  const importApplication = applications.find((application) => application.id === importApplicationId)
  const importReviewNodes = useMemo(() => importApplication
    ? getReachedReviewNodes(importApplication, workflowNodes)
    : [], [importApplication, workflowNodes])
  const importNode = importReviewNodes.find((node) => node.id === importWorkflowNodeId)
  const importLinkExists = Boolean(importApplicationId && importWorkflowNodeId && reviewByApplicationNode.get(`${importApplicationId}:${importWorkflowNodeId}`))

  useEffect(() => {
    if (selectedId && reviews.some(({ id }) => id === selectedId)) return
    setSelectedId(sortedReviews[0]?.id)
  }, [reviews, selectedId, sortedReviews])

  useEffect(() => {
    if (!openRequest) return
    setSelectedId(openRequest.id)
    setMode('live')
  }, [openRequest])

  const addReview = (): void => {
    if (!createApplication || !createNode) {
      onNotify('请先选择公司、职位和流程节点', 'error')
      return
    }
    if (createLinkExists) {
      onNotify('这条投递的该流程节点已经有复盘', 'error')
      return
    }
    const review = createInterviewReview(createApplication, createNode)
    onAdd(review)
    setSelectedId(review.id)
    setMode('live')
    setCreateDialogOpen(false)
    setCreateApplicationId('')
    setCreateWorkflowNodeId('')
    onNotify(`已创建复盘「${review.title}」`)
  }

  const importReview = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!importApplication || !importNode) {
      onNotify('请先选择公司、职位和流程节点', 'error')
      return
    }
    if (reviewByApplicationNode.get(`${importApplication.id}:${importNode.id}`)) {
      onNotify('这条投递的该流程节点已经有复盘', 'error')
      return
    }
    try {
      const { content } = await readMarkdownFile(file, '未命名面试复盘')
      const review = { ...createInterviewReview(importApplication, importNode), content }
      onAdd(review)
      setSelectedId(review.id)
      setMode('live')
      setImportDialogOpen(false)
      setImportApplicationId('')
      setImportWorkflowNodeId('')
      onNotify(`已导入复盘「${review.title}」`)
    } catch (error: unknown) {
      onNotify(error instanceof Error ? error.message : 'Markdown 复盘导入失败', 'error')
    }
  }

  const chooseReviewFile = (): void => {
    if (!importApplication || !importNode) {
      onNotify('请先选择公司、职位和流程节点', 'error')
      return
    }
    if (importLinkExists) {
      onNotify('这条投递的该流程节点已经有复盘', 'error')
      return
    }
    markdownFileInputRef.current?.click()
  }

  const exportReview = async (format: 'md' | 'pdf'): Promise<void> => {
    if (!selected) return
    try {
      const saved = format === 'md'
        ? await exportMarkdown(selected.title, selectedContent, '未命名面试复盘')
        : await exportMarkdownPdf(selected.title, selectedContent, '未命名面试复盘')
      if (saved) onNotify(`${format === 'md' ? 'Markdown' : 'PDF'} 复盘已导出`)
    } catch {
      onNotify(`${format === 'md' ? 'Markdown' : 'PDF'} 导出失败`, 'error')
    }
  }

  const confirmDelete = (): void => {
    if (!deleting) return
    onDelete(deleting.id)
    setDeleting(undefined)
    onNotify('面试复盘已删除')
  }

  return (
    <div className="page reviews-page">
      <header className="page-heading page-heading-row review-page-heading">
        <div><span className="eyebrow">Interview Notes</span><h1>面试复盘</h1><p>用 Markdown 沉淀问题、回答和下一步行动。</p></div>
        <div className="review-heading-actions">
          <Button size="sm" icon={<Upload size={14} />} onClick={() => setImportDialogOpen(true)}>导入 .md</Button>
          <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => { setCreateApplicationId(''); setCreateWorkflowNodeId(''); setCreateDialogOpen(true) }}>新建复盘</Button>
          <input ref={markdownFileInputRef} type="file" hidden accept=".md,.markdown,text/markdown" onChange={(event) => void importReview(event)} />
        </div>
      </header>

      <section className={`panel review-workspace ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <aside className="review-notes-sidebar">
          <button className="review-sidebar-toggle" onClick={() => setSidebarCollapsed((value) => !value)} title={sidebarCollapsed ? '展开全部笔记' : '向左折叠全部笔记'} aria-label={sidebarCollapsed ? '展开全部笔记' : '折叠全部笔记'}>
            <span aria-hidden="true">{sidebarCollapsed ? '>' : '<'}</span>
          </button>
          <div className="review-sidebar-head">
            <div><strong>全部笔记</strong><span>{reviews.length}</span></div>
            <label className="review-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索复盘内容" /></label>
          </div>
          <div className="review-note-list">
            {filteredReviews.map((review) => {
              const application = review.applicationId ? applicationById.get(review.applicationId) : undefined
              return (
                <div key={review.id} className={`review-note-card ${selectedId === review.id ? 'active' : ''}`}>
                  <button className="review-note-select" onClick={() => { setSelectedId(review.id); setMode('live') }}>
                    <span className="review-note-icon"><FileText size={15} /></span>
                    <span className="review-note-copy">
                      <strong>{review.title.trim() || '未命名面试复盘'}</strong>
                      <small>{application ? `${application.companyName} · ${application.positionName}${review.stageName ? ` · ${review.stageName}` : ''}` : '未关联投递'}</small>
                      <time>{formatUpdatedAt(review.updatedAt)}</time>
                    </span>
                  </button>
                  <button className="review-note-delete" aria-label={`删除 ${review.title.trim() || '未命名面试复盘'}`} title="删除复盘" onClick={() => setDeleting(review)}><Trash2 size={13} /></button>
                </div>
              )
            })}
            {!filteredReviews.length && <div className="review-list-empty"><FileText size={20} /><strong>{reviews.length ? '没有匹配的复盘' : '还没有面试复盘'}</strong><span>{reviews.length ? '换个关键词试试。' : '新建一篇 Markdown 笔记开始记录。'}</span></div>}
          </div>
        </aside>

        <div className="review-editor-shell">
          {selected ? <>
            <div className="review-editor-head">
              <input className="review-title-input" value={selected.title} maxLength={100} onChange={(event) => onUpdate(selected.id, { title: event.target.value })} placeholder="未命名面试复盘" />
              <div className="review-editor-tools">
                <div className="review-mode-switch" role="group" aria-label="编辑模式">
                  <button className={mode === 'source' ? 'active' : ''} onClick={() => setMode('source')}><Code2 size={13} />源码</button>
                  <button className={mode === 'live' ? 'active' : ''} onClick={() => setMode('live')}><Sparkles size={13} />实时预览</button>
                  <button className={mode === 'preview' ? 'active' : ''} onClick={() => setMode('preview')}><Eye size={13} />预览</button>
                </div>
                <Button size="sm" variant="ghost" icon={<Download size={14} />} onClick={() => void exportReview('md')}>导出 .md</Button>
                <Button size="sm" variant="ghost" icon={<FileDown size={14} />} onClick={() => void exportReview('pdf')}>导出 PDF</Button>
              </div>
            </div>
            <div className="review-meta-bar">
              <Link2 size={14} />
              <span>关联投递</span>
              <select value={selected.applicationId ?? ''} onChange={(event) => {
                const applicationId = event.target.value || undefined
                const application = applications.find((item) => item.id === applicationId)
                const node = application
                  ? getReachedReviewNodes(application, workflowNodes).find((item) => item.id === selected.workflowNodeId)
                  : undefined
                const key = applicationId && node ? `${applicationId}:${node.id}` : undefined
                if (key && reviewByApplicationNode.get(key) && reviewByApplicationNode.get(key) !== selected.id) {
                  onNotify('这条投递的该流程节点已经有复盘', 'error')
                  return
                }
                onUpdate(selected.id, {
                  applicationId,
                  workflowNodeId: node?.id,
                  stageName: node?.name,
                  ...(application ? { title: createReviewTitle(application, node) } : {}),
                })
              }}>
                <option value="">不关联投递</option>
                {sortedApplications.map((application) => <option value={application.id} key={application.id}>{application.companyName} · {application.positionName}</option>)}
              </select>
              <span>流程节点</span>
              <select disabled={!selectedApplication} value={selected.workflowNodeId ?? ''} onChange={(event) => {
                const workflowNodeId = event.target.value || undefined
                const node = selectedReviewNodes.find((item) => item.id === workflowNodeId)
                const application = selectedApplication
                const key = selected.applicationId && workflowNodeId ? `${selected.applicationId}:${workflowNodeId}` : undefined
                if (key && reviewByApplicationNode.get(key) && reviewByApplicationNode.get(key) !== selected.id) {
                  onNotify('这条投递的该流程节点已经有复盘', 'error')
                  return
                }
                onUpdate(selected.id, { workflowNodeId, stageName: node?.name, ...(application ? { title: createReviewTitle(application, node) } : {}) })
              }}>
                <option value="">{selectedApplication && !selectedReviewNodes.length ? '暂无已到达的复盘节点' : '未指定节点'}</option>
                {selectedReviewNodes.map((node) => <option value={node.id} key={node.id}>{node.name}</option>)}
              </select>
              <i />
              <small>{drafts.isPending(selected.id) ? '等待定时保存…' : `每 1 秒定时保存 · 更新于 ${formatUpdatedAt(selected.updatedAt)}`}</small>
            </div>
            <MarkdownToolbar disabled={mode === 'preview'} onAction={(action) => markdownEditorRef.current?.applyAction(action)} />
            <div className={`review-document mode-${mode}`}>
              {mode === 'preview' && <article className="markdown-preview markdown-prose"><MarkdownContent source={selectedContent} /></article>}
              {mode === 'source' && <MarkdownSourceEditor ref={markdownEditorRef} value={selectedContent} onChange={(content, kind) => drafts.changeContent(selected, content, kind)} />}
              {mode === 'live' && <LiveMarkdownEditor ref={markdownEditorRef} documentId={selected.id} value={selectedContent} onChange={(content, kind) => drafts.changeContent(selected, content, kind)} />}
            </div>
          </> : <div className="review-editor-empty"><span><FileText size={25} /></span><h2>记录一次面试</h2><p>点击右上角新建复盘，使用 Markdown 记录面试过程。</p></div>}
        </div>
      </section>

      <ConfirmDialog open={Boolean(deleting)} title="删除这篇面试复盘？" description={deleting ? `「${deleting.title.trim() || '未命名面试复盘'}」将被永久删除，此操作无法撤销。` : ''} confirmText="确认删除" onClose={() => setDeleting(undefined)} onConfirm={confirmDelete} />
      <Modal open={createDialogOpen} width="sm" title="新建面试复盘" description="选择已经到达的笔试或面试节点，创建与该投递关联的复盘。" onClose={() => setCreateDialogOpen(false)}>
        <form className="review-import-form" onSubmit={(event) => { event.preventDefault(); addReview() }}>
          <div className="review-import-grid">
            <label className="field"><span>公司与职位 <em>*</em></span><select autoFocus required value={createApplicationId} onChange={(event) => { setCreateApplicationId(event.target.value); setCreateWorkflowNodeId('') }}><option value="">请选择投递</option>{sortedApplications.map((application) => <option value={application.id} key={application.id}>{application.companyName} · {application.positionName}</option>)}</select></label>
            <label className="field"><span>流程节点 <em>*</em></span><select required disabled={!createApplication} value={createWorkflowNodeId} onChange={(event) => setCreateWorkflowNodeId(event.target.value)}><option value="">{createApplication && !createReviewNodes.length ? '暂无已到达的复盘节点' : '请选择节点'}</option>{createReviewNodes.map((node) => <option value={node.id} key={node.id}>{node.name}</option>)}</select></label>
          </div>
          <div className={`review-import-name ${createLinkExists ? 'duplicate' : ''}`}><span>创建后名称</span><strong>{createApplication && createNode ? createReviewTitle(createApplication, createNode) : '选择完整后自动生成'}</strong>{createLinkExists && <small>该投递的这个节点已经有复盘</small>}</div>
          <footer className="modal-footer"><Button type="button" onClick={() => setCreateDialogOpen(false)}>取消</Button><Button type="submit" variant="primary" icon={<Plus size={14} />} disabled={!createApplication || !createNode || createLinkExists}>创建复盘</Button></footer>
        </form>
      </Modal>
      <Modal open={importDialogOpen} width="sm" title="导入面试复盘" description="先确定公司、职位和节点，再选择 Markdown 文件。原文件名不会被使用。" onClose={() => setImportDialogOpen(false)}>
        <form className="review-import-form" onSubmit={(event) => { event.preventDefault(); chooseReviewFile() }}>
          <div className="review-import-grid">
            <label className="field"><span>公司与职位 <em>*</em></span><select autoFocus required value={importApplicationId} onChange={(event) => { setImportApplicationId(event.target.value); setImportWorkflowNodeId('') }}><option value="">请选择投递</option>{sortedApplications.map((application) => <option value={application.id} key={application.id}>{application.companyName} · {application.positionName}</option>)}</select></label>
            <label className="field"><span>流程节点 <em>*</em></span><select required disabled={!importApplication} value={importWorkflowNodeId} onChange={(event) => setImportWorkflowNodeId(event.target.value)}><option value="">{importApplication && !importReviewNodes.length ? '暂无已到达的复盘节点' : '请选择节点'}</option>{importReviewNodes.map((node) => <option value={node.id} key={node.id}>{node.name}</option>)}</select></label>
          </div>
          <div className={`review-import-name ${importLinkExists ? 'duplicate' : ''}`}><span>导入后名称</span><strong>{importApplication && importNode ? createReviewTitle(importApplication, importNode) : '选择完整后自动生成'}</strong>{importLinkExists && <small>该投递的这个节点已经有复盘</small>}</div>
          <footer className="modal-footer"><Button type="button" onClick={() => setImportDialogOpen(false)}>取消</Button><Button type="submit" variant="primary" icon={<Upload size={14} />} disabled={!importApplication || !importNode || importLinkExists}>选择 MD 文件</Button></footer>
        </form>
      </Modal>
    </div>
  )
}
