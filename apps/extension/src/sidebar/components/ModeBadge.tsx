import type { RuntimeState } from '../../shared/types'

export function ModeBadge({ runtime }: { runtime: RuntimeState }): JSX.Element {
  const isRecording = runtime.status === 'recording'
  const isMeeting = runtime.activeTab.isMeeting
  const label = isMeeting ? runtime.activeTab.provider.replace('-', ' ') : 'unsupported tab'

  return (
    <div
      className={[
        'inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold capitalize',
        isMeeting ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-zinc-200 bg-zinc-100 text-zinc-500'
      ].join(' ')}
    >
      <span
        className={[
          'h-2.5 w-2.5 rounded-full',
          isRecording ? 'animate-pulseDot bg-rose-500' : isMeeting ? 'bg-rose-400' : 'bg-zinc-400'
        ].join(' ')}
      />
      {label}
    </div>
  )
}
