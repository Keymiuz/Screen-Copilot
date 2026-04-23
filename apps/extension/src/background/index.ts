import { transcribeAudioChunk, summarizeTranscript } from './geminiClient'
import { createTabContext } from '../shared/meetings'
import { getGeminiConfig, getPublicSettings, getSettingsDraft, saveSettings } from '../shared/storage'
import type {
  ActiveTabContext,
  OffscreenToBackgroundMessage,
  RecordingStatus,
  RuntimeMessage,
  RuntimeResponse,
  RuntimeState,
  SidebarToBackgroundMessage,
  TranscriptEntry
} from '../shared/types'

const OFFSCREEN_URL = 'src/offscreen/offscreen.html'

let state: RuntimeState = {
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

let captureGrantTabId: number | null = null

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function setState(patch: Partial<RuntimeState>): void {
  state = {
    ...state,
    ...patch
  }

  void broadcastState()
}

async function broadcastState(): Promise<void> {
  const message: RuntimeMessage = {
    type: 'meeting:state',
    payload: state
  }

  await chrome.runtime.sendMessage(message).catch(() => undefined)
}

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

async function refreshActiveTabContext(): Promise<ActiveTabContext> {
  const tab = await getActiveTab()
  const activeTab = createTabContext(tab)
  const canCaptureActiveTab = Boolean(activeTab.tabId && activeTab.tabId === captureGrantTabId)
  setState({ activeTab, canCaptureActiveTab })

  return activeTab
}

function registerActionInvocation(tab: chrome.tabs.Tab): ActiveTabContext {
  const activeTab = createTabContext(tab)
  captureGrantTabId = activeTab.isMeeting && activeTab.tabId ? activeTab.tabId : null

  setState({
    activeTab,
    canCaptureActiveTab: Boolean(captureGrantTabId),
    error: activeTab.isMeeting
      ? ''
      : 'Abra uma aba de Google Meet, Teams ou Zoom Web e clique no icone MindSide antes de iniciar.'
  })

  return activeTab
}

async function setupOffscreenDocument(): Promise<void> {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_URL)

  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [offscreenUrl]
  })

  if (contexts.length > 0) {
    return
  }

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification: 'Record tab audio from an active meeting for transcription.'
  })
}

function getTabMediaStreamId(targetTabId: number): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId }, (streamId) => {
      const error = chrome.runtime.lastError

      if (error || !streamId) {
        reject(new Error(error?.message || 'Chrome nao retornou um stream de audio da aba.'))
        return
      }

      resolve(streamId)
    })
  })
}

async function startMeetingCapture(): Promise<RuntimeState> {
  const activeTab = await refreshActiveTabContext()

  if (!activeTab.isMeeting || !activeTab.tabId) {
    throw new Error('Abra uma aba de Google Meet, Teams ou Zoom Web antes de iniciar a captura.')
  }

  if (!activeTab.url.startsWith('http://') && !activeTab.url.startsWith('https://')) {
    throw new Error('O Chrome nao permite capturar paginas internas como chrome:// ou chrome-extension://.')
  }

  if (captureGrantTabId !== activeTab.tabId) {
    throw new Error(
      'Clique no icone MindSide na barra do Chrome enquanto a aba da reuniao estiver ativa. Depois aperte Start capture.'
    )
  }

  const settings = await getPublicSettings()

  if (!settings.hasGoogleApiKey) {
    throw new Error('Adicione sua Google API key nas configuracoes antes de iniciar.')
  }

  setState({
    status: 'starting',
    startedAt: Date.now(),
    transcript: [],
    summary: '',
    error: ''
  })

  await setupOffscreenDocument()

  const streamId = await getTabMediaStreamId(activeTab.tabId)

  await chrome.runtime.sendMessage({
    type: 'offscreen:start',
    payload: {
      streamId
    }
  } satisfies RuntimeMessage)

  await chrome.action.setBadgeText({ text: 'REC' })
  await chrome.action.setBadgeBackgroundColor({ color: '#DC2626' })
  setState({ status: 'recording' })

  return state
}

