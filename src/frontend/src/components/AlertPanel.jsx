import { AlertTriangle, BellRing, TrendingDown, TrendingUp } from 'lucide-react'
import { SEVERITY_STYLES, alertBadgeLabel, groupBySeverity } from '../lib/alerts'
import { formatCurrency, formatPercent } from '../lib/format'
import { symbolMeta } from '../lib/symbols'

const SEVERITY_ICONS = {
  critical: AlertTriangle,
  warning: BellRing,
  info: BellRing,
}

/**
 * Price movements that crossed the alert threshold, grouped by severity.
 *
 * This is the feature the dashboard was missing: the chart shows *what*
 * happened, the panel says *what deserves attention*.
 */
export default function AlertPanel({ alerts = [], status = 'ready' }) {
  const groups = groupBySeverity(alerts)
  const isEmpty = alerts.length === 0

  return (
    <section
      aria-labelledby="alerts-title"
      className="rounded-[2rem] border border-white/10 bg-zinc-900/30 p-6 shadow-2xl backdrop-blur-2xl md:p-8"
    >
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <div>
          <h2 id="alerts-title" className="text-lg font-bold text-white">
            Alertas de variação
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Movimentos acima do limite configurado no pipeline
          </p>
        </div>
        <span
          className="rounded-md border border-white/5 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-500"
          data-testid="alerts-count"
        >
          {alertBadgeLabel(alerts)}
        </span>
      </div>

      {isEmpty ? (
        <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center font-mono text-[11px] uppercase tracking-widest text-zinc-600">
          {status === 'loading' ? 'verificando…' : 'nenhuma variação relevante'}
        </p>
      ) : (
        <ul className="space-y-2" aria-live="polite">
          {['critical', 'warning', 'info'].flatMap((severity) =>
            groups[severity].map((alert) => {
              const meta = symbolMeta(alert.symbol)
              const style = SEVERITY_STYLES[severity]
              const Icon = alert.kind === 'down' ? TrendingDown : TrendingUp
              const SeverityIcon = SEVERITY_ICONS[severity]

              return (
                <li
                  key={`${alert.symbol}-${severity}-${alert.timestamp ?? alert.changePercent}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-zinc-950/40 px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${style.chip}`}
                      aria-hidden="true"
                    >
                      <SeverityIcon size={13} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-white">{meta.label}</p>
                      <p className={`font-mono text-[10px] uppercase tracking-wider ${style.text}`}>
                        {style.label} · {formatCurrency(alert.price)}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`flex shrink-0 items-center gap-1 font-mono text-xs font-bold tabular-nums ${style.text}`}
                  >
                    <Icon size={12} aria-hidden="true" />
                    {formatPercent(alert.changePercent)}
                  </span>
                </li>
              )
            }),
          )}
        </ul>
      )}
    </section>
  )
}
