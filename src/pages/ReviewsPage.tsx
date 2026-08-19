import { useEffect, useMemo, useState } from 'react'
import { Download, Eye, FileText, Link2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { Application, InterviewReview } from '@/types/application'
import { createInterviewReview } from '@/utils/review'

interface ReviewsPageProps {
  applications: Application[]
  reviews: InterviewReview[]
  onAdd: (review: InterviewReview) => void
  onUpdate: (id: string, changes: Partial<Pick<InterviewReview, 'applicationId' | 'title' | 'content'>>) => void
  onDelete: (id: string) => void
  onNotify: (message: string, tone?: 'success' | 'error') => void
}

function formatUpdatedAt(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

function safeFileName(title: string): string {
  const normalized = title.trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ')
  return `${normalized || '未命名面试复盘'}.md`
}

async function downloadMarkdown(content: string, name: string): Promise<void> {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

export function ReviewsPage({ applications, reviews, onAdd, onUpdate, onDelete, onNotify }: ReviewsPageProps): JSX.Element {
  const [selectedId, setSelectedId] = useState<string>()
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState(false)
  const [deleting, setDeleting] = useState<InterviewReview>()
  const applicationById = useMemo(() => new Map(applications.map((item) => [item.id, item])), [applications])
  const sortedApplications = useMemo(() => [...applications].sort((a, b) =>
    `${a.companyName}${a.positionName}`.localeCompare(`${b.companyName}${b.positionName}`, 'zh-CN')),
  [applications])
  const sortedReviews = useMemo(() => [...reviews].sort((a, b) => b.updatedAt - a.updatedAt), [reviews])
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

  useEffect(() => {
    if (selectedId && reviews.some(({ id }) => id === selectedId)) return
    setSelectedId(sortedReviews[0]?.id)
  }, [reviews, selectedId, sortedReviews])

  const addReview = (): void => {
    const review = createInterviewReview()
    onAdd(review)
    setSelectedId(review.id)
    setPreview(false)
  }

  const exportReview = async (): Promise<void> => {
    if (!selected) return
    try {
      const name = safeFileName(selected.title)
      const saved = window.desktopApi
        ? await window.desktopApi.saveFile(selected.content, name, 'md')
        : (await downloadMarkdown(selected.content, name), true)
      if (saved) onNotify('Markdown 复盘已导出')
    } catch {
      onNotify('Markdown 导出失败', 'error')
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
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={addReview}>新建复盘</Button>
      </header>

      <section className="panel review-workspace">
        <aside className="review-notes-sidebar">
          <div className="review-sidebar-head">
            <div><strong>全部笔记</strong><span>{reviews.length}</span></div>
            <label className="review-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索复盘内容" /></label>
          </div>
          <div className="review-note-list">
            {filteredReviews.map((review) => {
              const application = review.applicationId ? applicationById.get(review.applicationId) : undefined
              return (
                <div key={review.id} className={`review-note-card ${selectedId === review.id ? 'active' : ''}`}>
                  <button className="review-note-select" onClick={() => { setSelectedId(review.id); setPreview(false) }}>
                    <span className="review-note-icon"><FileText size={15} /></span>
                    <span className="review-note-copy">
                      <strong>{review.title.trim() || '未命名面试复盘'}</strong>
                      <small>{application ? `${application.companyName} · ${application.positionName}` : '未关联投递'}</small>
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
                  <button className={!preview ? 'active' : ''} onClick={() => setPreview(false)}><Pencil size={13} />编辑</button>
                  <button className={preview ? 'active' : ''} onClick={() => setPreview(true)}><Eye size={13} />预览</button>
                </div>
                <Button size="sm" variant="ghost" icon={<Download size={14} />} onClick={() => void exportReview()}>导出 .md</Button>
              </div>
            </div>
            <div className="review-meta-bar">
              <Link2 size={14} />
              <span>关联投递</span>
              <select value={selected.applicationId ?? ''} onChange={(event) => onUpdate(selected.id, { applicationId: event.target.value || undefined })}>
                <option value="">不关联投递</option>
                {sortedApplications.map((application) => <option value={application.id} key={application.id}>{application.companyName} · {application.positionName}</option>)}
              </select>
              <i />
              <small>已自动保存 · 更新于 {formatUpdatedAt(selected.updatedAt)}</small>
            </div>
            <div className={`review-document ${preview ? 'is-preview' : 'is-editing'}`}>
              {preview
                ? <article className="markdown-preview"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer">{children}</a> }}>{selected.content}</ReactMarkdown></article>
                : <textarea value={selected.content} onChange={(event) => onUpdate(selected.id, { content: event.target.value })} spellCheck={false} aria-label="Markdown 源码编辑器" />}
            </div>
          </> : <div className="review-editor-empty"><span><FileText size={25} /></span><h2>记录一次面试</h2><p>点击右上角新建复盘，使用 Markdown 记录面试过程。</p></div>}
        </div>
      </section>

      <ConfirmDialog open={Boolean(deleting)} title="删除这篇面试复盘？" description={deleting ? `「${deleting.title.trim() || '未命名面试复盘'}」将被永久删除，此操作无法撤销。` : ''} confirmText="确认删除" onClose={() => setDeleting(undefined)} onConfirm={confirmDelete} />
    </div>
  )
}
