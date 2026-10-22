const STACK = ['React 19', 'Vite', 'Tailwind v4', '.NET 10', 'PostgreSQL']

export default function Footer() {
  return (
    <footer className="mt-12 mb-6 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-6 text-[10px] uppercase tracking-[0.2em] text-zinc-600 md:flex-row">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span className="font-bold text-zinc-500">AgroData Intelligence Systems</span>
        <span className="text-zinc-800">|</span>
        {STACK.map((item) => (
          <span key={item} className="font-mono text-zinc-600">
            {item}
          </span>
        ))}
      </div>
      <span className="italic tracking-[0.15em] text-zinc-700">
        Design &amp; Engine by Everton L. de Souza
      </span>
    </footer>
  )
}
