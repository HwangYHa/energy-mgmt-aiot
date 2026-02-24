import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Check, ArrowRight, HelpCircle } from 'lucide-react';

/**
 * 가격 플랜 페이지
 */
export const metadata = {
  title: '가격 플랜 - 탄소이음',
  description:
    '무료 Starter부터 Enterprise까지. 탄소이음 에너지 관리 플랫폼의 합리적인 가격 플랜을 비교하세요. 14일 무료 체험 가능.',
  openGraph: {
    title: '가격 플랜 비교 - 탄소이음',
    description: 'Starter(무료) · Professional(₩299,000/월) · Enterprise(맞춤). 14일 무료 체험.',
  },
};

const plans = [
  {
    name: 'Starter',
    price: '무료',
    description: '개인 및 소규모 사업자를 위한 무료 플랜',
    features: [
      '최대 1개 사이트',
      '최대 10개 디바이스',
      '기본 대시보드',
      '7일 데이터 보관',
      '이메일 지원',
    ],
    cta: '무료 시작',
    href: '/register',
    popular: false,
  },
  {
    name: 'Professional',
    price: '₩299,000',
    period: '/ 월',
    description: '중소기업을 위한 전문 플랜',
    features: [
      '최대 5개 사이트',
      '최대 100개 디바이스',
      'AI 예측 및 이상 탐지',
      '30일 데이터 보관',
      '최적화 추천',
      'DR 참여 기능',
      '우선 지원',
      'API 접근',
    ],
    cta: '14일 무료 체험',
    href: '/register?plan=professional',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: '맞춤 견적',
    description: '대기업을 위한 엔터프라이즈 솔루션',
    features: [
      '무제한 사이트',
      '무제한 디바이스',
      '모든 AI 기능',
      '무제한 데이터 보관',
      '탄소 배출 추적',
      '커스텀 통합',
      '전담 계정 매니저',
      'SLA 보장',
      '온프레미스 옵션',
    ],
    cta: '문의하기',
    href: '/support',
    popular: false,
  },
];

export default function PricingPage() {
  return (
    <div className="py-20 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            명확하고 합리적인 가격
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            규모에 맞는 플랜을 선택하세요. 언제든 업그레이드 가능합니다.
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative bg-slate-800 border rounded-2xl p-8 ${
                plan.popular
                  ? 'border-emerald-500 shadow-2xl shadow-emerald-500/20 scale-105'
                  : 'border-slate-700'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-emerald-500 text-white text-sm font-semibold rounded-full">
                  가장 인기있는 플랜
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">
                  {plan.name}
                </h3>
                <p className="text-slate-400 text-sm mb-4">
                  {plan.description}
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-slate-400">{plan.period}</span>
                  )}
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link href={plan.href} className="block">
                <Button
                  size="lg"
                  className={`w-full ${
                    plan.popular
                      ? 'bg-emerald-500 hover:bg-emerald-600'
                      : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  {plan.cta}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            자주 묻는 질문
          </h2>
          <div className="space-y-4">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                플랜을 변경할 수 있나요?
              </h3>
              <p className="text-slate-300 pl-7">
                네, 언제든 플랜을 업그레이드하거나 다운그레이드할 수 있습니다.
                변경은 즉시 적용됩니다.
              </p>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                무료 체험 기간이 끝나면 어떻게 되나요?
              </h3>
              <p className="text-slate-300 pl-7">
                무료 체험 기간이 끝나면 자동으로 유료 플랜으로 전환됩니다.
                원하지 않으시면 체험 기간 중 언제든 취소할 수 있습니다.
              </p>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                환불 정책은 어떻게 되나요?
              </h3>
              <p className="text-slate-300 pl-7">
                14일 이내 100% 환불 보장합니다. 서비스에 만족하지 않으시면
                전액 환불해드립니다.
              </p>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                데이터 보안은 어떻게 되나요?
              </h3>
              <p className="text-slate-300 pl-7">
                모든 데이터는 AES-256으로 암호화되며, ISO 27001 인증 인프라에서 운영됩니다.
                역할 기반 접근 제어(RBAC)와 전체 감사 로그를 제공합니다.
              </p>
            </div>
          </div>

          {/* 전체 FAQ 바로가기 */}
          <div className="mt-8 text-center">
            <p className="text-slate-400 mb-3">더 많은 질문이 있으신가요?</p>
            <Link href="/faq">
              <Button variant="outline" size="lg">
                전체 FAQ 보기
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
