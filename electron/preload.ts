import { contextBridge, ipcRenderer } from 'electron'

const desktopApi = {
  saveFile: (content: string, defaultPath: string, type: 'json' | 'csv' | 'md'): Promise<boolean> =>
    ipcRenderer.invoke('file:save', { content, defaultPath, type }),
  savePdf: (html: string, defaultPath: string): Promise<boolean> =>
    ipcRenderer.invoke('file:save-pdf', { html, defaultPath }),
  openJsonFile: (): Promise<string | null> => ipcRenderer.invoke('file:open-json'),
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke('shell:open-external', url),
  getAutoLaunch: (): Promise<boolean> => ipcRenderer.invoke('app:get-auto-launch'),
  setAutoLaunch: (enabled: boolean): Promise<boolean> => ipcRenderer.invoke('app:set-auto-launch', enabled),
  showReminder: (): Promise<boolean> => ipcRenderer.invoke('app:show-reminder'),
}

contextBridge.exposeInMainWorld('desktopApi', desktopApi)
