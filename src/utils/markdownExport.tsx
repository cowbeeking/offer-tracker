import { renderToStaticMarkup } from 'react-dom/server'
import { MarkdownContent } from '@/components/MarkdownContent'

function normalizedFileName(title: string, fallback: string, extension: 'md' | 'pdf'): string {
  const normalized = title.trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ')
  return `${normalized || fallback}.${extension}`
}

function downloadBlob(content: BlobPart, type: string, name: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function printableHtml(title: string, content: string): string {
  const rendered = renderToStaticMarkup(
    <MarkdownContent source={content} />,
  )
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 18mm 17mm 20mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #202522; font: 14px/1.75 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif; }
    article { width: 100%; }
    h1 { margin: 0 0 22px; padding-bottom: 10px; border-bottom: 1px solid #dfe3df; font-size: 28px; line-height: 1.3; }
    h2 { margin: 28px 0 10px; font-size: 21px; line-height: 1.4; }
    h3 { margin: 22px 0 8px; font-size: 17px; line-height: 1.4; }
    p, ul, ol, blockquote, pre, table { margin: 10px 0; }
    ul, ol { padding-left: 24px; }
    li { margin: 3px 0; }
    blockquote { margin-left: 0; padding: 7px 14px; border-left: 3px solid #2f5b4b; background: #f4f7f5; color: #5f6964; }
    code { padding: 2px 5px; border-radius: 4px; background: #f0f2f0; font: 12px/1.6 Consolas, monospace; }
    pre { overflow: hidden; padding: 0; border: 1px solid #dfe3df; border-radius: 7px; background: #f7f8f7; }
    pre code { display: block; overflow-wrap: anywhere; white-space: pre-wrap; padding: 14px; background: transparent; }
    pre code[data-language]::before { content: attr(data-language); display: block; margin: -14px -14px 11px; padding: 5px 14px; border-bottom: 1px solid #dfe3df; background: #eef1ef; color: #6f7974; font-size: 10px; font-weight: 600; }
    .hljs-comment, .hljs-quote { color: #77827c; }
    .hljs-keyword, .hljs-selector-tag, .hljs-built_in, .hljs-name { color: #8d3f73; }
    .hljs-string, .hljs-regexp, .hljs-addition, .hljs-attribute { color: #2f7156; }
    .hljs-number, .hljs-literal, .hljs-symbol, .hljs-bullet { color: #a05a24; }
    .hljs-title, .hljs-section, .hljs-function .hljs-title { color: #2d5f91; }
    .hljs-type, .hljs-class .hljs-title, .hljs-variable, .hljs-template-variable { color: #6852a3; }
    .hljs-meta, .hljs-doctag { color: #936b22; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { padding: 7px 9px; border: 1px solid #dfe3df; text-align: left; }
    th { background: #f4f6f4; }
    a { color: #2f5b4b; text-decoration: underline; }
    img { max-width: 100%; }
    hr { margin: 24px 0; border: 0; border-top: 1px solid #dfe3df; }
    input[type="checkbox"] { margin-right: 6px; }
    .katex-display { margin: 16px 0; overflow: hidden; text-align: center; }
    math[display="block"] { margin: 0 auto; }
  </style>
</head>
<body><article>${rendered}</article></body>
</html>`
}

export async function exportMarkdown(title: string, content: string, fallbackName: string): Promise<boolean> {
  const name = normalizedFileName(title, fallbackName, 'md')
  if (window.desktopApi) return window.desktopApi.saveFile(content, name, 'md')
  downloadBlob(content, 'text/markdown;charset=utf-8', name)
  return true
}

export async function exportMarkdownPdf(title: string, content: string, fallbackName: string): Promise<boolean> {
  const name = normalizedFileName(title, fallbackName, 'pdf')
  const html = printableHtml(title.trim() || fallbackName, content)
  if (window.desktopApi) return window.desktopApi.savePdf(html, name)

  const preview = window.open('', '_blank')
  if (!preview) throw new Error('无法打开 PDF 打印窗口')
  preview.opener = null
  preview.document.write(html)
  preview.document.close()
  window.setTimeout(() => preview.print(), 100)
  return true
}
