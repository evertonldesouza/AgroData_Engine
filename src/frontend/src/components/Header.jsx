import { ExternalLink, Leaf, RefreshCcw } from 'lucide-react'
import RelativeTime from './RelativeTime'
import StatusPill from './StatusPill'

export default function Header({ status, lastUpdated, isRefreshing, retryInSeconds, onRefresh, apiDocsUrl }) {
  return (
    <header className="sticky top-4 z-20 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/5 bg-zinc-900/60 px-4 py-3 shadow-2xl backdrop-blur-xl md:px-5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 shadow-[0_4px_12px_#10b98140]">
          <Leaf className="text-white" size={18} aria-hidden="true" />
        </div>
        <div className="leading-tight">
          <h1 className="text-base font-black tracking-tighter text-white">
            AGRO<span className="text-emerald-500">DATA</span>
          </h1>
          <p className="hidden text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500 sm:block">
            market intelligence
          </p>
        </div>
        <span className="ml-1 rounded border border-white/5 px-2 py-0.5 font-mono text-[9px] font-bold text-zinc-500">
          v3.0
        </span>
      </div>

      <div className="flex items-center gap-3 font-mono text-[10px] text-zinc-500">
        <StatusPill status={status} retryInSeconds={retryInSeconds} />
        <span className="hidden text-zinc-700 sm:inline">·</span>
        <span className="hidden sm:inline">postgresql · supabase</span>
        <span className="hidden text-zinc-700 sm:inline">·</span>
        <RelativeTime timestamp={lastUpdated} />
      </div>

      <div className="flex items-center gap-2">
        {apiDocsUrl && (
          <a
            href={apiDocsUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="hidden items-center gap-1.5 rounded-xl border border-white/5 bg-zinc-800/60 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400 transition hover:bg-zinc-700 hover:text-white sm:flex"
          >
            API docs
            <ExternalLink size={11} aria-hidden="true" />
          </a>
        )}
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Recarregar dados"
          title="Recarregar dados"
          className="rounded-xl border border-white/5 bg-zinc-800/60 p-2.5 shadow-lg transition active:scale-95 hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
        >
          <RefreshCcw
            size={14}
            className={`text-emerald-500 ${isRefreshing ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>
    </header>
  )
}
