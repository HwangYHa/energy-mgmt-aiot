'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  Clock,
  Loader2,
} from 'lucide-react';

interface CostBreakdown {
  basicCharge: number;
  energyCharge: number;
  subtotal: number;
  fund: number;
  vat: number;
  total: number;
}

interface HourlyCost {
  hour: number;
  energy: number;
  cost: number;
  timeType: 'offPeak' | 'midPeak' | 'onPeak';
}

interface SavingPotential {
  currentCost: number;
  potentialSaving: number;
  savingPercentage: number;
  recommendations: string[];
}

const TIME_COLORS = {
  offPeak: '#10B981',   // 경부하 - 초록
  midPeak: '#F59E0B',   // 중간부하 - 노랑
  onPeak: '#EF4444',    // 최대부하 - 빨강
};

export default function CostAnalyticsPage() {
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown | null>(null);
  const [hourlyCost, setHourlyCost] = useState<HourlyCost[]>([]);
  const [savingPotential, setSavingPotential] = useState<SavingPotential | null>(null);
  const [comparison, setComparison] = useState<{
    currentMonth: number;
    previousMonth: number;
    difference: number;
    percentageChange: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contractPower, setContractPower] = useState(1000);

  const fetchCostAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 사이트 설정에서 계약전력 조회 시도
      try {
        const siteRes = await fetch('/api/sites?take=1');
        if (siteRes.ok) {
          const siteJson = await siteRes.json();
          const site = siteJson.data?.[0];
          if (site?.contractPower) {
            setContractPower(site.contractPower);
          }
        }
      } catch {
        // 사이트 정보 미조회 시 기본값 유지
      }

      const currentMonth = new Date();
      const currentMonthStr = currentMonth.toISOString();
      const today = new Date().toISOString();

      const [costRes, hourlyRes, savingRes, compareRes] = await Promise.allSettled([
        fetch(`/api/analytics/cost/monthly?contractPower=${contractPower}&month=${currentMonthStr}`),
        fetch(`/api/analytics/cost/hourly?date=${today}`),
        fetch(`/api/analytics/cost/saving-potential?month=${currentMonthStr}`),
        fetch(`/api/analytics/cost/compare?contractPower=${contractPower}&currentMonth=${currentMonthStr}`),
      ]);

      if (costRes.status === 'fulfilled' && costRes.value.ok) {
        const json = await costRes.value.json();
        if (json.success) setCostBreakdown(json.data);
      }
      if (hourlyRes.status === 'fulfilled' && hourlyRes.value.ok) {
        const json = await hourlyRes.value.json();
        if (json.success) setHourlyCost(json.data || []);
      }
      if (savingRes.status === 'fulfilled' && savingRes.value.ok) {
        const json = await savingRes.value.json();
        if (json.success) setSavingPotential(json.data);
      }
      if (compareRes.status === 'fulfilled' && compareRes.value.ok) {
        const json = await compareRes.value.json();
        if (json.success) setComparison(json.data);
      }
    } catch {
      setError('비용 분석 데이터를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [contractPower]);

  useEffect(() => {
    fetchCostAnalytics();
  }, [fetchCostAnalytics]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  // 비용 구성 비율 (Pie Chart)
  const pieData = costBreakdown ? [
    { name: '기본요금', value: costBreakdown.basicCharge, color: '#3B82F6' },
    { name: '전력량요금', value: costBreakdown.energyCharge, color: '#10B981' },
    { name: '기반기금', value: costBreakdown.fund, color: '#F59E0B' },
    { name: '부가세', value: costBreakdown.vat, color: '#EF4444' },
  ] : [];

  return (
    <div className="min-h-screen bg-[#051225] text-white p-4 md:p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <DollarSign className="w-6 h-6 text-blue-400" />
          </div>
          비용 분석
        </h1>
        <p className="text-slate-400 mt-1">전력 요금 및 절감 분석</p>
      </div>

      {/* 에러 배너 */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center justify-between">
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={fetchCostAnalytics} className="px-3 py-1.5 bg-red-500/20 text-red-300 rounded-lg text-sm hover:bg-red-500/30 transition">
            재시도
          </button>
        </div>
      )}

      {/* 주요 지표 */}
      <div className="grid grid-cols-4 gap-4">
        {/* 이번 달 총 비용 */}
        <div className="bg-slate-800/50 rounded-lg p-6 border-2 border-blue-500">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-blue-400" />
            <span className="text-sm text-slate-400">이번 달 총 비용</span>
          </div>
          <div className="text-4xl font-bold text-blue-400 mb-1">
            {costBreakdown && formatCurrency(costBreakdown.total)}
          </div>
        </div>

        {/* 전월 대비 */}
        <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-2">
            {comparison && comparison.percentageChange < 0 ? (
              <TrendingDown className="w-5 h-5 text-green-400" />
            ) : (
              <TrendingUp className="w-5 h-5 text-red-400" />
            )}
            <span className="text-sm text-slate-400">전월 대비</span>
          </div>
          <div className={`text-4xl font-bold mb-1 ${
            comparison && comparison.percentageChange < 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {comparison?.percentageChange.toFixed(1) || 0}%
          </div>
          <div className="text-sm text-slate-400">
            {comparison && formatCurrency(Math.abs(comparison.difference))}
          </div>
        </div>

        {/* 절감 가능 금액 */}
        <div className="bg-slate-800/50 rounded-lg p-6 border border-green-700">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-5 h-5 text-green-400" />
            <span className="text-sm text-slate-400">절감 가능</span>
          </div>
          <div className="text-4xl font-bold text-green-400 mb-1">
            {savingPotential && formatCurrency(savingPotential.potentialSaving)}
          </div>
          <div className="text-sm text-slate-400">
            {savingPotential?.savingPercentage.toFixed(1)}%
          </div>
        </div>

        {/* 계약전력 */}
        <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700/50">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-yellow-400" />
            <span className="text-sm text-slate-400">계약전력</span>
          </div>
          <div className="text-4xl font-bold text-yellow-400 mb-1">
            {contractPower}
          </div>
          <div className="text-sm text-slate-400">kW</div>
        </div>
      </div>

      {/* 비용 구성 */}
      <div className="grid grid-cols-2 gap-6">
        {/* 비용 구성 비율 (Pie Chart) */}
        <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700/50">
          <h2 className="text-xl font-bold mb-4">비용 구성</h2>
          
          {pieData.length > 0 && (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                  formatter={(value: any) => formatCurrency(value)}
                />
              </PieChart>
            </ResponsiveContainer>
          )}

          {/* 상세 내역 */}
          {costBreakdown && (
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">기본요금</span>
                <span className="font-bold">{formatCurrency(costBreakdown.basicCharge)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">전력량요금</span>
                <span className="font-bold">{formatCurrency(costBreakdown.energyCharge)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-700/50 pt-2">
                <span className="text-slate-400">소계</span>
                <span className="font-bold">{formatCurrency(costBreakdown.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">전력산업기반기금</span>
                <span>{formatCurrency(costBreakdown.fund)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">부가세</span>
                <span>{formatCurrency(costBreakdown.vat)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-700/50 pt-2 text-lg">
                <span className="font-bold">합계</span>
                <span className="font-bold text-blue-400">
                  {formatCurrency(costBreakdown.total)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 절감 권장사항 */}
        <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700/50">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-green-400" />
            절감 권장사항
          </h2>

          {savingPotential && (
            <>
              <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 mb-4">
                <div className="text-sm text-slate-400 mb-1">절감 가능 금액</div>
                <div className="text-3xl font-bold text-green-400">
                  {formatCurrency(savingPotential.potentialSaving)}
                </div>
                <div className="text-sm text-slate-400 mt-1">
                  전체 비용의 {savingPotential.savingPercentage.toFixed(1)}%
                </div>
              </div>

              <div className="space-y-3">
                {savingPotential.recommendations.map((rec, index) => (
                  <div 
                    key={index}
                    className="flex items-start gap-3 p-3 bg-slate-700/50 rounded"
                  >
                    <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {index + 1}
                    </div>
                    <p className="text-sm text-slate-300">{rec}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 시간대별 비용 */}
      <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700/50">
        <h2 className="text-xl font-bold mb-4">시간대별 비용 (금일)</h2>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={hourlyCost}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="hour" 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF' }}
              label={{ value: '시간', position: 'insideBottom', offset: -5, fill: '#9CA3AF' }}
            />
            <YAxis 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF' }}
              label={{ value: '비용 (원)', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#fff',
              }}
              formatter={(value: any, name: string) => {
                if (name === 'cost') return formatCurrency(value);
                return value;
              }}
            />
            <Legend />
            <Bar 
              dataKey="cost" 
              name="비용"
              fill="#8884d8"
            >
              {hourlyCost.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={TIME_COLORS[entry.timeType]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* 범례 */}
        <div className="flex justify-center gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-600 rounded"></div>
            <span>경부하 (23-09시)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-600 rounded"></div>
            <span>중간부하</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-600 rounded"></div>
            <span>최대부하 (10-12, 13-17시)</span>
          </div>
        </div>
      </div>
    </div>
  );
}