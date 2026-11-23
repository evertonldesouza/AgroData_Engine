import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchHistories, fetchHistory, fetchSnapshots } from './commodities'
import { requestJson } from './client'

vi.mock('./client', () => ({
  requestJson: vi.fn(),
}))

const mockedRequest = vi.mocked(requestJson)

beforeEach(() => {
  mockedRequest.mockReset()
})

describe('fetchSnapshots', () => {
  it('normalises the payload', async () => {
    mockedRequest.mockResolvedValue([{ symbol: 'soja', price: 136.42, trend: 'Alta' }])

    const [snapshot] = await fetchSnapshots()

    expect(mockedRequest).toHaveBeenCalledWith('/api/commodities', undefined)
    expect(snapshot).toMatchObject({ symbol: 'SOJA', price: 136.42, trend: 'up' })
  })

  it('returns an empty list for unexpected payloads', async () => {
    mockedRequest.mockResolvedValue({ detail: 'nope' })
    await expect(fetchSnapshots()).resolves.toEqual([])
  })
})

describe('fetchHistory', () => {
  it('builds the query and coerces prices to numbers', async () => {
    mockedRequest.mockResolvedValue({
      symbol: 'SOJA',
      points: [
        { timestamp: '2026-10-22T12:00:00Z', price: '130.10' },
        { timestamp: '2026-10-22T13:00:00Z', price: 136.42 },
      ],
      movingAverage: 133.26,
      window: 2,
    })

    const history = await fetchHistory('SOJA', 42)

    expect(mockedRequest).toHaveBeenCalledWith('/api/commodities/history?symbol=SOJA&points=42', undefined)
    expect(history.points).toEqual([
      { timestamp: '2026-10-22T12:00:00Z', price: 130.1 },
      { timestamp: '2026-10-22T13:00:00Z', price: 136.42 },
    ])
    expect(history.window).toBe(2)
  })

  it('defaults missing fields', async () => {
    mockedRequest.mockResolvedValue({})
    const history = await fetchHistory('MILHO')
    expect(history).toMatchObject({ symbol: 'MILHO', points: [], movingAverage: null, window: 0 })
  })
})

describe('fetchHistories', () => {
  it('isolates failures per symbol', async () => {
    mockedRequest.mockImplementation(async (path) => {
      if (path.includes('MILHO')) throw new Error('upstream down')
      return { symbol: 'SOJA', points: [{ timestamp: '2026-10-22T12:00:00Z', price: 1 }] }
    })

    const [soja, milho] = await fetchHistories(['SOJA', 'MILHO'], 10)

    expect(soja.points).toHaveLength(1)
    expect(milho).toMatchObject({ symbol: 'MILHO', points: [] })
    expect(milho.error).toBeInstanceOf(Error)
  })

  it('propagates aborts', async () => {
    mockedRequest.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    await expect(fetchHistories(['SOJA'], 10)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
