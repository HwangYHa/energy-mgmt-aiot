import Link from 'next/link';
import { Check, ArrowRight, HelpCircle, TrendingDown, Zap, BarChart2, Shield, Building2, AlertCircle, Wrench } from 'lucide-react';

/**
 * 가격 플랜 페이지 — ROI 기반 가격 산정
 * "기능이 아니라 절감 효과를 삽니다"
 */
export const metadata = {
  title: '가격 플랜 - 탄소이음',
  description: '에너지 절감액 기반 구독 가격. 월 전기료의 1~3%로 최대 8% 에너지 절감. 스타터 ₩99,000 · 비즈니스 ₩299,000 · 엔터프라이즈 ₩790,000~',
  openGraph: {
    title: '가격 플랜 - 탄소이음 에너지 관리 플랫폼',
    description: 'ROI 기반 구독료. 절감액의 5~15% 수준으로 설계된 합리적인 가격.',
  },
};

const plans = [
  {
    id: 'trial',
    name: '체험판',
    badge: '14일 무료',
    badgeColor: 'bg-slate-600',
    price: '₩0',
    period: '',
    setupFee: null,
    yearlyPrice: null,
    description: '14일간 모든 기능 무제한 체험',
    roi: null,
    target: '도입 검토 중인 사업장',
    limits: '1 사이트 · 10 디바이스 · 데이터 30일',
    features: [
      '실시간 에너지 모니터링',
      '기본 대시보드',
      '전력 소비 분석',
      '게이트웨이 1대 연동',
      '이메일 알림',
    ],
    cta: '무료 체험 시작',
    href: '/register',
    highlight: false,
    popular: false,
  },
  {
    id: 'basic',
    name: '스타터',
    badge: null,
    badgeColor: '',
    price: '₩99,000',
    period: '/ 월',
    setupFee: null,
    yearlyPrice: '₩990,000',
    description: '소규모 사업장·공장을 위한 입문 플랜',
    roi: '월 전기료 500만원 기준 절감 40만원+',
    target: '소형 공장 · 상가 · 소규모 제조업',
    limits: '1 사이트 · 20 디바이스 · 데이터 90일',
    features: [
      '실시간 에너지 모니터링',
      '월별·일별 소비 분석 리포트',
      '이상 탐지 알림',
      '에너지 절감 추천',
      '탄소 배출량 기본 계산',
      '카카오/이메일 알림',
    ],
    cta: '스타터 시작',
    href: '/register?plan=basic',
    highlight: false,
    popular: false,
  },
  {
    id: 'pro',
    name: '비즈니스',
    badge: '가장 인기',
    badgeColor: 'bg-emerald-500',
    price: '₩299,000',
    period: '/ 월',
    setupFee: '₩500,000 (구축비)',
    yearlyPrice: '₩2,990,000',
    description: '중소기업 에너지·탄소 통합 관리',
    roi: '월 전기료 2,000만원 기준 절감 160만원+',
    target: '중소 제조업 · 프랜차이즈 · 물류창고',
    limits: '5 사이트 · 100 디바이스 · 데이터 365일',
    features: [
      '스타터 모든 기능 포함',
      'AI 에너지 예측 및 이상 탐지',
      '자동 ESG·탄소 리포트 생성',
      'DR(수요반응) 참여 기능',
      '업종 벤치마킹 비교',
      'ROI 절감액 자동 계산',
      'API 연동 (ERP 연동 기반)',
      '멀티 사이트 통합 관리',
      '우선 기술 지원',
    ],
    cta: '14일 무료 체험',
    href: '/register?plan=pro',
    highlight: true,
    popular: true,
  },
  {
    id: 'enterprise',
    name: '엔터프라이즈',
    badge: '맞춤 견적',
    badgeColor: 'bg-purple-600',
    price: '₩790,000~',
    period: '/ 월',
    setupFee: '₩1,500,000~ (구축비)',
    yearlyPrice: '₩7,900,000~',
    description: '대기업·공공기관을 위한 완전 맞춤 솔루션',
    roi: '월 전기료 5,000만원 기준 절감 400만원+',
    target: '대기업 · 공공기관 · 대형 제조사',
    limits: '무제한 사이트 · 무제한 디바이스 · 영구 보관',
    features: [
      '비즈니스 모든 기능 포함',
      'ERP/MES/SCADA 완전 연동',
      'Big4 감사 대응 ESG 보고서',
      'ISO 50001 인증 대응',
      'K-ETS 탄소배출권 연동',
      '화이트 레이블 (브랜드 커스텀)',
      '전담 계정 매니저',
      'SLA 99.9% 보장',
      '온프레미스 배포 옵션',
    ],
    cta: '도입 문의',
    href: '/support?category=enterprise',
    highlight: false,
    popular: false,
  },
];

