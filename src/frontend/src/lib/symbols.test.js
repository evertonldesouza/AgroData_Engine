import { describe, expect, it } from 'vitest'
import { symbolMeta, trendStyle } from './symbols'

describe('symbolMeta', () => {
  it('returns the known identity of a commodity', () => {
    expect(symbolMeta('soja')).toMatchObject({
      symbol: 'SOJA',
      label: 'Soja',
      unit: 'BRL / saca 60 kg',
      color: '#00d68f',
    })
  })

  it('assigns a deterministic colour to unknown symbols', () => {
    const first = symbolMeta('cafe')
    const second = symbolMeta('CAFE')

    expect(first.color).toBe(second.color)
    expect(first.label).toBe('CAFE')
  })

  it('copes with empty input', () => {
    expect(symbolMeta(undefined).label).toBe('—')
  })
})

describe('trendStyle', () => {
  it('maps trends to styles', () => {
    expect(trendStyle('up').label).toBe('Alta')
    expect(trendStyle('down').label).toBe('Baixa')
    expect(trendStyle('unknown').label).toBe('Estável')
  })
})
