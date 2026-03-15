/**
 * 대시보드 로딩 스켈레톤
 */
export default function DashboardLoading() {
  return (
    <div className="h-full bg-slate-950 p-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-48 bg-slate-800 rounded" />
        <div className="h-8 w-32 bg-slate-800 rounded" />
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 h-28" />
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 h-72" />
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 h-72" />
      </div>
    </div>
  );
}
