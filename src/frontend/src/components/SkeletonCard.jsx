export default function SkeletonCard() {
  return (
    <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 flex-1 min-w-[260px] shadow-xl animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-zinc-800/60 rounded-xl">
            <div className="w-4 h-4 rounded bg-zinc-700" />
          </div>
          <div className="h-3 w-12 bg-zinc-800 rounded" />
        </div>
        <div className="h-5 w-16 bg-zinc-800 rounded-md" />
      </div>
      <div className="h-9 w-32 bg-zinc-800 rounded mb-2" />
      <div className="h-3 w-28 bg-zinc-800/60 rounded mb-5" />
      <div className="h-8 w-full bg-zinc-800/40 rounded" />
    </div>
  );
}
