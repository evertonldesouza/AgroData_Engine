import { describe, expect, it } from 'vitest'
import { alertBadgeLabel, groupBySeverity, worstSeverity, SEVERITY_STYLES } from './alerts'

const alerts = [
  { symbol: 'SOJA', severity: 'critical' },
  { symbol: 'MILHO', severity: 'warning' },
  { symbol: 'CAFE', severity: 'warning' },
]

describe('worstSeverity', () => {
  it('returns the most severe entry', () => {
    expect(worstSeverity(alerts)).toBe('critical')
    expect(worstSeverity([{ severity: 'info' }, { severity: 'warning' }])).toBe('warning')
  })

  it('returns null for an empty or invalid list', () => {
    expect(worstSeverity([])).toBeNull()
    expect(worstSeverity(null)).toBeNull()
  })

  it('treats an unknown severity as the least severe', () => {
    expect(worstSeverity([{ severity: 'turbo' }, { severity: 'info' }])).toBe('info')
  })
})

describe('groupBySeverity', () => {
  it('groups while preserving the original order', () => {
    const groups = groupBySeverity(alerts)

    expect(groups.critical.map((alert) => alert.symbol)).toEqual(['SOJA'])
    expect(groups.warning.map((alert) => alert.symbol)).toEqual(['MILHO', 'CAFE'])
    expect(groups.info).toEqual([])
  })

  it('routes unknown severities to info', () => {
    expect(groupBySeverity([{ severity: 'turbo' }]).info).toHaveLength(1)
  })

  it('returns empty buckets for invalid input', () => {
    expect(groupBySeverity(undefined)).toEqual({ critical: [], warning: [], info: [] })
  })
})

describe('alertBadgeLabel', () => {
  it('uses the singular for one alert', () => {
    expect(alertBadgeLabel([{ severity: 'info' }])).toBe('1 alerta')
  })

  it('uses the plural above one', () => {
    expect(alertBadgeLabel(alerts)).toBe('3 alertas')
  })

  it('reports an empty list', () => {
    expect(alertBadgeLabel([])).toBe('sem alertas')
    expect(alertBadgeLabel(undefined)).toBe('sem alertas')
  })
})

describe('SEVERITY_STYLES', () => {
  it('exposes a label and classes for every severity', () => {
    for (const severity of ['critical', 'warning', 'info']) {
      expect(SEVERITY_STYLES[severity].label).toBeTruthy()
      expect(SEVERITY_STYLES[severity].chip).toContain('border')
    }
  })
})
