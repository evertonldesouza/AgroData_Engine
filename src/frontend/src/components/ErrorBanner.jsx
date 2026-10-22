import { AlertTriangle } from 'lucide-react'

export default function ErrorBanner({ message, retryInSeconds, onRetry }) {
  return (
    <div
      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3"
      role="alert"
    >
      <div className="flex items-center gap-2.5">
        <AlertTriangle size={14} className="text-red-400" aria-hidden="true" />
        <span className="font-mono text-xs text-red-300">
          {message ?? 'Falha ao consultar a API.'}
          {Number.isFinite(retryInSeconds) && (
            <span className="text-red-400/70"> · nova tentativa em {retryInSeconds}s</span>
          )}
        </span>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg border border-red-400/30 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-red-300 transition hover:bg-red-500/20"
      >
        Tentar agora
      </button>
    </div>
  )
}
