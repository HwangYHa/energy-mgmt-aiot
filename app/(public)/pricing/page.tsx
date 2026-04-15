import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import {
  Check, ArrowRight, HelpCircle, Zap, TrendingUp,
  Shield, Building2, AlertTriangle, Phone,
} from 'lucide-react';

/**
 * 가격 플랜 페이지 — 탄소이음
 *
 * 전략: 다이소 공식 적용
 *   ① 명확한 공식: 월 전기요금 X → 10% 절감 → 비용 Y → ROI Z
 *   ② 심리 가격대: ₩99K(10만 미만) / ₩290K(30만 미만)
 *   ③ 빠른 BEP: Pro 1명 or Basic 3명 = 운영비 커버
 *   ④ 성장 공식: 인스타 광고 → 체험 → 유료 전환 → 소개
 */
export const metadata = {
  title: '가격 플랜 - 탄소이음 | 월 ₩99,000부터 전기요금 10% 절감',
  description:
    '월 ₩99,000부터. 전기요금 10% 절감 보장. 무료 체험 → Basic ₩99K → Professional ₩290K → Enterprise 맞춤견적. 첫달부터 ROI.',
  openGraph: {
    title: '탄소이음 가격 플랜 | 월 ₩99,000부터 에너지 절감 시작',
    description: '무료(Starter) · Basic ₩99,000/월 · Pro ₩290,000/월 · Enterprise 맞춤견적. 신용카드 없이 30일 무료 체험.',
  },
};

// ─── 비용 구조 공식 ────────────────────────────────────────────────────────────
const ROI_EXAMPLES = [
  {
    monthlyBill: '₩1,000,000',
    saving10pct: '₩100,000',
    plan: 'Basic',
    planCost: '₩99,000',
    roi: '1.01x',
    color: 'blue',
  },
  {
    monthlyBill: '₩3,000,000',
    saving10pct: '₩300,000',
    plan: 'Professional',
    planCost: '₩290,000',
    roi: '1.03x',
    color: 'cyan',
  },
  {
    monthlyBill: '₩10,000,000',
    saving10pct: '₩1,000,000',
    plan: 'Professional',
    planCost: '₩290,000',
    roi: '3.4x',
    color: 'emerald',
  },
];

