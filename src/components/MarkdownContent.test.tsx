// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MarkdownContent } from '@/components/MarkdownContent'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('MarkdownContent', () => {
  const roots: ReturnType<typeof createRoot>[] = []

  afterEach(() => {
    roots.forEach((root) => act(() => root.unmount()))
    roots.length = 0
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('assigns stable heading ids and scrolls internal links to them', async () => {
    const scrollIntoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView })
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    roots.push(root)

    await act(async () => {
      root.render(<MarkdownContent source={'[跳转到目标](#目标标题)\n\n## 目标标题\n\n## 目标标题'} />)
    })

    const headings = [...container.querySelectorAll<HTMLElement>('h2')]
    expect(headings.map((heading) => heading.id)).toEqual(['目标标题', '目标标题-1'])
    const link = container.querySelector<HTMLAnchorElement>('a')
    act(() => link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
    expect(scrollIntoView).toHaveBeenCalledOnce()
    expect(scrollIntoView.mock.instances[0]).toBe(headings[0])
  })

  it('does not syntax-highlight explicitly plain text code blocks', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    roots.push(root)
    await act(async () => {
      root.render(<MarkdownContent source={'```text\nPrecision < Recall\n```'} />)
    })

    const code = container.querySelector<HTMLElement>('code[data-language="text"]')
    expect(code?.textContent).toBe('Precision < Recall')
    expect(code?.querySelector('[class^="hljs-"]')).toBeNull()
  })

  it('renders dollar and LaTeX-style math delimiters without changing code blocks', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    roots.push(root)
    await act(async () => {
      root.render(<MarkdownContent source={'Inline $x^2$.\n\n\\[\nFFN(x)=W_2\\sigma(W_1x)\n\\]\n\n```text\n\\[not math\\]\n```'} />)
    })

    expect(container.querySelectorAll('math')).toHaveLength(2)
    expect(container.querySelector('math[display="block"]')).not.toBeNull()
    expect(container.querySelector('code[data-language="text"]')?.textContent).toBe('\\[not math\\]')
  })

  it('uses KaTeX HTML layout for formulas with functions, fractions and norms', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    roots.push(root)
    await act(async () => {
      root.render(<MarkdownContent source={'$$\\cos(a,b)=\\frac{a\\cdot b}{\\lVert a\\rVert\\lVert b\\rVert}$$'} />)
    })

    expect(container.querySelector('.katex-html')).not.toBeNull()
    expect(container.querySelector('.katex-html .mop')?.textContent).toBe('cos')
    expect(container.querySelector('.katex-html')?.textContent).toContain('∥a∥∥b∥')
  })

  it('does not let a redundant LaTeX closer swallow the remaining preview', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    roots.push(root)
    await act(async () => {
      root.render(<MarkdownContent source={'$$\nRRF(d)=\\sum_r\\frac{1}{k+rank_r(d)}\n$$\n\\]\n\n#### 7.6 ANN 与向量索引\n\n后续正文'} />)
    })

    expect(container.querySelector('.katex-error')).toBeNull()
    expect(container.querySelector('h4')?.textContent).toBe('7.6 ANN 与向量索引')
    expect(container.querySelector('h4')?.closest('.katex')).toBeNull()
  })
})
