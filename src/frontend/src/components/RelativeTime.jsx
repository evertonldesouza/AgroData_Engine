import { useEffect, useState } from 'react'
import { formatDistanceToNowStrict } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/**
 * Renders "atualizado há X" and re-renders every second without a global timer.
 */
export default function RelativeTime({ timestamp, prefix = 'atualizado há' }) {
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!timestamp) return undefined
    const interval = setInterval(() => setTick((tick) => tick + 1), 1000)
    return () => clearInterval(interval)
  }, [timestamp])

  if (!timestamp) {
    return <span className="font-mono text-zinc-600">aguardando dados</span>
  }

  const relative = formatDistanceToNowStrict(timestamp, { locale: ptBR })

  return (
    <span className="font-mono text-zinc-500" aria-live="polite">
      {prefix} <time dateTime={new Date(timestamp).toISOString()}>{relative}</time>
    </span>
  )
}
