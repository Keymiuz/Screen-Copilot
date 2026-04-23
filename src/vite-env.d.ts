/// <reference types="vite/client" />

import type {
  AppSettings,
  ChatErrorPayload,
  ScreenshotPayload,
  SendMessagePayload,
  StreamDonePayload,
  SummarizeUrlPayload,
  TokenPayload,
  WindowState
} from './types'

type Unsubscribe = () => void

declare global {
  interface Window {
    screenMind: {
      captureScreen: () => Promise<ScreenshotPayload | null>
      onScreenshot: (callback: (payload: ScreenshotPayload) => void) => Unsubscribe
      sendMessage: (payload: SendMessagePayload) => Promise<{ streamId: string }>
      summarizeUrl: (payload: SummarizeUrlPayload) => Promise<{ streamId: string }>
      copyText: (value: string) => Promise<void>
      onToken: (callback: (payload: TokenPayload) => void) => Unsubscribe
      onStreamDone: (callback: (payload: StreamDonePayload) => void) => Unsubscribe
      onChatError: (callback: (payload: ChatErrorPayload) => void) => Unsubscribe
      getSettings: () => Promise<AppSettings>
      saveSettings: (settings: AppSettings) => Promise<AppSettings>
      hideOverlay: () => Promise<void>
      minimizeWindow: () => Promise<void>
      getWindowState: () => Promise<WindowState>
      toggleConversationMode: () => Promise<WindowState>
      setPinned: (pinned: boolean) => Promise<boolean>
      onWindowState: (callback: (payload: WindowState) => void) => Unsubscribe
      onOverlayFlash: (callback: () => void) => Unsubscribe
      onOpenSettings: (callback: () => void) => Unsubscribe
    }
  }
}

export {}
