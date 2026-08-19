export interface ImportedMarkdown {
  title: string
  content: string
}

export async function readMarkdownFile(file: File, fallbackTitle: string): Promise<ImportedMarkdown> {
  if (!/\.(md|markdown)$/i.test(file.name)) throw new Error('请选择 .md 或 .markdown 文件')
  if (file.size > 20 * 1024 * 1024) throw new Error('Markdown 文件不能超过 20 MB')
  const content = (await file.text()).replace(/^\uFEFF/, '')
  const title = file.name.replace(/\.(md|markdown)$/i, '').trim().slice(0, 100) || fallbackTitle
  return { title, content }
}
