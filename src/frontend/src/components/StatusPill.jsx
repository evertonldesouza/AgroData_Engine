const STATES = {
  ready: { label: 'LIVE', dot: 'bg-[var(--color-up)]', text: 'text-[var(--color-up)]' },
  loading: { label: 'SYNC', dot: 'bg-sky-400', text: 'text-sky-400' },
  error: { label: 'DEGRADED', dot: 'bg-[var(--color-down)]', text: 'text-[var(--color-down)]' },
}

export default function StatusPill({ status, retryInSeconds }) {
  const state = STATES[status] ?? STATES.loading

  return (
    <span className="flex items-center gap-2" aria-live="polite">
      <span className="relative flex h-2 w-2">
        <span className={`absolute inline-flex h-full w-full rounded-full opacity-70 ${state.dot} ${status === 'error' ? '' : 'animate-ping'}`} />
        <span className={`relative inline-flex h-2 w-2 rounded-full ${state.dot}`} />
      </span>
      <span className={`font-bold tracking-wider ${state.text}`}>{state.label}</span>
      {status === 'error' && Number.isFinite(retryInSeconds) && (
        <span className="text-zinc-600">· retry {retryInSeconds}s</span>
      )}
    </span>
  )
}
