import React, { useEffect, useState } from 'react';
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import { Leaf, RefreshCcw, Activity, Globe, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ============================================================
// RelativeTime — atualiza sozinho a cada segundo
// ============================================================
function RelativeTime({ timestamp, prefix = "updated" }) {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (!timestamp) return;
    const interval = setInterval(() => forceUpdate(n => n + 1), 1000);
    return () => clearInterval(interval);
  }, [timestamp]);

  if (!timestamp) return null;

  const relative = formatDistanceToNowStrict(timestamp, {
    locale: ptBR,
    addSuffix: false,
  });

  return (
    <span className="text-zinc-500 font-mono">
      {prefix} {relative} atrás
    </span>
  );
}

// ============================================================
// Sparkline — mini gráfico SVG puro
// ============================================================
function Sparkline({ data, color = '#00d68f', height = 32 }) {
  if (!data || data.length < 2) {
    return <div style={{ height }} className="opacity-20" />;
  }

  const values = data.filter(v => v != null && !isNaN(v));
  if (values.length < 2) return <div style={{ height }} className="opacity-20" />;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const width = 200;
  const padding = 2;
  const innerHeight = height - padding * 2;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = padding + innerHeight - ((v - min) / range) * innerHeight;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');

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
// TickerCard — sem mudanças
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

      <Sparkline data={history} color={sparkColor} height={32} />
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
  const [lastUpdate, setLastUpdate] = useState(null);

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
        setLastUpdate(new Date());
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

        {/* Header compacto - 1 linha */}
        <header className="flex flex-wrap justify-between items-center gap-4 bg-zinc-900/20 backdrop-blur-md border border-white/5 rounded-2xl px-5 py-3 mb-8 shadow-2xl">
          {/* Esquerda: Logo + nome + versão */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center shadow-[0_4px_12px_#10b98140]">
              <Leaf className="text-white" size={18} />
            </div>
            <h1 className="text-base font-black tracking-tighter text-white">
              AGRO<span className="text-emerald-500">DATA</span>
            </h1>
            <span className="text-[9px] text-zinc-500 font-bold font-mono px-2 py-0.5 border border-white/5 rounded">
              v2.3
            </span>
          </div>

          {/* Centro: status microtexto */}
          <div className="flex items-center gap-3 text-[10px] font-mono">
            <span className="flex items-center gap-1.5">
              <span className={`relative flex h-2 w-2`}>
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${error ? 'bg-red-500' : 'bg-emerald-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${error ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
              </span>
              <span className={`font-bold tracking-wider ${error ? 'text-red-500' : 'text-emerald-500'}`}>
                {error ? 'DEGRADED' : 'LIVE'}
              </span>
            </span>
            <span className="text-zinc-700">·</span>
            <span className="text-zinc-500">supabase_db_01</span>
            <span className="text-zinc-700">·</span>
            <RelativeTime timestamp={lastUpdate} />
          </div>

          {/* Direita: botão reload icon-only */}
          <button
            onClick={fetchData}
            aria-label="Recarregar dados"
            className="p-2.5 bg-zinc-800/60 border border-white/5 rounded-xl hover:bg-zinc-700 transition-all active:scale-95 shadow-lg"
          >
            <RefreshCcw size={14} className={`text-emerald-500 ${pulse ? 'animate-spin' : ''}`} />
          </button>
        </header>

        {/* Cards de commodity - agora ocupam linha inteira */}
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

        {/* Gráfico principal */}
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