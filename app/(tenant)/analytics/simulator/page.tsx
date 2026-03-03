'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  Calculator,
  Leaf,
  DollarSign,
  Zap,
  TrendingDown,
  Loader2,
  RotateCcw,
  Lightbulb,
  TrendingUp,
  BarChart2,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';

// ── 상수 ────────────────────────────────────────────────────────────
/** 부가세(10%) + 전력산업기반기금(3.7%) */
const SURCHARGE = 0.137;
/** 2023년 한국 전력 탄소 배출 계수 tCO₂/MWh */
const CARBON_FACTOR_KR = 0.4781;

/** 한전 요금제 프리셋 (2024년 기준) */
const TARIFF_PRESETS = [
  { id: 'ind_a',    label: '산업용(갑) 고압A',  basicRate: 8230, unitPrice: 152 },
  { id: 'ind_b',    label: '산업용(을) 고압B',  basicRate: 7220, unitPrice: 141 },
  { id: 'gen_high', label: '일반용(을) 고압',    basicRate: 6160, unitPrice: 122 },
  { id: 'edu',      label: '교육용(갑)',         basicRate: 2550, unitPrice:  90 },
  { id: 'custom',   label: '직접 입력',          basicRate:    0, unitPrice:   0 },
] as const;

/** 한국 산업용 월별 계절 부하 계수 (하계/동계 피크 반영) */
const SEASON_FACTORS = [1.10, 1.00, 0.90, 0.85, 0.90, 1.05, 1.20, 1.25, 1.10, 0.95, 0.90, 1.05];
const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

/** 절감 시나리오
 *  basicRed: 기본요금 절감율(%) — ESS·역률개선처럼 계약전력/역률 개선이 기본요금에 영향을 주는 시나리오 */
const SCENARIOS = [
  {
    id: 'led',
    label: 'LED 조명 전환',
    desc: '형광등 → LED 교체로 조명 에너지 절감',
    icon: Lightbulb,
    color: 'text-yellow-400',
    accent: 'border-yellow-500/40 bg-yellow-500/5',
    defaults: { cost: 5_000_000, reduction: 15, basicRed: 0,  life: 10 },
  },
  {
    id: 'hvac',
    label: 'HVAC 최적화',
    desc: '인버터 공조기 + 스케줄 제어로 에너지 절감',
    icon: Zap,
    color: 'text-cyan-400',
    accent: 'border-cyan-500/40 bg-cyan-500/5',
    defaults: { cost: 15_000_000, reduction: 20, basicRed: 0,  life: 15 },
  },
  {
    id: 'solar',
    label: '태양광 발전',
    desc: '옥상 태양광 자가발전으로 구매 전력 절감',
    icon: Leaf,
    color: 'text-emerald-400',
    accent: 'border-emerald-500/40 bg-emerald-500/5',
    defaults: { cost: 30_000_000, reduction: 25, basicRed: 0,  life: 20 },
  },
  {
    id: 'ess',
    label: 'ESS 도입',
    desc: '에너지 저장장치로 피크 감소 → 계약전력 절감',
    icon: DollarSign,
    color: 'text-blue-400',
    accent: 'border-blue-500/40 bg-blue-500/5',
    defaults: { cost: 50_000_000, reduction: 18, basicRed: 15, life: 10 },
  },
  {
    id: 'pfc',
    label: '역률 개선',
    desc: '진상용 콘덴서 설치로 역률 벌금 제거',
    icon: TrendingUp,
    color: 'text-purple-400',
    accent: 'border-purple-500/40 bg-purple-500/5',
    defaults: { cost: 3_000_000, reduction: 5,  basicRed: 12, life: 15 },
  },
  {
    id: 'ems',
    label: 'EMS 통합 제어',
    desc: '에너지 관리 시스템 도입으로 전사 최적화',
    icon: BarChart2,
    color: 'text-indigo-400',
    accent: 'border-indigo-500/40 bg-indigo-500/5',
    defaults: { cost: 20_000_000, reduction: 12, basicRed: 5,  life: 10 },
  },
] as const;

// ── 재무 계산 유틸 ──────────────────────────────────────────────────

