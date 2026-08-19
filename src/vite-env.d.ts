/// <reference types="vite/client" />

interface Window {
  desktopApi?: {
    saveFile: (content: string, defaultPath: string, type: 'json' | 'csv' | 'md') => Promise<boolean>
    savePdf: (html: string, defaultPath: string) => Promise<boolean>
    openJsonFile: () => Promise<string | null>
    openExternal: (url: string) => Promise<boolean>
    getAutoLaunch: () => Promise<boolean>
    setAutoLaunch: (enabled: boolean) => Promise<boolean>
    showReminder: (payload?: { applicationId?: string; companyName?: string; positionName?: string; nodeName?: string; scheduledAt?: string }) => Promise<boolean>
    onOpenReminder: (callback: (applicationId: string) => void) => () => void
  }
}
