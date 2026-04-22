import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  safeStorage,
  screen,
  Tray
} from 'electron'
import { captureActiveScreen, ScreenshotPayload } from './screenshot'
import { streamGeminiQuery } from './googleClient'
import { fetchRemoteDocument } from './documentFetcher'

interface AppSettings {
  googleApiKey: string
  googleModel: string
  googleBaseUrl: string
  hotkey: string
  captureQuality: number
  maxScreenshotWidth: number
  autoCapture: boolean
  autoCaptureInterval: number
  keepHistoryDays: number
}

type StoredSettings = Omit<AppSettings, 'googleApiKey'> & {
  googleApiKeyEncrypted: string
}

interface SettingsStore {
  store: StoredSettings
  set: (value: Partial<StoredSettings>) => void
}

interface SendMessagePayload {
  message: string
  imageBase64?: string
  useGoogleSearch?: boolean
  history?: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
}

interface SummarizeUrlPayload {
  url: string
  useGoogleSearch?: boolean
  history?: SendMessagePayload['history']
}

const WINDOW_SIZE = {
  width: 480,
  height: 600
}

function readLocalEnvValue(name: string): string {
  const envPath = join(process.cwd(), '.env.local')

  if (!existsSync(envPath)) {
    return process.env[name] ?? ''
  }

  try {
    const content = readFileSync(envPath, 'utf8')
    const line = content
      .split(/\r?\n/)
      .find((candidate) => candidate.trim().startsWith(`${name}=`))

    if (!line) {
      return process.env[name] ?? ''
    }

    return line
      .slice(name.length + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '')
  } catch {
    return process.env[name] ?? ''
  }
}

const DEFAULT_SETTINGS: AppSettings = {
  googleApiKey: readLocalEnvValue('SCREENMIND_GOOGLE_API_KEY'),
  googleModel: readLocalEnvValue('SCREENMIND_GOOGLE_MODEL') || 'gemini-2.5-flash',
  googleBaseUrl:
    readLocalEnvValue('SCREENMIND_GOOGLE_BASE_URL') || 'https://generativelanguage.googleapis.com',
  hotkey: 'CommandOrControl+Shift+Space',
  captureQuality: 80,
  maxScreenshotWidth: 1280,
  autoCapture: false,
  autoCaptureInterval: 20,
  keepHistoryDays: 7
}

let overlayWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let registeredHotkey = ''
let settingsStore: SettingsStore | null = null

async function initializeSettingsStore(): Promise<void> {
  const { default: Store } = await import('electron-store')

  settingsStore = new Store<StoredSettings>({
    name: 'settings',
    defaults: {
      googleApiKeyEncrypted: '',
      googleModel: DEFAULT_SETTINGS.googleModel,
      googleBaseUrl: DEFAULT_SETTINGS.googleBaseUrl,
      hotkey: DEFAULT_SETTINGS.hotkey,
      captureQuality: DEFAULT_SETTINGS.captureQuality,
      maxScreenshotWidth: DEFAULT_SETTINGS.maxScreenshotWidth,
      autoCapture: DEFAULT_SETTINGS.autoCapture,
      autoCaptureInterval: DEFAULT_SETTINGS.autoCaptureInterval,
      keepHistoryDays: DEFAULT_SETTINGS.keepHistoryDays
    }
  }) as SettingsStore
}

function getSettingsStore(): SettingsStore {
  if (!settingsStore) {
    throw new Error('Settings store ainda nao foi inicializado.')
  }

  return settingsStore
}

function decryptApiKey(encryptedValue: string): string {
  if (!encryptedValue || !safeStorage.isEncryptionAvailable()) {
    return ''
  }

  try {
    return safeStorage.decryptString(Buffer.from(encryptedValue, 'base64'))
  } catch {
    return ''
  }
}

function encryptApiKey(value: string): string {
  if (!value) {
    return ''
  }

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Criptografia segura indisponivel neste sistema.')
  }

  return safeStorage.encryptString(value).toString('base64')
}

function getSettings(): AppSettings {
  const stored = getSettingsStore().store
  const decryptedKey = decryptApiKey(stored.googleApiKeyEncrypted)

  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    googleApiKey: decryptedKey || DEFAULT_SETTINGS.googleApiKey
  }
}

