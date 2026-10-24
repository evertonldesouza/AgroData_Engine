import { beforeEach, describe, expect, it, vi } from 'vitest'
import { exportCsvUrl, fetchAlerts, normalizeAlert } from './alerts'
import { requestJson } from './client'

vi.mock('./client', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, requestJson: vi.fn() }
})

const mockedRequest = vi.mocked(requestJson)

beforeEach(() => {
  mockedRequest.mockReset()
})

describe('normalizeAlert', () => {
  it('maps the API payload to the UI model', () => {
    const alert = normalizeAlert({
      symbol: 'soja',
      kind: 'PriceSpike',
      severity: 'Critical',
      price: 141.5,
      referencePrice: 136.42,
      changePercent: 3.72,
      timestamp: '2026-10-22T12:00:00Z',
      message: 'Soja subiu 3,72%',
    })

    expect(alert).toEqual({
      symbol: 'SOJA',
      kind: 'up',
      severity: 'critical',
      price: 141.5,
      referencePrice: 136.42,
      changePercent: 3.72,
      timestamp: '2026-10-22T12:00:00Z',
      message: 'Soja subiu 3,72%',
    })
  })

  it('maps a drop to the down kind', () => {
    expect(normalizeAlert({ symbol: 'MILHO', kind: 'priceDrop' }).kind).toBe('down')
  })

  it('falls back to info for an unknown severity', () => {
    expect(normalizeAlert({ symbol: 'SOJA', severity: 'turbo' }).severity).toBe('info')
  })

  it('coerces missing numbers to zero instead of NaN', () => {
    const alert = normalizeAlert({ symbol: 'SOJA' })

    expect(alert.price).toBe(0)
    expect(alert.changePercent).toBe(0)
    expect(alert.message).toBe('')
  })
})

describe('fetchAlerts', () => {
  it('normalises every alert', async () => {
    mockedRequest.mockResolvedValue([
      { symbol: 'SOJA', severity: 'critical', changePercent: 3.7 },
      { symbol: 'MILHO', severity: 'warning', changePercent: -1.7 },
    ])

    const alerts = await fetchAlerts()

    expect(mockedRequest).toHaveBeenCalledWith('/api/alerts', undefined)
    expect(alerts).toHaveLength(2)
    expect(alerts[0]).toMatchObject({ symbol: 'SOJA', severity: 'critical' })
  })

  it('drops entries without a symbol', async () => {
    mockedRequest.mockResolvedValue([{ severity: 'critical' }, { symbol: 'SOJA' }])

    await expect(fetchAlerts()).resolves.toHaveLength(1)
  })

  it('returns an empty list for an unexpected payload', async () => {
    mockedRequest.mockResolvedValue({ detail: 'nope' })

    await expect(fetchAlerts()).resolves.toEqual([])
  })

  it('forwards the abort signal', async () => {
    mockedRequest.mockResolvedValue([])
    const signal = new AbortController().signal

    await fetchAlerts({ signal })

    expect(mockedRequest).toHaveBeenCalledWith('/api/alerts', { signal })
  })
})

describe('exportCsvUrl', () => {
  it('builds the export URL with an upper-cased symbol', () => {
    expect(exportCsvUrl('soja', 24, 'https://api.test')).toBe(
      'https://api.test/api/commodities/export?symbol=SOJA&points=24',
    )
  })

  it('defaults to 60 points', () => {
    expect(exportCsvUrl('MILHO', undefined, 'https://api.test')).toContain('points=60')
  })
})
