import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import {
  Award,
  ArrowRight,
  PlayCircle,
  CheckCircle,
} from 'lucide-react';
import { HERO_CONTENT } from '@/lib/constants/landing-content';

/**
 * 히어로 섹션 (Server Component)
 *
 * 정적 콘텐츠 → Server Component로 SEO 최적화
 */
export function Hero() {
  return (
    <section className="relative pt-32 pb-20 px-4 overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-64 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-64 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto">
        <div className="text-center mb-12">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm mb-8">
            <Award className="w-4 h-4" />
            {HERO_CONTENT.badge}
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
            {HERO_CONTENT.title.main}
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">
              {HERO_CONTENT.title.highlight}
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto leading-relaxed">
            {HERO_CONTENT.description}
            <br />
            에너지 효율{' '}
            <span className="text-emerald-400 font-semibold">
              {HERO_CONTENT.metrics.efficiency}
            </span>
            , 비용{' '}
            <span className="text-emerald-400 font-semibold">
              {HERO_CONTENT.metrics.savings}
            </span>
            을 경험하세요
          </p>

          {/* CTA Buttons */}
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/register">
              <Button
                size="lg"
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-6 text-lg"
              >
                {HERO_CONTENT.cta.primary}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/demo">
              <Button
                size="lg"
                variant="outline"
                className="px-8 py-6 text-lg"
              >
                <PlayCircle className="mr-2 w-5 h-5" />
                {HERO_CONTENT.cta.secondary}
              </Button>
            </Link>
          </div>

          {/* Trust Indicators */}
          <div className="mt-12 flex items-center justify-center gap-8 text-sm text-slate-400 flex-wrap">
            {HERO_CONTENT.trustIndicators.map((indicator, index) => (
              <div key={index} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                {indicator}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
