import { MetricCard } from './MetricCard';
import { METRICS_DATA } from '@/lib/constants/landing-content';

/**
 * 성과 지표 섹션 (Server Component)
 *
 * MetricCard를 래핑하여 데이터 전달
 */
export function Metrics() {
  const primaryMetrics = METRICS_DATA.slice(0, 4);
  const secondaryMetrics = METRICS_DATA.slice(4);

  return (
    <section id="metrics" className="py-20 px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-blue-500/5" />

      <div className="relative max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            검증된 성과
          </h2>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            실제 고객사에서 측정된 정확한 데이터입니다
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {primaryMetrics.map((metric, index) => (
            <MetricCard
              key={index}
              value={metric.value}
              suffix={metric.suffix}
              label={metric.label}
              color={metric.color}
            />
          ))}
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          {secondaryMetrics.map((metric, index) => (
            <MetricCard
              key={index}
              value={metric.value}
              suffix={metric.suffix}
              label={metric.label}
              color={metric.color}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
