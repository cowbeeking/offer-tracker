import { forwardRef, useCallback, useImperativeHandle, useRef, type KeyboardEvent } from 'react'
import { applyMarkdownAction, type MarkdownAction, type MarkdownChangeKind, type MarkdownEditorHandle } from '@/utils/markdownEditing'

interface MarkdownSourceEditorProps {
  value: string
  onChange: (value: string, kind?: MarkdownChangeKind) => void
}

export const MarkdownSourceEditor = forwardRef<MarkdownEditorHandle, MarkdownSourceEditorProps>(function MarkdownSourceEditor({ value, onChange }, ref) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const applyAction = useCallback((action: MarkdownAction): void => {
    const textarea = textareaRef.current
    const start = textarea?.selectionStart ?? value.length
    const end = textarea?.selectionEnd ?? start
    const result = applyMarkdownAction(value, start, end, action)
    onChange(result.value, 'action')
    window.requestAnimationFrame(() => {
      const editor = textareaRef.current
      if (!editor) return
      editor.focus()
      editor.setSelectionRange(result.selectionStart, result.selectionEnd)
    })
  }, [onChange, value])

  useImperativeHandle(ref, () => ({
    applyAction,
    focus: () => textareaRef.current?.focus(),
  }), [applyAction])

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (!(event.ctrlKey || event.metaKey)) return
    if (event.key.toLocaleLowerCase() === 'b') {
      event.preventDefault()
      applyAction({ type: 'bold' })
    } else if (event.key.toLocaleLowerCase() === 'i') {
      event.preventDefault()
      applyAction({ type: 'italic' })
    }
  }

  return <textarea ref={textareaRef} value={value} onChange={(event) => onChange(event.target.value, 'typing')} onKeyDown={handleKeyDown} spellCheck={false} aria-label="Markdown 源码编辑器" />
})
