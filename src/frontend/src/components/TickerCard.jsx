import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Sparkline from './Sparkline';

const TREND_CONFIG = {
  up:   { color: 'text-[#00d68f]', bg: 'bg-[#00d68f]/10', spark: '#00d68f', icon: TrendingUp },
  down: { color: 'text-[#ff5a5a]', bg: 'bg-[#ff5a5a]/10', spark: '#ff5a5a', icon: TrendingDown },
  neutral: { color: 'text-zinc-500', bg: 'bg-white/5', spark: '#71717a', icon: Minus },
};

export default function TickerCard({ symbol, currentValue, previousValue, history, identityColor, icon: Icon, unit = 'BRL / saca 60kg' }) {
  const hasData = currentValue != null;
  const hasComparison = hasData && previousValue != null;

  const delta = hasComparison ? currentValue - previousValue : 0;
  const deltaPct = hasComparison && previousValue !== 0
    ? (delta / previousValue) * 100
    : 0;

  const direction = hasComparison
    ? (delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral')
    : 'neutral';

  const cfg = TREND_CONFIG[direction];
  const TrendIcon = cfg.icon;

  return (
    <div
      className="bg-zinc-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex-1 min-w-[260px] shadow-xl transition-all duration-300 hover:bg-zinc-800/40"
      role="article"
      aria-label={`Card ${symbol}: ${hasData ? `R$ ${currentValue.toFixed(2)}` : 'sem dados'}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-zinc-800/60 rounded-xl border border-white/5">
            <Icon size={16} style={{ color: identityColor }} />
          </div>
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em]">{symbol}</span>
        </div>

        {hasComparison && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${cfg.bg}`}>
            <TrendIcon size={11} className={cfg.color} strokeWidth={2.5} />
            <span className={`text-[10px] font-bold font-mono tabular-nums ${cfg.color}`}>
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
          <span className={`text-xs font-mono tabular-nums ${cfg.color}`}>
            {delta > 0 ? '+' : delta < 0 ? '-' : ''}{Math.abs(delta).toFixed(2)}
          </span>
        )}
      </div>

      <div className="text-[10px] text-zinc-600 uppercase tracking-wider font-mono mb-3">{unit}</div>

      <Sparkline data={history} color={cfg.spark} />
    </div>
  );
}