/** 현재가치(NPV) 계산 */
function calcNPV(annualSaving: number, cost: number, rate: number, years: number): number {
  let npv = -cost;
  for (let t = 1; t <= years; t++) {
    npv += annualSaving / Math.pow(1 + rate / 100, t);
  }
  return npv;
}

/** IRR 계산 (이분법, 0.01% 정밀도) */
function calcIRR(annualSaving: number, cost: number, years: number): number | null {
  if (annualSaving <= 0 || cost <= 0) return null;
  if (annualSaving * years <= cost) return null; // 절대 회수 불가
  let lo = 0, hi = 500;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (calcNPV(annualSaving, cost, mid, years) > 0) lo = mid;
    else hi = mid;
    if (hi - lo < 0.01) break;
  }
  return (lo + hi) / 2;
}

/** 연도별 누적 NPV 계산 (차트용) */
function calcCumulativeNPV(
  annualSaving: number,
  cost: number,
  rate: number,
  years: number
): { year: string; cumNPV: number }[] {
  const rows: { year: string; cumNPV: number }[] = [{ year: '0년', cumNPV: -cost }];
  let cum = -cost;
  for (let t = 1; t <= years; t++) {
    cum += annualSaving / Math.pow(1 + rate / 100, t);
    rows.push({ year: `${t}년`, cumNPV: Math.round(cum) });
  }
  return rows;
}

/** 할인 회수 기간 계산 (누적 NPV가 0을 넘는 시점) */
function calcDiscountedPayback(annualSaving: number, cost: number, rate: number, years: number): number | null {
  let cum = -cost;
  for (let t = 1; t <= years; t++) {
    cum += annualSaving / Math.pow(1 + rate / 100, t);
    if (cum >= 0) return t;
  }
  return null; // 기간 내 회수 불가
}

