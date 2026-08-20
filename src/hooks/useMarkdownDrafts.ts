import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createMarkdownHistory,
  recordMarkdownChange,
  redoMarkdownChange,
  undoMarkdownChange,
  type MarkdownChangeKind,
  type MarkdownHistory,
} from '@/utils/markdownHistory'

interface MarkdownDocument {
  id: string
  content: string
}

interface MarkdownDrafts {
  contentFor: (document: MarkdownDocument) => string
  changeContent: (document: MarkdownDocument, value: string, kind?: MarkdownChangeKind) => void
  flush: (id: string) => void
  isPending: (id: string) => boolean
}

const SAVE_DELAY_MS = 60_000

export function useMarkdownDrafts(
  documents: MarkdownDocument[],
  activeDocumentId: string | undefined,
  onSave: (id: string, content: string) => void,
): MarkdownDrafts {
  const onSaveRef = useRef(onSave)
  const savedContentRef = useRef(new Map<string, string>())
  const draftsRef = useRef(new Map<string, string>())
  const historiesRef = useRef(new Map<string, MarkdownHistory>())
  const timersRef = useRef(new Map<string, number>())
  const pendingRef = useRef(new Set<string>())
  const [, render] = useState(0)

  onSaveRef.current = onSave
  savedContentRef.current = new Map(documents.map((document) => [document.id, document.content]))

  const notify = useCallback(() => render((revision) => revision + 1), [])

  const flush = useCallback((id: string, updateView: boolean): void => {
    const timer = timersRef.current.get(id)
    if (timer !== undefined) window.clearTimeout(timer)
    timersRef.current.delete(id)
    const draft = draftsRef.current.get(id)
    const saved = savedContentRef.current.get(id)
    if (draft !== undefined && draft !== saved) onSaveRef.current(id, draft)
    const changed = pendingRef.current.delete(id)
    if (changed && updateView) notify()
  }, [notify])

  const schedule = useCallback((id: string, value: string): void => {
    draftsRef.current.set(id, value)
    if (value === savedContentRef.current.get(id)) {
      const previousTimer = timersRef.current.get(id)
      if (previousTimer !== undefined) window.clearTimeout(previousTimer)
      timersRef.current.delete(id)
      pendingRef.current.delete(id)
      notify()
      return
    }
    pendingRef.current.add(id)
    if (!timersRef.current.has(id)) {
      timersRef.current.set(id, window.setTimeout(() => flush(id, true), SAVE_DELAY_MS))
    }
    notify()
  }, [flush, notify])

  const historyFor = useCallback((document: MarkdownDocument): MarkdownHistory => {
    const existing = historiesRef.current.get(document.id)
    if (existing) return existing
    const created = createMarkdownHistory(draftsRef.current.get(document.id) ?? document.content)
    historiesRef.current.set(document.id, created)
    return created
  }, [])

  const changeContent = useCallback((document: MarkdownDocument, value: string, kind: MarkdownChangeKind = 'typing'): void => {
    const history = recordMarkdownChange(historyFor(document), value, kind)
    historiesRef.current.set(document.id, history)
    schedule(document.id, history.present)
  }, [historyFor, schedule])

  const undo = useCallback((document: MarkdownDocument): boolean => {
    const current = historyFor(document)
    const next = undoMarkdownChange(current)
    if (next === current) return false
    historiesRef.current.set(document.id, next)
    schedule(document.id, next.present)
    return true
  }, [historyFor, schedule])

  const redo = useCallback((document: MarkdownDocument): boolean => {
    const current = historyFor(document)
    const next = redoMarkdownChange(current)
    if (next === current) return false
    historiesRef.current.set(document.id, next)
    schedule(document.id, next.present)
    return true
  }, [historyFor, schedule])

  useEffect(() => {
    const existingIds = new Set(documents.map((document) => document.id))
    for (const [id, timer] of timersRef.current) {
      if (existingIds.has(id)) continue
      window.clearTimeout(timer)
      timersRef.current.delete(id)
      draftsRef.current.delete(id)
      historiesRef.current.delete(id)
      pendingRef.current.delete(id)
    }
  }, [documents])

  useEffect(() => {
    if (!activeDocumentId) return
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      const key = event.key.toLocaleLowerCase()
      const wantsUndo = key === 'z' && !event.shiftKey
      const wantsRedo = key === 'y' || (key === 'z' && event.shiftKey)
      if (!wantsUndo && !wantsRedo) return
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return
      if (target instanceof HTMLTextAreaElement && !target.closest('.review-document')) return
      const content = savedContentRef.current.get(activeDocumentId)
      if (content === undefined) return
      event.preventDefault()
      const document = { id: activeDocumentId, content }
      if (wantsUndo) undo(document)
      else redo(document)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeDocumentId, redo, undo])

  useEffect(() => () => {
    for (const timer of timersRef.current.values()) window.clearTimeout(timer)
    for (const id of pendingRef.current) flush(id, false)
  }, [flush])

  return {
    contentFor: (document) => draftsRef.current.get(document.id) ?? document.content,
    changeContent,
    flush: (id) => flush(id, true),
    isPending: (id) => pendingRef.current.has(id),
  }
}
