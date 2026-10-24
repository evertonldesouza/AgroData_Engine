import { Download } from 'lucide-react'
import { exportCsvUrl } from '../api/alerts'

/**
 * One-click CSV download of a symbol's history.
 *
 * A plain anchor pointing at the API: the endpoint already answers with
 * `Content-Disposition: attachment`, so the browser streams the file without
 * loading it into memory first.
 */
export default function ExportCsvLink({ symbol, points = 60, className = '' }) {
  if (!symbol) return null

  const upper = String(symbol).toUpperCase()

  return (
    <a
      href={exportCsvUrl(upper, points)}
      download
      title={`Baixar o histórico de ${upper} em CSV`}
      className={`flex items-center gap-1.5 rounded-lg border border-white/10 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-400 transition hover:border-emerald-500/40 hover:text-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${className}`}
    >
      <Download size={10} aria-hidden="true" />
      CSV
      <span className="sr-only">{` ${upper}`}</span>
    </a>
  )
}
