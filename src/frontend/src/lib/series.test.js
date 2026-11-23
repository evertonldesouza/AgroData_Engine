import { describe, expect, it } from 'vitest'
import {
  flattenReadings,
  lastValue,
  latestReadings,
  mergeSeries,
  movingAverage,
  seriesDelta,
  seriesValues,
} from './series'

const soja = {
  symbol: 'SOJA',
  points: [
    { timestamp: '2026-10-22T12:00:00Z', price: 130 },
    { timestamp: '2026-10-22T13:00:00Z', price: 135 },
    { timestamp: '2026-10-22T14:00:00Z', price: 140 },
  ],
}

const milho = {
  symbol: 'MILHO',
  points: [
    { timestamp: '2026-10-22T13:00:00Z', price: 58 },
    { timestamp: '2026-10-22T14:00:00Z', price: 57 },
  ],
}

describe('mergeSeries', () => {
  it('aligns symbols on a shared timeline', () => {
    const rows = mergeSeries([soja, milho])

    expect(rows).toHaveLength(3)
    expect(rows.map((row) => row.SOJA)).toEqual([130, 135, 140])
    expect(rows.map((row) => row.MILHO)).toEqual([undefined, 58, 57])
    expect(rows[rows.length - 1].time).toBe('11:00')
  })

  it('deduplicates points from the same minute', () => {
    const rows = mergeSeries([
      { symbol: 'SOJA', points: [{ timestamp: '2026-10-22T12:00:10Z', price: 1 }] },
      { symbol: 'SOJA', points: [{ timestamp: '2026-10-22T12:00:50Z', price: 2 }] },
    ])

    expect(rows).toHaveLength(1)
    expect(rows[0].SOJA).toBe(2)
  })

  it('ignores invalid points and empty input', () => {
    const rows = mergeSeries([
      { symbol: 'SOJA', points: [{ timestamp: 'nope', price: 1 }, { timestamp: '2026-10-22T12:00:00Z', price: 'x' }] },
    ])

    expect(rows).toEqual([])
    expect(mergeSeries()).toEqual([])
  })
})

describe('series helpers', () => {
  it('extracts the values of one symbol', () => {
    const rows = mergeSeries([soja, milho])
    expect(seriesValues(rows, 'soja')).toEqual([130, 135, 140])
    expect(seriesValues(rows, 'MILHO')).toEqual([null, 58, 57])
  })

  it('returns the last finite value', () => {
    expect(lastValue([1, 2, null])).toBe(2)
    expect(lastValue([null])).toBeNull()
    expect(lastValue([])).toBeNull()
  })

  it('computes a moving average over the last window', () => {
    expect(movingAverage([10, 20, 30, 40], 3)).toBe(30)
    expect(movingAverage([], 3)).toBeNull()
    expect(movingAverage([10], 0)).toBeNull()
  })

  it('computes the delta between the last two values', () => {
    const { delta, deltaPercent } = seriesDelta([100, 110])
    expect(delta).toBe(10)
    expect(deltaPercent).toBeCloseTo(10)

    expect(seriesDelta([100])).toEqual({ delta: null, deltaPercent: null })
    expect(seriesDelta([0, 10])).toEqual({ delta: null, deltaPercent: null })
  })

  it('returns the latest readings newest first', () => {
    const rows = mergeSeries([soja])
    expect(latestReadings(rows, 2).map((row) => row.SOJA)).toEqual([140, 135])
  })
})

describe('flattenReadings', () => {
  it('creates one reading per symbol and timestamp with the delta', () => {
    const rows = mergeSeries([soja, milho])
    const readings = flattenReadings(rows, [{ symbol: 'SOJA', source: 'Test' }], 10)

    expect(readings).toHaveLength(5)
    expect(readings[0]).toMatchObject({ symbol: 'MILHO', price: 57 })
    expect(readings[1]).toMatchObject({ symbol: 'SOJA', price: 140, source: 'Test' })
    expect(readings[1].deltaPercent).toBeCloseTo(((140 - 135) / 135) * 100)
    expect(readings[4].deltaPercent).toBeNull()
  })

  it('respects the limit and handles empty input', () => {
    expect(flattenReadings(mergeSeries([soja]), [], 2)).toHaveLength(2)
    expect(flattenReadings()).toEqual([])
  })
})
