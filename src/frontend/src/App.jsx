import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Area, AreaChart
} from 'recharts';
import { Leaf, RefreshCcw, TrendingUp, TrendingDown, Activity, Globe, Database } from 'lucide-react';

// Widget de métrica com design "Glass-Tech"
function TickerCard({ symbol, value, color, pulse, icon: Icon }) {
  return (
    <div className="relative group overflow-hidden bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-xl p-5 min-w-[200px] transition-all hover:border-emerald-500/30">
      <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
        <Icon size={48} color={color} />
      </div>
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-zinc-800/50 border border-white/5">
          <Icon size={14} style={{ color }} />
        </div>
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{symbol}</span>
        {pulse && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />}
      </div>

      <div className="flex flex-col">
        <span className="text-2xl font-bold tracking-tight text-white font-mono">
          {value ?? <span className="text-zinc-700">---</span>}
        </span>
        <div className="flex items-center gap-1.5 mt-1">
          <TrendingUp size={12} className="text-emerald-500" />
          <span className="text-[10px] text-zinc-400 font-medium">BRL / Saca 60kg</span>
        </div>
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
      if (!res.ok) throw new Error('API Offline');
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
      setTimeout(() => setPulse(false), 1000);
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
      <div className="min-h-screen bg-[#050505] flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#10b98110_0%,_transparent_70%)]" />
        <div className="z-10 flex flex-col items-center">
          <div className="w-12 h-12 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
          <h2 className="text-emerald-500 font-mono text-sm tracking-[0.3em] uppercase animate-pulse">Syncing Engine</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Textura de Grid ao fundo */}
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none" />
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Header Superior */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center shadow-[0_0_20px_#10b98110]">
              <Leaf className="text-emerald-500" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                AGRO<span className="text-emerald-500">DATA</span>
                <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full border border-white/5 uppercase tracking-widest font-mono">v2.1</span>
              </h1>
              <p className="text-xs text-zinc-500 font-medium">Real-time commodity intelligence platform</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end mr-4">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Network Status</span>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold font-mono ${error ? 'text-red-500' : 'text-emerald-500'}`}>
                  {error ? 'CONNECTION_LOST' : 'STABLE_NODE'}
                </span>
                <div className={`w-2 h-2 rounded-full ${error ? 'bg-red-500' : 'bg-emerald-500'} shadow-[0_0_8px_currentColor]`} />
          </div>
        </div>
        <button
          onClick={fetchData}
              className="p-3 bg-zinc-900 border border-white/5 rounded-xl hover:border-emerald-500/50 transition-all active:scale-95 group"
        >
              <RefreshCcw size={18} className={`text-zinc-400 group-hover:text-emerald-500 ${pulse ? 'animate-spin' : ''}`} />
        </button>
      </div>
        </header>

        {/* Grade de Widgets Principais */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
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
          <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-xl p-5 flex flex-col justify-center">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Data Source</span>
            <div className="flex items-center gap-2 text-white">
              <Database size={16} className="text-emerald-500" />
              <span className="text-sm font-bold font-mono">SUPABASE_DB_01</span>
            </div>
        </div>
          <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-xl p-5 flex flex-col justify-center">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Session Info</span>
            <span className="text-sm font-bold font-mono text-emerald-500">LIVE_DATA_STREAMING</span>
          </div>
    </div>

        {/* Container do Gráfico "Premium" */}
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/20 to-amber-500/20 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
          <div className="relative bg-[#0d0d0d]/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-8 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-lg font-bold flex items-center gap-3 text-white">
                Market Performance
                <span className="text-[10px] text-zinc-600 font-mono tracking-widest">REALTIME_ANALYTICS</span>
              </h3>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
                  <span className="text-[10px] font-bold text-zinc-400">SOJA</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_#f59e0b]" />
                  <span className="text-[10px] font-bold text-zinc-400">MILHO</span>
                </div>
              </div>
            </div>

            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorSoja" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorMilho" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis
                    dataKey="time"
                    stroke="#ffffff20"
                    fontSize={10}
                    tickMargin={15}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#ffffff20"
                    fontSize={10}
                    axisLine={false}
                    tickLine={false}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111',
                      border: '1px solid #ffffff10',
                      borderRadius: '12px',
                      fontSize: '12px'
                    }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="SOJA"
                    stroke="#10b981"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorSoja)"
                    animationDuration={1500}
                  />
                  <Area
                    type="monotone"
                    dataKey="MILHO"
                    stroke="#f59e0b"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorMilho)"
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <footer className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-zinc-600">
          <span className="text-[10px] font-mono tracking-widest uppercase">© 2024 AgroData Intelligence Systems</span>
          <div className="flex gap-6 items-center">
            <span className="text-[10px] font-mono tracking-widest uppercase">Status: 200 OK</span>
            <span className="text-[10px] font-mono tracking-widest uppercase italic">Developed by Everton L. de Souza</span>
          </div>
        </footer>
      </div>
    </div>
  );
}