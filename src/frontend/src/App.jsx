import { Suspense, lazy, useMemo, useState } from 'react'
import AlertPanel from './components/AlertPanel'
import ErrorBanner from './components/ErrorBanner'
import EmptyState from './components/EmptyState'
import Footer from './components/Footer'
import Header from './components/Header'
import HistoryTable from './components/HistoryTable'
import SkeletonCard from './components/SkeletonCard'
import SkeletonChart from './components/SkeletonChart'
import TickerCard from './components/TickerCard'
import { API_BASE_URL } from './api/client'
import { useAlerts } from './hooks/useAlerts'
import { useCommodities } from './hooks/useCommodities'
import { usePriceHistory } from './hooks/usePriceHistory'
import { flattenReadings, mergeSeries } from './lib/series'

// Recharts is the heaviest dependency; it is only fetched once data exists.
const MarketChart = lazy(() => import('./components/MarketChart'))

const DEFAULT_RANGE = 24
const READINGS = 8

export default function App() {
  const { snapshots, status, error, lastUpdated, isRefreshing, retryInSeconds, refresh } =
    useCommodities()
  const { alerts, status: alertsStatus } = useAlerts()

  const symbols = useMemo(() => snapshots.map((snapshot) => snapshot.symbol), [snapshots])
  const [range, setRange] = useState(DEFAULT_RANGE)
  const { histories } = usePriceHistory(symbols, { points: range })

  const rows = useMemo(() => mergeSeries(histories), [histories])
  const readings = useMemo(
    () => flattenReadings(rows, snapshots, READINGS),
    [rows, snapshots],
  )
  const legend = useMemo(() => symbols.map((symbol) => ({ symbol })), [symbols])

  const isLoading = status === 'loading'
  const isEmpty = status === 'ready' && snapshots.length === 0

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] px-4 py-4 font-sans text-zinc-100 antialiased md:px-8 md:py-6">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.07),_transparent_45%)]" />
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(to_right,rgba(128,128,128,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(128,128,128,0.045)_1px,transparent_1px)] [background-size:64px_64px]" />

      <div className="relative z-10 mx-auto max-w-7xl">
        <Header
          status={status}
          lastUpdated={lastUpdated}
          isRefreshing={isRefreshing}
          retryInSeconds={retryInSeconds}
          onRefresh={refresh}
          apiDocsUrl={API_BASE_URL ? `${API_BASE_URL}/swagger` : null}
          alerts={alerts}
        />

        <main className="mt-8">
          {status === 'error' && (
            <ErrorBanner
              message={error?.message}
              retryInSeconds={retryInSeconds}
              onRetry={refresh}
            />
          )}

          <section aria-labelledby="quotes-title" className="mb-8">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="quotes-title" className="text-xl font-bold tracking-tight text-white">
                  Cotações
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Último preço por commodity, com variação sobre a leitura anterior.
                </p>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600">
                fonte · pipeline GitHub Actions
              </p>
            </div>

            {isLoading ? (
              <div className="flex flex-col gap-6 sm:flex-row">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : isEmpty ? (
              <EmptyState />
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {snapshots.map((snapshot) => (
                  <TickerCard key={snapshot.symbol} snapshot={snapshot} />
                ))}
              </div>
            )}
          </section>

          <div className="mb-6">
            <AlertPanel alerts={alerts} status={alertsStatus} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
            <Suspense fallback={<SkeletonChart />}>
              <MarketChart
                rows={rows}
                symbols={legend}
                range={range}
                onRangeChange={setRange}
              />
            </Suspense>

            <section
              className="rounded-[2rem] border border-white/10 bg-zinc-900/30 p-6 shadow-2xl backdrop-blur-2xl md:p-8"
              aria-labelledby="readings-title"
            >
              <div className="mb-5 flex items-baseline justify-between gap-3">
                <div>
                  <h2 id="readings-title" className="text-lg font-bold text-white">
                    Últimas leituras
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    Registros brutos do warehouse
                  </p>
                </div>
                <span className="rounded-md border border-white/5 px-2 py-0.5 font-mono text-[9px] font-bold text-zinc-500">
                  {readings.length}/{READINGS}
                </span>
              </div>

              <HistoryTable readings={readings} />
            </section>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  )
}
