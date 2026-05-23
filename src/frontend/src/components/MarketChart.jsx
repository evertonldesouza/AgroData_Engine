import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';

function formatPrice(value) {
  if (value == null || isNaN(value)) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl px-4 py-3">
      <p className="text-[10px] text-zinc-500 font-mono mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs font-mono">
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-zinc-400">{entry.name}:</span>
          <span className="text-white font-bold tabular-nums">{formatPrice(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function MarketChart({ data }) {
  return (
    <div className="relative bg-zinc-900/30 backdrop-blur-2xl border border-white/10 rounded-[40px] p-10 shadow-2xl overflow-hidden min-h-[550px]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">Market Performance</h3>
          <p className="text-xs text-zinc-500 font-medium italic">
            Analise preditiva de tendencias em tempo real
          </p>
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

      <div className="h-[380px] w-full" role="img" aria-label="Grafico de performance de mercado: SOJA (verde) e MILHO (laranja)">
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
              <YAxis stroke="#ffffff20" fontSize={10} axisLine={false} tickLine={false} domain={['auto', 'auto']}
                tickFormatter={(v) => formatPrice(v)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="SOJA" stroke="#10b981" strokeWidth={4} fill="url(#colorSoja)" animationDuration={2000} />
              <Area type="monotone" dataKey="MILHO" stroke="#f59e0b" strokeWidth={4} fill="url(#colorMilho)" animationDuration={2000} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div
            className="h-full flex items-center justify-center text-zinc-700 font-mono text-xs uppercase tracking-widest"
            role="status"
            aria-live="polite"
          >
            Connecting Stream...
          </div>
        )}
      </div>
    </div>
  );
}
