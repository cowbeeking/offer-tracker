import { app, BrowserWindow, Menu, dialog, ipcMain, screen, shell, Tray } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

let mainWindow: BrowserWindow | null = null
let reminderWindow: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false
let backgroundHintShown = false
const startHidden = process.argv.includes('--hidden')
const appIconPath = join(__dirname, '../../build/icon.png')
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
app.setAppUserModelId('com.autumn.tracker')

interface ReminderPayload {
  applicationId?: string
  companyName?: string
  positionName?: string
  nodeName?: string
  scheduledAt?: string
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] ?? character)
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow(true)
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.setSkipTaskbar(false)
  mainWindow.show()
  mainWindow.focus()
}

function createWindow(showWhenReady = !startHidden): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    backgroundColor: '#f6f6f3',
    autoHideMenuBar: true,
    title: '秋招 Tracker',
    icon: appIconPath,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  })
  mainWindow = window

  window.once('ready-to-show', () => {
    if (showWhenReady) showMainWindow()
  })

  window.on('close', (event) => {
    if (quitting) return
    event.preventDefault()
    window.hide()
    window.setSkipTaskbar(true)
    if (!backgroundHintShown && tray) {
      backgroundHintShown = true
      tray.displayBalloon({
        title: '秋招 Tracker 正在后台运行',
        content: '节点提醒仍会按时触发；可双击托盘图标重新打开。',
        iconType: 'info',
      })
    }
  })

  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })

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

function openReminderApplication(applicationId?: string): void {
  showMainWindow()
  if (!applicationId || !mainWindow || mainWindow.isDestroyed()) return
  const send = (): void => mainWindow?.webContents.send('app:open-reminder', applicationId)
  if (mainWindow.webContents.isLoading()) mainWindow.webContents.once('did-finish-load', send)
  else send()
}

function closeReminderWindow(): void {
  if (reminderWindow && !reminderWindow.isDestroyed()) reminderWindow.close()
  reminderWindow = null
}

