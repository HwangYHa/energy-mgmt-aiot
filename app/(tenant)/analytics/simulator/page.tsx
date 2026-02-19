'use client';

import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
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
} from 'lucide-react';

interface SimulationResult {
  monthlySavings: { month: string; before: number; after: number; saving: number }[];
  totalCostSaving: number;
  totalCarbonReduction: number;
  totalEnergySaving: number;
  paybackMonths: number;
  recommendations: string[];
}

const SCENARIOS = [
  {
    id: 'led',
    label: 'LED 조명 전환',
    description: '기존 형광등을 LED로 교체',
    icon: Lightbulb,
    color: 'text-yellow-400',
    defaults: { investmentCost: 5000000, energyReduction: 15 },
  },
  {
    id: 'hvac',
    label: 'HVAC 최적화',
    description: '공조 시스템 인버터 설치 및 스케줄 최적화',
    icon: Zap,
    color: 'text-cyan-400',
    defaults: { investmentCost: 15000000, energyReduction: 20 },
  },
  {
    id: 'solar',
    label: '태양광 설치',
    description: '옥상 태양광 발전 시스템 설치',
    icon: Leaf,
    color: 'text-emerald-400',
    defaults: { investmentCost: 30000000, energyReduction: 25 },
  },
  {
    id: 'ess',
    label: 'ESS 도입',
    description: '에너지 저장장치로 피크 부하 감소',
    icon: DollarSign,
    color: 'text-blue-400',
    defaults: { investmentCost: 50000000, energyReduction: 18 },
  },
];

