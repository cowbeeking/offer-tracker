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
    async (_event, payload: { content: string; defaultPath: string; type: 'json' | 'csv' | 'md' }) => {
      const filters = payload.type === 'json'
        ? [{ name: 'JSON 数据', extensions: ['json'] }]
        : payload.type === 'csv'
          ? [{ name: 'CSV 表格', extensions: ['csv'] }]
          : [{ name: 'Markdown 文档', extensions: ['md'] }]
      const result = await dialog.showSaveDialog({ defaultPath: payload.defaultPath, filters })
      if (result.canceled || !result.filePath) return false
      await writeFile(result.filePath, payload.content, 'utf8')
      return true
    },
  )

  ipcMain.handle('file:save-pdf', async (_event, payload: { html: string; defaultPath: string }) => {
    const result = await dialog.showSaveDialog({
      defaultPath: payload.defaultPath,
      filters: [{ name: 'PDF 文档', extensions: ['pdf'] }],
    })
    if (result.canceled || !result.filePath) return false

    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })
    try {
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(payload.html)}`)
      const pdf = await printWindow.webContents.printToPDF({ printBackground: true, pageSize: 'A4' })
      await writeFile(result.filePath, pdf)
      return true
    } finally {
      printWindow.destroy()
    }
  })

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

  ipcMain.handle('app:get-auto-launch', () => app.getLoginItemSettings().openAtLogin)
  ipcMain.handle('app:set-auto-launch', (_event, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: Boolean(enabled), openAsHidden: false })
    return app.getLoginItemSettings().openAtLogin
  })
  ipcMain.handle('app:show-reminder', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return false
    if (window.isMinimized()) window.restore()
    window.show()
    window.flashFrame(true)
    shell.beep()
    setTimeout(() => { if (!window.isDestroyed()) window.flashFrame(false) }, 5000)
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
