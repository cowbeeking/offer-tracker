import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import css from 'highlight.js/lib/languages/css'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import go from 'highlight.js/lib/languages/go'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import kotlin from 'highlight.js/lib/languages/kotlin'
import lua from 'highlight.js/lib/languages/lua'
import markdown from 'highlight.js/lib/languages/markdown'
import php from 'highlight.js/lib/languages/php'
import powershell from 'highlight.js/lib/languages/powershell'
import python from 'highlight.js/lib/languages/python'
import ruby from 'highlight.js/lib/languages/ruby'
import rust from 'highlight.js/lib/languages/rust'
import sql from 'highlight.js/lib/languages/sql'
import swift from 'highlight.js/lib/languages/swift'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'
import { isValidElement, memo, type ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { openExternalUrl } from '@/utils/external'

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('c', c)
hljs.registerLanguage('cpp', cpp)
hljs.registerLanguage('csharp', csharp)
hljs.registerLanguage('css', css)
hljs.registerLanguage('dockerfile', dockerfile)
hljs.registerLanguage('go', go)
hljs.registerLanguage('java', java)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('kotlin', kotlin)
hljs.registerLanguage('lua', lua)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('php', php)
hljs.registerLanguage('powershell', powershell)
hljs.registerLanguage('python', python)
hljs.registerLanguage('ruby', ruby)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('swift', swift)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('yaml', yaml)

const LANGUAGE_ALIASES: Record<string, string> = {
  'c++': 'cpp',
  'c#': 'csharp',
  cs: 'csharp',
  html: 'xml',
  js: 'javascript',
  jsx: 'javascript',
  md: 'markdown',
  py: 'python',
  shell: 'bash',
  sh: 'bash',
  ts: 'typescript',
  tsx: 'typescript',
  vue: 'xml',
  yml: 'yaml',
}

const PLAIN_TEXT_LANGUAGES = new Set(['plain', 'plaintext', 'text', 'txt'])

function replaceBalancedMathPairs(source: string, opening: string, closing: string, replacement: string): string {
  let cursor = 0
  let output = ''
  while (cursor < source.length) {
    const openAt = source.indexOf(opening, cursor)
    if (openAt === -1) return output + source.slice(cursor)
    const closeAt = source.indexOf(closing, openAt + opening.length)
    if (closeAt === -1) return output + source.slice(cursor)
    output += source.slice(cursor, openAt)
      + replacement
      + source.slice(openAt + opening.length, closeAt)
      + replacement
    cursor = closeAt + closing.length
  }
  return output
}

function normalizeMathSegment(source: string): string {
  return replaceBalancedMathPairs(
    replaceBalancedMathPairs(source, '\\[', '\\]', '$$'),
    '\\(',
    '\\)',
    '$',
  ).replace(/^\s*\\\]\s*$/gm, '')
}

function normalizeMathDelimiters(source: string): string {
  const lines = source.split('\n')
  const output: string[] = []
  let index = 0
  let outsideStart = 0
  while (index < lines.length) {
    const openingFence = /^\s*(`{3,}|~{3,})/.exec(lines[index])?.[1]
    if (!openingFence) {
      index += 1
      continue
    }
    if (outsideStart < index) output.push(...normalizeMathSegment(lines.slice(outsideStart, index).join('\n')).split('\n'))
    const marker = openingFence[0]
    const minimumLength = openingFence.length
    let endIndex = index + 1
    while (endIndex < lines.length) {
      const closingFence = /^\s*(`+|~+)\s*$/.exec(lines[endIndex])?.[1]
      endIndex += 1
      if (closingFence && closingFence[0] === marker && closingFence.length >= minimumLength) break
    }
    output.push(...lines.slice(index, endIndex))
    index = endIndex
    outsideStart = endIndex
  }
  if (outsideStart < lines.length) output.push(...normalizeMathSegment(lines.slice(outsideStart).join('\n')).split('\n'))
  return output.join('\n')
}

function nodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children)
  return ''
}

function headingSlug(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{Letter}\p{Number}\p{Mark}\s_-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function scrollToAnchor(href: string): void {
  let requestedId: string
  try {
    requestedId = decodeURIComponent(href.slice(1))
  } catch {
    requestedId = href.slice(1)
  }
  const requestedSlug = headingSlug(requestedId)
  const target = document.getElementById(requestedId)
    ?? [...document.querySelectorAll<HTMLElement>('[data-markdown-heading]')]
      .find((heading) => headingSlug(heading.textContent ?? '') === requestedSlug)
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function createComponents(): Components {
  const slugCounts = new Map<string, number>()
  const heading = (Tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'): NonNullable<Components['h1']> => ({ children }) => {
    const baseSlug = headingSlug(nodeText(children)) || 'section'
    const count = slugCounts.get(baseSlug) ?? 0
    slugCounts.set(baseSlug, count + 1)
    const id = count ? `${baseSlug}-${count}` : baseSlug
    return <Tag id={id} data-markdown-heading>{children}</Tag>
  }

  return {
    h1: heading('h1'),
    h2: heading('h2'),
    h3: heading('h3'),
    h4: heading('h4'),
    h5: heading('h5'),
    h6: heading('h6'),
    a: ({ children, href }) => {
      const color = /^#color-([0-9a-f]{6})$/i.exec(href ?? '')?.[1]
      if (color) return <span className="markdown-colored-text" style={{ color: `#${color}` }}>{children}</span>
      return <a href={href} onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (href?.startsWith('#')) scrollToAnchor(href)
        else if (/^https?:\/\//i.test(href ?? '')) void openExternalUrl(href!)
      }}>{children}</a>
    },
    code: ({ children, className }) => {
      const languageTag = /(?:^|\s)language-([^\s]+)/i.exec(className ?? '')?.[1]
      if (!languageTag) return <code className={className}>{children}</code>

      const requestedLanguage = languageTag.toLocaleLowerCase()
      const language = LANGUAGE_ALIASES[requestedLanguage] ?? requestedLanguage
      const source = String(children).replace(/\n$/, '')
      if (PLAIN_TEXT_LANGUAGES.has(requestedLanguage)) {
        return <code className={`hljs ${className ?? ''}`} data-language={requestedLanguage}>{source}</code>
      }
      const highlighted = hljs.getLanguage(language)
        ? hljs.highlight(source, { language }).value
        : hljs.highlightAuto(source).value
      return <code className={`hljs ${className ?? ''}`} data-language={requestedLanguage} dangerouslySetInnerHTML={{ __html: highlighted }} />
    },
  }
}

interface MarkdownContentProps {
  source: string
  mathOutput?: 'htmlAndMathml' | 'mathml'
}

export const MarkdownContent = memo(function MarkdownContent({ source, mathOutput = 'htmlAndMathml' }: MarkdownContentProps): JSX.Element {
  return <ReactMarkdown
    remarkPlugins={[remarkGfm, remarkMath]}
    rehypePlugins={[[rehypeKatex, { output: mathOutput, strict: false }]]}
    components={createComponents()}
  >{normalizeMathDelimiters(source)}</ReactMarkdown>
})
