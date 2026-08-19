/// <reference types="vite/client" />

interface Window {
  desktopApi?: {
    saveFile: (content: string, defaultPath: string, type: 'json' | 'csv') => Promise<boolean>
    openJsonFile: () => Promise<string | null>
    openExternal: (url: string) => Promise<boolean>
  }
}
