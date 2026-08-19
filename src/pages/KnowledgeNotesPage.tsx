import { useEffect, useMemo, useRef, useState } from 'react'
import { BookMarked, Code2, Download, Eye, FileDown, FileText, PanelLeftClose, PanelLeftOpen, Plus, Search, Sparkles, Trash2 } from 'lucide-react'
import { LiveMarkdownEditor } from '@/components/LiveMarkdownEditor'
import { MarkdownContent } from '@/components/MarkdownContent'
import { MarkdownSourceEditor } from '@/components/MarkdownSourceEditor'
import { MarkdownToolbar } from '@/components/MarkdownToolbar'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { KnowledgeNote } from '@/types/application'
import { createKnowledgeNote } from '@/utils/knowledge'
import { exportMarkdown, exportMarkdownPdf } from '@/utils/markdownExport'
import type { MarkdownEditorHandle } from '@/utils/markdownEditing'

interface KnowledgeNotesPageProps {
  notes: KnowledgeNote[]
  onAdd: (note: KnowledgeNote) => void
  onUpdate: (id: string, changes: Partial<Pick<KnowledgeNote, 'title' | 'content'>>) => void
  onDelete: (id: string) => void
  onNotify: (message: string, tone?: 'success' | 'error') => void
}

type EditorMode = 'source' | 'live' | 'preview'

