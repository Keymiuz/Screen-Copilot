import { create } from 'zustand'
import type { PublicSettings, RuntimeState, SettingsDraft } from '../../shared/types'

export const DEFAULT_RUNTIME_STATE: RuntimeState = {
  activeTab: {
    title: 'No active tab',
    url: '',
    provider: 'unsupported',
    isMeeting: false
  },
  canCaptureActiveTab: false,
  status: 'idle',
  startedAt: null,
  transcript: [],
  summary: '',
  error: ''
}

export const DEFAULT_PUBLIC_SETTINGS: PublicSettings = {
  hasGoogleApiKey: false,
  googleModel: 'gemini-2.5-flash'
}

export const DEFAULT_SETTINGS_DRAFT: SettingsDraft = {
  googleApiKey: '',
  googleModel: 'gemini-2.5-flash'
}

interface SidebarStore {
  runtime: RuntimeState
  publicSettings: PublicSettings
  settingsDraft: SettingsDraft
  settingsOpen: boolean
  setRuntime: (runtime: RuntimeState) => void
  setPublicSettings: (settings: PublicSettings) => void
  setSettingsDraft: (settings: SettingsDraft) => void
  setSettingsOpen: (open: boolean) => void
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  runtime: DEFAULT_RUNTIME_STATE,
  publicSettings: DEFAULT_PUBLIC_SETTINGS,
  settingsDraft: DEFAULT_SETTINGS_DRAFT,
  settingsOpen: false,
  setRuntime: (runtime) => set({ runtime }),
  setPublicSettings: (publicSettings) => set({ publicSettings }),
  setSettingsDraft: (settingsDraft) => set({ settingsDraft }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen })
}))
