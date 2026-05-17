import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Leaf, RefreshCcw, TrendingUp, TrendingDown } from 'lucide-react';

function TickerCard({ symbol, value, color, pulse }) {
  return (
    <div
      className="flex flex-col gap-1 px-6 py-3 border-l border-zinc-800 min-w-[140px]"
      style={{ borderTopColor: color, borderTopWidth: 2 }}
    >
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">{symbol} / BRL</span>
        {pulse && (
          <span
            className="w-1.5 h-1.5 rounded-sm animate-ping"
            style={{ backgroundColor: color }}
          />
        )}
      </div>
      <span className="text-xl font-bold font-mono" style={{ color }}>
        {value ?? <span className="text-zinc-700 text-sm">—</span>}
      </span>
      <span className="text-[9px] text-zinc-600 font-mono">R$ / saca</span>
    </div>
  );
}

function LastUpdate({ time }) {
  return (
    <div className="flex flex-col gap-1 px-6 py-3 border-l border-zinc-800 min-w-[120px]">
      <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">Atualizado</span>
      <span className="text-sm font-mono text-zinc-400">{time ?? '—'}</span>
      <span className="text-[9px] text-zinc-600 font-mono">LIVE · 10s</span>
    </div>
  );
}

function StatusBadge({ error }) {
  return (
    <div className="hidden md:flex flex-col items-end gap-1 pl-6 border-l border-zinc-800">
      <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest">System</span>
      <div className="flex items-center gap-2">
        {error ? (
          <span className="text-[11px] font-bold font-mono text-red-500">DEGRADED</span>
        ) : (
          <>
            <span className="text-[11px] font-bold font-mono text-emerald-600">OPERATIONAL</span>
            <span className="w-1.5 h-1.5 rounded-sm bg-emerald-600" />
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pulse, setPulse] = useState(false);

  const fetchData = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'https://agro-data-engine.onrender.com';
      const res = await fetch(`${baseUrl}/api/Commodities`);
      if (!res.ok) throw new Error('Erro na API');
      const json = await res.json();

      if (json?.length > 0) {
        const grouped = json.reduce((acc, item) => {
          const time = new Date(item.timestamp).toLocaleTimeString('pt-BR');
          if (!acc[time]) acc[time] = { time };
          acc[time][item.symbol] = item.price;
          return acc;
        }, {});
        setData(Object.values(grouped).reverse());
        setError(false);
        setPulse(true);
        setTimeout(() => setPulse(false), 2000);
      }
      setLoading(false);
    } catch (err) {
      console.error('[AgroData] fetchData:', err);
      setError(true);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const last = data[data.length - 1];
  const lastSoja = last?.SOJA != null ? `R$ ${Number(last.SOJA).toFixed(2)}` : null;
  const lastMilho = last?.MILHO != null ? `R$ ${Number(last.MILHO).toFixed(2)}` : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-sm animate-spin mx-auto" />
          <p className="text-zinc-600 font-mono text-[10px] uppercase tracking-[0.2em]">
            Initializing Market Feed...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans flex flex-col overflow-hidden">

      {/* Header com tickers integrados */}
      <header className="border-b border-zinc-900 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-0 flex-wrap">

          {/* Logo */}
          <div className="flex items-center gap-3 pr-8 mr-2">
            <div className="p-2 bg-emerald-950/20 border border-emerald-900/30 rounded-sm">
              <Leaf className="text-emerald-600 w-4 h-4" />
            </div>
            <div>
              <h1 className="text-md font-bold tracking-tighter uppercase leading-none">
                Agro<span className="text-emerald-600">Data</span>
              </h1>
              <p className="text-[8px] text-zinc-600 tracking-[0.3em] font-mono uppercase mt-0.5">
                Terminal v2.0
              </p>
            </div>
          </div>

          {/* Tickers */}
          <TickerCard symbol="SOJA" value={lastSoja} color="#059669" pulse={pulse} />
          <TickerCard symbol="MILHO" value={lastMilho} color="#CA8A04" pulse={pulse} />
          <LastUpdate time={last?.time} />

          {/* Status empurrado pra direita */}
          <div className="ml-auto flex items-center">
            <StatusBadge error={error} />
          </div>
        </div>
      </header>

      {/* Toolbar do gráfico */}
      <div className="max-w-7xl mx-auto w-full px-6 pt-10 pb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xs font-bold text-zinc-400 flex items-center gap-2 uppercase tracking-wider">
            <div className="w-1 h-3 bg-emerald-600" />
            Commodity Analytics
            <span className="text-[10px] text-zinc-700 font-mono">[0x_LIVE]</span>
          </h2>
          <p className="text-[10px] text-zinc-600 mt-1 font-mono uppercase tracking-tight">
            Real-time comparative analysis · Soy vs Corn
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-4 py-2 rounded-sm transition-all active:translate-y-px group"
        >
          <RefreshCcw className="w-3 h-3 text-zinc-500 group-hover:rotate-180 transition-transform duration-700" />
          <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">Execute Refresh</span>
        </button>
      </div>

      {/* Gráfico */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 pb-12">
        <div className="h-[520px] w-full bg-zinc-950 border border-zinc-900 p-6 rounded-sm relative">
          {data.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-800 font-mono text-[10px] uppercase tracking-[0.5em]">
              {error ? 'ERR: DATA_LOAD_FAILED' : 'Awaiting market feed...'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="0" stroke="#18181b" vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke="#3f3f46"
                  fontSize={9}
                  tickMargin={12}
                  fontFamily="JetBrains Mono, monospace"
                  tick={{ fill: '#52525b' }}
                  axisLine={{ stroke: '#27272a' }}
                />
                <YAxis
                  stroke="#3f3f46"
                  fontSize={9}
                  tickFormatter={(val) => `${val}`}
                  fontFamily="JetBrains Mono, monospace"
                  tick={{ fill: '#52525b' }}
                  axisLine={{ stroke: '#27272a' }}
                />
                <Tooltip
                  cursor={{ stroke: '#27272a', strokeWidth: 1 }}
                  contentStyle={{
                    backgroundColor: '#09090b',
                    border: '1px solid #27272a',
                    borderRadius: '2px',
                    fontSize: 10,
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                  itemStyle={{ padding: '2px 0' }}
                  labelStyle={{ color: '#52525b', marginBottom: 6, textTransform: 'uppercase', fontSize: 9 }}
                  formatter={(val, name) => [`R$ ${Number(val).toFixed(2)}`, name]}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  height={40}
                  iconType="rect"
                  wrapperStyle={{ 
                    fontSize: 9, 
                    fontFamily: 'JetBrains Mono, monospace', 
                    textTransform: 'uppercase',
                    paddingBottom: '20px'
                  }}
                />
                <Line
                  name="SOJA"
                  type="stepAfter"
                  dataKey="SOJA"
                  stroke="#059669"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 3, fill: '#059669', strokeWidth: 0 }}
                />
                <Line
                  name="MILHO"
                  type="stepAfter"
                  dataKey="MILHO"
                  stroke="#CA8A04"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 3, fill: '#CA8A04', strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
          
          {/* Decorative Corner Elements */}
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-zinc-700" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-zinc-700" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-zinc-700" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-zinc-700" />
        </div>
      </main>

      <footer className="border-t border-zinc-900 bg-zinc-950 py-6 text-center text-[8px] text-zinc-600 font-mono uppercase tracking-[0.4em]">
        AgroData Engine Terminal · Operational Intelligence · 2024
      </footer>
    </div>
  );
}