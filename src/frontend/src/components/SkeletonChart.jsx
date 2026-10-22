const BARS = [72, 88, 64, 96, 81]

export default function SkeletonChart() {
  return (
    <div className="relative min-h-[480px] overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-900/30 p-6 shadow-2xl backdrop-blur-2xl md:p-8">
      <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
        <div className="space-y-2">
          <div className="h-6 w-48 rounded bg-zinc-800" />
          <div className="h-3 w-64 rounded bg-zinc-800/60" />
        </div>
        <div className="h-8 w-40 rounded-xl bg-zinc-800/60" />
      </div>
      <div className="flex h-[320px] w-full flex-col justify-end gap-5">
        {BARS.map((width, index) => (
          <div
            key={index}
            className="h-5 animate-pulse rounded bg-zinc-800/40"
            style={{ width: `${width}%` }}
          />
        ))}
      </div>
    </div>
  )
}
