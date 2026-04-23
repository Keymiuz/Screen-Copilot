import ReactMarkdown from 'react-markdown'
import { useEffect, useState } from 'react'
import { ModeBadge } from './components/ModeBadge'
import { SettingsPanel } from './components/SettingsPanel'
import { TranscriptFeed } from './components/TranscriptFeed'
import { useElapsedTime } from './hooks/useElapsedTime'
import {
  clearMeeting,
  getMeetingState,
  getSettings,
  saveSettings,
  startMeeting,
  stopMeeting,
  subscribeToRuntime
} from './lib/runtime'
import { useSidebarStore } from './store/sidebarStore'
import type { SettingsDraft } from '../shared/types'

export function App(): JSX.Element {
  const runtime = useSidebarStore((state) => state.runtime)
  const publicSettings = useSidebarStore((state) => state.publicSettings)
  const settingsDraft = useSidebarStore((state) => state.settingsDraft)
  const settingsOpen = useSidebarStore((state) => state.settingsOpen)
  const setRuntime = useSidebarStore((state) => state.setRuntime)
  const setPublicSettings = useSidebarStore((state) => state.setPublicSettings)
  const setSettingsDraft = useSidebarStore((state) => state.setSettingsDraft)
  const setSettingsOpen = useSidebarStore((state) => state.setSettingsOpen)
  const [uiError, setUiError] = useState('')
  const elapsed = useElapsedTime(runtime.startedAt)

  const isBusy =
    runtime.status === 'starting' || runtime.status === 'stopping' || runtime.status === 'summarizing'
  const canStart = runtime.activeTab.isMeeting && publicSettings.hasGoogleApiKey && runtime.status !== 'recording'
  const canStop = runtime.status === 'recording' || runtime.status === 'starting'

  useEffect(() => {
    const unsubscribe = subscribeToRuntime(setRuntime)

    void Promise.all([getMeetingState(), getSettings()])
      .then(([nextRuntime, settings]) => {
        setRuntime(nextRuntime)
        setPublicSettings(settings.public)
        setSettingsDraft(settings.draft)
      })
      .catch((error) => setUiError(error instanceof Error ? error.message : 'Failed to load MindSide.'))

    return unsubscribe
  }, [setPublicSettings, setRuntime, setSettingsDraft])

  async function handleStart(): Promise<void> {
    setUiError('')

    try {
      setRuntime(await startMeeting())
    } catch (error) {
      setUiError(error instanceof Error ? error.message : 'Failed to start capture.')
    }
  }

  async function handleStop(): Promise<void> {
    setUiError('')

    try {
      setRuntime(await stopMeeting())
    } catch (error) {
      setUiError(error instanceof Error ? error.message : 'Failed to stop capture.')
    }
  }

  async function handleClear(): Promise<void> {
    setUiError('')
    setRuntime(await clearMeeting())
  }

  async function handleSaveSettings(nextSettings: SettingsDraft): Promise<void> {
    const nextPublic = await saveSettings(nextSettings)
    setPublicSettings(nextPublic)
    setSettingsDraft(nextSettings)
  }

  return (
    <main className="relative flex h-screen w-screen flex-col overflow-hidden bg-panel text-ink">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4">
        <div className="min-w-0">
          <h1 className="text-lg font-bold tracking-normal">MindSide</h1>
          <p className="text-xs text-zinc-500">Meeting MVP</p>
        </div>
        <div className="flex items-center gap-2">
          <ModeBadge runtime={runtime} />
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-md border border-line bg-white text-zinc-700 hover:bg-zinc-50"
            title="Settings"
          >
            <SettingsIcon />
          </button>
        </div>
      </header>

      <section className="border-b border-line bg-white px-4 py-4">
        <p className="truncate text-sm font-semibold text-zinc-900">{runtime.activeTab.title}</p>
        <p className="mt-1 truncate text-xs text-zinc-500">{runtime.activeTab.url || 'No active tab URL'}</p>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Metric label="Status" value={runtime.status} tone={runtime.status === 'recording' ? 'hot' : 'neutral'} />
          <Metric label="Elapsed" value={elapsed} />
          <Metric label="Chunks" value={String(runtime.transcript.length)} />
        </div>

        {!runtime.activeTab.isMeeting ? (
          <Notice tone="neutral" text="Open Google Meet, Microsoft Teams web, or Zoom web to enable capture." />
        ) : null}
        {!publicSettings.hasGoogleApiKey ? (
          <Notice tone="warning" text="Add a Google API key in settings before recording." />
        ) : null}
        {runtime.error || uiError ? <Notice tone="danger" text={runtime.error || uiError} /> : null}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={!canStart || isBusy}
            className="h-11 flex-1 rounded-lg bg-rose-600 text-sm font-bold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {runtime.status === 'starting' ? 'Starting' : 'Start capture'}
          </button>
          <button
            type="button"
            onClick={() => void handleStop()}
            disabled={!canStop || isBusy}
            className="h-11 flex-1 rounded-lg border border-line bg-white text-sm font-bold text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-400"
          >
            {runtime.status === 'stopping' || runtime.status === 'summarizing' ? 'Stopping' : 'Stop'}
          </button>
        </div>
      </section>

      <section className="min-h-0 flex-1 overflow-y-auto">
        <TranscriptFeed entries={runtime.transcript} />
      </section>

      <section className="max-h-[34vh] shrink-0 overflow-y-auto border-t border-line bg-white px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-950">Summary</h2>
          <button
            type="button"
            onClick={() => void handleClear()}
            className="rounded-md px-2 py-1 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          >
            Clear
          </button>
        </div>
        {runtime.summary ? (
          <div className="prose prose-sm max-w-none prose-headings:mb-2 prose-headings:mt-3 prose-p:my-1 prose-li:my-0">
            <ReactMarkdown>{runtime.summary}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-zinc-500">
            Stop recording to generate a concise meeting summary with decisions, action items, open questions,
            and notes.
          </p>
        )}
      </section>

      <SettingsPanel
        open={settingsOpen}
        settings={settingsDraft}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
      />
    </main>
  )
}