function saveSettings(settings: AppSettings): AppSettings {
  const stored: StoredSettings = {
    googleApiKeyEncrypted: encryptApiKey(settings.googleApiKey),
    googleModel: settings.googleModel,
    googleBaseUrl: settings.googleBaseUrl,
    hotkey: settings.hotkey,
    captureQuality: settings.captureQuality,
    maxScreenshotWidth: settings.maxScreenshotWidth,
    autoCapture: settings.autoCapture,
    autoCaptureInterval: settings.autoCaptureInterval,
    keepHistoryDays: settings.keepHistoryDays
  }

  getSettingsStore().set(stored)
  registerHotkey(stored.hotkey)
  rebuildTrayMenu()

  return getSettings()
}

function resolveOverlayBounds(): Electron.Rectangle {
  const cursorPoint = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursorPoint)
  const margin = 18

  return {
    width: WINDOW_SIZE.width,
    height: WINDOW_SIZE.height,
    x: Math.round(display.workArea.x + display.workArea.width - WINDOW_SIZE.width - margin),
    y: Math.round(display.workArea.y + display.workArea.height - WINDOW_SIZE.height - margin)
  }
}

function createOverlayWindow(): BrowserWindow {
  const window = new BrowserWindow({
    ...resolveOverlayBounds(),
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  window.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      window.hide()
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  overlayWindow = window
  return window
}

function showOverlayInactive(): void {
  const window = overlayWindow ?? createOverlayWindow()

  window.setBounds(resolveOverlayBounds())
  window.setAlwaysOnTop(true, 'floating')

  if (window.isMinimized()) {
    window.restore()
  }

  window.showInactive()
}

function hideOverlay(): void {
  overlayWindow?.hide()
}

async function captureAndBroadcast(): Promise<ScreenshotPayload | null> {
  const settings = getSettings()

  try {
    const screenshot = await captureActiveScreen({
      maxWidth: settings.maxScreenshotWidth,
      quality: settings.captureQuality
    })

    overlayWindow?.webContents.send('screenshot:captured', screenshot)
    overlayWindow?.webContents.send('overlay:flash')
    return screenshot
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao capturar a tela.'
    overlayWindow?.webContents.send('chat:error', { message })
    return null
  }
}

async function captureFromHotkey(): Promise<void> {
  showOverlayInactive()
  await captureAndBroadcast()
}

function registerHotkey(accelerator: string): void {
  if (registeredHotkey) {
    globalShortcut.unregister(registeredHotkey)
  }

  registeredHotkey = ''
  const success = globalShortcut.register(accelerator, () => {
    void captureFromHotkey()
  })

  if (success) {
    registeredHotkey = accelerator
    return
  }

  overlayWindow?.webContents.send('chat:error', {
    message: `Nao consegui registrar o atalho ${accelerator}.`
  })
}

function createTrayImage(): Electron.NativeImage {
  const svg = `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="8" fill="#111114"/><rect x="7" y="8" width="18" height="12" rx="3" fill="#f4f4f5"/><rect x="10" y="11" width="12" height="6" rx="1.5" fill="#18181b"/><path d="M12 14h5" stroke="#22d3ee" stroke-width="2" stroke-linecap="round"/><path d="M12 17h8" stroke="#a3e635" stroke-width="2" stroke-linecap="round"/><path d="M14 23h4" stroke="#f4f4f5" stroke-width="2" stroke-linecap="round"/></svg>`
  return nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
}

function rebuildTrayMenu(): void {
  if (!tray) {
    return
  }

  const settings = getSettings()
  const menu = Menu.buildFromTemplate([
    {
      label: 'Abrir ScreenMind',
      click: showOverlayInactive
    },
    {
      label: 'Capturar tela agora',
      click: () => {
        void captureFromHotkey()
      }
    },
    {
      label: `Gemini: ${settings.googleModel}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Configuracoes',
      click: () => {
        showOverlayInactive()
        overlayWindow?.webContents.send('settings:open')
      }
    },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setContextMenu(menu)
}

function createTray(): void {
  tray = new Tray(createTrayImage())
  tray.setToolTip('ScreenMind')
  tray.on('click', showOverlayInactive)
  rebuildTrayMenu()
}

function streamCloudResponse(streamId: string, payload: SendMessagePayload): void {
  const target = overlayWindow?.webContents

  if (!target) {
    return
  }

  void (async () => {
    try {
      for await (const token of streamGeminiQuery({
        settings: getSettings(),
        userMessage: payload.message,
        imageBase64: payload.imageBase64,
        useGoogleSearch: payload.useGoogleSearch,
        history: payload.history ?? []
      })) {
        target.send('chat:token', { streamId, token })
      }

      target.send('chat:done', { streamId })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao chamar o Gemini.'
      target.send('chat:error', { streamId, message })
    }
  })()
}

function buildUrlSummaryPrompt(document: Awaited<ReturnType<typeof fetchRemoteDocument>>): string {
  if (document.attachment) {
    return [
      'Resuma o documento anexado em portugues brasileiro.',
      `URL: ${document.url}`,
      `Titulo/arquivo: ${document.title}`,
      '',
      'Formato desejado:',
      '- 4 a 6 bullets com os pontos principais.',
      '- Dados, precos, prazos ou numeros importantes quando existirem.',
      '- Uma frase final com a conclusao pratica.',
      '- Se a URL nao puder ser lida completamente, diga isso claramente.'
    ].join('\n')
  }

  return [
    'Resuma o conteudo da URL abaixo em portugues brasileiro.',
    `URL: ${document.url}`,
    `Titulo: ${document.title}`,
    '',
    'Formato desejado:',
    '- 4 a 6 bullets com os pontos principais.',
    '- Dados, precos, prazos ou numeros importantes quando existirem.',
    '- Uma frase final com a conclusao pratica.',
    '- Se o texto parecer incompleto, diga isso claramente.',
    '',
    'Conteudo extraido:',
    document.text
  ].join('\n')
}

function streamUrlSummaryResponse(streamId: string, payload: SummarizeUrlPayload): void {
  const target = overlayWindow?.webContents

  if (!target) {
    return
  }

  void (async () => {
    try {
      const document = await fetchRemoteDocument(payload.url)

      for await (const token of streamGeminiQuery({
        settings: getSettings(),
        userMessage: buildUrlSummaryPrompt(document),
        attachments: document.attachment ? [document.attachment] : undefined,
        useGoogleSearch: payload.useGoogleSearch,
        history: payload.history ?? []
      })) {
        target.send('chat:token', { streamId, token })
      }

      target.send('chat:done', { streamId })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Nao consegui buscar ou resumir essa URL.'
      target.send('chat:error', { streamId, message })
    }
  })()
}

function registerIpcHandlers(): void {
  ipcMain.handle('screen:capture', async () => {
    showOverlayInactive()
    return captureAndBroadcast()
  })

  ipcMain.handle('chat:send-message', (_event, payload: SendMessagePayload) => {
    const streamId = randomUUID()
    setTimeout(() => streamCloudResponse(streamId, payload), 0)
    return { streamId }
  })

  ipcMain.handle('chat:summarize-url', (_event, payload: SummarizeUrlPayload) => {
    const streamId = randomUUID()
    setTimeout(() => streamUrlSummaryResponse(streamId, payload), 0)
    return { streamId }
  })

  ipcMain.handle('settings:get', () => getSettings())

  ipcMain.handle('settings:save', (_event, settings: AppSettings) => saveSettings(settings))

  ipcMain.handle('overlay:hide', () => {
    hideOverlay()
  })

  ipcMain.handle('overlay:set-pinned', (_event, pinned: boolean) => {
    overlayWindow?.setAlwaysOnTop(pinned, 'floating')
    return pinned
  })
}

app.whenReady().then(async () => {
  await initializeSettingsStore()
  registerIpcHandlers()
  createOverlayWindow()
  createTray()
  registerHotkey(getSettings().hotkey)
  showOverlayInactive()

  app.on('activate', () => {
    showOverlayInactive()
  })
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
