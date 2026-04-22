import { useEffect, useMemo, useState } from 'react'
import type { ScreenshotPayload } from '../types'

function formatElapsed(capturedAt: number | undefined, now: number): string {
  if (!capturedAt) {
    return 'Nenhuma captura'
  }

  const seconds = Math.max(0, Math.floor((now - capturedAt) / 1000))

  if (seconds < 2) {
    return 'Capturado agora'
  }

  if (seconds < 60) {
    return `Capturado ha ${seconds}s`
  }

  return `Capturado ha ${Math.floor(seconds / 60)}min`
}

export function ScreenThumb({
  screenshot,
  isCapturing,
  onCapture
}: {
  screenshot: ScreenshotPayload | null
  isCapturing: boolean
  onCapture: () => void
}): JSX.Element {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const elapsed = useMemo(() => formatElapsed(screenshot?.capturedAt, now), [now, screenshot])

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onCapture}
        className="app-region-no-drag grid h-[100px] w-[150px] shrink-0 place-items-center overflow-hidden rounded-lg border border-white/10 bg-zinc-950/60 text-left transition hover:border-cyan-300/70 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
        title="Capturar tela"
      >
        {screenshot ? (
          <img src={screenshot.dataUrl} alt="Ultima tela capturada" className="h-full w-full object-cover" />
        ) : (
          <span className="px-4 text-center text-xs text-zinc-500">Sem captura</span>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-100">{elapsed}</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
          {screenshot ? `${screenshot.width}x${screenshot.height}px` : 'Use o atalho global ou atualize.'}
        </p>
        <button
          type="button"
          onClick={onCapture}
          disabled={isCapturing}
          className="app-region-no-drag mt-3 inline-flex h-8 items-center gap-2 rounded-md border border-white/10 px-3 text-xs font-medium text-zinc-200 transition hover:border-cyan-300/60 hover:text-white disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshIcon />
          {isCapturing ? 'Capturando' : 'Atualizar'}
        </button>
      </div>
    </div>
  )
}

function RefreshIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 12a8 8 0 0 1-13.7 5.6M4 12A8 8 0 0 1 17.7 6.4M18 3v4h-4M6 21v-4h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
