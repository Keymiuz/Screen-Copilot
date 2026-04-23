import type {
  BackgroundBroadcastMessage,
  PublicSettings,
  RuntimeResponse,
  RuntimeState,
  SettingsDraft,
  SidebarToBackgroundMessage
} from '../../shared/types'

async function sendMessage<T>(message: SidebarToBackgroundMessage): Promise<T> {
  const response = (await chrome.runtime.sendMessage(message)) as RuntimeResponse<T>

  if (!response.ok) {
    throw new Error(response.error || 'MindSide background failed.')
  }

  return response.data as T
}

export function getMeetingState(): Promise<RuntimeState> {
  return sendMessage<RuntimeState>({ type: 'meeting:get-state' })
}

export function startMeeting(): Promise<RuntimeState> {
  return sendMessage<RuntimeState>({ type: 'meeting:start' })
}

export function stopMeeting(): Promise<RuntimeState> {
  return sendMessage<RuntimeState>({ type: 'meeting:stop' })
}

export function clearMeeting(): Promise<RuntimeState> {
  return sendMessage<RuntimeState>({ type: 'meeting:clear' })
}

export function getSettings(): Promise<{ public: PublicSettings; draft: SettingsDraft }> {
  return sendMessage<{ public: PublicSettings; draft: SettingsDraft }>({ type: 'settings:get' })
}

export function saveSettings(settings: SettingsDraft): Promise<PublicSettings> {
  return sendMessage<PublicSettings>({
    type: 'settings:save',
    payload: settings
  })
}

export function subscribeToRuntime(callback: (state: RuntimeState) => void): () => void {
  const listener = (message: BackgroundBroadcastMessage): void => {
    if (message.type === 'meeting:state') {
      callback(message.payload)
    }
  }

  chrome.runtime.onMessage.addListener(listener)

  return () => {
    chrome.runtime.onMessage.removeListener(listener)
  }
}
