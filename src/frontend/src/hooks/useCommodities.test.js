import { describe, expect, it } from 'vitest'
import { computeBackoff } from './useCommodities'

describe('computeBackoff', () => {
  it('keeps the base interval after a successful poll', () => {
    expect(computeBackoff(0, 15_000)).toBe(15_000)
  })

  it('doubles the delay on consecutive failures', () => {
    expect(computeBackoff(1, 15_000)).toBe(30_000)
    expect(computeBackoff(2, 15_000)).toBe(60_000)
    expect(computeBackoff(3, 15_000)).toBe(120_000)
  })

  it('never exceeds two minutes', () => {
    expect(computeBackoff(9, 15_000)).toBe(120_000)
  })
})
