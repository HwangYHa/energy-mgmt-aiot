// app/web/app/(tenant)/analytics/cost/page.tsx
'use client';

import { useEffect, useState } from 'react';
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
  const [comparison, setComparison] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const contractPower = 1000; // 계약전력 1000kW (예시)

  useEffect(() => {
    fetchCostAnalytics();
  }, []);

  const fetchCostAnalytics = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const currentMonth = new Date();
      const currentMonthStr = currentMonth.toISOString();

      // 월간 비용
      const costResponse = await fetch(
        `http://localhost:4000/api/analytics/cost/monthly?` +
        `contractPower=${contractPower}&` +
        `month=${currentMonthStr}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        },
      );

      if (costResponse.ok) {
        setCostBreakdown(await costResponse.json());
      }

      // 시간대별 비용 (오늘)
      const today = new Date().toISOString();
      const hourlyResponse = await fetch(
        `http://localhost:4000/api/analytics/cost/hourly?date=${today}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        },
      );

      if (hourlyResponse.ok) {
        setHourlyCost(await hourlyResponse.json());
      }

      // 절감 잠재력
      const savingResponse = await fetch(
        `http://localhost:4000/api/analytics/cost/saving-potential?month=${currentMonthStr}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        },
      );

      if (savingResponse.ok) {
        setSavingPotential(await savingResponse.json());
      }

      // 전월 대비
      const compareResponse = await fetch(
        `http://localhost:4000/api/analytics/cost/compare?` +
        `contractPower=${contractPower}&` +
        `currentMonth=${currentMonthStr}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        },
      );

      if (compareResponse.ok) {
        setComparison(await compareResponse.json());
      }

    } catch (error) {
      console.error('Failed to fetch cost analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-xl">비용 분석 중...</div>
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
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-3xl font-bold">💰 비용 분석</h1>
        <p className="text-gray-400 mt-1">전력 요금 및 절감 분석</p>
      </div>

      {/* 주요 지표 */}
      <div className="grid grid-cols-4 gap-4">
        {/* 이번 달 총 비용 */}
        <div className="bg-gray-800 rounded-lg p-6 border-2 border-blue-500">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-blue-400" />
            <span className="text-sm text-gray-400">이번 달 총 비용</span>
          </div>
          <div className="text-4xl font-bold text-blue-400 mb-1">
            {costBreakdown && formatCurrency(costBreakdown.total)}
          </div>
        </div>

        {/* 전월 대비 */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            {comparison && comparison.percentageChange < 0 ? (
              <TrendingDown className="w-5 h-5 text-green-400" />
            ) : (
              <TrendingUp className="w-5 h-5 text-red-400" />
            )}
            <span className="text-sm text-gray-400">전월 대비</span>
          </div>
          <div className={`text-4xl font-bold mb-1 ${
            comparison && comparison.percentageChange < 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {comparison?.percentageChange.toFixed(1) || 0}%
          </div>
          <div className="text-sm text-gray-400">
            {comparison && formatCurrency(Math.abs(comparison.difference))}
          </div>
        </div>

        {/* 절감 가능 금액 */}
        <div className="bg-gray-800 rounded-lg p-6 border border-green-700">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-5 h-5 text-green-400" />
            <span className="text-sm text-gray-400">절감 가능</span>
          </div>
          <div className="text-4xl font-bold text-green-400 mb-1">
            {savingPotential && formatCurrency(savingPotential.potentialSaving)}
          </div>
          <div className="text-sm text-gray-400">
            {savingPotential?.savingPercentage.toFixed(1)}%
          </div>
        </div>

        {/* 계약전력 */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-yellow-400" />
            <span className="text-sm text-gray-400">계약전력</span>
          </div>
          <div className="text-4xl font-bold text-yellow-400 mb-1">
            {contractPower}
          </div>
          <div className="text-sm text-gray-400">kW</div>
        </div>
      </div>

      {/* 비용 구성 */}
      <div className="grid grid-cols-2 gap-6">
        {/* 비용 구성 비율 (Pie Chart) */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
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
                <span className="text-gray-400">기본요금</span>
                <span className="font-bold">{formatCurrency(costBreakdown.basicCharge)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">전력량요금</span>
                <span className="font-bold">{formatCurrency(costBreakdown.energyCharge)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-700 pt-2">
                <span className="text-gray-400">소계</span>
                <span className="font-bold">{formatCurrency(costBreakdown.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">전력산업기반기금</span>
                <span>{formatCurrency(costBreakdown.fund)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">부가세</span>
                <span>{formatCurrency(costBreakdown.vat)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-700 pt-2 text-lg">
                <span className="font-bold">합계</span>
                <span className="font-bold text-blue-400">
                  {formatCurrency(costBreakdown.total)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 절감 권장사항 */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-green-400" />
            절감 권장사항
          </h2>

          {savingPotential && (
            <>
              <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 mb-4">
                <div className="text-sm text-gray-400 mb-1">절감 가능 금액</div>
                <div className="text-3xl font-bold text-green-400">
                  {formatCurrency(savingPotential.potentialSaving)}
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  전체 비용의 {savingPotential.savingPercentage.toFixed(1)}%
                </div>
              </div>

              <div className="space-y-3">
                {savingPotential.recommendations.map((rec, index) => (
                  <div 
                    key={index}
                    className="flex items-start gap-3 p-3 bg-gray-700/50 rounded"
                  >
                    <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {index + 1}
                    </div>
                    <p className="text-sm text-gray-300">{rec}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 시간대별 비용 */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
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