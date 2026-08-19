export type MarkdownAction =
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6 }
  | { type: 'bold' | 'italic' | 'strikethrough' | 'inline-code' | 'bullet-list' | 'ordered-list' | 'task-list' | 'quote' | 'link' | 'horizontal-rule' }
  | { type: 'code-block'; language: string }
  | { type: 'table'; rows: number; columns: number }
  | { type: 'color'; color: string }

export interface MarkdownEditResult {
  value: string
  selectionStart: number
  selectionEnd: number
}

export interface MarkdownEditorHandle {
  applyAction: (action: MarkdownAction) => void
  focus: () => void
}

function replaceRange(value: string, start: number, end: number, replacement: string, selectionStart: number, selectionEnd: number): MarkdownEditResult {
  return {
    value: `${value.slice(0, start)}${replacement}${value.slice(end)}`,
    selectionStart: start + selectionStart,
    selectionEnd: start + selectionEnd,
  }
}

function wrapSelection(value: string, start: number, end: number, before: string, after: string, placeholder: string): MarkdownEditResult {
  const content = value.slice(start, end) || placeholder
  const replacement = `${before}${content}${after}`
  return replaceRange(value, start, end, replacement, before.length, before.length + content.length)
}

function selectedLineRange(value: string, start: number, end: number): { start: number; end: number; text: string } {
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  const nextNewline = value.indexOf('\n', end)
  const lineEnd = nextNewline === -1 ? value.length : nextNewline
  return { start: lineStart, end: lineEnd, text: value.slice(lineStart, lineEnd) }
}

function prefixLines(value: string, start: number, end: number, prefix: string | ((index: number) => string), placeholder = '列表项'): MarkdownEditResult {
  const range = selectedLineRange(value, start, end)
  const source = range.text || placeholder
  const lines = source.split('\n')
  const replacement = lines.map((line, index) => {
    const clean = line.replace(/^\s*(?:#{1,6}\s+|[-+*]\s+|\d+[.)]\s+|-\s+\[[ xX]\]\s+|>\s*)/, '')
    return `${typeof prefix === 'function' ? prefix(index) : prefix}${clean}`
  }).join('\n')
  return replaceRange(value, range.start, range.end, replacement, 0, replacement.length)
}

function blockSpacing(value: string, start: number, end: number, block: string): { replacement: string; contentOffset: number } {
  const before = start > 0 && !value.slice(0, start).endsWith('\n\n') ? (value[start - 1] === '\n' ? '\n' : '\n\n') : ''
  const after = end < value.length && !value.slice(end).startsWith('\n\n') ? (value[end] === '\n' ? '\n' : '\n\n') : ''
  return { replacement: `${before}${block}${after}`, contentOffset: before.length }
}

export function applyMarkdownAction(value: string, rawStart: number, rawEnd: number, action: MarkdownAction): MarkdownEditResult {
  const start = Math.max(0, Math.min(rawStart, value.length))
  const end = Math.max(start, Math.min(rawEnd, value.length))

  switch (action.type) {
    case 'heading': {
      const range = selectedLineRange(value, start, end)
      const replacement = range.text.split('\n').map((line) => `${'#'.repeat(action.level)} ${line.replace(/^\s*#{1,6}\s+/, '') || '标题'}`).join('\n')
      return replaceRange(value, range.start, range.end, replacement, 0, replacement.length)
    }
    case 'bold': return wrapSelection(value, start, end, '**', '**', '粗体文字')
    case 'italic': return wrapSelection(value, start, end, '*', '*', '斜体文字')
    case 'strikethrough': return wrapSelection(value, start, end, '~~', '~~', '删除线文字')
    case 'inline-code': return wrapSelection(value, start, end, '`', '`', 'code')
    case 'bullet-list': return prefixLines(value, start, end, '- ')
    case 'ordered-list': return prefixLines(value, start, end, (index) => `${index + 1}. `)
    case 'task-list': return prefixLines(value, start, end, '- [ ] ')
    case 'quote': return prefixLines(value, start, end, '> ', '引用内容')
    case 'link': return wrapSelection(value, start, end, '[', '](https://)', '链接文字')
    case 'horizontal-rule': {
      const insertionPoint = end
      const spaced = blockSpacing(value, insertionPoint, insertionPoint, '---')
      return replaceRange(value, insertionPoint, insertionPoint, spaced.replacement, spaced.replacement.length, spaced.replacement.length)
    }
    case 'code-block': {
      const content = value.slice(start, end) || '// 在这里输入代码'
      const block = `\`\`\`${action.language}\n${content}\n\`\`\``
      const spaced = blockSpacing(value, start, end, block)
      const contentStart = spaced.contentOffset + action.language.length + 4
      return replaceRange(value, start, end, spaced.replacement, contentStart, contentStart + content.length)
    }
    case 'table': {
      const columns = Math.max(1, Math.min(10, Math.floor(action.columns)))
      const rows = Math.max(1, Math.min(20, Math.floor(action.rows)))
      const header = `| ${Array.from({ length: columns }, (_, index) => `列 ${index + 1}`).join(' | ')} |`
      const divider = `| ${Array.from({ length: columns }, () => '---').join(' | ')} |`
      const body = Array.from({ length: rows }, () => `| ${Array.from({ length: columns }, () => ' ').join(' | ')} |`)
      const table = [header, divider, ...body].join('\n')
      const insertionPoint = end
      const spaced = blockSpacing(value, insertionPoint, insertionPoint, table)
      return replaceRange(value, insertionPoint, insertionPoint, spaced.replacement, spaced.contentOffset + 2, spaced.contentOffset + 2 + '列 1'.length)
    }
    case 'color': {
      const color = /^#[0-9a-f]{6}$/i.test(action.color) ? action.color.toLowerCase() : '#2563eb'
      const content = value.slice(start, end) || '彩色文字'
      const before = '['
      const after = `](#color-${color.slice(1)})`
      return replaceRange(value, start, end, `${before}${content}${after}`, before.length, before.length + content.length)
    }
  }
}
