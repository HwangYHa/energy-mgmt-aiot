import { TESTIMONIALS } from '@/lib/constants/landing-content';

/**
 * 고객 후기 섹션 (Server Component)
 */
export function SocialProof() {
  const colorClasses = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
  } as const;

  return (
    <section className="py-20 px-4 bg-slate-800/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            신뢰받는 플랫폼
          </h2>
          <p className="text-xl text-slate-300">
            1,000+ 기업이 선택한 에너지 관리 솔루션
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TESTIMONIALS.map((testimonial) => (
            <div
              key={testimonial.id}
              className="bg-slate-800 border border-slate-700 rounded-xl p-8 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-center gap-4 mb-4">
                <div
                  className={`w-12 h-12 ${
                    colorClasses[testimonial.color as keyof typeof colorClasses]
                  } rounded-full flex items-center justify-center text-white font-bold`}
                >
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="font-semibold text-white">
                    {testimonial.name}
                  </div>
                  <div className="text-sm text-slate-400">
                    {testimonial.role}
                  </div>
                </div>
              </div>
              <p className="text-slate-300 leading-relaxed">
                {testimonial.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