const roiCalcData = [
  { monthly: '500만원', savings: '~40만원', cost: '₩9.9만', roi: '4.0x' },
  { monthly: '1,000만원', savings: '~80만원', cost: '₩9.9만', roi: '8.0x' },
  { monthly: '2,000만원', savings: '~160만원', cost: '₩29.9만', roi: '5.3x' },
  { monthly: '5,000만원', savings: '~400만원', cost: '₩79만', roi: '5.0x' },
];

const faqs = [
  {
    q: '구축비는 무엇인가요?',
    a: '게이트웨이 연동 설정, 초기 데이터 마이그레이션, 운영자 교육 등 최초 도입 시 1회 발생하는 비용입니다. 스타터 플랜은 셀프 온보딩으로 구축비가 없으며, 비즈니스 이상부터 현장 여건에 따라 조정 가능합니다.',
  },
  {
    q: '실제로 에너지가 얼마나 절감되나요?',
    a: '고객사 평균 5~12% 절감 효과를 확인했습니다. 월 전기료 1,000만원 사업장 기준 연간 600만원~1,440만원 절감이 가능하며, 구독료 대비 평균 5배 이상의 ROI를 제공합니다.',
  },
  {
    q: '플랜 변경이 가능한가요?',
    a: '네, 언제든 업그레이드 또는 다운그레이드 가능합니다. 업그레이드는 즉시 적용되며, 다운그레이드는 현재 구독 기간 종료 후 적용됩니다.',
  },
  {
    q: 'ESG·탄소 보고서 자동 생성이 어떻게 되나요?',
    a: 'GHG Protocol Scope 1·2·3 기반 탄소 배출량을 자동 계산하고, PDF/Excel 형식으로 보고서를 생성합니다. 비즈니스 이상 플랜에서는 환경부 제출용 양식 및 Big4 회계법인 감사 대응 해시체인 감사 로그를 지원합니다.',
  },
  {
    q: 'DR(수요반응) 참여 기능이란 무엇인가요?',
    a: '한전 수요반응 프로그램 참여를 지원합니다. 피크 시간대 자동 부하 조절 제안과 DR 이벤트 알림을 통해 전기요금 추가 절감 및 수익을 얻을 수 있습니다.',
  },
  {
    q: '환불 정책은?',
    a: '월 구독료는 구독 시작 후 7일 이내 환불 가능합니다. 구축비는 현장 작업 착수 전까지 환불 가능하며, 착수 이후에는 진행률에 따라 정산합니다.',
  },
];

