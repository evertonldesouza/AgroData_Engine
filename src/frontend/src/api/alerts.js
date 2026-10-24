import { requestJson } from './client'
import { buildUrl } from './client'

/**
 * Normalises a raw alert payload coming from `GET /api/alerts`.
 *
 * The endpoint is newer than the dashboard (which can be redeployed first), so
 * every field is defensive: an unexpected shape degrades to an empty list
 * instead of crashing a render.
 */
export function normalizeAlert(raw) {
  const changePercent = Number(raw?.changePercent)
  const kind = String(raw?.kind ?? '').toLowerCase()

  return {
    symbol: String(raw?.symbol ?? '').toUpperCase(),
    kind: kind === 'pricedrop' ? 'down' : 'up',
    severity: ['info', 'warning', 'critical'].includes(String(raw?.severity ?? '').toLowerCase())
      ? String(raw.severity).toLowerCase()
      : 'info',
    price: Number(raw?.price) || 0,
    referencePrice: Number(raw?.referencePrice) || 0,
    changePercent: Number.isFinite(changePercent) ? changePercent : 0,
    timestamp: raw?.timestamp ?? null,
    message: String(raw?.message ?? ''),
  }
}

/** Fetches the active price alerts. */
export async function fetchAlerts(options) {
  const payload = await requestJson('/api/alerts', options)
  if (!Array.isArray(payload)) return []
  return payload.map(normalizeAlert).filter((alert) => alert.symbol.length > 0)
}

/**
 * Download URL of the CSV export for one symbol.
 *
 * The API answers with `Content-Disposition: attachment`, so a plain anchor is
 * enough — no blob handling, no memory copy, and the browser streams it.
 */
export function exportCsvUrl(symbol, points = 60, baseUrl) {
  const query = new URLSearchParams({ symbol: String(symbol ?? '').toUpperCase(), points: String(points) })
  return buildUrl(`/api/commodities/export?${query}`, baseUrl)
}
