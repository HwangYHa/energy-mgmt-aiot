import { CheckCircle } from 'lucide-react';
import { FEATURES } from '@/lib/constants/landing-content';
import * as Icons from 'lucide-react';

/**
 * 기능 섹션 (Server Component)
 *
 * 6개 핵심 기능 카드 표시
 */
export function Features() {
  const colorMap = {
    emerald: {
      border: 'hover:border-emerald-500/50',
      shadow: 'hover:shadow-emerald-500/10',
      bg: 'bg-emerald-500/10 group-hover:bg-emerald-500/20',
      text: 'text-emerald-400',
      icon: 'text-emerald-400',
    },
    orange: {
      border: 'hover:border-orange-500/50',
      shadow: 'hover:shadow-orange-500/10',
      bg: 'bg-orange-500/10 group-hover:bg-orange-500/20',
      text: 'text-orange-400',
      icon: 'text-orange-400',
    },
    yellow: {
      border: 'hover:border-yellow-500/50',
      shadow: 'hover:shadow-yellow-500/10',
      bg: 'bg-yellow-500/10 group-hover:bg-yellow-500/20',
      text: 'text-yellow-400',
      icon: 'text-yellow-400',
    },
    blue: {
      border: 'hover:border-blue-500/50',
      shadow: 'hover:shadow-blue-500/10',
      bg: 'bg-blue-500/10 group-hover:bg-blue-500/20',
      text: 'text-blue-400',
      icon: 'text-blue-400',
    },
    green: {
      border: 'hover:border-green-500/50',
      shadow: 'hover:shadow-green-500/10',
      bg: 'bg-green-500/10 group-hover:bg-green-500/20',
      text: 'text-green-400',
      icon: 'text-green-400',
    },
    red: {
      border: 'hover:border-red-500/50',
      shadow: 'hover:shadow-red-500/10',
      bg: 'bg-red-500/10 group-hover:bg-red-500/20',
      text: 'text-red-400',
      icon: 'text-red-400',
    },
  } as const;

  return (
    <section id="features" className="py-20 px-4 bg-slate-800/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            강력한 AI 엔진
          </h2>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            최첨단 머신러닝과 실시간 분석으로 에너지 효율을 극대화합니다
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {FEATURES.map((feature) => {
            const Icon = Icons[feature.icon as keyof typeof Icons] as any;
            const colors = colorMap[feature.color as keyof typeof colorMap];

            return (
              <div
                key={feature.id}
                className={`group bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-8 ${colors.border} ${colors.shadow} hover:shadow-xl transition-all duration-300`}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className={`p-3 ${colors.bg} rounded-lg transition-colors`}>
                    <Icon className={`w-8 h-8 ${colors.icon}`} />
                  </div>
                  <h3 className="text-2xl font-semibold text-white">
                    {feature.title}
                  </h3>
                </div>
                <p className="text-slate-300 mb-6 leading-relaxed">
                  {feature.description}
                </p>
                <ul className="space-y-3">
                  {feature.metrics.map((metric, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-slate-400">
                      <CheckCircle className={`w-4 h-4 ${colors.icon} flex-shrink-0`} />
                      {metric.label && <span>{metric.label}</span>}
                      {metric.value && (
                        <span className={`font-semibold ${colors.text}`}>
                          {metric.value}
                        </span>
                      )}
                      {'detail' in metric && metric.detail && <span>{metric.detail}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
