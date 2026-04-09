/**
 * 전기요금 절감 계산기 — 클라이언트 컴포넌트
 * ROI·탄소 배출 절감량·Payback Period 실시간 계산
 */

'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Zap, Leaf, TrendingUp, DollarSign,
  Calculator, ArrowRight, Info,
} from 'lucide-react';

// ── 상수 ──────────────────────────────────────────────────────────

/** 한국전력 배출계수 2023 (kgCO₂/kWh) */
const EMISSION_FACTOR = 0.4781;

/** 산업유형별 절감율 예상 */
const INDUSTRY_REDUCTION: Record<string, { min: number; max: number; avg: number }> = {
  manufacturing: { min: 0.20, max: 0.35, avg: 0.28 },
  building:      { min: 0.30, max: 0.45, avg: 0.38 },
  datacenter:    { min: 0.25, max: 0.45, avg: 0.35 },
  franchise:     { min: 0.15, max: 0.25, avg: 0.20 },
  other:         { min: 0.15, max: 0.30, avg: 0.22 },
};

/** 플랜별 월 구독료 */
const PLAN_COST: Record<string, number> = {
  basic:      99000,
  pro:       299000,
  enterprise: 500000, // 평균 견적
};

/** 설치비 (IoT 기본 패키지) */
const INSTALLATION_COST: Record<string, number> = {
  basic:       500000,
  pro:       1500000,
  enterprise: 5000000,
};

type IndustryType = keyof typeof INDUSTRY_REDUCTION;

// ── 계산 로직 ─────────────────────────────────────────────────────

interface CalcResult {
  annualCostSaving:   number;   // 연간 절감 금액 (원)
  monthlyCostSaving:  number;
  annualCO2Saving:    number;   // 연간 CO₂ 절감 (톤)
  paybackMonths:      number;   // 투자 회수 기간 (월)
  threeYearROI:       number;   // 3년 ROI (%)
  reductionRate:      number;   // 절감율
}

function calculate(
  monthlyKwh: number,
  unitPrice: number,           // 원/kWh
  industryType: IndustryType,
  plan: string,
): CalcResult {
  const reduction = INDUSTRY_REDUCTION[industryType]?.avg ?? 0.22;
  const annualKwh = monthlyKwh * 12;
  const currentAnnualCost = annualKwh * unitPrice;

  const annualCostSaving  = currentAnnualCost * reduction;
  const monthlyCostSaving = annualCostSaving / 12;
  const annualCO2Saving   = annualKwh * reduction * EMISSION_FACTOR / 1000; // 톤

  const planMonthly     = PLAN_COST[plan] ?? 299000;
  const planInstall     = INSTALLATION_COST[plan] ?? 1500000;
  const totalFirstYearCost = planMonthly * 12 + planInstall;
  const paybackMonths = monthlyCostSaving > 0
    ? Math.ceil(totalFirstYearCost / monthlyCostSaving)
    : 999;

  const threeYearSaving = annualCostSaving * 3 - totalFirstYearCost - planMonthly * 12 * 2;
  const threeYearROI = totalFirstYearCost > 0
    ? Math.round((threeYearSaving / (totalFirstYearCost + planMonthly * 12 * 2)) * 100)
    : 0;

  return {
    annualCostSaving:  Math.round(annualCostSaving),
    monthlyCostSaving: Math.round(monthlyCostSaving),
    annualCO2Saving:   Math.round(annualCO2Saving * 10) / 10,
    paybackMonths:     Math.min(paybackMonths, 36),
    threeYearROI:      Math.max(threeYearROI, 0),
    reductionRate:     reduction,
  };
}

// ── UI ────────────────────────────────────────────────────────────

const INDUSTRY_LABELS: Record<IndustryType, string> = {
  manufacturing: '제조업 / 공장',
  building:      '빌딩 / 상업시설',
  datacenter:    '데이터센터',
  franchise:     '프랜차이즈 / 매장',
  other:         '기타',
};

function fmt(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000)      return `${Math.round(n / 10_000)}만`;
  return n.toLocaleString('ko-KR');
}

