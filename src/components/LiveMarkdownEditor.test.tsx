// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LiveMarkdownEditor } from '@/components/LiveMarkdownEditor'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('LiveMarkdownEditor', () => {
  const roots: ReturnType<typeof createRoot>[] = []

  afterEach(() => {
    roots.forEach((root) => act(() => root.unmount()))
    roots.length = 0
    vi.useRealTimers()
  })

  it('keeps a multi-line display formula in one rendered block', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    roots.push(root)
    await act(async () => {
      root.render(<LiveMarkdownEditor
        documentId="math-note"
        value={'\\[\nFFN(x)=W_2\\sigma(W_1x)\n\\]\n\n下一段'}
        onChange={() => undefined}
      />)
    })

    expect(container.querySelectorAll('.markdown-live-block')).toHaveLength(2)
    expect(container.querySelector('math[display="block"]')).not.toBeNull()
  })

  it('opens a real editor from the final placeholder and separates the new paragraph', async () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const container = document.createElement('div')
    const root = createRoot(container)
    roots.push(root)
    await act(async () => {
      root.render(<LiveMarkdownEditor documentId="append-note" value="# 标题" onChange={onChange} />)
    })

    await act(async () => container.querySelector<HTMLElement>('.markdown-live-append')?.click())
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea')!
    expect(textarea).not.toBeNull()
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
      setter?.call(textarea, '新段落')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(onChange).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTime(180))
    expect(onChange).toHaveBeenCalledWith('append-note', '# 标题\n\n新段落', 'typing')
  })

  it('coalesces rapid typing before propagating the latest document value', async () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const container = document.createElement('div')
    const root = createRoot(container)
    roots.push(root)
    await act(async () => root.render(<LiveMarkdownEditor documentId="long-note" value="第一段" onChange={onChange} />))
    await act(async () => container.querySelector<HTMLElement>('.markdown-live-rendered')?.click())
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea')!
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set

    await act(async () => {
      setter?.call(textarea, '第一段内容')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
      setter?.call(textarea, '第一段最新内容')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
      vi.advanceTimersByTime(179)
    })
    expect(onChange).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTime(1))
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith('long-note', '第一段最新内容', 'typing')
  })
})
