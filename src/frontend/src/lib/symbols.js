/** Visual identity of each tracked commodity. */

const PALETTE = [
  { color: '#00d68f', tint: 'rgba(0, 214, 143, 0.12)' },
  { color: '#f5a524', tint: 'rgba(245, 165, 36, 0.12)' },
  { color: '#60a5fa', tint: 'rgba(96, 165, 250, 0.12)' },
  { color: '#c084fc', tint: 'rgba(192, 132, 252, 0.12)' },
]

const KNOWN = {
  SOJA: { label: 'Soja', unit: 'BRL / saca 60 kg', ...PALETTE[0] },
  MILHO: { label: 'Milho', unit: 'BRL / saca 60 kg', ...PALETTE[1] },
}

const hash = (value) =>
  [...value].reduce((total, character) => (total * 31 + character.charCodeAt(0)) % 997, 7)

/**
 * Returns the label, unit and colours of a symbol. Unknown symbols get a
 * deterministic colour so new commodities render without a code change.
 */
export function symbolMeta(symbol) {
  const key = String(symbol ?? '').toUpperCase()
  const known = KNOWN[key]
  if (known) return { symbol: key, ...known }

  const { color, tint } = PALETTE[hash(key) % PALETTE.length]
  return { symbol: key, label: key || '—', unit: 'BRL / unidade', color, tint }
}

export const TREND_STYLES = {
  up: {
    label: 'Alta',
    text: 'text-[var(--color-up)]',
    chip: 'bg-[var(--color-up-soft)] text-[var(--color-up)]',
    stroke: 'var(--color-up)',
  },
  down: {
    label: 'Baixa',
    text: 'text-[var(--color-down)]',
    chip: 'bg-[var(--color-down-soft)] text-[var(--color-down)]',
    stroke: 'var(--color-down)',
  },
  flat: {
    label: 'Estável',
    text: 'text-zinc-400',
    chip: 'bg-white/5 text-zinc-400',
    stroke: '#71717a',
  },
}

export function trendStyle(trend) {
  return TREND_STYLES[trend] ?? TREND_STYLES.flat
}
