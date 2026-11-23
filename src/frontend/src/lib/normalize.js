/**
 * Normalisation layer between the API payload and the UI model.
 *
 * The dashboard has to keep working while an older API revision is still
 * deployed (the public demo and the API are released independently), so both
 * the current contract and the legacy one are accepted here.
 */

const TRENDS = {
  alta: 'up',
  baixa: 'down',
  estavel: 'flat',
  'estável': 'flat',
  up: 'up',
  down: 'down',
  flat: 'flat',
}

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/** Maps any known trend representation to `up`, `down` or `flat`. */
export function normalizeTrend(value) {
  if (typeof value !== 'string') return 'flat'
  return TRENDS[value.toLowerCase().trim()] ?? 'flat'
}

/** Absolute and relative change between two prices. */
export function computeDelta(price, previousPrice) {
  if (!Number.isFinite(price) || !Number.isFinite(previousPrice) || previousPrice === 0) {
    return { delta: null, deltaPercent: null }
  }

  const delta = price - previousPrice
  return { delta, deltaPercent: (delta / previousPrice) * 100 }
}

/**
 * Normalises one snapshot returned by `GET /api/commodities`.
 *
 * @param {object} raw payload item
 * @returns {{id: number|null, symbol: string, price: number, previousPrice: number|null,
 *   delta: number|null, deltaPercent: number|null, trend: 'up'|'down'|'flat',
 *   timestamp: string|null, source: string, history: number[]}}
 */
export function normalizeSnapshot(raw) {
  const price = toFiniteNumber(raw?.price) ?? 0
  const previousPrice = toFiniteNumber(raw?.previousPrice)
  const computed = computeDelta(price, previousPrice)

  const delta = toFiniteNumber(raw?.delta) ?? computed.delta
  const deltaPercent = toFiniteNumber(raw?.deltaPercent) ?? computed.deltaPercent

  let trend = normalizeTrend(raw?.trend)
  if (delta !== null && delta !== 0) {
    trend = delta > 0 ? 'up' : 'down'
  }

  const history = Array.isArray(raw?.history)
    ? raw.history.map(Number).filter(Number.isFinite)
    : []

  return {
    id: raw?.id ?? null,
    symbol: String(raw?.symbol ?? '').toUpperCase(),
    price,
    previousPrice,
    delta,
    deltaPercent,
    trend,
    timestamp: raw?.timestamp ?? null,
    source: raw?.source ?? 'unknown',
    history: history.length > 0 ? history : price > 0 ? [price] : [],
  }
}

/** Normalises a list of snapshots, dropping entries without a symbol. */
export function normalizeSnapshots(rawList) {
  if (!Array.isArray(rawList)) return []
  return rawList.map(normalizeSnapshot).filter((snapshot) => snapshot.symbol.length > 0)
}
