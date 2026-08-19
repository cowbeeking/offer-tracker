import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { MarkdownContent } from '@/components/MarkdownContent'

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

interface SourceLine {
  start: number
  end: number
  text: string
}

const LIST_ITEM_PATTERN = /^\s*(?:[-+*]|\d+[.)])\s+/
const TABLE_DIVIDER_PATTERN = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/

function sourceLines(source: string): SourceLine[] {
  const lines: SourceLine[] = []
  let cursor = 0
  while (cursor < source.length) {
    const newline = source.indexOf('\n', cursor)
    const rawEnd = newline === -1 ? source.length : newline
    const end = rawEnd > cursor && source[rawEnd - 1] === '\r' ? rawEnd - 1 : rawEnd
    lines.push({ start: cursor, end, text: source.slice(cursor, end) })
    cursor = newline === -1 ? source.length : newline + 1
  }
  return lines
}

function parseMarkdownBlocks(source: string): MarkdownBlock[] {
  if (!source) return [{ start: 0, end: 0, text: '' }]
  const lines = sourceLines(source)
  const blocks: MarkdownBlock[] = []
  const addBlock = (startIndex: number, endIndex: number): void => {
    const start = lines[startIndex].start
    const end = lines[endIndex - 1].end
    blocks.push({ start, end, text: source.slice(start, end) })
  }

  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.text.trim()
    if (!trimmed) {
      index += 1
      continue
    }

    const openingFence = /^\s*(`{3,}|~{3,})/.exec(line.text)?.[1]
    if (openingFence) {
      const marker = openingFence[0]
      const minimumLength = openingFence.length
      let endIndex = index + 1
      while (endIndex < lines.length) {
        const closingFence = /^\s*(`+|~+)\s*$/.exec(lines[endIndex].text)?.[1]
        endIndex += 1
        if (closingFence && closingFence[0] === marker && closingFence.length >= minimumLength) break
      }
      addBlock(index, endIndex)
      index = endIndex
      continue
    }

    if (index + 1 < lines.length && line.text.includes('|') && TABLE_DIVIDER_PATTERN.test(lines[index + 1].text)) {
      let endIndex = index + 2
      while (endIndex < lines.length && lines[endIndex].text.trim() && lines[endIndex].text.includes('|')) endIndex += 1
      addBlock(index, endIndex)
      index = endIndex
      continue
    }

    if (index + 1 < lines.length && /^\s*(?:={3,}|-{3,})\s*$/.test(lines[index + 1].text)) {
      addBlock(index, index + 2)
      index += 2
      continue
    }

    if (LIST_ITEM_PATTERN.test(line.text)) {
      let endIndex = index + 1
      while (endIndex < lines.length) {
        const next = lines[endIndex]
        if (!next.text.trim()) break
        if (!LIST_ITEM_PATTERN.test(next.text) && !/^(?:\s{2,}|\t)\S/.test(next.text)) break
        endIndex += 1
      }
      addBlock(index, endIndex)
      index = endIndex
      continue
    }

    if (/^\s*>/.test(line.text)) {
      let endIndex = index + 1
      while (endIndex < lines.length && /^\s*>/.test(lines[endIndex].text)) endIndex += 1
      addBlock(index, endIndex)
      index = endIndex
      continue
    }

    if (/^(?: {4}|\t)/.test(line.text)) {
      let endIndex = index + 1
      while (endIndex < lines.length && /^(?: {4}|\t)/.test(lines[endIndex].text)) endIndex += 1
      addBlock(index, endIndex)
      index = endIndex
      continue
    }

    addBlock(index, index + 1)
    index += 1
  }

  return blocks.length ? blocks : [{ start: source.length, end: source.length, text: '' }]
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
                ><MarkdownContent source={block.text} /></div>}
          </div>
        )
      })}
    </div>
  )
}