async function stopMeetingCapture(): Promise<RuntimeState> {
  if (state.status !== 'recording' && state.status !== 'starting') {
    return state
  }

  setState({ status: 'stopping' })

  await chrome.runtime
    .sendMessage({
      type: 'offscreen:stop'
    } satisfies RuntimeMessage)
    .catch(() => undefined)

  await chrome.action.setBadgeText({ text: '' })

  const transcriptText = state.transcript.map((entry) => entry.text).join('\n').trim()

  if (!transcriptText) {
    setState({
      status: 'idle',
      startedAt: null,
      summary: 'Nenhuma fala inteligivel foi transcrita nesta sessao.'
    })
    return state
  }

  setState({ status: 'summarizing' })

  try {
    const summary = await summarizeTranscript(await getGeminiConfig(), transcriptText)
    setState({ status: 'idle', startedAt: null, summary, error: '' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao gerar resumo.'
    setState({ status: 'error', startedAt: null, error: message })
  }

  return state
}

async function handleAudioChunk(message: OffscreenToBackgroundMessage): Promise<void> {
  if (message.type !== 'offscreen:audio-chunk') {
    return
  }

  try {
    const text = await transcribeAudioChunk(await getGeminiConfig(), message.payload.dataUrl)

    if (!text) {
      return
    }

    const entry: TranscriptEntry = {
      id: createId('transcript'),
      source: 'Meeting audio',
      text,
      createdAt: Date.now(),
      chunkIndex: message.payload.chunkIndex
    }

    setState({
      transcript: [...state.transcript, entry],
      error: ''
    })
  } catch (error) {
    const messageText = error instanceof Error ? error.message : 'Falha ao transcrever audio.'
    setState({ status: 'error', error: messageText })
  }
}

function createResponse<T>(data: T): RuntimeResponse<T> {
  return { ok: true, data }
}

function createErrorResponse(error: unknown): RuntimeResponse<never> {
  return {
    ok: false,
    error: error instanceof Error ? error.message : 'Erro inesperado.'
  }
}

async function handleSidebarMessage(
  message: SidebarToBackgroundMessage
): Promise<RuntimeResponse<RuntimeState | unknown>> {
  if (message.type === 'settings:get') {
    return createResponse({
      public: await getPublicSettings(),
      draft: await getSettingsDraft()
    })
  }

  if (message.type === 'settings:save') {
    return createResponse(await saveSettings(message.payload))
  }

  if (message.type === 'meeting:get-state') {
    await refreshActiveTabContext()
    return createResponse(state)
  }

  if (message.type === 'meeting:start') {
    return createResponse(await startMeetingCapture())
  }

  if (message.type === 'meeting:stop') {
    return createResponse(await stopMeetingCapture())
  }

  if (message.type === 'meeting:clear') {
    setState({ transcript: [], summary: '', error: '', status: 'idle', startedAt: null })
    return createResponse(state)
  }

  return createErrorResponse(new Error('Mensagem desconhecida.'))
}

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })
  void refreshActiveTabContext()
})

chrome.action.onClicked.addListener((tab) => {
  registerActionInvocation(tab)

  if (tab.windowId) {
    void chrome.sidePanel.open({ windowId: tab.windowId })
  }
})

chrome.tabs.onActivated.addListener(() => {
  void refreshActiveTabContext()
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === captureGrantTabId && changeInfo.url) {
    captureGrantTabId = null
  }

  if (changeInfo.status === 'complete' || changeInfo.url || changeInfo.title) {
    void refreshActiveTabContext()
  }
})

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (
    message.type === 'offscreen:start' ||
    message.type === 'offscreen:stop' ||
    message.type === 'offscreen:ready'
  ) {
    return false
  }

  if (message.type === 'offscreen:audio-chunk') {
    void handleAudioChunk(message)
    sendResponse(createResponse(null))
    return false
  }

  if (message.type === 'offscreen:error') {
    setState({ status: 'error', error: message.payload.message })
    sendResponse(createResponse(null))
    return false
  }

  if (message.type === 'offscreen:stopped') {
    sendResponse(createResponse(null))
    return false
  }

  void handleSidebarMessage(message as SidebarToBackgroundMessage)
    .then(sendResponse)
    .catch((error) => sendResponse(createErrorResponse(error)))

  return true
})

void refreshActiveTabContext()
