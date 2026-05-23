import { useEffect, useState, useCallback, useRef } from 'react';
import { Leaf, RefreshCcw, Activity, Globe } from 'lucide-react';
import TickerCard from './components/TickerCard';
import MarketChart from './components/MarketChart';
import RelativeTime from './components/RelativeTime';

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="p-8 bg-zinc-900/50 backdrop-blur-2xl border border-white/10 rounded-[40px] shadow-2xl flex flex-col items-center">
        <div className="w-16 h-16 border-4 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin mb-6" />
        <span className="text-emerald-500 font-mono text-xs tracking-[0.4em] uppercase">Booting Engine...</span>
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const retryCount = useRef(0);

  const getInterval = useCallback(() => {
    const base = 15000;
    const max = 120000;
    const backoff = Math.min(base * Math.pow(2, retryCount.current), max);
    return backoff;
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setPulse(true);
      const baseUrl = import.meta.env.VITE_API_URL || 'https://agro-data-engine.onrender.com';
      const res = await fetch(`${baseUrl}/api/Commodities`);
      if (!res.ok) throw new Error('Offline');
      const json = await res.json();

      if (json?.length > 0) {
        const grouped = json.reduce((acc, item) => {
          const time = new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          if (!acc[time]) acc[time] = { time };
          acc[time][item.symbol] = item.price;
          return acc;
        }, {});
        setData(Object.values(grouped).reverse().slice(-15));
        setLastUpdate(new Date());
        setError(false);
        retryCount.current = 0;
      }
      setTimeout(() => setPulse(false), 800);
      setLoading(false);
    } catch (err) {
      retryCount.current += 1;
      setError(true);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, getInterval());
    return () => clearInterval(interval);
  }, [fetchData, getInterval]);

  const last = data[data.length - 1];
  const prev = data[data.length - 2];

  const sojaHistory = data.map(d => d.SOJA != null ? Number(d.SOJA) : null);
  const milhoHistory = data.map(d => d.MILHO != null ? Number(d.MILHO) : null);

  if (loading) return <LoadingScreen />;

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 font-sans p-4 md:p-8">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,_#10b98108_0%,_transparent_40%)] pointer-events-none" />
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808005_1px,transparent_1px),linear-gradient(to_bottom,#80808005_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto">
        <header className="flex flex-wrap justify-between items-center gap-4 bg-zinc-900/20 backdrop-blur-md border border-white/5 rounded-2xl px-5 py-3 mb-8 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center shadow-[0_4px_12px_#10b98140]">
              <Leaf className="text-white" size={18} />
            </div>
            <h1 className="text-base font-black tracking-tighter text-white">
              AGRO<span className="text-emerald-500">DATA</span>
            </h1>
            <span className="text-[9px] text-zinc-500 font-bold font-mono px-2 py-0.5 border border-white/5 rounded">v2.3</span>
          </div>

          <div className="flex items-center gap-3 text-[10px] font-mono">
            <span className="flex items-center gap-1.5" aria-live="polite">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${error ? 'bg-red-500' : 'bg-emerald-400'}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${error ? 'bg-red-500' : 'bg-emerald-500'}`} />
              </span>
              <span className={`font-bold tracking-wider ${error ? 'text-red-500' : 'text-emerald-500'}`}>
                {error ? 'DEGRADED' : 'LIVE'}
              </span>
            </span>
            <span className="text-zinc-700">&middot;</span>
            <span className="text-zinc-500">supabase_db_01</span>
            <span className="text-zinc-700">&middot;</span>
            <RelativeTime timestamp={lastUpdate} />
          </div>

          <button
            onClick={fetchData}
            aria-label="Recarregar dados"
            className="p-2.5 bg-zinc-800/60 border border-white/5 rounded-xl hover:bg-zinc-700 transition-all active:scale-95 shadow-lg"
          >
            <RefreshCcw size={14} className={`text-emerald-500 ${pulse ? 'animate-spin' : ''}`} />
          </button>
        </header>

        {error && (
          <div
            className="flex items-center justify-between bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-3 mb-6"
            role="alert"
          >
            <span className="text-xs text-red-400 font-mono">
              Erro de conexao com a API. Tentando novamente em {(getInterval() / 1000).toFixed(0)}s...
            </span>
            <button
              onClick={fetchData}
              className="text-xs font-bold text-red-400 underline hover:text-red-300"
            >
              Tentar agora
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-6 mb-8">
          <TickerCard
            symbol="SOJA"
            currentValue={last?.SOJA != null ? Number(last.SOJA) : null}
            previousValue={prev?.SOJA != null ? Number(prev.SOJA) : null}
            history={sojaHistory}
            identityColor="#10b981"
            icon={Activity}
          />
          <TickerCard
            symbol="MILHO"
            currentValue={last?.MILHO != null ? Number(last.MILHO) : null}
            previousValue={prev?.MILHO != null ? Number(prev.MILHO) : null}
            history={milhoHistory}
            identityColor="#f59e0b"
            icon={Globe}
          />
        </div>

        <MarketChart data={data} />

        <footer className="mt-12 mb-8 flex flex-col md:flex-row justify-between items-center text-[10px] text-zinc-600 font-bold tracking-[0.2em] uppercase">
          <span>AgroData Intelligence Systems</span>
          <span className="italic text-zinc-700 mt-4 md:mt-0">Design &amp; Engine by Everton L. de Souza</span>
        </footer>
      </div>
    </div>
  );
}
