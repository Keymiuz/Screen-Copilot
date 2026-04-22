export function ModeToggle({
  model,
  hasApiKey
}: {
  model: string
  hasApiKey: boolean
}): JSX.Element {
  const statusLabel = hasApiKey ? 'Cloud pronto' : 'Sem chave'

  return (
    <div className="app-region-no-drag flex items-center gap-2">
      <div className="flex h-8 items-center rounded-md border border-white/10 bg-black/20 px-2.5 text-xs font-medium text-zinc-100">
        Gemini
      </div>
      <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">
        <span
          className={`h-2 w-2 rounded-full ${hasApiKey ? 'bg-lime-300' : 'bg-rose-400'}`}
          aria-hidden="true"
        />
        <span className="max-w-24 truncate">{hasApiKey ? model : statusLabel}</span>
      </span>
    </div>
  )
}
