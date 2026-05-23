export default function SkeletonChart() {
  return (
    <div className="relative bg-zinc-900/30 backdrop-blur-2xl border border-white/10 rounded-[40px] p-10 shadow-2xl overflow-hidden min-h-[550px] animate-pulse">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div className="space-y-2">
          <div className="h-7 w-52 bg-zinc-800 rounded" />
          <div className="h-4 w-64 bg-zinc-800/60 rounded" />
        </div>
        <div className="flex gap-4 p-2 bg-black/20 rounded-2xl border border-white/5">
          <div className="h-5 w-16 bg-zinc-800 rounded" />
          <div className="h-5 w-16 bg-zinc-800 rounded" />
        </div>
      </div>
      <div className="h-[380px] flex items-center justify-center">
        <div className="w-full h-full flex flex-col gap-4 px-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-6 bg-zinc-800/30 rounded" style={{ width: `${70 + Math.random() * 30}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
