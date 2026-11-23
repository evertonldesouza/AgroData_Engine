import { useEffect, useState } from 'react'
import { fetchHistories } from '../api/commodities'

const EMPTY = { key: '', histories: [], status: 'idle' }

/**
 * Loads the price history of every tracked symbol and refreshes it on a slower
 * cadence than the snapshot polling (quotes change every run, the history only
 * grows).
 *
 * The resolved data carries the key it belongs to, so switching symbols shows
 * an empty chart instead of stale values from the previous selection.
 *
 * @param {string[]} symbols tickers to load
 * @param {object} [options]
 * @param {number} [options.points] number of points per symbol
 * @param {number} [options.intervalMs] refresh interval
 */
export function usePriceHistory(symbols, { points = 60, intervalMs = 60_000 } = {}) {
  const key = symbols.join(',')
  const [state, setState] = useState(EMPTY)

  useEffect(() => {
    if (!key) return undefined

    let active = true
    const controller = new AbortController()

    const load = async () => {
      try {
        const data = await fetchHistories(key.split(','), points, { signal: controller.signal })
        if (active) setState({ key, histories: data, status: 'ready' })
      } catch (error) {
        if (active && error?.name !== 'AbortError') {
          setState({ key, histories: [], status: 'error' })
        }
      }
    }

    load()
    const timer = setInterval(load, intervalMs)

    return () => {
      active = false
      controller.abort()
      clearInterval(timer)
    }
  }, [key, points, intervalMs])

  if (state.key !== key) {
    return { histories: [], status: key ? 'loading' : 'idle' }
  }

  return { histories: state.histories, status: state.status }
}
