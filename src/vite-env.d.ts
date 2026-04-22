/// <reference types="vite/client" />

import type {
  AppSettings,
  ChatErrorPayload,
  ScreenshotPayload,
  SendMessagePayload,
  StreamDonePayload,
  TokenPayload
} from './types'

type Unsubscribe = () => void

declare global {
  interface Window {
    screenMind: {
      captureScreen: () => Promise<ScreenshotPayload | null>
      onScreenshot: (callback: (payload: ScreenshotPayload) => void) => Unsubscribe
      sendMessage: (payload: SendMessagePayload) => Promise<{ streamId: string }>
      onToken: (callback: (payload: TokenPayload) => void) => Unsubscribe
      onStreamDone: (callback: (payload: StreamDonePayload) => void) => Unsubscribe
      onChatError: (callback: (payload: ChatErrorPayload) => void) => Unsubscribe
      getSettings: () => Promise<AppSettings>
      saveSettings: (settings: AppSettings) => Promise<AppSettings>
      hideOverlay: () => Promise<void>
      setPinned: (pinned: boolean) => Promise<boolean>
      onOverlayFlash: (callback: () => void) => Unsubscribe
      onOpenSettings: (callback: () => void) => Unsubscribe
    }
  }
}

export {}
