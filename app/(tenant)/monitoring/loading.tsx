/**
 * 모니터링 로딩 스켈레톤
 */
export default function MonitoringLoading() {
  return (
    <div className="h-full bg-slate-950 p-6 animate-pulse">
      <div className="h-8 w-40 bg-slate-800 rounded mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 h-24" />
        ))}
      </div>
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 h-96" />
    </div>
  );
}
