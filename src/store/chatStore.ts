import { create } from 'zustand'
import type { AppSettings, ChatMessage, ScreenshotPayload } from '../types'

export const DEFAULT_SETTINGS: AppSettings = {
  googleApiKey: '',
  googleModel: 'gemini-2.5-flash',
  googleBaseUrl: 'https://generativelanguage.googleapis.com',
  hotkey: 'CommandOrControl+Shift+Space',
  captureQuality: 80,
  maxScreenshotWidth: 1280,
  autoCapture: false,
  autoCaptureInterval: 20,
  keepHistoryDays: 7
}

interface ChatStore {
  messages: ChatMessage[]
  lastScreenshot: ScreenshotPayload | null
  settings: AppSettings
  isStreaming: boolean
  addMessage: (message: ChatMessage) => void
  appendToMessage: (id: string, token: string) => void
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void
  clearHistory: () => void
  setLastScreenshot: (screenshot: ScreenshotPayload | null) => void
  setSettings: (settings: AppSettings) => void
  setStreaming: (isStreaming: boolean) => void
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  lastScreenshot: null,
  settings: DEFAULT_SETTINGS,
  isStreaming: false,
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message]
    })),
  appendToMessage: (id, token) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === id ? { ...message, content: message.content + token } : message
      )
    })),
  updateMessage: (id, patch) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === id ? { ...message, ...patch } : message
      )
    })),
  clearHistory: () => set({ messages: [], isStreaming: false }),
  setLastScreenshot: (screenshot) => set({ lastScreenshot: screenshot }),
  setSettings: (settings) => set({ settings }),
  setStreaming: (isStreaming) => set({ isStreaming })
}))

export function estimateTokenCount(messages: ChatMessage[]): number {
  return Math.ceil(messages.reduce((total, message) => total + message.content.length, 0) / 4)
}
