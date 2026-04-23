import { FormEvent, useEffect, useState } from 'react'
import type { SettingsDraft } from '../../shared/types'

export function SettingsPanel({
  open,
  settings,
  onClose,
  onSave
}: {
  open: boolean
  settings: SettingsDraft
  onClose: () => void
  onSave: (settings: SettingsDraft) => Promise<void>
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
    <div className="absolute inset-0 z-20 flex items-end bg-black/30 p-3 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full rounded-lg bg-white p-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-950">Settings</h2>
            <p className="mt-1 text-xs text-zinc-500">Gemini key and model for meeting transcription.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100"
            title="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <label className="mt-4 block text-xs font-semibold text-zinc-700">
          Google API key
          <input
            type="password"
            value={draft.googleApiKey}
            onChange={(event) => setDraft((current) => ({ ...current, googleApiKey: event.target.value }))}
            placeholder="AIza..."
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-rose-400"
          />
        </label>

        <label className="mt-3 block text-xs font-semibold text-zinc-700">
          Gemini model
          <input
            value={draft.googleModel}
            onChange={(event) => setDraft((current) => ({ ...current, googleModel: event.target.value }))}
            className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none focus:border-rose-400"
          />
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-md px-3 text-sm text-zinc-600 hover:bg-zinc-100">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="h-9 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
          >
            {isSaving ? 'Saving' : 'Save'}
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