// ─── 플랜 정의 ─────────────────────────────────────────────────────────────────
const plans = [
  {
    tier: 'trial',
    name: 'Starter',
    price: '무료',
    period: null,
    yearlyPrice: null,
    setupFee: null,
    description: '무료 체험 — 신용카드 불필요',
    highlight: '30일 무제한 체험',
    features: [
      { label: '사이트 1개', ok: true },
      { label: 'IoT 센서 3개 (체험용)', ok: true },
      { label: '사용자 2명', ok: true },
      { label: '실시간 모니터링', ok: true },
      { label: '수동 제어', ok: true },
      { label: 'Excel 내보내기', ok: true },
      { label: '데이터 30일 보관', ok: true },
      { label: 'AI 예측', ok: false },
      { label: '탄소 회계', ok: false },
    ],
    cta: '무료 시작',
    href: '/register',
    popular: false,
    badge: null,
    color: 'slate',
  },
  {
    tier: 'basic',
    name: 'Basic',
    price: '₩99,000',
    period: '/ 월',
    yearlyPrice: '₩990,000 / 년 (₩82,500/월)',
    setupFee: '초기 설치비 ₩300,000 (원격 지원)',
    description: '월 전기요금 ₩1M+ 소규모 공장·건물',
    highlight: '첫 달부터 ROI',
    features: [
      { label: '사이트 3개', ok: true },
      { label: 'IoT 디바이스 50개', ok: true },
      { label: '사용자 10명', ok: true },
      { label: 'AI 부하 예측', ok: true },
      { label: '스케줄 자동 제어', ok: true },
      { label: '탄소 회계 (Scope 1·2)', ok: true },
      { label: 'PDF·Excel 보고서', ok: true },
      { label: '감사 로그', ok: true },
      { label: '데이터 1년 보관', ok: true },
      { label: 'AI 이상 감지', ok: false },
      { label: 'DR 이벤트', ok: false },
      { label: 'ESG 컴플라이언스', ok: false },
    ],
    cta: '지금 시작',
    href: '/register?plan=basic',
    popular: false,
    badge: null,
    color: 'blue',
  },
  {
    tier: 'pro',
    name: 'Professional',
    price: '₩290,000',
    period: '/ 월',
    yearlyPrice: '₩2,900,000 / 년 (₩241,667/월)',
    setupFee: '초기 설치비 ₩1,500,000 (현장 방문)',
    description: '월 전기요금 ₩3M+ 중견 공장·복합시설',
    highlight: 'AI·DR·ESG 완전 대응',
    features: [
      { label: '사이트 10개', ok: true },
      { label: 'IoT 디바이스 200개', ok: true },
      { label: '사용자 50명', ok: true },
      { label: 'AI 부하 예측 + 이상 감지', ok: true },
      { label: 'DR 이벤트 관리', ok: true },
      { label: '최적화 자동 제어', ok: true },
      { label: '탄소 회계 (Scope 1·2·3)', ok: true },
      { label: 'ESG 컴플라이언스 보고', ok: true },
      { label: 'SMS 알림', ok: true },
      { label: 'Webhook 연동', ok: true },
      { label: '우선 기술 지원', ok: true },
      { label: '데이터 2년 보관', ok: true },
    ],
    cta: '14일 무료 체험',
    href: '/register?plan=pro',
    popular: true,
    badge: '인기',
    color: 'cyan',
  },
  {
    tier: 'enterprise',
    name: 'Enterprise',
    price: '맞춤 견적',
    period: null,
    yearlyPrice: null,
    setupFee: '설치·공사비 별도 견적',
    description: '월 전기요금 ₩30M+ 대규모 공단·데이터센터',
    highlight: '전담 PM + SLA 99.9%',
    features: [
      { label: '사이트·디바이스 무제한', ok: true },
      { label: '사용자 무제한', ok: true },
      { label: '모든 AI 기능', ok: true },
      { label: 'SSO 통합 (SAML/OIDC)', ok: true },
      { label: '전담 계정 매니저', ok: true },
      { label: '맞춤형 PLC/SCADA 연동', ok: true },
      { label: 'SLA 99.9% 보장', ok: true },
      { label: 'Big4 감사 대응 (Hash Chain)', ok: true },
      { label: '온프레미스 옵션', ok: true },
      { label: '데이터 3년 보관', ok: true },
    ],
    cta: '문의하기',
    href: '/support',
    popular: false,
    badge: null,
    color: 'purple',
  },
];

