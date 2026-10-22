import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency, formatDateTime } from '../lib/format'
import { symbolMeta } from '../lib/symbols'

const RANGES = [
  { label: '24h', points: 24 },
  { label: '7d', points: 168 },
  { label: '30d', points: 500 },
]

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/95 px-4 py-3 shadow-2xl backdrop-blur">
      <p className="mb-2 font-mono text-[10px] text-zinc-500">
        {formatDateTime(payload[0]?.payload?.timestamp)}
      </p>
      <ul className="space-y-1">
        {payload.map((entry) => (
          <li key={entry.dataKey} className="flex items-center gap-2 font-mono text-xs">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.stroke }}
              aria-hidden="true"
            />
            <span className="text-zinc-400">{symbolMeta(entry.dataKey).label}</span>
            <span className="ml-auto font-bold tabular-nums text-white">{formatCurrency(entry.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function MarketChart({ rows, symbols, range, onRangeChange }) {
  const hasData = rows.length > 1

  return (
    <section
      className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-900/30 p-6 shadow-2xl backdrop-blur-2xl md:p-8"
      aria-labelledby="market-chart-title"
    >
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-center">
        <div>
          <h2 id="market-chart-title" className="text-lg font-bold text-white">
            Histórico de preços
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Série real extraída do warehouse · atualizada a cada minuto
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ul className="flex flex-wrap items-center gap-3">
            {symbols.map(({ symbol }) => {
              const meta = symbolMeta(symbol)
              return (
                <li key={symbol} className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: meta.color }}
                    aria-hidden="true"
                  />
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    {meta.label}
                  </span>
                </li>
              )
            })}
          </ul>

          <div
            className="flex rounded-xl border border-white/5 bg-black/20 p-1"
            role="group"
            aria-label="Intervalo do gráfico"
          >
            {RANGES.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => onRangeChange(option.points)}
                aria-pressed={range === option.points}
                className={`rounded-lg px-2.5 py-1 font-mono text-[10px] font-bold transition ${
                  range === option.points
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className="h-[340px] w-full md:h-[380px]"
        role="img"
        aria-label={`Gráfico de preços com ${rows.length} pontos para ${symbols
          .map(({ symbol }) => symbol)
          .join(' e ')}`}
      >
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                {symbols.map(({ symbol }) => {
                  const meta = symbolMeta(symbol)
                  return (
                    <linearGradient key={symbol} id={`fill-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={meta.color} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={meta.color} stopOpacity={0} />
                    </linearGradient>
                  )
                })}
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="rgba(255,255,255,0.15)"
                fontSize={10}
                axisLine={false}
                tickLine={false}
                tickMargin={14}
                minTickGap={48}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="rgba(255,255,255,0.15)"
                fontSize={10}
                axisLine={false}
                tickLine={false}
                width={64}
                domain={['auto', 'auto']}
                tickFormatter={(value) => `R$ ${Math.round(value)}`}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
              {symbols.map(({ symbol }) => {
                const meta = symbolMeta(symbol)
                return (
                  <Area
                    key={symbol}
                    type="monotone"
                    dataKey={symbol}
                    name={meta.label}
                    stroke={meta.color}
                    strokeWidth={2.5}
                    fill={`url(#fill-${symbol})`}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                    connectNulls
                    animationDuration={700}
                  />
                )
              })}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-600">
              aguardando série histórica
            </p>
            <p className="max-w-xs text-xs text-zinc-600">
              O pipeline precisa de pelo menos duas leituras por commodity para desenhar a curva.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
