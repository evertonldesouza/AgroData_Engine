/**
 * Series helpers for the market chart and the readings table.
 *
 * The API returns one series per symbol; the chart needs a single table where
 * every row carries one column per symbol. Charting a *real* history (instead
 * of accumulating polling responses) keeps the x-axis honest.
 */

import { formatDateTime, formatTime, toDate } from './format'

/**
 * Merges per-symbol histories into a single chronological table.
 *
 * @param {Array<{symbol: string, points: Array<{timestamp: string, price: number}>}>} histories
 * @returns {Array<Record<string, string|number>>} rows ordered oldest first
 */
export function mergeSeries(histories = []) {
  /** @type {Map<number, Record<string, string|number>>} */
  const buckets = new Map()

  for (const history of histories) {
    const symbol = String(history?.symbol ?? '').toUpperCase()
    if (!symbol) continue

    for (const point of history.points ?? []) {
      const date = toDate(point?.timestamp)
      const price = Number(point?.price)
      if (!date || !Number.isFinite(price)) continue

      // One bucket per minute: providers may send sub-second precision.
      const key = Math.floor(date.getTime() / 60_000)
      const bucket = buckets.get(key) ?? { timestamp: date.toISOString() }
      bucket[symbol] = price
      buckets.set(key, bucket)
    }
  }

  return [...buckets.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, row]) => ({
      ...row,
      time: formatTime(row.timestamp),
      label: formatDateTime(row.timestamp),
    }))
}

/** Extracts the values of one symbol from merged rows, keeping gaps as `null`. */
export function seriesValues(rows, symbol) {
  const key = String(symbol ?? '').toUpperCase()
  return rows.map((row) => (Number.isFinite(row?.[key]) ? Number(row[key]) : null))
}

/** Last price of a symbol in a merged series, or `null`. */
export function lastValue(values) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (Number.isFinite(values[index])) return values[index]
  }
  return null
}

/** Simple moving average of the last `window` finite values. */
export function movingAverage(values, window = 7) {
  const clean = values.filter((value) => Number.isFinite(value))
  if (clean.length === 0 || window < 1) return null

  const slice = clean.slice(-Math.min(window, clean.length))
  const total = slice.reduce((sum, value) => sum + value, 0)
  return total / slice.length
}

/** Variation between the last two finite values of a series. */
export function seriesDelta(values) {
  const clean = values.filter((value) => Number.isFinite(value))
  if (clean.length < 2) return { delta: null, deltaPercent: null }

  const latest = clean[clean.length - 1]
  const previous = clean[clean.length - 2]
  if (previous === 0) return { delta: null, deltaPercent: null }

  const delta = latest - previous
  return { delta, deltaPercent: (delta / previous) * 100 }
}

/** The `limit` most recent readings, newest first (used by the table). */
export function latestReadings(rows, limit = 8) {
  return [...rows].reverse().slice(0, limit)
}

/**
 * Flattens merged rows into a list of individual readings, newest first,
 * with the percentage change against the previous reading of the same symbol.
 *
 * @param {Array<Record<string, string|number>>} rows merged rows, oldest first
 * @param {Array<{symbol: string, source?: string}>} snapshots used for the source label
 * @param {number} limit how many readings to return
 */
export function flattenReadings(rows = [], snapshots = [], limit = 8) {
  const sourceBySymbol = new Map(
    (snapshots ?? []).map((snapshot) => [String(snapshot.symbol).toUpperCase(), snapshot.source]),
  )

  const readings = []
  const previousBySymbol = new Map()

  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (key === 'time' || key === 'label' || key === 'timestamp') continue
      if (!Number.isFinite(value)) continue

      const previous = previousBySymbol.get(key)
      readings.push({
        symbol: key,
        price: value,
        timestamp: row.timestamp,
        source: sourceBySymbol.get(key) ?? null,
        deltaPercent: previous ? ((value - previous) / previous) * 100 : null,
      })
      previousBySymbol.set(key, value)
    }
  }

  return readings.slice(-limit).reverse()
}