// ─── 기능 비교표 ──────────────────────────────────────────────────────────────
const FEATURE_TABLE = [
  { category: '모니터링', items: [
    { label: '실시간 대시보드',    trial: true,  basic: true,  pro: true,  enterprise: true  },
    { label: 'AI 부하 예측',        trial: false, basic: true,  pro: true,  enterprise: true  },
    { label: 'AI 이상 감지',        trial: false, basic: false, pro: true,  enterprise: true  },
  ]},
  { category: '제어·최적화', items: [
    { label: '수동 제어',           trial: true,  basic: true,  pro: true,  enterprise: true  },
    { label: '스케줄 자동 제어',    trial: false, basic: true,  pro: true,  enterprise: true  },
    { label: '최적화 제어',         trial: false, basic: false, pro: true,  enterprise: true  },
    { label: 'DR 이벤트',           trial: false, basic: false, pro: true,  enterprise: true  },
  ]},
  { category: '탄소·ESG', items: [
    { label: '탄소 회계 (Scope 1·2)',  trial: false, basic: true,  pro: true,  enterprise: true  },
    { label: '탄소 회계 (Scope 3)',    trial: false, basic: false, pro: true,  enterprise: true  },
    { label: 'ESG 컴플라이언스',       trial: false, basic: false, pro: true,  enterprise: true  },
    { label: '탄소 배출권 거래',       trial: false, basic: false, pro: false, enterprise: true  },
  ]},
  { category: '보고서·알림', items: [
    { label: 'Excel 내보내기',      trial: true,  basic: true,  pro: true,  enterprise: true  },
    { label: 'PDF 보고서',          trial: false, basic: true,  pro: true,  enterprise: true  },
    { label: '이메일 알림',         trial: true,  basic: true,  pro: true,  enterprise: true  },
    { label: 'SMS 알림',            trial: false, basic: false, pro: true,  enterprise: true  },
    { label: 'Webhook 연동',        trial: false, basic: false, pro: true,  enterprise: true  },
  ]},
  { category: '관리·지원', items: [
    { label: '감사 로그',           trial: false, basic: true,  pro: true,  enterprise: true  },
    { label: 'API 접근',            trial: false, basic: true,  pro: true,  enterprise: true  },
    { label: 'SSO (SAML/OIDC)',     trial: false, basic: false, pro: false, enterprise: true  },
    { label: '전담 매니저',         trial: false, basic: false, pro: false, enterprise: true  },
    { label: 'SLA 보장',            trial: false, basic: false, pro: false, enterprise: true  },
  ]},
];

const TIER_KEYS = ['trial', 'basic', 'pro', 'enterprise'] as const;
const TIER_LABELS: Record<string, string> = { trial: 'Starter', basic: 'Basic', pro: 'Pro', enterprise: 'Ent.' };
const TIER_COLORS: Record<string, string> = {
  trial:      'text-slate-400',
  basic:      'text-blue-400',
  pro:        'text-cyan-400',
  enterprise: 'text-purple-400',
};

