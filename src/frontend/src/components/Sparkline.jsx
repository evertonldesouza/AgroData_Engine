export default function Sparkline({ data, color = '#00d68f', height = 32 }) {
  if (!data || data.length < 2) {
    return <div style={{ height }} className="opacity-20" aria-hidden="true" />;
  }

  const values = data.filter(v => v != null && !isNaN(v));
  if (values.length < 2) return <div style={{ height }} className="opacity-20" aria-hidden="true" />;

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
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      role="img"
      aria-label={`Mini-grafico: ${values.length} pontos, variacao de ${formatNum(min)} a ${formatNum(max)}`}
    >
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

function formatNum(v) {
  return v.toFixed(2);
}
