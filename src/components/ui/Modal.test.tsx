// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Modal } from '@/components/ui/Modal'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('Modal focus management', () => {
  const roots: ReturnType<typeof createRoot>[] = []

  afterEach(() => {
    roots.forEach((root) => act(() => root.unmount()))
    roots.length = 0
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('keeps the active input focused when children and onClose rerender', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 1
    })
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push(root)

    const renderModal = async (value: string): Promise<void> => {
      await act(async () => {
        root.render(
          <Modal open title="更新节点" onClose={() => undefined}>
            <input aria-label="节点备注" autoFocus value={value} readOnly />
          </Modal>,
        )
      })
    }

    await renderModal('')
    const input = document.querySelector<HTMLInputElement>('[aria-label="节点备注"]')
    expect(document.activeElement).toBe(input)

    await renderModal('1')
    expect(document.activeElement).toBe(input)
  })
})