export default function PricingPage() {
  return (
    <div className="py-16 px-4 bg-slate-950">
      <div className="max-w-7xl mx-auto">

        {/* ── Hero ── */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-sm text-emerald-400 font-medium mb-6">
            <TrendingDown className="w-4 h-4" />
            절감액의 5~15% 수준으로 설계된 가격
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-4 leading-tight">
            기능이 아니라<br />
            <span className="text-emerald-400">절감 효과</span>를 사세요
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            월 전기료의 1~3% 투자로 최대 8~12% 에너지 절감.<br />
            구독료 대비 평균 <span className="text-white font-semibold">5배 ROI</span>를 경험하세요.
          </p>
        </div>

        {/* ── ROI 빠른 계산기 ── */}
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-12 max-w-3xl mx-auto">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-emerald-400" />
            예상 절감액 빠른 계산
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs border-b border-slate-800">
                  <th className="py-2 text-left">월 전기료</th>
                  <th className="py-2 text-right">예상 절감 (8%)</th>
                  <th className="py-2 text-right">추천 플랜</th>
                  <th className="py-2 text-right">투자 대비 절감</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {roiCalcData.map(r => (
                  <tr key={r.monthly} className="text-white">
                    <td className="py-2.5">{r.monthly}</td>
                    <td className="py-2.5 text-right text-emerald-400 font-bold">{r.savings}</td>
                    <td className="py-2.5 text-right text-slate-300">{r.cost}/월</td>
                    <td className="py-2.5 text-right text-yellow-400 font-bold">{r.roi} ROI</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-600 mt-3">* 절감율은 도입 사례 평균 기준이며 사업장 환경에 따라 차이가 있습니다.</p>
        </div>

        {/* ── Plans Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-16">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-slate-900 border rounded-2xl flex flex-col transition-all ${
                plan.highlight
                  ? 'border-emerald-500 shadow-2xl shadow-emerald-500/15 scale-[1.02]'
                  : 'border-slate-700 hover:border-slate-600'
              }`}
            >
              {plan.badge && (
                <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 ${plan.badgeColor} text-white text-xs font-bold rounded-full whitespace-nowrap`}>
                  {plan.badge}
                </div>
              )}

              <div className="p-6 flex-1">
                {/* 헤더 */}
                <div className="mb-5">
                  <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                  <p className="text-slate-400 text-xs mb-4">{plan.description}</p>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-3xl font-black text-white">{plan.price}</span>
                    {plan.period && <span className="text-slate-400 text-sm">{plan.period}</span>}
                  </div>
                  {plan.yearlyPrice && (
                    <p className="text-xs text-slate-500">연간 {plan.yearlyPrice} <span className="text-emerald-400">(2개월 무료)</span></p>
                  )}
                  {plan.setupFee && (
                    <p className="text-xs text-amber-400/80 mt-1 flex items-center gap-1">
                      <Wrench className="w-3 h-3" /> 초기 구축비 {plan.setupFee}
                    </p>
                  )}
                </div>

                {/* ROI 어필 */}
                {plan.roi && (
                  <div className="bg-emerald-500/8 border border-emerald-500/15 rounded-lg px-3 py-2 mb-4">
                    <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                      <TrendingDown className="w-3 h-3" />
                      {plan.roi}
                    </p>
                  </div>
                )}

                {/* 대상 + 제한 */}
                <div className="mb-4 space-y-1">
                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Building2 className="w-3 h-3 shrink-0" />
                    {plan.target}
                  </p>
                  <p className="text-[11px] text-slate-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {plan.limits}
                  </p>
                </div>

                {/* 기능 목록 */}
                <ul className="space-y-2">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA */}
              <div className="p-6 pt-0">
                <Link href={plan.href}>
                  <button className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition ${
                    plan.highlight
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      : plan.id === 'enterprise'
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-slate-700 hover:bg-slate-600 text-white'
                  }`}>
                    {plan.cta}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* ── 가치 제안 섹션 ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {[
            {
              icon: TrendingDown,
              title: '검증된 절감 효과',
              desc: '고객사 평균 8% 에너지 절감. 월 전기료 1,000만원 기준 연 960만원 절감, 구독료 대비 8배 ROI.',
              color: 'text-emerald-400',
            },
            {
              icon: Shield,
              title: 'ESG·규제 대응 완비',
              desc: 'GHG Protocol 기반 탄소 감사 추적, Big4 대응 해시체인, ISO 50001 자료 자동 생성.',
              color: 'text-blue-400',
            },
            {
              icon: Zap,
              title: '72시간 내 가동',
              desc: 'Gateway 연결 → 데이터 수집 → 대시보드 확인까지 최소 72시간. 현장 방문 없이 원격 세팅 가능.',
              color: 'text-yellow-400',
            },
          ].map(v => (
            <div key={v.title} className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
              <v.icon className={`w-8 h-8 ${v.color} mx-auto mb-3`} />
              <h3 className="font-bold text-white mb-2">{v.title}</h3>
              <p className="text-sm text-slate-400">{v.desc}</p>
            </div>
          ))}
        </div>

        {/* ── FAQ ── */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-8">자주 묻는 질문</h2>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="font-semibold text-white mb-2 flex items-center gap-2 text-sm">
                  <HelpCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  {faq.q}
                </h3>
                <p className="text-slate-400 text-sm pl-6 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── CTA 바 ── */}
        <div className="mt-16 bg-gradient-to-r from-emerald-900/40 to-slate-900 border border-emerald-700/30 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-2">ROI 시뮬레이션이 필요하신가요?</h2>
          <p className="text-slate-300 mb-6 text-sm">사업장 규모와 현재 전기료를 알려주시면 맞춤형 절감 시뮬레이션을 제공해드립니다.</p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/support?category=roi_simulation">
              <button className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold transition flex items-center gap-2">
                <BarChart2 className="w-4 h-4" /> ROI 시뮬레이션 요청
              </button>
            </Link>
            <Link href="/register">
              <button className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold transition">
                14일 무료 체험
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
