import { describe, expect, it } from 'vitest'
import { createMarkdownHistory, recordMarkdownChange, redoMarkdownChange, undoMarkdownChange } from '@/utils/markdownHistory'

describe('markdown history', () => {
  it('groups continuous typing but keeps toolbar actions as separate undo steps', () => {
    let history = createMarkdownHistory('')
    history = recordMarkdownChange(history, 'a', 'typing', 100)
    history = recordMarkdownChange(history, 'ab', 'typing', 200)
    history = recordMarkdownChange(history, '**ab**', 'action', 300)

    history = undoMarkdownChange(history)
    expect(history.present).toBe('ab')
    history = undoMarkdownChange(history)
    expect(history.present).toBe('')
    history = redoMarkdownChange(history)
    expect(history.present).toBe('ab')
    history = redoMarkdownChange(history)
    expect(history.present).toBe('**ab**')
  })

  it('starts a new undo step after a typing pause', () => {
    let history = createMarkdownHistory('')
    history = recordMarkdownChange(history, 'first', 'typing', 100)
    history = recordMarkdownChange(history, 'second', 'typing', 900)
    expect(undoMarkdownChange(history).present).toBe('first')
  })
})
