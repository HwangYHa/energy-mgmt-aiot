import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { ArrowRight, Shield, Users, Award } from 'lucide-react';
import { TRUST_BADGES } from '@/lib/constants/landing-content';

/**
 * CTA 섹션 (Server Component)
 *
 * 전환 유도 섹션
 */
export function CTASection() {
  const iconMap = {
    Shield,
    Users,
    Award,
  } as const;

  return (
    <section className="py-20 px-4 bg-gradient-to-r from-emerald-600/20 to-blue-600/20 border-y border-slate-700">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
          지금 바로 시작하세요
        </h2>
        <p className="text-xl text-slate-300 mb-8 leading-relaxed">
          14일 무료 체험으로 에너지 효율을 높이고 비용을 절감하세요.
          <br />
          신용카드 등록 불필요, 언제든 취소 가능합니다.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/register">
            <Button
              size="lg"
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-6 text-lg"
            >
              무료로 시작하기
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
          <Link href="/login">
            <Button
              size="lg"
              variant="outline"
              className="px-8 py-6 text-lg"
            >
              로그인
            </Button>
          </Link>
        </div>

        {/* Trust Badges */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-slate-400">
          {TRUST_BADGES.map((badge, index) => {
            const Icon = iconMap[badge.icon as keyof typeof iconMap];
            return (
              <div key={index} className="flex items-center gap-2">
                <Icon className="w-5 h-5 text-emerald-400" />
                {badge.label}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
