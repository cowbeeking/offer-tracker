export type MarkdownChangeKind = 'typing' | 'action'

export interface MarkdownHistory {
  past: string[]
  present: string
  future: string[]
  lastKind?: MarkdownChangeKind
  lastChangedAt: number
}

const MAX_HISTORY_ENTRIES = 100
const TYPING_GROUP_WINDOW_MS = 700

export function createMarkdownHistory(value: string): MarkdownHistory {
  return { past: [], present: value, future: [], lastChangedAt: 0 }
}

export function recordMarkdownChange(history: MarkdownHistory, value: string, kind: MarkdownChangeKind, now = Date.now()): MarkdownHistory {
  if (value === history.present) return history
  const mergeTyping = kind === 'typing'
    && history.lastKind === 'typing'
    && now - history.lastChangedAt <= TYPING_GROUP_WINDOW_MS
  return {
    past: mergeTyping ? history.past : [...history.past, history.present].slice(-MAX_HISTORY_ENTRIES),
    present: value,
    future: [],
    lastKind: kind,
    lastChangedAt: now,
  }
}

export function undoMarkdownChange(history: MarkdownHistory): MarkdownHistory {
  const previous = history.past.at(-1)
  if (previous === undefined) return history
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    lastChangedAt: 0,
  }
}

export function redoMarkdownChange(history: MarkdownHistory): MarkdownHistory {
  const next = history.future[0]
  if (next === undefined) return history
  return {
    past: [...history.past, history.present].slice(-MAX_HISTORY_ENTRIES),
    present: next,
    future: history.future.slice(1),
    lastChangedAt: 0,
  }
}