function formatUpdatedAt(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

export function KnowledgeNotesPage({ notes, onAdd, onUpdate, onDelete, onNotify }: KnowledgeNotesPageProps): JSX.Element {
  const [selectedId, setSelectedId] = useState<string>()
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<EditorMode>('live')
  const [deleting, setDeleting] = useState<KnowledgeNote>()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const markdownEditorRef = useRef<MarkdownEditorHandle>(null)
  const sortedNotes = useMemo(() => [...notes].sort((a, b) => b.updatedAt - a.updatedAt), [notes])
  const filteredNotes = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    if (!needle) return sortedNotes
    return sortedNotes.filter((note) => `${note.title} ${note.content}`.toLocaleLowerCase().includes(needle))
  }, [query, sortedNotes])
  const selected = notes.find(({ id }) => id === selectedId)

  useEffect(() => {
    if (selectedId && notes.some(({ id }) => id === selectedId)) return
    setSelectedId(sortedNotes[0]?.id)
  }, [notes, selectedId, sortedNotes])

  const addNote = (): void => {
    const note = createKnowledgeNote()
    onAdd(note)
    setSelectedId(note.id)
    setMode('live')
  }

  const exportNote = async (format: 'md' | 'pdf'): Promise<void> => {
    if (!selected) return
    try {
      const saved = format === 'md'
        ? await exportMarkdown(selected.title, selected.content, '未命名知识笔记')
        : await exportMarkdownPdf(selected.title, selected.content, '未命名知识笔记')
      if (saved) onNotify(`${format === 'md' ? 'Markdown' : 'PDF'} 知识笔记已导出`)
    } catch {
      onNotify(`${format === 'md' ? 'Markdown' : 'PDF'} 导出失败`, 'error')
    }
  }

  const confirmDelete = (): void => {
    if (!deleting) return
    onDelete(deleting.id)
    setDeleting(undefined)
    onNotify('知识笔记已删除')
  }

  return (
    <div className="page reviews-page knowledge-page">
      <header className="page-heading page-heading-row review-page-heading">
        <div><span className="eyebrow">Knowledge Base</span><h1>知识笔记</h1><p>用 Markdown 整理技术知识、易错点和延伸阅读。</p></div>
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={addNote}>新建笔记</Button>
      </header>

      <section className={`panel review-workspace ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <aside className="review-notes-sidebar">
          <button className="review-sidebar-toggle" onClick={() => setSidebarCollapsed((value) => !value)} title={sidebarCollapsed ? '展开全部笔记' : '向左折叠全部笔记'} aria-label={sidebarCollapsed ? '展开全部笔记' : '折叠全部笔记'}>
            {sidebarCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
          </button>
          <div className="review-sidebar-head">
            <div><strong>全部笔记</strong><span>{notes.length}</span></div>
            <label className="review-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索知识笔记" /></label>
          </div>
          <div className="review-note-list">
            {filteredNotes.map((note) => (
              <div key={note.id} className={`review-note-card ${selectedId === note.id ? 'active' : ''}`}>
                <button className="review-note-select" onClick={() => { setSelectedId(note.id); setMode('live') }}>
                  <span className="review-note-icon"><BookMarked size={15} /></span>
                  <span className="review-note-copy">
                    <strong>{note.title.trim() || '未命名知识笔记'}</strong>
                    <small>Markdown 知识笔记</small>
                    <time>{formatUpdatedAt(note.updatedAt)}</time>
                  </span>
                </button>
                <button className="review-note-delete" aria-label={`删除 ${note.title.trim() || '未命名知识笔记'}`} title="删除笔记" onClick={() => setDeleting(note)}><Trash2 size={13} /></button>
              </div>
            ))}
            {!filteredNotes.length && <div className="review-list-empty"><BookMarked size={20} /><strong>{notes.length ? '没有匹配的笔记' : '还没有知识笔记'}</strong><span>{notes.length ? '换个关键词试试。' : '新建一篇 Markdown 笔记开始整理。'}</span></div>}
          </div>
        </aside>

        <div className="review-editor-shell">
          {selected ? <>
            <div className="review-editor-head">
              <input className="review-title-input" value={selected.title} maxLength={100} onChange={(event) => onUpdate(selected.id, { title: event.target.value })} placeholder="未命名知识笔记" />
              <div className="review-editor-tools">
                <div className="review-mode-switch" role="group" aria-label="编辑模式">
                  <button className={mode === 'source' ? 'active' : ''} onClick={() => setMode('source')}><Code2 size={13} />源码</button>
                  <button className={mode === 'live' ? 'active' : ''} onClick={() => setMode('live')}><Sparkles size={13} />实时预览</button>
                  <button className={mode === 'preview' ? 'active' : ''} onClick={() => setMode('preview')}><Eye size={13} />预览</button>
                </div>
                <Button size="sm" variant="ghost" icon={<Download size={14} />} onClick={() => void exportNote('md')}>导出 .md</Button>
                <Button size="sm" variant="ghost" icon={<FileDown size={14} />} onClick={() => void exportNote('pdf')}>导出 PDF</Button>
              </div>
            </div>
            <div className="review-meta-bar">
              <BookMarked size={14} />
              <span>知识库</span>
              <i />
              <small>已自动保存 · 更新于 {formatUpdatedAt(selected.updatedAt)}</small>
            </div>
            <MarkdownToolbar disabled={mode === 'preview'} onAction={(action) => markdownEditorRef.current?.applyAction(action)} />
            <div className={`review-document mode-${mode}`}>
              {mode === 'preview' && <article className="markdown-preview markdown-prose"><MarkdownContent source={selected.content} /></article>}
              {mode === 'source' && <MarkdownSourceEditor ref={markdownEditorRef} value={selected.content} onChange={(content) => onUpdate(selected.id, { content })} />}
              {mode === 'live' && <LiveMarkdownEditor ref={markdownEditorRef} documentId={selected.id} value={selected.content} onChange={(content) => onUpdate(selected.id, { content })} />}
            </div>
          </> : <div className="review-editor-empty"><span><FileText size={25} /></span><h2>建立自己的知识库</h2><p>点击右上角新建笔记，使用 Markdown 开始整理。</p></div>}
        </div>
      </section>

      <ConfirmDialog open={Boolean(deleting)} title="删除这篇知识笔记？" description={deleting ? `「${deleting.title.trim() || '未命名知识笔记'}」将被永久删除，此操作无法撤销。` : ''} confirmText="确认删除" onClose={() => setDeleting(undefined)} onConfirm={confirmDelete} />
    </div>
  )
}
