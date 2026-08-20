// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMarkdownDrafts } from '@/hooks/useMarkdownDrafts'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Harness({ onSave }: { onSave: (id: string, content: string) => void }): JSX.Element {
  const [saved, setSaved] = useState('initial')
  const document = { id: 'doc', content: saved }
  const drafts = useMarkdownDrafts([document], document.id, (id, content) => {
    onSave(id, content)
    setSaved(content)
  })
  const content = drafts.contentFor(document)
  return <div>
    <div className="review-document">
      <textarea aria-label="editor" value={content} onChange={(event) => drafts.changeContent(document, event.target.value, 'typing')} />
    </div>
    <button onClick={() => drafts.changeContent(document, `**${content}**`, 'action')}>toolbar</button>
    <output>{content}</output>
  </div>
}

describe('useMarkdownDrafts', () => {
  const roots: ReturnType<typeof createRoot>[] = []

  afterEach(() => {
    roots.forEach((root) => act(() => root.unmount()))
    roots.length = 0
    vi.useRealTimers()
  })

  it('saves the latest draft once after the fixed delay', async () => {
    vi.useFakeTimers()
    const onSave = vi.fn()
    const container = document.createElement('div')
    const root = createRoot(container)
    roots.push(root)
    await act(async () => root.render(<Harness onSave={onSave} />))
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea')!

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
      setter?.call(textarea, 'a')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => vi.advanceTimersByTime(800))
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
      setter?.call(textarea, 'latest')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(onSave).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTime(200))
    expect(onSave).toHaveBeenCalledOnce()
    expect(onSave).toHaveBeenCalledWith('doc', 'latest')
  })

  it('undoes and redoes typing plus toolbar changes through global shortcuts', async () => {
    vi.useFakeTimers()
    const container = document.createElement('div')
    const root = createRoot(container)
    roots.push(root)
    await act(async () => root.render(<Harness onSave={() => undefined} />))
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea')!
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
    await act(async () => {
      setter?.call(textarea, 'typed')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => container.querySelector<HTMLButtonElement>('button')!.click())
    expect(container.querySelector('output')?.textContent).toBe('**typed**')

    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true })))
    expect(container.querySelector('output')?.textContent).toBe('typed')
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true, cancelable: true })))
    expect(container.querySelector('output')?.textContent).toBe('**typed**')
  })
})
