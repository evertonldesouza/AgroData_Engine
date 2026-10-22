import { describe, expect, it } from 'vitest'
import { computeDelta, normalizeSnapshot, normalizeSnapshots, normalizeTrend } from './normalize'

describe('normalizeTrend', () => {
  it('understands the current contract', () => {
    expect(normalizeTrend('up')).toBe('up')
    expect(normalizeTrend('down')).toBe('down')
    expect(normalizeTrend('flat')).toBe('flat')
  })

  it('maps the legacy Portuguese values', () => {
    expect(normalizeTrend('Alta')).toBe('up')
    expect(normalizeTrend('Baixa')).toBe('down')
    expect(normalizeTrend('Estável')).toBe('flat')
  })

  it('falls back to flat for unknown values', () => {
    expect(normalizeTrend('sideways')).toBe('flat')
    expect(normalizeTrend(null)).toBe('flat')
    expect(normalizeTrend(42)).toBe('flat')
  })
})

describe('computeDelta', () => {
  it('computes absolute and relative change', () => {
    const { delta, deltaPercent } = computeDelta(110, 100)
    expect(delta).toBe(10)
    expect(deltaPercent).toBeCloseTo(10)
  })

  it('guards invalid inputs', () => {
    expect(computeDelta(100, 0)).toEqual({ delta: null, deltaPercent: null })
    expect(computeDelta(Number.NaN, 100)).toEqual({ delta: null, deltaPercent: null })
    expect(computeDelta(100, undefined)).toEqual({ delta: null, deltaPercent: null })
  })
})

describe('normalizeSnapshot', () => {
  it('normalises the current API shape', () => {
    const snapshot = normalizeSnapshot({
      id: 3,
      symbol: 'soja',
      price: 136.42,
      previousPrice: 134.21,
      delta: 2.21,
      deltaPercent: 1.65,
      trend: 'up',
      timestamp: '2026-10-22T14:02:00Z',
      source: 'Simulated Market Data',
      history: [134.21, 136.42],
    })

    expect(snapshot).toMatchObject({
      id: 3,
      symbol: 'SOJA',
      price: 136.42,
      previousPrice: 134.21,
      delta: 2.21,
      deltaPercent: 1.65,
      trend: 'up',
      source: 'Simulated Market Data',
    })
    expect(snapshot.history).toEqual([134.21, 136.42])
  })

  it('accepts the legacy payload and derives the missing fields', () => {
    const snapshot = normalizeSnapshot({
      symbol: 'milho',
      price: 58.19,
      timestamp: '2026-10-22T14:02:00Z',
      trend: 'Alta',
    })

    expect(snapshot.symbol).toBe('MILHO')
    expect(snapshot.trend).toBe('up')
    expect(snapshot.delta).toBeNull()
    expect(snapshot.history).toEqual([58.19])
  })

  it('derives the trend from the delta when it is present', () => {
    expect(normalizeSnapshot({ symbol: 'SOJA', price: 100, delta: -1 }).trend).toBe('down')
    expect(normalizeSnapshot({ symbol: 'SOJA', price: 100, delta: 1 }).trend).toBe('up')
  })

  it('survives malformed payloads', () => {
    const snapshot = normalizeSnapshot(undefined)
    expect(snapshot.symbol).toBe('')
    expect(snapshot.price).toBe(0)
    expect(snapshot.history).toEqual([])
  })
})

describe('normalizeSnapshots', () => {
  it('drops entries without a symbol', () => {
    const list = normalizeSnapshots([{ symbol: 'soja', price: 1 }, { price: 2 }, null])
    expect(list).toHaveLength(1)
  })

  it('returns an empty list for non-arrays', () => {
    expect(normalizeSnapshots(null)).toEqual([])
    expect(normalizeSnapshots({})).toEqual([])
  })
})