function reminderHtml(payload: ReminderPayload): string {
  const company = escapeHtml(payload.companyName || '秋招 Tracker')
  const position = escapeHtml(payload.positionName || '招聘流程节点即将开始')
  const node = escapeHtml(payload.nodeName || '待办节点')
  const date = payload.scheduledAt ? new Date(payload.scheduledAt) : new Date()
  const time = escapeHtml(new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(Number.isNaN(date.getTime()) ? new Date() : date))
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style>
*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;background:transparent;font-family:"Microsoft YaHei UI","Segoe UI",sans-serif;color:#232321;overflow:hidden}
.notice{position:relative;width:calc(100% - 8px);height:calc(100% - 8px);margin:4px;display:grid;grid-template-columns:58px 1fr auto;gap:14px;align-items:center;padding:18px 18px 18px 16px;background:rgba(255,255,253,.98);border:1px solid rgba(214,210,197,.92);border-radius:16px;box-shadow:0 12px 38px rgba(48,43,31,.22);animation:enter .38s cubic-bezier(.2,.9,.25,1),shake .4s .44s ease-in-out 2;transform-origin:80% 100%}
.notice:after{content:"";position:absolute;right:0;bottom:0;width:92px;height:3px;border-radius:3px;background:#e6b629;animation:countdown 15s linear forwards}
.bell{width:58px;height:58px;border-radius:50%;display:grid;place-items:center;background:#fff0b8;color:#b86218}.bell svg{width:27px;height:27px;animation:ring .4s .44s ease-in-out 4;transform-origin:50% 12%}
.copy{min-width:0;align-self:center}.eyebrow{display:block;margin-bottom:4px;color:#b86218;font-size:12px;font-weight:700;letter-spacing:.08em}.title{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:17px;font-weight:750}.meta{margin-top:5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#73736d;font-size:13px}.time{display:flex;align-items:center;gap:5px;margin-top:8px;color:#7d7d76;font-size:12px}.time svg{width:14px;height:14px}
.actions{display:flex;align-items:center;gap:10px}.view{display:grid;place-items:center;height:40px;padding:0 17px;border-radius:9px;background:#222220;color:#fff;text-decoration:none;font-size:13px;font-weight:650}.view:hover{background:#3a3a36}.close{position:absolute;right:12px;top:9px;width:26px;height:26px;display:grid;place-items:center;color:#777;text-decoration:none;font-size:24px;font-weight:300;line-height:1}.close:hover{color:#222}
@keyframes enter{from{opacity:0;transform:translateX(48px) scale(.96)}to{opacity:1;transform:translateX(0) scale(1)}}
@keyframes shake{0%,100%{transform:translateX(0) rotate(0)}20%{transform:translateX(-5px) rotate(-.45deg)}40%{transform:translateX(5px) rotate(.45deg)}60%{transform:translateX(-3px) rotate(-.25deg)}80%{transform:translateX(3px) rotate(.25deg)}}
@keyframes ring{0%,100%{transform:rotate(0)}25%{transform:rotate(14deg)}75%{transform:rotate(-14deg)}}
@keyframes countdown{from{width:92px}to{width:0}}
</style></head><body>
<section class="notice">
  <a class="close" href="autumn-tracker://dismiss" aria-label="关闭">×</a>
  <span class="bell"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 21h3.4"/><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/></svg></span>
  <div class="copy"><span class="eyebrow">节点提醒</span><strong class="title">${node}</strong><div class="meta">${company} · ${position}</div><time class="time"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>${time}</time></div>
  <div class="actions"><a class="view" href="autumn-tracker://view">查看节点</a></div>
</section>
<script>
async function playChime(){const C=window.AudioContext||window.webkitAudioContext;if(!C)return;const c=new C();const t=c.currentTime;[[523.25,0],[659.25,.12],[783.99,.24],[1046.5,.38]].forEach(([f,d],i)=>{const o=c.createOscillator(),g=c.createGain();o.type=i<3?'sine':'triangle';o.frequency.setValueAtTime(f,t+d);g.gain.setValueAtTime(.0001,t+d);g.gain.exponentialRampToValueAtTime(i===3?.13:.09,t+d+.025);g.gain.exponentialRampToValueAtTime(.0001,t+d+.3);o.connect(g).connect(c.destination);o.start(t+d);o.stop(t+d+.32)});setTimeout(()=>c.close(),1100)}
addEventListener('DOMContentLoaded',()=>playChime().catch(()=>{}));
</script></body></html>`
}

function showReminderPopup(payload: ReminderPayload): void {
  closeReminderWindow()
  const width = 510
  const height = 152
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const { x, y, width: workWidth, height: workHeight } = display.workArea
  const popup = new BrowserWindow({
    width,
    height,
    x: x + workWidth - width - 14,
    y: y + workHeight - height - 14,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    hasShadow: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  })
  reminderWindow = popup
  popup.setAlwaysOnTop(true, 'pop-up-menu')
  popup.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  popup.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('autumn-tracker://')) return
    event.preventDefault()
    if (url.startsWith('autumn-tracker://view')) openReminderApplication(payload.applicationId)
    closeReminderWindow()
  })
  popup.once('ready-to-show', () => popup.showInactive())
  popup.on('closed', () => { if (reminderWindow === popup) reminderWindow = null })
  void popup.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(reminderHtml(payload))}`)
  setTimeout(() => { if (!popup.isDestroyed()) popup.close() }, 15_000)
}

async function createTray(): Promise<void> {
  if (tray) return
  tray = new Tray(appIconPath)
  tray.setToolTip('秋招 Tracker · 后台提醒运行中')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开主界面', click: showMainWindow },
    { type: 'separator' },
    {
      label: '退出秋招 Tracker',
      click: () => {
        quitting = true
        app.quit()
      },
    },
  ]))
  tray.on('double-click', showMainWindow)
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()
if (!hasSingleInstanceLock) app.quit()
else app.on('second-instance', showMainWindow)

app.whenReady().then(() => {
  if (!hasSingleInstanceLock) return
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
    app.setLoginItemSettings({ openAtLogin: Boolean(enabled), args: enabled ? ['--hidden'] : [] })
    return app.getLoginItemSettings().openAtLogin
  })
  ipcMain.handle('app:show-reminder', (_event, payload?: ReminderPayload) => {
    showReminderPopup(payload ?? {})
    return true
  })

  createWindow(!startHidden)
  void createTray().catch((error: unknown) => console.error('创建系统托盘失败', error))
  app.on('activate', () => {
    showMainWindow()
  })
})

app.on('window-all-closed', () => {
  // 主窗口关闭时隐藏到托盘，只有托盘菜单中的“退出”才结束后台提醒。
})

app.on('before-quit', () => {
  quitting = true
  closeReminderWindow()
  tray?.destroy()
  tray = null
})
