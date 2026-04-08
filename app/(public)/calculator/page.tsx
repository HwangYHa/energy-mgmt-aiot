/**
 * 전기요금 절감 & ROI 계산기
 * /calculator
 *
 * 전환 SEO 핵심 페이지 — BOFU 고전환율 키워드
 * - 전기요금 절감 계산기
 * - EMS ROI 분석
 * - 탄소 배출 절감량 계산
 */

import type { Metadata } from 'next';
import { buildBreadcrumbSchema, buildFaqSchema, serializeJsonLd } from '@/lib/seo/jsonld';
import CalculatorClient from './CalculatorClient';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://carboneum.kr';

export const metadata: Metadata = {
  title: '전기요금 절감 계산기 & EMS ROI 분석 — 무료',
  description:
    '현재 전력 사용량을 입력하면 AI가 연간 절감 가능 금액을 즉시 계산합니다. 제조업·빌딩·데이터센터 맞춤 분석, EMS 도입 투자 회수 기간 자동 산출.',
  keywords: [
    '전기요금 절감 계산기', 'EMS ROI 계산기', '에너지 절감 계산',
    '탄소 배출 계산기', '전력 비용 분석', '에너지 관리 ROI',
  ],
  alternates: { canonical: `${SITE_URL}/calculator` },
  openGraph: {
    title: '무료 전기요금 절감 계산기 — 연간 얼마나 줄일 수 있을까?',
    description: '전력 사용량 입력 → AI 즉시 분석 → 절감 금액·탄소 감축량·ROI 자동 계산.',
    url: `${SITE_URL}/calculator`,
    type: 'website',
  },
};

const CALCULATOR_FAQS = [
  {
    question: '계산 결과는 얼마나 정확한가요?',
    answer: '탄소이음 고객사 평균 데이터 기반으로 산출됩니다. 실제 절감율은 설비 구성, 운영 패턴에 따라 ±20% 차이가 있을 수 있습니다. 정밀 분석은 전문가 상담을 통해 진행됩니다.',
  },
  {
    question: 'EMS 도입 비용은 얼마인가요?',
    answer: '탄소이음은 월 ₩99,000(Basic)부터 시작하는 구독형 SaaS입니다. 초기 IoT 설치비가 별도로 발생하며, 플랜에 따라 ₩0~별도 견적입니다.',
  },
  {
    question: '투자 회수 기간(Payback Period)은 얼마나 되나요?',
    answer: '대부분의 고객사에서 6~18개월 내 투자 회수를 경험합니다. 전기 사용량이 많을수록, 피크 요금 비중이 높을수록 회수 기간이 짧아집니다.',
  },
  {
    question: '탄소 배출 절감량은 어떻게 계산되나요?',
    answer: '한국전력 전력배출계수(0.4781 kgCO₂/kWh, 2023년 기준)를 적용해 계산됩니다. Scope 2 기준이며, 정확한 탄소 회계는 별도 컨설팅을 통해 진행됩니다.',
  },
];

export default function CalculatorPage() {
  const breadcrumb = buildBreadcrumbSchema([
    { name: '홈', url: '/' },
    { name: '전기요금 절감 계산기', url: '/calculator' },
  ]);

  const faqSchema = buildFaqSchema(CALCULATOR_FAQS);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqSchema) }}
      />

      <div className="min-h-screen bg-slate-900">
        {/* ── 헤더 ── */}
        <section className="border-b border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 py-14 px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-xs text-green-400 mb-4">
              무료 분석 도구
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
              전기요금 절감 계산기
            </h1>
            <p className="text-slate-400">
              현재 전력 사용량을 입력하면 AI가 <strong className="text-white">연간 절감 가능 금액</strong>과
              {' '}<strong className="text-white">EMS 투자 회수 기간</strong>을 즉시 계산합니다.
            </p>
          </div>
        </section>

        {/* ── 계산기 (클라이언트 컴포넌트) ── */}
        <CalculatorClient />

        {/* ── FAQ ── */}
        <section className="max-w-3xl mx-auto px-4 py-16">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">자주 묻는 질문</h2>
          <div className="space-y-4">
            {CALCULATOR_FAQS.map((faq, i) => (
              <div key={i} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-2">Q. {faq.question}</h3>
                <p className="text-sm text-slate-400">A. {faq.answer}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