// ─── FAQ ──────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: '설치비가 별도인가요?',
    a: 'Basic은 원격 설치 지원 ₩300,000, Professional은 현장 방문 설치 ₩1,500,000입니다. 하드웨어(게이트웨이·센서)는 별도 구매하시며, 저희가 추천 제품을 안내해 드립니다. 모든 금액은 VAT 별도입니다.',
  },
  {
    q: '진짜로 전기요금 10% 절감이 가능한가요?',
    a: '업종별 실제 도입 사례 기준으로 제조업 20~35%, 건물 30~45%, 데이터센터 25~45% 절감을 달성했습니다. 절감 계산기로 귀사의 예상 절감액을 직접 확인해보세요.',
  },
  {
    q: '무료 체험은 신용카드가 필요한가요?',
    a: '필요 없습니다. 이메일만으로 30일 무제한 체험이 가능합니다. 체험 종료 후 자동 과금은 없으며, 원하시면 그때 플랜을 선택하시면 됩니다.',
  },
  {
    q: '연간 결제 시 혜택이 있나요?',
    a: '연간 결제 시 17% 할인됩니다. Basic은 ₩990,000/년(월 ₩82,500), Professional은 ₩2,900,000/년(월 ₩241,667)입니다. 연간 결제는 미리 전액을 납부하시면 됩니다.',
  },
  {
    q: '플랜을 중간에 변경할 수 있나요?',
    a: '언제든 업그레이드·다운그레이드 가능합니다. 업그레이드는 즉시 반영되며, 미사용 금액은 비례 환급 또는 크레딧으로 처리됩니다.',
  },
  {
    q: '환불 정책은?',
    a: '결제 후 14일 이내 100% 환불 보장합니다. 서비스에 만족하지 않으시면 이유 없이 전액 환불해드립니다. 고객센터(support@carbonieum.co.kr)로 연락해 주세요.',
  },
  {
    q: 'Enterprise 최소 비용은 얼마인가요?',
    a: '사이트 수, 디바이스 수, 커스텀 연동 복잡도에 따라 다릅니다. 내부 최저 기준선은 월 ₩890,000이며, 대규모 멀티 사이트의 경우 맞춤 견적을 제공합니다.',
  },
];

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────
export default function PricingPage() {
  return (
    <div className="py-16 px-4 bg-slate-950">
      <div className="max-w-7xl mx-auto">

        {/* ── 헤더: 다이소 공식 메시지 ── */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-1.5 rounded-full mb-5">
            <Zap className="w-4 h-4" />
            전기요금 10% 절감 공식
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            월 ₩99,000부터<br />
            <span className="text-emerald-400">첫 달부터 ROI</span>
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-2">
            플랜 비용 ≤ 전기요금 절감액 — 명확한 공식, 즉각적인 효과
          </p>
          <p className="text-sm text-slate-500">
            신용카드 없이 30일 무료 체험 · 언제든 취소 · 14일 환불 보장
          </p>
        </div>

        {/* ── ROI 공식 카드 ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-14">
          {ROI_EXAMPLES.map((ex) => (
            <div key={ex.monthlyBill} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
              <div className="text-xs text-slate-500 mb-3 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" /> 월 전기요금 {ex.monthlyBill}
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 text-center">
                  <div className="text-xs text-slate-400">10% 절감</div>
                  <div className="text-lg font-bold text-emerald-400">{ex.saving10pct}</div>
                </div>
                <div className="text-slate-600">−</div>
                <div className="flex-1 text-center">
                  <div className="text-xs text-slate-400">{ex.plan} 비용</div>
                  <div className="text-lg font-bold text-white">{ex.planCost}</div>
                </div>
                <div className="text-slate-600">=</div>
                <div className="flex-1 text-center">
                  <div className="text-xs text-slate-400">ROI</div>
                  <div className={`text-lg font-bold text-${ex.color}-400`}>{ex.roi}</div>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 text-center">
                ※ 업종·운영 패턴에 따라 달라질 수 있습니다
              </div>
            </div>
          ))}
        </div>

        {/* ── 플랜 카드 그리드 ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-16">
          {plans.map((plan) => (
            <div
              key={plan.tier}
              className={`relative flex flex-col bg-slate-800 border rounded-2xl p-6 ${
                plan.popular
                  ? 'border-cyan-500 shadow-2xl shadow-cyan-500/20 scale-[1.02]'
                  : 'border-slate-700'
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-cyan-500 text-white text-xs font-bold rounded-full whitespace-nowrap">
                  {plan.badge}
                </div>
              )}

              {/* 플랜 헤더 */}
              <div className="mb-5">
                <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                <p className="text-xs text-slate-400 mb-3">{plan.description}</p>

                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-bold text-white">{plan.price}</span>
                  {plan.period && <span className="text-slate-400 text-sm">{plan.period}</span>}
                </div>

                {plan.yearlyPrice && (
                  <div className="text-xs text-emerald-400 mb-1">
                    연간: {plan.yearlyPrice}
                  </div>
                )}
                {plan.setupFee && (
                  <div className="text-xs text-slate-500">{plan.setupFee}</div>
                )}

                <div className="mt-2 text-[11px] text-slate-400 bg-slate-700/50 rounded px-2 py-1">
                  {plan.highlight}
                </div>
              </div>

              {/* 기능 목록 */}
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    {f.ok
                      ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      : <span className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-600 text-center">—</span>
                    }
                    <span className={f.ok ? 'text-slate-200' : 'text-slate-500'}>{f.label}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link href={plan.href} className="block mt-auto">
                <Button
                  size="lg"
                  className={`w-full text-sm py-2.5 ${
                    plan.popular
                      ? 'bg-cyan-500 hover:bg-cyan-400 text-white'
                      : plan.tier === 'trial'
                      ? 'bg-slate-700 hover:bg-slate-600 text-white'
                      : plan.tier === 'enterprise'
                      ? 'bg-purple-600 hover:bg-purple-500 text-white'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  {plan.cta}
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </div>
          ))}
        </div>

        {/* ── VAT 안내 배너 ── */}
        <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4 mb-14 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-slate-400">
            모든 가격은 <span className="text-white font-medium">VAT 별도</span>입니다.
            초기 설치비는 원격(Basic) 또는 현장 방문(Pro) 설치 인건비이며,
            하드웨어(게이트웨이·센서)는 별도 구매하셔야 합니다.
            Enterprise는 설치·공사비 별도 견적 진행합니다.
          </p>
        </div>

        {/* ── 기능 비교표 ── */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">전체 기능 비교</h2>
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
            {/* 테이블 헤더 */}
            <div className="grid grid-cols-5 border-b border-slate-700/50 bg-slate-800">
              <div className="p-4 text-sm font-medium text-slate-400">기능</div>
              {TIER_KEYS.map(t => (
                <div key={t} className={`p-4 text-center text-sm font-bold ${TIER_COLORS[t]}`}>
                  {TIER_LABELS[t]}
                </div>
              ))}
            </div>
            {/* 카테고리별 행 */}
            {FEATURE_TABLE.map((group) => (
              <div key={group.category}>
                <div className="grid grid-cols-5 bg-slate-800/80 border-b border-slate-700/30">
                  <div className="col-span-5 px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {group.category}
                  </div>
                </div>
                {group.items.map((item) => (
                  <div key={item.label} className="grid grid-cols-5 border-b border-slate-700/20 hover:bg-slate-800/30">
                    <div className="px-4 py-2.5 text-sm text-slate-300">{item.label}</div>
                    {TIER_KEYS.map(t => {
                      const val = item[t as keyof typeof item] as boolean;
                      return (
                        <div key={t} className="px-4 py-2.5 text-center">
                          {val
                            ? <Check className={`w-4 h-4 mx-auto ${TIER_COLORS[t]}`} />
                            : <span className="text-slate-700 text-sm">—</span>
                          }
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── 절감 계산기 링크 ── */}
        <div className="bg-gradient-to-r from-emerald-900/30 to-cyan-900/30 border border-emerald-500/20 rounded-2xl p-8 mb-16 text-center">
          <TrendingUp className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">우리 회사 절감액, 직접 계산해보세요</h2>
          <p className="text-slate-300 mb-6 max-w-xl mx-auto">
            월 전력 사용량과 업종을 입력하면 예상 절감액·CO₂ 감축량·투자 회수 기간을 즉시 계산합니다.
          </p>
          <Link href="/calculator">
            <Button size="lg" className="bg-emerald-600 hover:bg-emerald-500 text-white">
              무료 절감 계산기 사용하기
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>

        {/* ── FAQ ── */}
        <div className="max-w-3xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">자주 묻는 질문</h2>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  {faq.q}
                </h3>
                <p className="text-sm text-slate-300 pl-6">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Enterprise CTA ── */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 text-center">
          <Shield className="w-10 h-10 text-purple-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">대규모 조직을 위한 Enterprise</h2>
          <p className="text-slate-300 mb-2 max-w-xl mx-auto">
            월 전기요금 ₩30M 이상 공장·복합단지·데이터센터.<br />
            전담 PM, 맞춤 PLC/SCADA 연동, SLA 99.9% 보장, Big4 감사 대응.
          </p>
          <p className="text-sm text-slate-500 mb-6">내부 기준선 ₩890,000/월부터 · 규모에 따라 맞춤 견적</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/support">
              <Button size="lg" className="bg-purple-600 hover:bg-purple-500 text-white">
                도입 문의하기
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/calculator">
              <Button size="lg" variant="outline" className="border-slate-600 text-slate-300">
                <Phone className="mr-2 w-4 h-4" />
                절감 효과 계산하기
              </Button>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
