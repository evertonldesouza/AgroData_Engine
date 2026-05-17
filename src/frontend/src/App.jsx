import React, { useEffect, useState } from 'react';
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import { Leaf, RefreshCcw, Activity, Globe, Database, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ============================================================
// Sparkline — mini gráfico SVG puro, sem biblioteca
// ============================================================
function Sparkline({ data, color = '#00d68f', height = 32 }) {
  if (!data || data.length < 2) {
    return <div style={{ height }} className="opacity-20" />;
  }

  const values = data.filter(v => v != null && !isNaN(v));
  if (values.length < 2) return <div style={{ height }} className="opacity-20" />;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1; // evita divisão por zero se todos os valores forem iguais

  const width = 200;
  const padding = 2;
  const innerHeight = height - padding * 2;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = padding + innerHeight - ((v - min) / range) * innerHeight;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');

  // gradient para a área sob a linha
  const gradientId = `spark-${color.replace('#', '')}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#${gradientId})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ============================================================
// TickerCard — agora com sparkline no rodapé
// ============================================================
function TickerCard({ symbol, currentValue, previousValue, history, identityColor, icon: Icon, unit = "BRL · saca 60kg" }) {
  const hasData = currentValue != null;
  const hasComparison = hasData && previousValue != null;

  const delta = hasComparison ? currentValue - previousValue : 0;
  const deltaPct = hasComparison && previousValue !== 0
    ? (delta / previousValue) * 100
    : 0;

  const direction = hasComparison
    ? (delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral')
    : 'neutral';

  const trendColor = {
    up: 'text-[#00d68f]',
    down: 'text-[#ff5a5a]',
    neutral: 'text-zinc-500',
  }[direction];

  const trendBg = {
    up: 'bg-[#00d68f]/10',
    down: 'bg-[#ff5a5a]/10',
    neutral: 'bg-white/5',
  }[direction];

  const sparkColor = {
    up: '#00d68f',
    down: '#ff5a5a',
    neutral: '#71717a',
  }[direction];

  const TrendIcon = {
    up: TrendingUp,
    down: TrendingDown,
    neutral: Minus,
  }[direction];

  return (
    <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex-1 min-w-[260px] shadow-xl transition-all duration-300 hover:bg-zinc-800/40">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-zinc-800/60 rounded-xl border border-white/5">
            <Icon size={16} style={{ color: identityColor }} />
          </div>
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">{symbol}</span>
        </div>

        {hasComparison && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${trendBg}`}>
            <TrendIcon size={11} className={trendColor} strokeWidth={2.5} />
            <span className={`text-[10px] font-bold font-mono tabular-nums ${trendColor}`}>
              {Math.abs(deltaPct).toFixed(2)}%
            </span>
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-3 mb-1">
        <span className="text-3xl font-bold tracking-tight text-white font-mono tabular-nums">
          {hasData ? `R$ ${currentValue.toFixed(2)}` : <span className="text-zinc-800">---</span>}
        </span>
        {hasComparison && (
          <span className={`text-xs font-mono tabular-nums ${trendColor}`}>
            {delta > 0 ? '+' : delta < 0 ? '−' : ''}{Math.abs(delta).toFixed(2)}
          </span>
        )}
      </div>

      <div className="text-[10px] text-zinc-600 uppercase tracking-wider font-mono mb-3">{unit}</div>

      {/* Sparkline */}
      <Sparkline data={history} color={sparkColor} height={32} />
    </div>
  );
}

