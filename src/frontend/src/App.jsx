import React, { useEffect, useState } from 'react';
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import { Leaf, RefreshCcw, TrendingUp, Activity, Globe, Database } from 'lucide-react';

// Widget de métrica com design "Floating Glass"
function TickerCard({ symbol, value, color, pulse, icon: Icon }) {
  return (
    <div className="relative flex items-center gap-5 bg-zinc-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-5 flex-1 min-w-[260px] shadow-xl transition-all duration-300 hover:-translate-y-1 hover:bg-zinc-800/40 hover:shadow-emerald-500/5 group">
      <div className="p-4 bg-zinc-800/60 rounded-2xl border border-white/5 group-hover:scale-110 transition-transform duration-500">
        <Icon size={22} style={{ color }} />
      </div>

      <div className="flex flex-col">
              <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">{symbol}</span>
          {pulse && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
              )}
            </div>
        <span className="text-2xl font-bold tracking-tight text-white font-mono mt-0.5">
          {value ?? <span className="text-zinc-800">---</span>}
        </span>
      </div>

      <div className="ml-auto p-2 bg-emerald-500/5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
         <TrendingUp size={16} className="text-emerald-500" />
          </div>
      </div>
  );
}

// Painel Técnico estilo "Capsule"
function TechPanel({ error }) {
  return (
    <div className="flex flex-wrap items-center gap-4 bg-zinc-900/40 backdrop-blur-xl border border-white/10 rounded-3xl px-6 py-3 shadow-xl">
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
      {/* Background Decorativo Suave */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top_right,_#10b98108_0%,_transparent_40%)] pointer-events-none" />
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808005_1px,transparent_1px),linear-gradient(to_bottom,#80808005_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto">

        {/* Header Superior Estilo Floating Bar */}
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

        {/* Widgets e Painel Técnico */}
        <div className="flex flex-col lg:flex-row gap-6 mb-10">
          <div className="flex flex-col sm:flex-row gap-6 flex-1">
            <TickerCard
              symbol="SOJA"
              value={last?.SOJA ? `R$ ${Number(last.SOJA).toFixed(2)}` : null}
              color="#10b981"
              pulse={pulse}
              icon={Activity}
            />
            <TickerCard
              symbol="MILHO"
              value={last?.MILHO ? `R$ ${Number(last.MILHO).toFixed(2)}` : null}
              color="#f59e0b"
              pulse={pulse}
              icon={Globe}
            />
          </div>
          <TechPanel error={error} />
        </div>

        {/* Gráfico Floating Card */}
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

