import { useEffect, useRef, useState } from 'react'
import { fetchAlerts } from '../api/alerts'

const ALERT_INTERVAL_MS = 60_000

/**
 * Polls `GET /api/alerts`.
 *
 * Alerts are a secondary signal: a failure here must never break the dashboard,
 * so errors are swallowed into an empty list and retried on the next tick.
 */
export function useAlerts({ intervalMs = ALERT_INTERVAL_MS, autoStart = true } = {}) {
  const [alerts, setAlerts] = useState([])
  const [status, setStatus] = useState('loading')
  const isMounted = useRef(false)

  useEffect(() => {
    isMounted.current = true
    const controller = new AbortController()

    const sync = async () => {
      try {
        const data = await fetchAlerts({ signal: controller.signal })
        if (!isMounted.current) return
        setAlerts(data)
        setStatus('ready')
      } catch (error) {
        if (error?.name === 'AbortError' || !isMounted.current) return
        setAlerts([])
        setStatus('error')
      }
    }

    const timer = autoStart ? setInterval(sync, intervalMs) : null
    if (autoStart) void sync()

    return () => {
      isMounted.current = false
      controller.abort()
      if (timer) clearInterval(timer)
    }
  }, [autoStart, intervalMs])

  return { alerts, status }
}
