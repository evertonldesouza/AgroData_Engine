import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import AlertBadge from './AlertBadge'
import AlertPanel from './AlertPanel'
import EmptyState from './EmptyState'
import ExportCsvLink from './ExportCsvLink'
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

const ALERTS = [
  {
    symbol: 'SOJA',
    kind: 'up',
    severity: 'critical',
    price: 141.5,
    referencePrice: 136.42,
    changePercent: 3.72,
    timestamp: '2026-10-22T12:00:00Z',
    message: 'Soja subiu 3,72%',
  },
  {
    symbol: 'MILHO',
    kind: 'down',
    severity: 'warning',
    price: 57.1,
    referencePrice: 58.19,
    changePercent: -1.87,
    timestamp: '2026-10-22T12:00:00Z',
    message: 'Milho caiu 1,87%',
  },
]

describe('alerts', () => {
  it('renders one row per alert with severity, price and variation', () => {
    const html = renderToStaticMarkup(<AlertPanel alerts={ALERTS} />)

    expect(html).toContain('Alertas de variação')
    expect(html).toContain('2 alertas')
    expect(html).toContain('Soja')
    expect(html).toContain('crítico')
    expect(html).toContain('atenção')
    expect(html).toContain('+3,72%')
    expect(html).toContain('-1,87%')
  })

  it('explains an empty list instead of rendering a blank box', () => {
    const html = renderToStaticMarkup(<AlertPanel alerts={[]} />)

    expect(html).toContain('nenhuma variação relevante')
    expect(html).toContain('sem alertas')
  })

  it('shows a loading hint while the first request is in flight', () => {
    expect(renderToStaticMarkup(<AlertPanel alerts={[]} status="loading" />)).toContain('verificando')
  })

  it('hides the header badge when nothing is above the threshold', () => {
    expect(renderToStaticMarkup(<AlertBadge alerts={[]} />)).toBe('')
  })

  it('shows the alert count in the header badge', () => {
    const html = renderToStaticMarkup(<AlertBadge alerts={ALERTS} />)

    expect(html).toContain('2')
    expect(html).toContain('2 alertas')
    expect(html).toContain('href="#alerts-title"')
  })

  it('renders a CSV download link per commodity', () => {
    const html = renderToStaticMarkup(<ExportCsvLink symbol="soja" points={24} />)

    expect(html).toContain('/api/commodities/export?symbol=SOJA&amp;points=24')
    expect(html).toContain('download')
  })

  it('renders nothing without a symbol', () => {
    expect(renderToStaticMarkup(<ExportCsvLink symbol="" />)).toBe('')
  })
})
