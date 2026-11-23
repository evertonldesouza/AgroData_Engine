import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import ExportCsvLink from './ExportCsvLink'
import Sparkline from './Sparkline'
import { formatCurrency, formatPercent, formatSignedCurrency, formatTime } from '../lib/format'
import { symbolMeta, trendStyle } from '../lib/symbols'

const ICONS = { up: TrendingUp, down: TrendingDown, flat: Minus }

export default function TickerCard({ snapshot }) {
  const { symbol, price, delta, deltaPercent, trend, timestamp, history } = snapshot
  const meta = symbolMeta(symbol)
  const style = trendStyle(trend)
  const TrendIcon = ICONS[trend] ?? ICONS.flat
  const hasDelta = deltaPercent !== null && Number.isFinite(deltaPercent)

  return (
    <article
      className="group relative flex-1 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/40 p-5 shadow-xl backdrop-blur-xl transition-colors duration-300 hover:border-white/20"
      aria-label={`${meta.label}: ${formatCurrency(price)}${hasDelta ? `, variação de ${formatPercent(deltaPercent)}` : ''}`}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)` }}
        aria-hidden="true"
      />

      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/5 font-mono text-[11px] font-bold"
            style={{ backgroundColor: meta.tint, color: meta.color }}
            aria-hidden="true"
          >
            {symbol.slice(0, 2)}
          </span>
          <div>
            <p className="text-sm font-semibold leading-none text-white">{meta.label}</p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-500">{symbol}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
        <ExportCsvLink symbol={symbol} points={history.length} />
        <span className={`flex items-center gap-1 rounded-md px-2 py-1 ${style.chip}`}>
          <TrendIcon size={11} strokeWidth={2.5} aria-hidden="true" />
          <span className="font-mono text-[10px] font-bold tabular-nums">
            {hasDelta ? formatPercent(deltaPercent) : 'sem base'}
          </span>
        </span>
        </div>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-3xl font-bold tracking-tight text-white tabular-nums">
          {formatCurrency(price)}
        </span>
        {delta !== null && (
          <span className={`font-mono text-xs tabular-nums ${style.text}`}>
            {formatSignedCurrency(delta)}
          </span>
        )}
      </div>

      <div className="mb-3 mt-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-600">
        <span>{meta.unit}</span>
        <span>{timestamp ? formatTime(timestamp) : '—'}</span>
      </div>

      <Sparkline data={history} color={style.stroke === 'var(--color-up)' ? meta.color : style.stroke} />
    </article>
  )
}
