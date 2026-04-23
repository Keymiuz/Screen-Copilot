import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ChatBubble } from './ChatBubble'
import { ModeToggle } from './ModeToggle'
import { ScreenThumb } from './ScreenThumb'
import { SettingsPanel } from './SettingsPanel'
import { estimateTokenCount, useChatStore } from '../store/chatStore'
import { useChat } from '../hooks/useChat'
import { useScreenshot } from '../hooks/useScreenshot'
import type { AppSettings } from '../types'

function extractFirstUrl(value: string): string | null {
  const match = value.match(/\bhttps?:\/\/[^\s<>"']+/i)

  if (!match) {
    return null
  }

  return match[0].replace(/[.,;!?]+$/, '')
}

export function Overlay(): JSX.Element {
  const messages = useChatStore((state) => state.messages)
  const lastScreenshot = useChatStore((state) => state.lastScreenshot)
  const settings = useChatStore((state) => state.settings)
  const setSettings = useChatStore((state) => state.setSettings)
  const clearHistory = useChatStore((state) => state.clearHistory)
  const isStreaming = useChatStore((state) => state.isStreaming)

  const [input, setInput] = useState('')
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isPinned, setIsPinned] = useState(true)
  const listEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { sendMessage, summarizeUrl } = useChat()
  const { capture, isCapturing, flash } = useScreenshot()
  const tokenCount = useMemo(() => estimateTokenCount(messages), [messages])

  useEffect(() => {
    window.screenMind.getSettings().then(setSettings).catch(() => undefined)
    return window.screenMind.onOpenSettings(() => setSettingsOpen(true))
  }, [setSettings])

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent): void {
      const commandPressed = event.metaKey || event.ctrlKey

      if (event.key === 'Escape') {
        if (settingsOpen) {
          setSettingsOpen(false)
        } else {
          void window.screenMind.hideOverlay()
        }
      }

      if (commandPressed && event.key.toLowerCase() === 'r') {
        event.preventDefault()
        void capture()
      }

      if (commandPressed && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        clearHistory()
      }

      if (commandPressed && event.key === ',') {
        event.preventDefault()
        setSettingsOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [capture, clearHistory, settingsOpen])

  async function handleSubmit(event?: FormEvent<HTMLFormElement>): Promise<void> {
    event?.preventDefault()
    const nextMessage = input.trim()
    const pastedUrl = extractFirstUrl(nextMessage)

    setInput('')

    if (pastedUrl) {
      await summarizeUrl(pastedUrl, {
        useGoogleSearch: webSearchEnabled,
        instruction: nextMessage
      })
      return
    }

    await sendMessage(nextMessage, { useGoogleSearch: webSearchEnabled })
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSubmit()
    }
  }

  async function handleSaveSettings(nextSettings: AppSettings): Promise<void> {
    const saved = await window.screenMind.saveSettings(nextSettings)
    setSettings(saved)
  }

  async function handlePin(): Promise<void> {
    const nextPinned = !isPinned
    setIsPinned(await window.screenMind.setPinned(nextPinned))
  }

  return (
    <main
      className={[
        'relative flex h-screen w-screen flex-col overflow-hidden rounded-xl border border-white/10 bg-surface-glass text-zinc-100 shadow-overlay backdrop-blur-2xl',
        'animate-overlayIn',
        flash ? 'animate-borderFlash' : ''
      ].join(' ')}
    >
      <header className="app-region-drag flex h-14 items-center justify-between border-b border-white/10 px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-zinc-50 text-zinc-950">
            <LogoIcon />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-normal text-white">ScreenMind</h1>
            <p className="text-[11px] text-zinc-400">Copiloto de tela</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ModeToggle
            model={settings.googleModel}
            hasApiKey={Boolean(settings.googleApiKey)}
          />
          <button
            type="button"
            onClick={() => void handlePin()}
            className={`app-region-no-drag grid h-8 w-8 place-items-center rounded-md transition ${
              isPinned ? 'bg-lime-300/20 text-lime-200' : 'text-zinc-400 hover:bg-white/10 hover:text-white'
            }`}
            title={isPinned ? 'Desafixar' : 'Fixar'}
          >
            <PinIcon />
          </button>
          <button
            type="button"
            onClick={() => void window.screenMind.hideOverlay()}
            className="app-region-no-drag grid h-8 w-8 place-items-center rounded-md text-zinc-400 transition hover:bg-white/10 hover:text-white"
            title="Fechar"
          >
            <CloseIcon />
          </button>
        </div>
      </header>

      <section className="border-b border-white/10 p-4">
        <ScreenThumb screenshot={lastScreenshot} isCapturing={isCapturing} onCapture={() => void capture()} />
      </section>

      <section className="scrollbar-soft flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col justify-center">
            <p className="text-sm font-medium text-zinc-200">Pergunte sobre a tela, uma URL ou a web.</p>
            <p className="mt-1 max-w-[28rem] text-xs leading-relaxed text-zinc-500">
              Cloud via Gemini esta ligado. Ative a busca para precos e informacoes atuais.
            </p>
          </div>
        ) : (
          messages.map((message) => <ChatBubble key={message.id} message={message} />)
        )}
        <div ref={listEndRef} />
      </section>

      <form onSubmit={(event) => void handleSubmit(event)} className="border-t border-white/10 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleInputKeyDown}
            rows={2}
            placeholder="Pergunte ou cole uma URL/PDF..."
            className="app-region-no-drag min-h-12 flex-1 resize-none rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm leading-relaxed text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-cyan-300"
          />
          <button
            type="button"
            onClick={() => setWebSearchEnabled((current) => !current)}
            className={[
              'app-region-no-drag grid h-12 w-12 shrink-0 place-items-center rounded-lg border transition',
              webSearchEnabled
                ? 'border-lime-300/60 bg-lime-300/15 text-lime-200'
                : 'border-white/10 text-zinc-400 hover:border-lime-300/50 hover:text-lime-200'
            ].join(' ')}
            title={webSearchEnabled ? 'Google Search ligado' : 'Usar Google Search'}
          >
            <SearchIcon />
          </button>
          <button
            type="button"
            onClick={clearHistory}
            className="app-region-no-drag grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-white/10 text-zinc-400 transition hover:border-rose-300/50 hover:text-rose-200"
            title="Limpar historico"
          >
            <TrashIcon />
          </button>
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="app-region-no-drag grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-cyan-300 text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            title="Enviar"
          >
            <SendIcon />
          </button>
        </div>
      </form>

      <footer className="flex h-9 items-center justify-between px-4 text-[11px] text-zinc-500">
        <span>{tokenCount} tokens aprox.</span>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="app-region-no-drag text-zinc-400 transition hover:text-cyan-200"
        >
          Configuracoes
        </button>
      </footer>

      <SettingsPanel
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
      />
    </main>
  )
}

function LogoIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="13" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M9 20h6M12 17v3M8 9h5M8 13h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function PinIcon(): JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14 4l6 6-3 1-4 4v5l-2 2-2-7-7-2 2-2h5l4-4 1-3z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CloseIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function TrashIcon(): JSX.Element {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SendIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SearchIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" />
      <path d="M16 16l4 4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}
