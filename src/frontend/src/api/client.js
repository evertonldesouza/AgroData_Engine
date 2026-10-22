/**
 * Tiny fetch wrapper with timeout, abort propagation and typed errors.
 * Keeping this in one place means components never see raw `fetch` noise.
 */

export const API_BASE_URL = (import.meta.env?.VITE_API_URL ?? '').replace(/\/+$/, '')

const DEFAULT_TIMEOUT_MS = 10_000

export class ApiError extends Error {
  constructor(message, { status = 0, url = '', cause } = {}) {
    super(message, cause ? { cause } : undefined)
    this.name = 'ApiError'
    this.status = status
    this.url = url
  }
}

export function buildUrl(path, baseUrl = API_BASE_URL) {
  if (!path) throw new ApiError('A path is required.')
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl}${normalized}`
}

async function readErrorMessage(response) {
  try {
    const body = await response.json()
    return body?.detail || body?.title || `Request failed with status ${response.status}`
  } catch {
    return `Request failed with status ${response.status}`
  }
}

/**
 * Performs a GET request and returns the parsed JSON body.
 *
 * @param {string} path absolute path inside the API, e.g. `/api/commodities`
 * @param {object} [options]
 * @param {AbortSignal} [options.signal] caller signal (component unmount)
 * @param {number} [options.timeoutMs] hard timeout for the request
 * @param {string} [options.baseUrl] override the configured API base URL
 * @param {typeof fetch} [options.fetchImpl] injected in tests
 * @returns {Promise<unknown>}
 */
export async function requestJson(path, options = {}) {
  const {
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    baseUrl = API_BASE_URL,
    fetchImpl = globalThis.fetch,
  } = options

  const url = buildUrl(path, baseUrl)
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort(new DOMException('Timeout', 'TimeoutError'))
  }, timeoutMs)
  const onAbort = () => controller.abort(signal?.reason)

  if (signal) {
    if (signal.aborted) controller.abort(signal.reason)
    else signal.addEventListener('abort', onAbort, { once: true })
  }

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new ApiError(await readErrorMessage(response), { status: response.status, url })
    }

    try {
      return await response.json()
    } catch (error) {
      throw new ApiError('The API returned an invalid JSON payload.', { status: response.status, url, cause: error })
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (timedOut) throw new ApiError('The API took too long to respond.', { url, cause: error })
    if (error?.name === 'AbortError') throw error
    throw new ApiError('Could not reach the AgroData API.', { url, cause: error })
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}
