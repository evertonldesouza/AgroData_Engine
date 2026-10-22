import { DatabaseZap } from 'lucide-react'

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-14 text-center">
      <DatabaseZap size={22} className="text-zinc-600" aria-hidden="true" />
      <p className="text-sm font-semibold text-zinc-300">Nenhuma cotação disponível</p>
      <p className="max-w-md text-xs leading-relaxed text-zinc-500">
        A API respondeu, mas o warehouse está vazio. Rode{' '}
        <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[11px] text-emerald-400">
          agrodata collect
        </code>{' '}
        (ou aguarde o próximo ciclo do GitHub Actions) para popular as commodities.
      </p>
    </div>
  )
}
