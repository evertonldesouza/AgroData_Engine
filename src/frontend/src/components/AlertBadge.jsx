import { BellRing } from 'lucide-react'
import { SEVERITY_STYLES, worstSeverity } from '../lib/alerts'

/**
 * Compact header indicator: total alerts plus the worst severity present.
 * Hidden when nothing crossed the threshold, so the header stays quiet.
 */
export default function AlertBadge({ alerts = [] }) {
  if (alerts.length === 0) return null

  const severity = worstSeverity(alerts) ?? 'info'
  const style = SEVERITY_STYLES[severity]
  const label = alerts.length === 1 ? '1 alerta' : `${alerts.length} alertas`

  return (
    <a
      href="#alerts-title"
      title={`${label} — pior severidade: ${style.label}`}
      className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-2 font-mono text-[10px] font-bold uppercase tracking-wider transition hover:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${style.chip}`}
    >
      <BellRing size={12} aria-hidden="true" />
      {alerts.length}
      <span className="sr-only">{` ${label}`}</span>
    </a>
  )
}