function Metric({
  label,
  value,
  tone = 'neutral'
}: {
  label: string
  value: string
  tone?: 'neutral' | 'hot'
}): JSX.Element {
  return (
    <div className="rounded-lg border border-line bg-panel px-2 py-2">
      <p className="text-[10px] font-semibold uppercase text-zinc-500">{label}</p>
      <p className={['mt-1 truncate text-xs font-bold capitalize', tone === 'hot' ? 'text-rose-600' : 'text-zinc-900'].join(' ')}>
        {value}
      </p>
    </div>
  )
}

function Notice({ text, tone }: { text: string; tone: 'neutral' | 'warning' | 'danger' }): JSX.Element {
  const styles = {
    neutral: 'border-zinc-200 bg-zinc-50 text-zinc-600',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    danger: 'border-rose-200 bg-rose-50 text-rose-700'
  }

  return <p className={`mt-3 rounded-lg border px-3 py-2 text-xs leading-relaxed ${styles[tone]}`}>{text}</p>
}

function SettingsIcon(): JSX.Element {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.1 1.65V21a2 2 0 1 1-4 0v-.09A1.8 1.8 0 0 0 8.75 19.26a1.8 1.8 0 0 0-1.98.36l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.8 1.8 0 0 0 4.3 14.8 1.8 1.8 0 0 0 2.65 13.7H2.5a2 2 0 1 1 0-4h.15A1.8 1.8 0 0 0 4.3 8.6a1.8 1.8 0 0 0-.36-1.98l-.06-.06A2 2 0 1 1 6.7 3.73l.06.06a1.8 1.8 0 0 0 1.98.36A1.8 1.8 0 0 0 9.85 2.5V2a2 2 0 1 1 4 0v.5A1.8 1.8 0 0 0 14.95 4.15a1.8 1.8 0 0 0 1.98-.36l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.8 1.8 0 0 0-.36 1.98 1.8 1.8 0 0 0 1.65 1.1h.45a2 2 0 1 1 0 4h-.45A1.8 1.8 0 0 0 19.4 15Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