// ============================================================
// TechPanel — sem alteração
// ============================================================
function TechPanel({ error }) {
  return (
    <div className="flex flex-wrap items-center gap-4 bg-zinc-900/40 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-3 shadow-xl">
      <div className="flex items-center gap-3 pr-4 border-r border-white/5">
        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
          <Database size={12} className="text-emerald-500/70" />
        </div>
        <div className="flex flex-col">
          <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest">Source</span>
          <span className="text-[10px] font-bold font-mono text-zinc-300">SUPABASE</span>
        </div>
      </div>

      <div className="flex items-center gap-3 pr-4 border-r border-white/5">
        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center">
          <Activity size={12} className="text-emerald-500/70" />
        </div>
        <div className="flex flex-col">
          <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest">Stream</span>
          <span className="text-[10px] font-bold font-mono text-emerald-500/80">LIVE</span>
        </div>
      </div>

      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/5 ${error ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${error ? 'bg-red-500' : 'bg-emerald-500'} animate-pulse`} />
        <span className={`text-[9px] font-black font-mono tracking-tighter ${error ? 'text-red-500' : 'text-emerald-500'}`}>
          {error ? 'DEGRADED' : 'SYSTEM_STABLE'}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// App
// ============================================================
export default function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pulse, setPulse] = useState(false);

  const fetchData = async () => {
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
        setError(false);
      }
      setTimeout(() => setPulse(false), 800);
      setLoading(false);
    } catch (err) {
      setError(true);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const last = data[data.length - 1];
  const prev = data[data.length - 2];

  // Histórico por commodity para o sparkline
  const sojaHistory = data.map(d => d.SOJA != null ? Number(d.SOJA) : null);
  const milhoHistory = data.map(d => d.MILHO != null ? Number(d.MILHO) : null);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="p-8 bg-zinc-900/50 backdrop-blur-2xl border border-white/10 rounded-[40px] shadow-2xl flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin mb-6" />
          <span className="text-emerald-500 font-mono text-xs tracking-[0.4em] uppercase">Booting Engine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 font-sans p-4 md:p-8">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,_#10b98108_0%,_transparent_40%)] pointer-events-none" />
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808005_1px,transparent_1px),linear-gradient(to_bottom,#80808005_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto">
        <header className="flex flex-wrap justify-between items-center bg-zinc-900/20 backdrop-blur-md border border-white/5 rounded-[32px] p-4 mb-10 shadow-2xl">
          <div className="flex items-center gap-4 px-2">
            <div className="w-11 h-11 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-[0_8px_20px_#10b98140]">
              <Leaf className="text-white" size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter text-white">
                AGRO<span className="text-emerald-500">DATA</span>
              </h1>
              <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-[0.3em]">Market Intelligence</span>
            </div>
          </div>

          <button
            onClick={fetchData}
            className="flex items-center gap-3 px-6 py-3 bg-zinc-800 border border-white/5 rounded-2xl hover:bg-zinc-700 transition-all active:scale-95 group shadow-lg"
          >
            <RefreshCcw size={16} className={`text-emerald-500 ${pulse ? 'animate-spin' : ''}`} />
            <span className="text-xs font-bold text-zinc-300 font-mono">RELOAD</span>
          </button>
        </header>

        <div className="flex flex-col lg:flex-row gap-6 mb-10">
          <div className="flex flex-col sm:flex-row gap-6 flex-1">
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
          <TechPanel error={error} />
        </div>

        <div className="relative bg-zinc-900/30 backdrop-blur-2xl border border-white/10 rounded-[40px] p-10 shadow-2xl overflow-hidden min-h-[550px]">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Market Performance</h3>
              <p className="text-xs text-zinc-500 font-medium italic">Análise preditiva de tendências em tempo real</p>
            </div>
            <div className="flex gap-4 p-2 bg-black/20 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2 px-3 py-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold text-zinc-400">SOJA</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-[10px] font-bold text-zinc-400">MILHO</span>
              </div>
            </div>
          </div>

          <div className="h-[380px] w-full">
            {data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorSoja" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorMilho" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis dataKey="time" stroke="#ffffff20" fontSize={10} axisLine={false} tickLine={false} tickMargin={15}/>
                  <YAxis stroke="#ffffff20" fontSize={10} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #ffffff10', borderRadius: '20px', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="SOJA" stroke="#10b981" strokeWidth={4} fill="url(#colorSoja)" animationDuration={2000} />
                  <Area type="monotone" dataKey="MILHO" stroke="#f59e0b" strokeWidth={4} fill="url(#colorMilho)" animationDuration={2000} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-700 font-mono text-xs uppercase tracking-widest">
                Connecting Stream...
              </div>
            )}
          </div>
        </div>

        <footer className="mt-12 mb-8 flex flex-col md:flex-row justify-between items-center text-[10px] text-zinc-600 font-bold tracking-[0.2em] uppercase">
          <span>AgroData Intelligence Systems</span>
          <span className="italic text-zinc-700 mt-4 md:mt-0">Design & Engine by Everton L. de Souza</span>
        </footer>
      </div>
    </div>
  );
}