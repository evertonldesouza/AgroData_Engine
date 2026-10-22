import { describe, expect, it } from 'vitest'
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPercent,
  formatSignedCurrency,
  formatTime,
  toDate,
} from './format'

// Intl inserts non-breaking spaces between "R$" and the number.
const plain = (value) => value.replace(/\u00a0/g, ' ')

describe('formatCurrency', () => {
  it('formats BRL amounts', () => {
    expect(plain(formatCurrency(136.42))).toBe('R$ 136,42')
    expect(plain(formatCurrency(0))).toBe('R$ 0,00')
  })

  it('returns a dash for invalid values', () => {
    expect(formatCurrency(Number.NaN)).toBe('—')
    expect(formatCurrency(null)).toBe('—')
  })
})

describe('formatSignedCurrency', () => {
  it('prefixes the sign', () => {
    expect(plain(formatSignedCurrency(2.21))).toBe('+R$ 2,21')
    expect(plain(formatSignedCurrency(-2.21))).toBe('-R$ 2,21')
    expect(plain(formatSignedCurrency(0))).toBe('R$ 0,00')
  })
})

describe('formatPercent', () => {
  it('uses two decimals and a sign', () => {
    expect(formatPercent(1.6543)).toBe('+1,65%')
    expect(formatPercent(-8.333)).toBe('-8,33%')
  })

  it('can omit the sign', () => {
    expect(formatPercent(1.65, { signed: false })).toBe('1,65%')
  })

  it('handles invalid input', () => {
    expect(formatPercent(Number.NaN)).toBe('—')
  })
})

describe('date helpers', () => {
  it('formats timestamps in the Brazilian timezone', () => {
    expect(formatTime('2026-10-22T17:02:00Z')).toBe('14:02')
    expect(formatDateTime('2026-10-22T17:02:00Z')).toContain('22/10')
  })

  it('formats dates', () => {
    expect(formatDate('2026-10-22T17:02:00Z')).toBe('22/10/2026')
  })

  it('parses valid values and rejects invalid ones', () => {
    expect(toDate('2026-10-22T17:02:00Z')).toBeInstanceOf(Date)
    expect(toDate('not-a-date')).toBeNull()
    expect(toDate(undefined)).toBeNull()
    expect(toDate(new Date('invalid'))).toBeNull()
  })
})
