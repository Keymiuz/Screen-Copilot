import { FormEvent, useEffect, useState } from 'react'
import type { AppSettings } from '../types'

export function SettingsPanel({
  open,
  settings,
  onClose,
  onSave
}: {
  open: boolean
  settings: AppSettings
  onClose: () => void
  onSave: (settings: AppSettings) => Promise<void>
}): JSX.Element | null {
  const [draft, setDraft] = useState(settings)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setDraft(settings)
    }
  }, [open, settings])

  if (!open) {
    return null
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setIsSaving(true)

    try {
      await onSave(draft)
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/50 px-3 pb-3 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="app-region-no-drag w-full rounded-lg border border-white/10 bg-zinc-950/95 p-4 shadow-overlay"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-50">Configuracoes</h2>
            <p className="mt-1 text-xs text-zinc-400">Gemini cloud e captura.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md text-zinc-400 transition hover:bg-white/10 hover:text-white"
            title="Fechar"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="col-span-2 text-xs font-medium text-zinc-300">
            Google API key
            <input
              type="password"
              value={draft.googleApiKey}
              onChange={(event) =>
                setDraft((current) => ({ ...current, googleApiKey: event.target.value }))
              }
              className="mt-1 h-9 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none focus:border-cyan-300"
              placeholder="AIza..."
            />
          </label>

          <label className="col-span-2 text-xs font-medium text-zinc-300">
            Endpoint
            <input
              value={draft.googleBaseUrl}
              onChange={(event) => setDraft((current) => ({ ...current, googleBaseUrl: event.target.value }))}
              className="mt-1 h-9 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none focus:border-cyan-300"
            />
          </label>

          <label className="text-xs font-medium text-zinc-300">
            Modelo
            <input
              value={draft.googleModel}
              onChange={(event) => setDraft((current) => ({ ...current, googleModel: event.target.value }))}
              className="mt-1 h-9 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none focus:border-cyan-300"
            />
          </label>

          <label className="text-xs font-medium text-zinc-300">
            Atalho
            <input
              value={draft.hotkey}
              onChange={(event) => setDraft((current) => ({ ...current, hotkey: event.target.value }))}
              className="mt-1 h-9 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none focus:border-cyan-300"
            />
          </label>

          <label className="col-span-2 text-xs font-medium text-zinc-300">
            Qualidade: {draft.captureQuality}
            <input
              type="range"
              min={60}
              max={100}
              value={draft.captureQuality}
              onChange={(event) =>
                setDraft((current) => ({ ...current, captureQuality: Number(event.target.value) }))
              }
              className="mt-2 w-full accent-cyan-300"
            />
          </label>

          <label className="text-xs font-medium text-zinc-300">
            Largura max.
            <input
              type="number"
              min={640}
              max={2560}
              value={draft.maxScreenshotWidth}
              onChange={(event) =>
                setDraft((current) => ({ ...current, maxScreenshotWidth: Number(event.target.value) }))
              }
              className="mt-1 h-9 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none focus:border-cyan-300"
            />
          </label>

          <label className="text-xs font-medium text-zinc-300">
            Historico
            <input
              type="number"
              min={1}
              max={90}
              value={draft.keepHistoryDays}
              onChange={(event) =>
                setDraft((current) => ({ ...current, keepHistoryDays: Number(event.target.value) }))
              }
              className="mt-1 h-9 w-full rounded-md border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none focus:border-cyan-300"
            />
          </label>

          <label className="col-span-2 flex items-center gap-2 text-xs font-medium text-zinc-300">
            <input
              type="checkbox"
              checked={draft.autoCapture}
              onChange={(event) =>
                setDraft((current) => ({ ...current, autoCapture: event.target.checked }))
              }
              className="h-4 w-4 rounded border-white/10 accent-cyan-300"
            />
            Captura automatica
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-md px-3 text-sm text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="h-9 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-70"
          >
            {isSaving ? 'Salvando' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  )
}

function CloseIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
