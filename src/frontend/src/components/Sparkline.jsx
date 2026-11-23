import { useId } from 'react'

/**
 * Dependency-free SVG sparkline. The gradient id comes from `useId`, so several
 * sparklines can coexist without clashing.
 */
export default function Sparkline({ data = [], color = '#00d68f', height = 36 }) {
  const gradientId = useId()
  const values = data.filter((value) => Number.isFinite(value))

  if (values.length < 2) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center rounded-lg bg-white/[0.02] font-mono text-[9px] uppercase tracking-widest text-zinc-700"
        aria-hidden="true"
      >
        aguardando série
      </div>
    )
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const width = 200
  const padding = 3
  const innerHeight = height - padding * 2

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width
      const y = padding + innerHeight - ((value - min) / range) * innerHeight
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  const first = values[0]
  const last = values[values.length - 1]
  const variation = first === 0 ? 0 : ((last - first) / first) * 100

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      role="img"
      aria-label={`Mini-gráfico com ${values.length} pontos, de ${min.toFixed(2)} a ${max.toFixed(2)} (variação de ${variation.toFixed(2)}%)`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${points} ${width},${height}`} fill={`url(#${gradientId})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
