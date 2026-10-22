import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import EmptyState from './EmptyState'
import Header from './Header'
import HistoryTable from './HistoryTable'
import RelativeTime from './RelativeTime'
import Sparkline from './Sparkline'
import StatusPill from './StatusPill'
import TickerCard from './TickerCard'

const snapshot = {
  id: 1,
  symbol: 'SOJA',
  price: 136.42,
  previousPrice: 134.21,
  delta: 2.21,
  deltaPercent: 1.65,
  trend: 'up',
  timestamp: '2026-10-22T14:02:00Z',
  source: 'Simulated Market Data',
  history: [130, 134, 136.42],
}

describe('TickerCard', () => {
  it('renders price, variation and unit', () => {
    const html = renderToStaticMarkup(<TickerCard snapshot={snapshot} />)

    expect(html).toContain('Soja')
    expect(html).toContain('136,42')
    expect(html).toContain('+1,65%')
    expect(html).toContain('saca 60 kg')
  })

  it('handles a snapshot without a previous quote', () => {
    const html = renderToStaticMarkup(
      <TickerCard snapshot={{ ...snapshot, previousPrice: null, delta: null, deltaPercent: null, trend: 'flat' }} />,
    )

    expect(html).toContain('sem base')
  })
})

describe('HistoryTable', () => {
  it('renders one row per reading', () => {
    const html = renderToStaticMarkup(
      <HistoryTable
        readings={[
          { symbol: 'SOJA', price: 136.42, timestamp: '2026-10-22T14:02:00Z', deltaPercent: 1.2, source: 'Test' },
          { symbol: 'MILHO', price: 58.19, timestamp: '2026-10-22T13:02:00Z', deltaPercent: null, source: 'Test' },
        ]}
      />,
    )

    expect(html.match(/<tr/g)).toHaveLength(3)
    expect(html).toContain('Soja')
    expect(html).toContain('—')
  })

  it('renders an empty state', () => {
    expect(renderToStaticMarkup(<HistoryTable readings={[]} />)).toContain('sem leituras recentes')
  })
})

describe('layout components', () => {
  it('renders the header with the live status', () => {
    const html = renderToStaticMarkup(
      <Header status="ready" lastUpdated={new Date('2026-10-22T14:02:00Z')} isRefreshing={false} retryInSeconds={null} onRefresh={() => {}} apiDocsUrl={null} />,
    )

    expect(html).toContain('LIVE')
    expect(html).toContain('v3.0')
  })

  it('shows the degraded state with the retry countdown', () => {
    const html = renderToStaticMarkup(<StatusPill status="error" retryInSeconds={30} />)
    expect(html).toContain('DEGRADED')
    expect(html).toContain('retry 30s')
  })

  it('renders the empty state and the sparkline fallback', () => {
    expect(renderToStaticMarkup(<EmptyState />)).toContain('Nenhuma cotação disponível')
    expect(renderToStaticMarkup(<Sparkline data={[]} />)).toContain('aguardando série')
    expect(renderToStaticMarkup(<Sparkline data={[1, 2, 3]} />)).toContain('<polyline')
  })

  it('renders the relative timestamp', () => {
    expect(renderToStaticMarkup(<RelativeTime timestamp={new Date()} />)).toContain('atualizado há')
    expect(renderToStaticMarkup(<RelativeTime timestamp={null} />)).toContain('aguardando dados')
  })
})
