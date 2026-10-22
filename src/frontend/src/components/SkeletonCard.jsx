export default function SkeletonCard() {
  return (
    <div className="flex-1 rounded-2xl border border-white/10 bg-zinc-900/40 p-5 shadow-xl backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-zinc-800/70" />
          <div className="space-y-2">
            <div className="h-3 w-16 rounded bg-zinc-800" />
            <div className="h-2 w-10 rounded bg-zinc-800/60" />
          </div>
        </div>
        <div className="h-5 w-16 rounded-md bg-zinc-800" />
      </div>
      <div className="mb-2 h-9 w-36 rounded bg-zinc-800" />
      <div className="mb-5 h-3 w-28 rounded bg-zinc-800/60" />
      <div className="h-9 w-full rounded bg-zinc-800/40" />
    </div>
  )
}
