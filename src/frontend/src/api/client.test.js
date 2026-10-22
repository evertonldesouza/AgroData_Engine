import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, buildUrl, requestJson } from './client'

const jsonResponse = (body, { status = 200 } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('buildUrl', () => {
  it('joins the base URL and the path', () => {
    expect(buildUrl('/api/commodities', 'https://api.test')).toBe('https://api.test/api/commodities')
    expect(buildUrl('api/commodities', 'https://api.test')).toBe('https://api.test/api/commodities')
    expect(buildUrl('/health')).toBe('/health')
  })

  it('rejects an empty path', () => {
    expect(() => buildUrl('')).toThrow(ApiError)
  })
})

describe('requestJson', () => {
  it('returns the parsed body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([{ symbol: 'SOJA' }]))

    await expect(requestJson('/api/commodities', { fetchImpl, baseUrl: 'https://api.test' }))
      .resolves.toEqual([{ symbol: 'SOJA' }])
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.test/api/commodities',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('surfaces the problem details message', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ title: 'Unexpected error', detail: 'database offline' }, { status: 500 }),
    )

    await expect(requestJson('/api/commodities', { fetchImpl })).rejects.toMatchObject({
      name: 'ApiError',
      status: 500,
      message: 'database offline',
    })
  })

  it('falls back to the status code when the body is not JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => {
        throw new Error('not json')
      },
    })

    await expect(requestJson('/health', { fetchImpl })).rejects.toMatchObject({
      status: 503,
      message: 'Request failed with status 503',
    })
  })

  it('rejects invalid JSON payloads', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('boom')
      },
    })

    await expect(requestJson('/api/commodities', { fetchImpl })).rejects.toMatchObject({
      name: 'ApiError',
      message: expect.stringContaining('invalid JSON'),
    })
  })

  it('wraps network failures', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(requestJson('/api/commodities', { fetchImpl })).rejects.toMatchObject({
      name: 'ApiError',
      message: 'Could not reach the AgroData API.',
    })
  })

  it('aborts with a readable error when the request times out', async () => {
    const fetchImpl = vi.fn(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
        }),
    )

    await expect(requestJson('/api/commodities', { fetchImpl, timeoutMs: 5 })).rejects.toMatchObject({
      message: 'The API took too long to respond.',
    })
  })

  it('propagates the caller abort untouched', async () => {
    const controller = new AbortController()
    const fetchImpl = vi.fn(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
        }),
    )

    const promise = requestJson('/api/commodities', { fetchImpl, signal: controller.signal })
    controller.abort()

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  })
})
