/** Locale-aware formatting helpers. All of them are pure and unit tested. */

const CURRENCY = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const TIME = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
})

const DATE_TIME = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
})

/** `136.42` -> `R$ 136,42` */
export function formatCurrency(value) {
  return Number.isFinite(value) ? CURRENCY.format(value) : '—'
}

/** `-2.21` -> `-R$ 2,21` */
export function formatSignedCurrency(value) {
  if (!Number.isFinite(value)) return '—'
  const formatted = CURRENCY.format(Math.abs(value))
  if (value === 0) return formatted
  return `${value > 0 ? '+' : '-'}${formatted}`
}

/** `1.65` -> `+1,65%` */
export function formatPercent(value, { signed = true, digits = 2 } = {}) {
  if (!Number.isFinite(value)) return '—'
  const formatted = Math.abs(value).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  if (!signed || value === 0) return `${formatted}%`
  return `${value > 0 ? '+' : '-'}${formatted}%`
}

/** ISO timestamp -> `14:02` (America/Sao_Paulo) */
export function formatTime(value) {
  const date = toDate(value)
  return date ? TIME.format(date) : '—'
}

/** ISO timestamp -> `22/10 14:02` */
export function formatDateTime(value) {
  const date = toDate(value)
  return date ? DATE_TIME.format(date) : '—'
}

/** `2026-10-22T14:02:00Z` -> `22/10/2026` (browser locale) */
export function formatDate(value) {
  const date = toDate(value)
  return date ? date.toLocaleDateString('pt-BR') : '—'
}

/** Turns any API timestamp into a `Date`, or `null` when invalid. */
export function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export const formatters = {
  formatCurrency,
  formatSignedCurrency,
  formatPercent,
  formatTime,
  formatDateTime,
  formatDate,
  toDate,
}
