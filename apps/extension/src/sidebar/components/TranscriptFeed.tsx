import { useEffect, useRef } from 'react'
import type { TranscriptEntry } from '../../shared/types'

export function TranscriptFeed({ entries }: { entries: TranscriptEntry[] }): JSX.Element {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [entries])

  if (!entries.length) {
    return (
      <div className="flex h-full flex-col justify-center px-5 text-sm text-zinc-500">
        <p className="font-medium text-zinc-700">No transcript yet.</p>
        <p className="mt-2 leading-relaxed">
          Start capture in a supported meeting tab. Transcript chunks appear every few seconds after Gemini
          processes the audio.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 px-4 py-4">
      {entries.map((entry) => (
        <article key={entry.id} className="animate-slideIn rounded-lg border border-line bg-white p-3 shadow-sm">
          <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-zinc-500">
            <span>{entry.source}</span>
            <span>chunk {entry.chunkIndex + 1}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">{entry.text}</p>
        </article>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
