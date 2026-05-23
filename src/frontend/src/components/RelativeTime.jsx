import { useEffect, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function RelativeTime({ timestamp, prefix = 'updated' }) {
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
    <span className="text-zinc-500 font-mono" aria-live="polite">
      {prefix} {relative} atras
    </span>
  );
}