export default function SimulatorPage() {
  const [selectedScenario, setSelectedScenario] = useState('led');
  const [currentMonthlyEnergy, setCurrentMonthlyEnergy] = useState(50000); // kWh
  const [currentMonthlyCost, setCurrentMonthlyCost] = useState(7500000); // 원
  const [energyReduction, setEnergyReduction] = useState(15); // %
  const [investmentCost, setInvestmentCost] = useState(5000000); // 원
  const [carbonFactor, setCarbonFactor] = useState(0.4781); // tCO2/MWh
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const handleScenarioChange = (scenarioId: string) => {
    setSelectedScenario(scenarioId);
    const scenario = SCENARIOS.find(s => s.id === scenarioId);
    if (scenario) {
      setInvestmentCost(scenario.defaults.investmentCost);
      setEnergyReduction(scenario.defaults.energyReduction);
    }
  };

  const runSimulation = () => {
    setIsSimulating(true);

    setTimeout(() => {
      const monthlyEnergySaving = currentMonthlyEnergy * (energyReduction / 100);
      const monthlyCostSaving = currentMonthlyCost * (energyReduction / 100);
      const monthlyCarbonSaving = (monthlyEnergySaving / 1000) * carbonFactor;

      const months = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
      const monthlySavings = months.map((month, i) => {
        const seasonFactors = [0.9, 0.85, 0.9, 1.0, 1.05, 1.15, 1.2, 1.25, 1.1, 1.0, 0.95, 0.9];
        const seasonFactor = seasonFactors[i] ?? 1.0;
        const before = Math.round(currentMonthlyCost * seasonFactor);
        const after = Math.round(before * (1 - energyReduction / 100));
        return { month, before, after, saving: before - after };
      });

      const totalCostSaving = monthlySavings.reduce((sum, m) => sum + m.saving, 0);
      const paybackMonths = investmentCost > 0 ? Math.ceil(investmentCost / monthlyCostSaving) : 0;

      setResult({
        monthlySavings,
        totalCostSaving,
        totalCarbonReduction: parseFloat((monthlyCarbonSaving * 12).toFixed(2)),
        totalEnergySaving: Math.round(monthlyEnergySaving * 12),
        paybackMonths,
        recommendations: [
          `연간 ${(totalCostSaving).toLocaleString()}원 절감 예상`,
          `투자 회수 기간: 약 ${paybackMonths}개월`,
          `연간 탄소 감축: ${(monthlyCarbonSaving * 12).toFixed(1)} tCO2`,
          paybackMonths <= 24
            ? '투자 회수 기간이 2년 이내로 경제성이 우수합니다.'
            : '장기적 관점에서 환경 및 비용 효과를 고려해주세요.',
        ],
      });
      setIsSimulating(false);
    }, 1500);
  };

  const resetSimulation = () => {
    setResult(null);
    handleScenarioChange('led');
    setCurrentMonthlyEnergy(50000);
    setCurrentMonthlyCost(7500000);
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(n);

  return (
    <div className="min-h-screen bg-[#051225] text-white p-4 md:p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Calculator className="w-6 h-6 text-blue-400" />
          </div>
          비용/탄소 절감 시뮬레이터
        </h1>
        <p className="text-slate-400 text-sm mt-1">에너지 절감 시나리오별 비용 및 탄소 감축 효과 시뮬레이션</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 입력 */}
        <div className="lg:col-span-1 space-y-6">
          {/* 시나리오 선택 */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">시나리오</h2>
            <div className="space-y-2">
              {SCENARIOS.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => handleScenarioChange(s.id)}
                    className={`w-full p-3 rounded-lg border text-left transition ${
                      selectedScenario === s.id
                        ? 'bg-cyan-500/10 border-cyan-500/50'
                        : 'bg-slate-800/30 border-slate-700/30 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${s.color}`} />
                      <div>
                        <div className="text-sm font-medium text-white">{s.label}</div>
                        <div className="text-xs text-slate-500">{s.description}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 파라미터 입력 */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-1">파라미터</h2>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">현재 월간 전력 사용량 (kWh)</label>
              <input
                type="number"
                value={currentMonthlyEnergy}
                onChange={(e) => setCurrentMonthlyEnergy(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">현재 월간 전기 요금 (원)</label>
              <input
                type="number"
                value={currentMonthlyCost}
                onChange={(e) => setCurrentMonthlyCost(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">에너지 절감율 (%)</label>
              <input
                type="range"
                min={1}
                max={50}
                value={energyReduction}
                onChange={(e) => setEnergyReduction(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-right text-sm text-cyan-400 font-bold">{energyReduction}%</div>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">투자 비용 (원)</label>
              <input
                type="number"
                value={investmentCost}
                onChange={(e) => setInvestmentCost(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">탄소 배출 계수 (tCO2/MWh)</label>
              <input
                type="number"
                step="0.0001"
                value={carbonFactor}
                onChange={(e) => setCarbonFactor(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={runSimulation}
                disabled={isSimulating}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition disabled:opacity-50"
              >
                {isSimulating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                {isSimulating ? '시뮬레이션 중...' : '시뮬레이션 실행'}
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

        {/* 오른쪽: 결과 */}
        <div className="lg:col-span-2 space-y-6">
          {result ? (
            <>
              {/* 요약 카드 */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 border border-emerald-500/30 rounded-xl p-5">
                  <DollarSign className="w-5 h-5 text-emerald-400 mb-2" />
                  <div className="text-2xl font-bold text-emerald-400">{formatCurrency(result.totalCostSaving)}</div>
                  <div className="text-xs text-slate-500">연간 비용 절감</div>
                </div>
                <div className="bg-slate-800/50 border border-green-500/30 rounded-xl p-5">
                  <Leaf className="w-5 h-5 text-green-400 mb-2" />
                  <div className="text-2xl font-bold text-green-400">{result.totalCarbonReduction}</div>
                  <div className="text-xs text-slate-500">연간 탄소 감축 (tCO2)</div>
                </div>
                <div className="bg-slate-800/50 border border-cyan-500/30 rounded-xl p-5">
                  <Zap className="w-5 h-5 text-cyan-400 mb-2" />
                  <div className="text-2xl font-bold text-cyan-400">{result.totalEnergySaving.toLocaleString()}</div>
                  <div className="text-xs text-slate-500">연간 절감 (kWh)</div>
                </div>
                <div className="bg-slate-800/50 border border-amber-500/30 rounded-xl p-5">
                  <TrendingDown className="w-5 h-5 text-amber-400 mb-2" />
                  <div className="text-2xl font-bold text-amber-400">{result.paybackMonths}개월</div>
                  <div className="text-xs text-slate-500">투자 회수 기간</div>
                </div>
              </div>

              {/* 월별 비교 차트 */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-4">월별 비용 비교</h2>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={result.monthlySavings}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="month" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis
                      stroke="#64748b"
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend wrapperStyle={{ color: '#94a3b8' }} />
                    <Bar dataKey="before" name="현재 비용" fill="#ef4444" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="after" name="절감 후" fill="#10b981" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 권장사항 */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-yellow-400" />
                  분석 결과
                </h2>
                <div className="space-y-2">
                  {result.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-slate-700/30 rounded-lg">
                      <div className="w-6 h-6 bg-cyan-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {i + 1}
                      </div>
                      <p className="text-sm text-slate-300">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-96 text-slate-500">
              <div className="text-center">
                <Calculator className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg mb-2">시나리오를 선택하고 시뮬레이션을 실행하세요</p>
                <p className="text-sm">좌측에서 절감 시나리오와 파라미터를 설정할 수 있습니다.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
