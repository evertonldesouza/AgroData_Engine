import { formatCurrency, formatDateTime, formatPercent } from '../lib/format'
import { symbolMeta, trendStyle } from '../lib/symbols'

/**
 * Recent readings, newest first. Turns the chart into auditable data: every
 * row is a real quote returned by the API.
 */
export default function HistoryTable({ readings, ariaLabel = 'Últimas leituras de preço' }) {
  if (!readings || readings.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center font-mono text-[11px] uppercase tracking-widest text-zinc-600">
        sem leituras recentes
      </p>
    )
  }

  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-left" aria-label={ariaLabel}>
        <thead>
          <tr className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-600">
            <th scope="col" className="px-2 pb-2 font-medium">Horário</th>
            <th scope="col" className="px-2 pb-2 font-medium">Commodity</th>
            <th scope="col" className="px-2 pb-2 text-right font-medium">Preço</th>
            <th scope="col" className="px-2 pb-2 text-right font-medium">Variação</th>
            <th scope="col" className="px-2 pb-2 text-right font-medium">Fonte</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {readings.map((reading) => {
            const meta = symbolMeta(reading.symbol)
            const style = trendStyle(reading.deltaPercent > 0 ? 'up' : reading.deltaPercent < 0 ? 'down' : 'flat')

            return (
              <tr
                key={`${reading.symbol}-${reading.timestamp}`}
                className="font-mono text-xs text-zinc-400 transition-colors hover:bg-white/[0.03]"
              >
                <td className="whitespace-nowrap px-2 py-2.5 tabular-nums">{formatDateTime(reading.timestamp)}</td>
                <td className="whitespace-nowrap px-2 py-2.5">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: meta.color }}
                      aria-hidden="true"
                    />
                    <span className="font-semibold text-zinc-200">{meta.label}</span>
                    <span className="text-[10px] text-zinc-600">{reading.symbol}</span>
                  </span>
                </td>
                <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums text-zinc-200">
                  {formatCurrency(reading.price)}
                </td>
                <td className={`whitespace-nowrap px-2 py-2.5 text-right tabular-nums ${style.text}`}>
                  {reading.deltaPercent === null ? '—' : formatPercent(reading.deltaPercent)}
                </td>
                <td className="whitespace-nowrap px-2 py-2.5 text-right text-[10px] uppercase tracking-wider text-zinc-600">
                  {reading.source ?? '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
