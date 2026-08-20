import { describe, expect, it } from 'vitest'
import { applyMarkdownAction } from '@/utils/markdownEditing'

describe('applyMarkdownAction', () => {
  it('wraps selections and preserves the inner selection', () => {
    const result = applyMarkdownAction('hello', 0, 5, { type: 'bold' })
    expect(result).toEqual({ value: '**hello**', selectionStart: 2, selectionEnd: 7 })
  })

  it('formats every selected line as an ordered list', () => {
    expect(applyMarkdownAction('甲\n乙', 0, 3, { type: 'ordered-list' }).value).toBe('1. 甲\n2. 乙')
  })

  it('clamps table dimensions', () => {
    const table = applyMarkdownAction('', 0, 0, { type: 'table', rows: 99, columns: 0 }).value
    expect(table.split('\n')).toHaveLength(22)
    expect(table.split('\n')[0]).toBe('| 列 1 |')
  })

  it('sanitizes invalid colors', () => {
    expect(applyMarkdownAction('文本', 0, 2, { type: 'color', color: 'red' }).value).toBe('[文本](#color-2563eb)')
  })

  it('creates fenced language code blocks', () => {
    expect(applyMarkdownAction('int i = 1;', 0, 10, { type: 'code-block', language: 'java' }).value).toContain('```java\nint i = 1;\n```')
  })

  it('replaces existing headings and inserts separated blocks', () => {
    expect(applyMarkdownAction('## 标题', 0, 5, { type: 'heading', level: 3 }).value).toBe('### 标题')
    expect(applyMarkdownAction('正文', 2, 2, { type: 'horizontal-rule' }).value).toBe('正文\n\n---')
  })
})
