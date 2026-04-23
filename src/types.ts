export interface ScreenshotPayload {
  id: string
  capturedAt: number
  width: number
  height: number
  displayId?: string
  base64: string
  dataUrl: string
}

export interface AppSettings {
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

export type ChatRole = 'user' | 'assistant'
export type MessageStatus = 'streaming' | 'done' | 'error'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: number
  status: MessageStatus
}

export interface SendMessagePayload {
  message: string
  imageBase64?: string
  useGoogleSearch?: boolean
  history?: Array<Pick<ChatMessage, 'role' | 'content'>>
}

export interface SummarizeUrlPayload {
  url: string
  userInstruction?: string
  useGoogleSearch?: boolean
  history?: Array<Pick<ChatMessage, 'role' | 'content'>>
}

export interface TokenPayload {
  streamId: string
  token: string
}

export interface StreamDonePayload {
  streamId: string
}

export interface ChatErrorPayload {
  streamId?: string
  message: string
}
