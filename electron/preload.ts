import { clipboard, contextBridge, ipcRenderer } from 'electron'

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

interface ScreenshotPayload {
  id: string
  capturedAt: number
  width: number
  height: number
  displayId?: string
  base64: string
  dataUrl: string
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
  userInstruction?: string
  useGoogleSearch?: boolean
  history?: SendMessagePayload['history']
}

interface TokenPayload {
  streamId: string
  token: string
}

interface StreamDonePayload {
  streamId: string
}

interface ChatErrorPayload {
  streamId?: string
  message: string
}

type Unsubscribe = () => void

function subscribe<T>(channel: string, callback: (payload: T) => void): Unsubscribe {
  const listener = (_event: Electron.IpcRendererEvent, payload: T) => callback(payload)
  ipcRenderer.on(channel, listener)

  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

contextBridge.exposeInMainWorld('screenMind', {
  captureScreen: (): Promise<ScreenshotPayload | null> => ipcRenderer.invoke('screen:capture'),
  onScreenshot: (callback: (payload: ScreenshotPayload) => void): Unsubscribe =>
    subscribe('screenshot:captured', callback),
  sendMessage: (payload: SendMessagePayload): Promise<{ streamId: string }> =>
    ipcRenderer.invoke('chat:send-message', payload),
  summarizeUrl: (payload: SummarizeUrlPayload): Promise<{ streamId: string }> =>
    ipcRenderer.invoke('chat:summarize-url', payload),
  copyText: (value: string): Promise<void> => {
    clipboard.writeText(value)
    return Promise.resolve()
  },
  onToken: (callback: (payload: TokenPayload) => void): Unsubscribe =>
    subscribe('chat:token', callback),
  onStreamDone: (callback: (payload: StreamDonePayload) => void): Unsubscribe =>
    subscribe('chat:done', callback),
  onChatError: (callback: (payload: ChatErrorPayload) => void): Unsubscribe =>
    subscribe('chat:error', callback),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: AppSettings): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:save', settings),
  hideOverlay: (): Promise<void> => ipcRenderer.invoke('overlay:hide'),
  setPinned: (pinned: boolean): Promise<boolean> => ipcRenderer.invoke('overlay:set-pinned', pinned),
  onOverlayFlash: (callback: () => void): Unsubscribe => subscribe('overlay:flash', callback),
  onOpenSettings: (callback: () => void): Unsubscribe => subscribe('settings:open', callback)
})
