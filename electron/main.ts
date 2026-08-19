import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    backgroundColor: '#f6f6f3',
    autoHideMenuBar: true,
    title: '秋招 Tracker',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  window.once('ready-to-show', () => window.show())

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  ipcMain.handle(
    'file:save',
    async (_event, payload: { content: string; defaultPath: string; type: 'json' | 'csv' }) => {
      const filters = payload.type === 'json'
        ? [{ name: 'JSON 数据', extensions: ['json'] }]
        : [{ name: 'CSV 表格', extensions: ['csv'] }]
      const result = await dialog.showSaveDialog({ defaultPath: payload.defaultPath, filters })
      if (result.canceled || !result.filePath) return false
      await writeFile(result.filePath, payload.content, 'utf8')
      return true
    },
  )

  ipcMain.handle('file:open-json', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'JSON 数据', extensions: ['json'] }],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return readFile(result.filePaths[0], 'utf8')
  })

  ipcMain.handle('shell:open-external', async (_event, url: string) => {
    if (!url.startsWith('https://') && !url.startsWith('http://')) return false
    await shell.openExternal(url)
    return true
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
