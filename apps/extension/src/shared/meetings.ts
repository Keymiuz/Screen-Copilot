import type { ActiveTabContext, MeetingProvider } from './types'

export function detectMeetingProvider(url: string): MeetingProvider {
  if (url.includes('meet.google.com')) {
    return 'google-meet'
  }

  if (url.includes('teams.microsoft.com')) {
    return 'teams'
  }

  if (url.includes('zoom.us/wc')) {
    return 'zoom'
  }

  return 'unsupported'
}

export function createTabContext(tab: chrome.tabs.Tab | undefined): ActiveTabContext {
  const url = tab?.url ?? ''
  const provider = detectMeetingProvider(url)

  return {
    tabId: tab?.id,
    title: tab?.title || 'Untitled tab',
    url,
    provider,
    isMeeting: provider !== 'unsupported'
  }
}
