export type MeetingProvider = 'google-meet' | 'teams' | 'zoom' | 'unsupported'

export type RecordingStatus = 'idle' | 'starting' | 'recording' | 'stopping' | 'summarizing' | 'error'

export interface ActiveTabContext {
  tabId?: number
  title: string
  url: string
  provider: MeetingProvider
  isMeeting: boolean
}

export interface TranscriptEntry {
  id: string
  source: 'Meeting audio'
  text: string
  createdAt: number
  chunkIndex: number
}

export interface PublicSettings {
  hasGoogleApiKey: boolean
  googleModel: string
}

export interface SettingsDraft {
  googleApiKey: string
  googleModel: string
}

export interface RuntimeState {
  activeTab: ActiveTabContext
  status: RecordingStatus
  startedAt: number | null
  transcript: TranscriptEntry[]
  summary: string
  error: string
}

export type SidebarToBackgroundMessage =
  | {
      type: 'settings:get'
    }
  | {
      type: 'settings:save'
      payload: SettingsDraft
    }
  | {
      type: 'meeting:get-state'
    }
  | {
      type: 'meeting:start'
    }
  | {
      type: 'meeting:stop'
    }
  | {
      type: 'meeting:clear'
    }

export type OffscreenToBackgroundMessage =
  | {
      type: 'offscreen:ready'
    }
  | {
      type: 'offscreen:audio-chunk'
      payload: {
        dataUrl: string
        mimeType: string
        chunkIndex: number
      }
    }
  | {
      type: 'offscreen:stopped'
    }
  | {
      type: 'offscreen:error'
      payload: {
        message: string
      }
    }

export type BackgroundToOffscreenMessage =
  | {
      type: 'offscreen:start'
      payload: {
        streamId: string
      }
    }
  | {
      type: 'offscreen:stop'
    }

export type BackgroundBroadcastMessage =
  | {
      type: 'meeting:state'
      payload: RuntimeState
    }

export type RuntimeMessage =
  | SidebarToBackgroundMessage
  | OffscreenToBackgroundMessage
  | BackgroundToOffscreenMessage
  | BackgroundBroadcastMessage

export interface RuntimeResponse<T> {
  ok: boolean
  data?: T
  error?: string
}