// ── 타입 ─────────────────────────────────────────────────────────────
interface SimResult {
  annualSaving: number;
  annualEnergySaving: number;
  annualCarbonReduction: number;
  monthlySavings: { month: string; before: number; after: number; saving: number }[];
  npv: number;
  irr: number | null;
  simplePaybackMonths: number;
  discountedPaybackYears: number | null;
  roiPct: number;
  npvChart: { year: string; cumNPV: number }[];
  monthlyBaseCost: number;
  monthlyUnitCost: number;
  monthlyTotal: number;
  monthlySaving: number;
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────
export default function SimulatorPage() {
  const [selectedScenario, setSelectedScenario] = useState<string>('led');
  const [tariffId, setTariffId] = useState<string>('ind_a');
  const [customBasicRate, setCustomBasicRate] = useState(0);
  const [customUnitPrice, setCustomUnitPrice] = useState(0);
  const [contractPower, setContractPower] = useState(300); // kW
  const [monthlyKwh, setMonthlyKwh] = useState(50_000); // kWh
  const [monthlyConsumptions, setMonthlyConsumptions] = useState<number[]>([]); // actual month-by-month usage
  const [energyReduction, setEnergyReduction] = useState(15); // %
  const [basicReduction, setBasicReduction] = useState(0); // % (기본요금 절감율)
  const [investmentCost, setInvestmentCost] = useState(5_000_000); // 원
  const [discountRate, setDiscountRate] = useState(5); // %
  const [lifeYears, setLifeYears] = useState(10); // 년
  const [carbonFactor, setCarbonFactor] = useState(CARBON_FACTOR_KR);
  const [isDataFromDb, setIsDataFromDb] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<SimResult | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 유효 요금 단가 결정
  const activeTariff = TARIFF_PRESETS.find(t => t.id === tariffId)!;
  const basicRate = tariffId === 'custom' ? customBasicRate : activeTariff.basicRate;
  const unitPrice = tariffId === 'custom' ? customUnitPrice : activeTariff.unitPrice;

  // 예상 월 전기요금 (미리보기) - memoized
  const estBaseCost = useMemo(() => contractPower * basicRate, [contractPower, basicRate]);
  const estUnitCost = useMemo(() => monthlyKwh * unitPrice * (1 + SURCHARGE), [monthlyKwh, unitPrice]);
  const estMonthlyTotal = useMemo(() => estBaseCost + estUnitCost, [estBaseCost, estUnitCost]);

  // 실 DB 데이터로 초기값 설정
  useEffect(() => {
    const loadActualData = async () => {
      try {
        const res = await fetch('/api/dashboard/stats');
        if (!res.ok) return;
        const json = await res.json();
        const data = json.data;
        const monthIdx = new Date().getMonth();
        const kwh = data?.monthlyConsumption?.[monthIdx]?.consumption;
        if (kwh && kwh > 0) {
          setMonthlyKwh(Math.round(kwh));
          // 계약전력 추정: 월간 kWh / (가동시간 160h) ≈ 평균 kW
          setContractPower(Math.max(50, Math.round(kwh / 160)));
          setIsDataFromDb(true);
        }
        const arr = data?.monthlyConsumption?.map((m: any) => m.consumption || 0) || [];
        if (arr.length === 12) {
          setMonthlyConsumptions(arr);
        }
        const cf = data?.kpis?.carbonFactor;
        if (cf && cf > 0) setCarbonFactor(cf);
      } catch {
        // 기본값 유지
      }
    };
    loadActualData();
  }, []);

  const handleScenarioChange = (id: string) => {
    setSelectedScenario(id);
    const s = SCENARIOS.find(sc => sc.id === id);
    if (s) {
      setInvestmentCost(s.defaults.cost);
      setEnergyReduction(s.defaults.reduction);
      setBasicReduction(s.defaults.basicRed);
      setLifeYears(s.defaults.life);
    }
  };

  const handleTariffChange = (id: string) => {
    setTariffId(id);
    const preset = TARIFF_PRESETS.find(t => t.id === id);
    if (preset && id !== 'custom') {
      setCustomBasicRate(preset.basicRate);
      setCustomUnitPrice(preset.unitPrice);
    }
  };

  const runSimulation = () => {
    setIsSimulating(true);

    // 월별 기본 절감액 계산 - 실제 월별 소비가 있으면 사용
    const monthlyBaseCost = contractPower * basicRate;
    const monthlyUnitCost = unitPrice * (1 + SURCHARGE);

    const monthlySavings = MONTHS.map((month, i) => {
      const sf = SEASON_FACTORS[i] ?? 1.0;
      const consumption = monthlyConsumptions[i] || monthlyKwh;
      const before = Math.round((monthlyBaseCost + consumption * monthlyUnitCost) * sf);
      const unitSav = Math.round(consumption * (energyReduction / 100) * monthlyUnitCost * sf);
      const basicSav = Math.round(monthlyBaseCost * (basicReduction / 100));
      const saving = unitSav + basicSav;
      return { month, before, after: before - saving, saving };
    });

    const monthlySaving = monthlySavings.reduce((s, m) => s + m.saving, 0);

    const annualSaving = monthlySavings.reduce((s, m) => s + m.saving, 0);
    const annualKwhSaved = (monthlyConsumptions.length === 12
      ? monthlyConsumptions.reduce((s, c) => s + c, 0)
      : monthlyKwh * 12
    ) * (energyReduction / 100);

    // annualSaving and annualKwhSaved already computed above
    const annualCarbon = (annualKwhSaved / 1000) * carbonFactor;

    const npv = calcNPV(annualSaving, investmentCost, discountRate, lifeYears);
    const irr = calcIRR(annualSaving, investmentCost, lifeYears);
    const simplePaybackMonths = monthlySaving > 0 ? Math.ceil(investmentCost / monthlySaving) : 9999;
    const discountedPaybackYears = calcDiscountedPayback(annualSaving, investmentCost, discountRate, lifeYears);
    const roiPct = investmentCost > 0 ? (npv / investmentCost) * 100 : 0;
    const npvChart = calcCumulativeNPV(annualSaving, investmentCost, discountRate, lifeYears);

    setResult({
      annualSaving,
      annualEnergySaving: Math.round(annualKwhSaved),
      annualCarbonReduction: parseFloat(annualCarbon.toFixed(2)),
      monthlySavings,
      npv,
      irr,
      simplePaybackMonths,
      discountedPaybackYears,
      roiPct,
      npvChart,
      monthlyBaseCost,
      monthlyUnitCost,
      monthlyTotal: monthlyBaseCost + monthlyKwh * monthlyUnitCost,
      monthlySaving,
    });
    setIsSimulating(false);
  };

  const resetSimulation = () => {
    setResult(null);
    handleScenarioChange('led');
    setMonthlyKwh(50_000);
    setContractPower(300);
    setTariffId('ind_a');
    setDiscountRate(5);
    setLifeYears(10);
    setIsDataFromDb(false);
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n);
  const fmtMan = (n: number) => `${(n / 10_000).toFixed(0)}만원`;

  const selectedScenarioObj = SCENARIOS.find(s => s.id === selectedScenario);

  return (
    <div className="min-h-screen bg-[#051225] text-white p-4 md:p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Calculator className="w-6 h-6 text-blue-400" />
          </div>
          비용·탄소 절감 시뮬레이터
        </h1>
        <div className="flex items-center gap-3 mt-1">
          <p className="text-slate-400 text-sm">한전 요금 기반 NPV/IRR 분석 · 에너지 절감 시나리오 경제성 평가</p>
          {isDataFromDb && (
            <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              실 DB 데이터 기반
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── 입력 패널 ── */}
        <div className="lg:col-span-1 space-y-4">

          {/* 시나리오 선택 */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">절감 시나리오</h2>
            <div className="grid grid-cols-2 gap-2">
              {SCENARIOS.map((s) => {
                const Icon = s.icon;
                const active = selectedScenario === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => handleScenarioChange(s.id)}
                    title={s.desc}
                    className={`p-3 rounded-lg border text-left transition ${
                      active
                        ? `${s.accent} border-opacity-100`
                        : 'bg-slate-800/30 border-slate-700/30 hover:border-slate-600'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${s.color} mb-1`} />
                    <div className="text-xs font-medium text-white leading-tight">{s.label}</div>
                  </button>
                );
              })}
            </div>
            {selectedScenarioObj && (
              <p className="text-xs text-slate-500 mt-2">{selectedScenarioObj.desc}</p>
            )}
          </div>

          {/* 요금제 선택 */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-3">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">한전 요금제</h2>
            <select
              value={tariffId}
              onChange={(e) => handleTariffChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none"
            >
              {TARIFF_PRESETS.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">기본요금 (원/kW)</label>
                <input
                  type="number"
                  value={basicRate}
                  disabled={tariffId !== 'custom'}
                  onChange={(e) => setCustomBasicRate(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">전력량 (원/kWh)</label>
                <input
                  type="number"
                  value={unitPrice}
                  disabled={tariffId !== 'custom'}
                  onChange={(e) => setCustomUnitPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none disabled:opacity-50"
                />
              </div>
            </div>

            <div className="text-xs text-slate-600 flex items-center gap-1">
              <Info className="w-3 h-3 flex-shrink-0" />
              부가세+기반기금 13.7% 포함 계산
            </div>
          </div>

          {/* 기본 파라미터 */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">에너지·투자 파라미터</h2>

            <div>
              <label className="text-xs text-slate-500 mb-1 block">계약전력 (kW)</label>
              <input
                type="number"
                value={contractPower}
                onChange={(e) => setContractPower(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-slate-500 mb-1 block">월간 전력 사용량 (kWh)</label>
              <input
                type="number"
                value={monthlyKwh}
                onChange={(e) => setMonthlyKwh(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none"
              />
              {isDataFromDb && monthlyConsumptions.length === 12 && (
                <p className="text-xs text-green-400 mt-1">
                  실제 월별 사용량 데이터가 로드되었습니다. (계산에 반영됩니다)
                </p>
              )}
            </div>

            {/* 예상 월 전기요금 미리보기 */}
            {estMonthlyTotal > 0 && (
              <div className="bg-slate-900/60 rounded-lg p-3 text-xs space-y-1">
                <div className="flex justify-between text-slate-500">
                  <span>기본요금</span><span>{estBaseCost.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>전력량요금 (부가세 포함)</span><span>{Math.round(estUnitCost).toLocaleString()}원</span>
                </div>
                <div className="flex justify-between text-white font-semibold border-t border-slate-700 pt-1 mt-1">
                  <span>예상 월 전기요금</span><span>{Math.round(estMonthlyTotal).toLocaleString()}원</span>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-slate-500 mb-1 block">에너지 절감율: <span className="text-cyan-400 font-bold">{energyReduction}%</span></label>
              <input
                type="range" min={1} max={50} value={energyReduction}
                onChange={(e) => setEnergyReduction(Number(e.target.value))}
                className="w-full"
              />
            </div>

            {basicReduction > 0 && (
              <div>
                <label className="text-xs text-slate-500 mb-1 block">기본요금 절감율: <span className="text-purple-400 font-bold">{basicReduction}%</span></label>
                <input
                  type="range" min={0} max={30} value={basicReduction}
                  onChange={(e) => setBasicReduction(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            )}

            <div>
              <label className="text-xs text-slate-500 mb-1 block">투자 비용 (원)</label>
              <input
                type="number"
                value={investmentCost}
                onChange={(e) => setInvestmentCost(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>

            {/* 고급 옵션 토글 */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
            >
              {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              고급 분석 옵션
            </button>

            {showAdvanced && (
              <div className="space-y-3 pt-1 border-t border-slate-700/50">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">할인율 (%, DCF 분석용)</label>
                  <input
                    type="number" step="0.5" min={0} max={30} value={discountRate}
                    onChange={(e) => setDiscountRate(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">사업 기간 (년)</label>
                  <input
                    type="number" min={1} max={30} value={lifeYears}
                    onChange={(e) => setLifeYears(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">탄소 배출 계수 (tCO₂/MWh)</label>
                  <input
                    type="number" step="0.0001" value={carbonFactor}
                    onChange={(e) => setCarbonFactor(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={runSimulation}
                disabled={isSimulating}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition disabled:opacity-50"
              >
                {isSimulating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                {isSimulating ? '계산 중...' : '시뮬레이션 실행'}
              </button>
              <button
                onClick={resetSimulation}
                className="px-3 py-2.5 bg-slate-700/50 text-slate-400 rounded-lg hover:bg-slate-700 transition"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── 결과 패널 ── */}
        <div className="lg:col-span-2 space-y-6">
          {result ? (
            <>
              {/* KPI 요약 카드 */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-slate-800/50 border border-emerald-500/30 rounded-xl p-4">
                  <DollarSign className="w-5 h-5 text-emerald-400 mb-1" />
                  <div className="text-xl font-bold text-emerald-400">{fmtMan(result.annualSaving)}</div>
                  <div className="text-xs text-slate-500">연간 절감액</div>
                </div>
                <div className={`bg-slate-800/50 rounded-xl p-4 border ${result.npv >= 0 ? 'border-cyan-500/30' : 'border-red-500/30'}`}>
                  <TrendingUp className={`w-5 h-5 mb-1 ${result.npv >= 0 ? 'text-cyan-400' : 'text-red-400'}`} />
                  <div className={`text-xl font-bold ${result.npv >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                    {fmtMan(result.npv)}
                  </div>
                  <div className="text-xs text-slate-500">NPV ({lifeYears}년)</div>
                </div>
                <div className="bg-slate-800/50 border border-amber-500/30 rounded-xl p-4">
                  <BarChart2 className="w-5 h-5 text-amber-400 mb-1" />
                  <div className="text-xl font-bold text-amber-400">
                    {result.irr !== null ? `${result.irr.toFixed(1)}%` : 'N/A'}
                  </div>
                  <div className="text-xs text-slate-500">IRR</div>
                </div>
                <div className="bg-slate-800/50 border border-green-500/30 rounded-xl p-4">
                  <Leaf className="w-5 h-5 text-green-400 mb-1" />
                  <div className="text-xl font-bold text-green-400">{result.annualCarbonReduction}</div>
                  <div className="text-xs text-slate-500">연간 탄소감축 (tCO₂)</div>
                </div>
              </div>

              {/* 보조 KPI */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/40">
                  <div className="text-xs text-slate-500 mb-1">단순 회수기간</div>
                  <div className="text-lg font-bold text-white">
                    {result.simplePaybackMonths >= 9999 ? '∞' : `${result.simplePaybackMonths}개월`}
                  </div>
                </div>
                <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/40">
                  <div className="text-xs text-slate-500 mb-1">할인 회수기간</div>
                  <div className="text-lg font-bold text-white">
                    {result.discountedPaybackYears !== null ? `${result.discountedPaybackYears}년` : `${lifeYears}년 초과`}
                  </div>
                </div>
                <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/40">
                  <div className="text-xs text-slate-500 mb-1">ROI</div>
                  <div className={`text-lg font-bold ${result.roiPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {result.roiPct.toFixed(1)}%
                  </div>
                </div>
                <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/40">
                  <div className="text-xs text-slate-500 mb-1">연간 절감 전력</div>
                  <div className="text-lg font-bold text-white">
                    {result.annualEnergySaving.toLocaleString()} kWh
                  </div>
                </div>
              </div>

              {/* 월별 비용 비교 차트 */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
                <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-cyan-400" />
                  월별 전기요금 비교
                </h2>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={result.monthlySavings}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="month" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis
                      stroke="#64748b"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      tickFormatter={(v) => `${(v / 10_000).toFixed(0)}만`}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      formatter={(value: number, name: string) => [fmt(value), name]}
                    />
                    <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }} />
                    <Bar dataKey="before" name="현재 요금" fill="#ef4444" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="after"  name="절감 후"   fill="#10b981" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 누적 NPV 추이 차트 */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
                <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-amber-400" />
                  누적 NPV 추이 (할인율 {discountRate}%)
                </h2>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={result.npvChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="year" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis
                      stroke="#64748b"
                      tick={{ fill: '#64748b', fontSize: 11 }}
                      tickFormatter={(v) => fmtMan(v)}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                      cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                      formatter={(v: number) => [fmtMan(v), '누적 NPV']}
                    />
                    <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" label={{ value: '손익분기', fill: '#94a3b8', fontSize: 11 }} />
                    <Line
                      type="monotone"
                      dataKey="cumNPV"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                      name="누적 NPV"
                      activeDot={{ r: 4, fill: '#f59e0b' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* 경제성 분석 요약 */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
                <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-yellow-400" />
                  경제성 분석 결론
                </h2>
                <div className="space-y-2 text-sm">
                  {[
                    {
                      label: '연간 전기요금 절감',
                      value: fmt(result.annualSaving),
                      sub: `월평균 ${fmt(Math.round(result.annualSaving / 12))}`,
                      color: 'text-emerald-400',
                    },
                    {
                      label: `NPV (${lifeYears}년, 할인율 ${discountRate}%)`,
                      value: fmtMan(result.npv),
                      sub: result.npv >= 0 ? '경제성 있음 ✓' : '경제성 부족 — 기간 연장 또는 할인율 검토 권장',
                      color: result.npv >= 0 ? 'text-cyan-400' : 'text-red-400',
                    },
                    {
                      label: 'IRR (내부수익률)',
                      value: result.irr !== null ? `${result.irr.toFixed(1)}%` : 'N/A',
                      sub: result.irr !== null
                        ? result.irr > discountRate
                          ? `자본비용(${discountRate}%) 초과 → 투자 권장`
                          : `자본비용(${discountRate}%) 미달 → 재검토 필요`
                        : '사업 기간 내 투자 회수 불가',
                      color: result.irr !== null && result.irr > discountRate ? 'text-amber-400' : 'text-slate-400',
                    },
                    {
                      label: '탄소 감축 효과',
                      value: `${result.annualCarbonReduction} tCO₂/년`,
                      sub: `K-ETS 탄소크레딧 환산 가치: 약 ${fmt(Math.round(result.annualCarbonReduction * 10_000))} (10,000원/tCO₂ 기준)`,
                      color: 'text-green-400',
                    },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start justify-between p-3 bg-slate-700/30 rounded-lg gap-4">
                      <div className="flex-1">
                        <p className="text-slate-400 text-xs">{item.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{item.sub}</p>
                      </div>
                      <p className={`font-bold shrink-0 ${item.color}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-96 text-slate-500">
              <div className="text-center">
                <Calculator className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-base mb-2">시나리오 선택 후 시뮬레이션을 실행하세요</p>
                <p className="text-sm">한전 요금제 기반 NPV/IRR 분석, 탄소 배출 환산까지 제공합니다.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
