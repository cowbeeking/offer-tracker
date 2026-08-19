import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownBlock {
  start: number
  end: number
  text: string
  active?: boolean
}

interface LiveMarkdownEditorProps {
  documentId: string
  value: string
  onChange: (value: string) => void
}

function parseMarkdownBlocks(source: string): MarkdownBlock[] {
  if (!source) return [{ start: 0, end: 0, text: '' }]
  const blocks: MarkdownBlock[] = []
  let blockStart = 0
  let cursor = 0
  let fenceMarker = ''

  while (cursor < source.length) {
    const lineStart = cursor
    const newline = source.indexOf('\n', cursor)
    const lineEnd = newline === -1 ? source.length : newline + 1
    const line = source.slice(lineStart, lineEnd)
    const trimmed = line.trim()
    const fence = /^(`{3,}|~{3,})/.exec(trimmed)?.[1]

    if (fence) {
      if (!fenceMarker) fenceMarker = fence[0]
      else if (fence[0] === fenceMarker) fenceMarker = ''
    }

    cursor = lineEnd
    if (!fenceMarker && trimmed === '') {
      const contentEnd = lineStart > blockStart && source[lineStart - 1] === '\n' ? lineStart - 1 : lineStart
      if (contentEnd > blockStart) {
        blocks.push({ start: blockStart, end: contentEnd, text: source.slice(blockStart, contentEnd) })
      }
      blockStart = cursor
    }
  }

  if (blockStart < source.length) {
    let contentEnd = source.length
    while (contentEnd > blockStart && source[contentEnd - 1] === '\n') contentEnd -= 1
    if (contentEnd > blockStart) {
      blocks.push({ start: blockStart, end: contentEnd, text: source.slice(blockStart, contentEnd) })
    }
  }
  return blocks.length ? blocks : [{ start: 0, end: source.length, text: source }]
}

function editableEnd(text: string): number {
  return text.replace(/\n+$/, '').length
}

export function LiveMarkdownEditor({ documentId, value, onChange }: LiveMarkdownEditorProps): JSX.Element {
  const [source, setSource] = useState(value)
  const [activeRange, setActiveRange] = useState<{ start: number; end: number }>()
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const pendingSelectionRef = useRef<number>()
  const previousDocumentRef = useRef(documentId)
  const blocks = useMemo(() => {
    if (!activeRange) return parseMarkdownBlocks(source)
    const before = source.slice(0, activeRange.start)
    const after = source.slice(activeRange.end)
    const beforeBlocks = before ? parseMarkdownBlocks(before) : []
    const afterBlocks = after
      ? parseMarkdownBlocks(after).map((block) => ({
          ...block,
          start: block.start + activeRange.end,
          end: block.end + activeRange.end,
        }))
      : []
    return [
      ...beforeBlocks,
      {
        start: activeRange.start,
        end: activeRange.end,
        text: source.slice(activeRange.start, activeRange.end),
        active: true,
      },
      ...afterBlocks,
    ]
  }, [activeRange, source])

  useEffect(() => {
    if (previousDocumentRef.current !== documentId) {
      previousDocumentRef.current = documentId
      setSource(value)
      setActiveRange(undefined)
      pendingSelectionRef.current = undefined
      return
    }
    if (value !== source) setSource(value)
  }, [documentId, source, value])

  useLayoutEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    editor.style.height = 'auto'
    editor.style.height = `${Math.max(48, editor.scrollHeight)}px`
    editor.focus()
    const selection = pendingSelectionRef.current
    if (selection !== undefined) {
      editor.setSelectionRange(selection, selection)
      pendingSelectionRef.current = undefined
    }
  }, [activeRange, source])

  const activate = (block: MarkdownBlock): void => {
    pendingSelectionRef.current = editableEnd(block.text)
    setActiveRange({ start: block.start, end: block.end })
  }

  const updateBlock = (block: MarkdownBlock, event: ChangeEvent<HTMLTextAreaElement>): void => {
    const replacement = event.target.value
    const nextSource = `${source.slice(0, block.start)}${replacement}${source.slice(block.end)}`
    pendingSelectionRef.current = event.target.selectionStart
    setSource(nextSource)
    setActiveRange({ start: block.start, end: block.start + replacement.length })
    onChange(nextSource)
  }

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Escape') {
      event.currentTarget.blur()
      setActiveRange(undefined)
    }
  }

  return (
    <div className="markdown-live-editor" onClick={(event) => { if (event.target === event.currentTarget && blocks.length) activate(blocks[blocks.length - 1]) }}>
      {blocks.map((block, index) => {
        const active = Boolean(block.active)
        return (
          <div className={`markdown-live-block ${active ? 'active' : ''}`} key={active ? `active-${block.start}` : `${block.start}-${block.end}-${index}`}>
            {active
              ? <textarea
                  ref={editorRef}
                  className="markdown-live-textarea"
                  rows={1}
                  value={block.text}
                  onChange={(event) => updateBlock(block, event)}
                  onBlur={() => setActiveRange(undefined)}
                  onKeyDown={handleEditorKeyDown}
                  spellCheck={false}
                  aria-label="Markdown 实时预览编辑器"
                />
              : <div
                  className="markdown-live-rendered markdown-prose"
                  role="button"
                  tabIndex={0}
                  onClick={() => activate(block)}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') activate(block) }}
                ><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer">{children}</a> }}>{block.text}</ReactMarkdown></div>}
          </div>
        )
      })}
    </div>
  )
}
