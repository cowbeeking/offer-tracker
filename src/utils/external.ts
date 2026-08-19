export async function openExternalUrl(url: string): Promise<boolean> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return false
  if (window.desktopApi) return window.desktopApi.openExternal(parsed.href)
  const opened = window.open(parsed.href, '_blank', 'noopener,noreferrer')
  if (opened) opened.opener = null
  return Boolean(opened)
}
