import { requestJson } from './client'
import { normalizeSnapshot } from '../lib/normalize'

/** Latest snapshot of every tracked commodity. */
export async function fetchSnapshots(options) {
  const payload = await requestJson('/api/commodities', options)
  return Array.isArray(payload) ? payload.map(normalizeSnapshot) : []
}

/**
 * Price history of one symbol.
 *
 * @param {string} symbol ticker, e.g. `SOJA`
 * @param {number} points number of points to request
 * @param {object} [options] forwarded to `requestJson`
 */
export async function fetchHistory(symbol, points = 60, options) {
  const query = new URLSearchParams({ symbol, points: String(points) })
  const payload = await requestJson(`/api/commodities/history?${query}`, options)

  return {
    symbol: payload?.symbol ?? symbol,
    points: (payload?.points ?? []).map((point) => ({
      timestamp: point.timestamp,
      price: Number(point.price),
    })),
    movingAverage: payload?.movingAverage ?? null,
    window: payload?.window ?? 0,
  }
}

/** Fetches the histories of several symbols concurrently. */
export async function fetchHistories(symbols, points = 60, options) {
  const results = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        return await fetchHistory(symbol, points, options)
      } catch (error) {
        // A single unknown symbol must not break the whole chart.
        if (error?.name === 'AbortError') throw error
        return { symbol, points: [], movingAverage: null, window: 0, error }
      }
    }),
  )

  return results
}