export default function CalculatorClient() {
  const [monthlyKwh,    setMonthlyKwh]    = useState<number>(50000);
  const [unitPrice,     setUnitPrice]     = useState<number>(120);
  const [industryType,  setIndustryType]  = useState<IndustryType>('manufacturing');
  const [plan,          setPlan]          = useState<string>('pro');
  const [showResult,    setShowResult]    = useState(false);

  const result = useMemo(
    () => calculate(monthlyKwh, unitPrice, industryType, plan),
    [monthlyKwh, unitPrice, industryType, plan],
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ── 입력 폼 ── */}
        <div className="space-y-6">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <h2 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-cyan-400" /> 에너지 현황 입력
            </h2>

            {/* 월 사용량 */}
            <div className="mb-4">
              <label className="text-sm text-slate-400 mb-1.5 block">
                월 평균 전력 사용량 (kWh)
              </label>
              <input
                type="number"
                value={monthlyKwh}
                onChange={(e) => setMonthlyKwh(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                placeholder="예: 50000"
                min={0}
              />
              <p className="text-xs text-slate-500 mt-1">
                전기요금 청구서의 '사용 전력량'을 입력하세요
              </p>
            </div>

            {/* 단가 */}
            <div className="mb-4">
              <label className="text-sm text-slate-400 mb-1.5 block">
                평균 전력 단가 (원/kWh)
              </label>
              <input
                type="number"
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
                placeholder="예: 120"
                min={0}
              />
              <p className="text-xs text-slate-500 mt-1">
                산업용 평균 120~160원/kWh. 요금 고지서에서 확인
              </p>
            </div>

            {/* 업종 */}
            <div className="mb-4">
              <label className="text-sm text-slate-400 mb-1.5 block">업종</label>
              <select
                value={industryType}
                onChange={(e) => setIndustryType(e.target.value as IndustryType)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
              >
                {(Object.entries(INDUSTRY_LABELS) as [IndustryType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            {/* 플랜 */}
            <div className="mb-6">
              <label className="text-sm text-slate-400 mb-1.5 block">탄소이음 플랜</label>
              <div className="grid grid-cols-3 gap-2">
                {(['basic', 'pro', 'enterprise'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlan(p)}
                    className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                      plan === p
                        ? 'bg-cyan-500 text-white'
                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    {p === 'basic' ? 'Basic' : p === 'pro' ? 'Pro' : 'Enterprise'}
                    <br />
                    <span className="text-[10px] opacity-70">
                      {p === 'enterprise' ? '견적' : `₩${((PLAN_COST[p] ?? 0) / 10000).toFixed(0)}만/월`}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowResult(true)}
              className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" /> 절감 효과 계산하기
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── 결과 ── */}
        <div>
          {showResult ? (
            <div className="space-y-4">
              {/* 연간 절감 금액 */}
              <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm text-cyan-400 font-medium">연간 절감 예상 금액</span>
                </div>
                <p className="text-4xl font-bold text-white mb-1">
                  {fmt(result.annualCostSaving)}원
                </p>
                <p className="text-sm text-slate-400">
                  월 평균 {fmt(result.monthlyCostSaving)}원 절감 ·
                  {' '}절감율 <strong className="text-white">{(result.reductionRate * 100).toFixed(0)}%</strong>
                </p>
              </div>

              {/* CO₂ 절감 */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex items-center gap-4">
                <div className="p-2.5 bg-green-500/10 rounded-lg">
                  <Leaf className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">연간 CO₂ 절감량</p>
                  <p className="text-xl font-bold text-white">{result.annualCO2Saving}톤</p>
                  <p className="text-xs text-slate-500">소나무 {(result.annualCO2Saving * 182).toLocaleString()}그루 효과</p>
                </div>
              </div>

              {/* ROI */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex items-center gap-4">
                <div className="p-2.5 bg-amber-500/10 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">투자 회수 기간</p>
                  <p className="text-xl font-bold text-white">{result.paybackMonths}개월</p>
                  <p className="text-xs text-slate-500">3년 ROI: {result.threeYearROI}%</p>
                </div>
              </div>

              {/* 면책 */}
              <div className="flex items-start gap-2 text-xs text-slate-500 px-1">
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <p>동종업계 평균 절감율 기반 예상치입니다. 실제 효과는 설비 환경에 따라 다를 수 있습니다.</p>
              </div>

              {/* CTA */}
              <div className="pt-2 space-y-2">
                <Link
                  href="/demo"
                  className="block w-full text-center py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors"
                >
                  전문가 정밀 분석 신청 →
                </Link>
                <Link
                  href="/trial"
                  className="block w-full text-center py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
                >
                  14일 무료 체험 시작
                </Link>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center bg-slate-800/20 border border-dashed border-slate-700 rounded-xl p-10 text-center">
              <div>
                <Calculator className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-sm">왼쪽에서 에너지 현황을 입력하고</p>
                <p className="text-slate-400 text-sm">계산 버튼을 클릭하세요.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
