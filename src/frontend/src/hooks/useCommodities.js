import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchSnapshots } from '../api/commodities'

const BASE_INTERVAL_MS = 15_000
const MAX_INTERVAL_MS = 120_000

/** Exponential backoff, capped at two minutes. */
export function computeBackoff(attempts, intervalMs = BASE_INTERVAL_MS) {
  if (attempts <= 0) return intervalMs
  return Math.min(intervalMs * 2 ** Math.min(attempts, 4), Math.max(intervalMs, MAX_INTERVAL_MS))
}

/**
 * Polls the snapshot endpoint with exponential backoff on failure and pauses
 * while the tab is hidden (battery friendly, no noisy logs).
 */
export function useCommodities({ intervalMs = BASE_INTERVAL_MS, autoStart = true } = {}) {
  const [snapshots, setSnapshots] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [retryInSeconds, setRetryInSeconds] = useState(null)

  const retryCount = useRef(0)
  const timer = useRef(null)
  const controller = useRef(null)
  const mounted = useRef(false)

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }

  const load = useCallback(
    async ({ manual = false } = {}) => {
      clearTimer()
      controller.current?.abort()
      const current = new AbortController()
      controller.current = current

      if (manual) setIsRefreshing(true)

      try {
        const data = await fetchSnapshots({ signal: current.signal })
        if (!mounted.current) return

        setSnapshots(data)
        setLastUpdated(new Date())
        setStatus('ready')
        setError(null)
        retryCount.current = 0
      } catch (caught) {
        if (caught?.name === 'AbortError' || !mounted.current) return

        retryCount.current += 1
        setStatus('error')
        setError(caught)
      } finally {
        if (mounted.current) {
          setIsRefreshing(false)
          const delay = computeBackoff(retryCount.current, intervalMs)
          setRetryInSeconds(retryCount.current > 0 ? Math.round(delay / 1000) : null)
          timer.current = setTimeout(() => load(), delay)
        }
      }
    },
    [intervalMs],
  )

  useEffect(() => {
    mounted.current = true
    if (autoStart) load()

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && autoStart) load()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      mounted.current = false
      document.removeEventListener('visibilitychange', onVisibilityChange)
      clearTimer()
      controller.current?.abort()
    }
  }, [autoStart, load])

  const refresh = useCallback(() => load({ manual: true }), [load])

  return { snapshots, status, error, lastUpdated, isRefreshing, retryInSeconds, refresh }
}
