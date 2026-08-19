import { contextBridge, ipcRenderer } from 'electron'

const desktopApi = {
  saveFile: (content: string, defaultPath: string, type: 'json' | 'csv' | 'md'): Promise<boolean> =>
    ipcRenderer.invoke('file:save', { content, defaultPath, type }),
  openJsonFile: (): Promise<string | null> => ipcRenderer.invoke('file:open-json'),
  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke('shell:open-external', url),
}

contextBridge.exposeInMainWorld('desktopApi', desktopApi)
