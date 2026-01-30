
// app/(tenant)/analytics/carbon/page.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Leaf,
  TrendingDown,
  Target,
  Lightbulb,
  Calendar,
} from 'lucide-react';

interface MonthlyEmission {
  month: number;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
}

interface CarbonFootprint {
  emissions: {
    scope1: number;
    scope2: number;
    scope3: number;
    total: number;
    unit: string;
  };
  target: number;
  achievement: number;
  reduction: number;
  reductionRate: number;
  recommendations: string[];
}

export default function CarbonAnalyticsPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [monthlyData, setMonthlyData] = useState<MonthlyEmission[]>([]);
  const [footprint, setFootprint] = useState<CarbonFootprint | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchCarbonData();
  }, [year]);

  const fetchCarbonData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('accessToken');

      // 월별 배출량
      const emissionsResponse = await fetch(
        `/api/analytics/carbon/emissions?year=${year}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        },
      );

      if (emissionsResponse.ok) {
        const data = await emissionsResponse.json();
        setMonthlyData(data.map((d: any) => ({
          month: d.month,
          scope1: d.scope1,
          scope2: d.scope2,
          scope3: d.scope3,
          total: d.total,
          monthName: `${d.month}월`,
        })));
      }

      // 탄소 발자국
      const footprintResponse = await fetch(
        `/api/analytics/carbon/footprint?year=${year}&target=500`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        },
      );

      if (footprintResponse.ok) {
        setFootprint(await footprintResponse.json());
      }

    } catch (error) {
      console.error('Carbon analytics error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-xl">탄소 배출 데이터 로딩 중...</div>
      </div>
    );
  }

  // Scope별 Pie Chart 데이터
  const scopeData = footprint ? [
    { name: 'Scope 1 (직접 배출)', value: footprint.emissions.scope1, color: '#EF4444' },
    { name: 'Scope 2 (간접 배출)', value: footprint.emissions.scope2, color: '#F59E0B' },
    { name: 'Scope 3 (기타)', value: footprint.emissions.scope3, color: '#10B981' },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Leaf className="w-8 h-8 text-green-400" />
            탄소 배출 분석
          </h1>
          <p className="text-gray-400 mt-1">온실가스 배출량 및 감축 현황</p>
        </div>

        {/* 연도 선택 */}
        <div className="flex gap-2">
          {[2024, 2025, 2026].map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                year === y
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* 주요 지표 */}
      {footprint && (
        <div className="grid grid-cols-4 gap-4">
          {/* 총 배출량 */}
          <div className="bg-gray-800 rounded-lg p-6 border-2 border-green-500">
            <div className="flex items-center gap-2 mb-2">
              <Leaf className="w-5 h-5 text-green-400" />
              <span className="text-sm text-gray-400">총 배출량</span>
            </div>
            <div className="text-4xl font-bold text-green-400 mb-1">
              {footprint.emissions.total.toFixed(1)}
            </div>
            <div className="text-sm text-gray-400">tCO₂</div>
          </div>

          {/* 목표 대비 */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-gray-400">목표 대비</span>
            </div>
            <div className={`text-4xl font-bold mb-1 ${
              footprint.achievement <= 100 ? 'text-green-400' : 'text-red-400'
            }`}>
              {footprint.achievement.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-400">
              목표: {footprint.target} tCO₂
            </div>
          </div>

          {/* 전년 대비 감축 */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-5 h-5 text-green-400" />
              <span className="text-sm text-gray-400">전년 대비 감축</span>
            </div>
            <div className={`text-4xl font-bold mb-1 ${
              footprint.reductionRate > 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {footprint.reductionRate.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-400">
              {footprint.reduction > 0 ? '-' : '+'}{Math.abs(footprint.reduction).toFixed(1)} tCO₂
            </div>
          </div>

          {/* Scope 2 (주요 배출원) */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-yellow-400" />
              <span className="text-sm text-gray-400">Scope 2 (전력)</span>
            </div>
            <div className="text-4xl font-bold text-yellow-400 mb-1">
              {footprint.emissions.scope2.toFixed(1)}
            </div>
            <div className="text-sm text-gray-400">
              {((footprint.emissions.scope2 / footprint.emissions.total) * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* 월별 배출량 추이 */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-xl font-bold mb-4">월별 배출량 추이</h2>

        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="monthName" 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF' }}
            />
            <YAxis 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF' }}
              label={{ 
                value: 'tCO₂', 
                angle: -90, 
                position: 'insideLeft',
                fill: '#9CA3AF',
              }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#fff',
              }}
            />
            <Legend />
            <Bar dataKey="scope1" name="Scope 1 (직접 배출)" stackId="a" fill="#EF4444" />
            <Bar dataKey="scope2" name="Scope 2 (간접 배출)" stackId="a" fill="#F59E0B" />
            <Bar dataKey="scope3" name="Scope 3 (기타)" stackId="a" fill="#10B981" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Scope 분석 */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4">Scope별 배출 비율</h2>

          {scopeData.length > 0 && (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={scopeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(1)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {scopeData.map((entry, index) => (
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
                  formatter={(value: any) => `${value.toFixed(1)} tCO₂`}
                />
              </PieChart>
            </ResponsiveContainer>
          )}

          {/* 범례 */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between p-2 bg-red-900/30 border border-red-700 rounded">
              <span className="text-sm">Scope 1 (직접 배출)</span>
              <span className="font-bold">{footprint?.emissions.scope1.toFixed(1)} tCO₂</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-yellow-900/30 border border-yellow-700 rounded">
              <span className="text-sm">Scope 2 (간접 배출)</span>
              <span className="font-bold">{footprint?.emissions.scope2.toFixed(1)} tCO₂</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-green-900/30 border border-green-700 rounded">
              <span className="text-sm">Scope 3 (기타)</span>
              <span className="font-bold">{footprint?.emissions.scope3.toFixed(1)} tCO₂</span>
            </div>
          </div>
        </div>

        {/* 감축 권장사항 */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-400" />
            감축 권장사항
          </h2>

          {footprint && footprint.recommendations.length > 0 ? (
            <div className="space-y-3">
              {footprint.recommendations.map((rec, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-3 p-4 bg-gray-700/50 rounded"
                >
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {index + 1}
                  </div>
                  <p className="text-sm text-gray-300 pt-1">{rec}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-8">
              <p>훌륭합니다! 목표를 달성하고 있습니다. 🎉</p>
              <p className="text-sm mt-2">현재 수준을 유지하세요.</p>
            </div>
          )}
        </div>
      </div>

      {/* 배출원별 상세 */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-xl font-bold mb-4">배출원별 상세</h2>

        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-red-900/20 border border-red-700 rounded">
            <h3 className="font-bold mb-2 text-red-400">Scope 1 (직접 배출)</h3>
            <ul className="text-sm space-y-1 text-gray-300">
              <li>• 디젤 발전기</li>
              <li>• LNG 보일러</li>
              <li>• 차량 연료 (디젤, 가솔린)</li>
            </ul>
          </div>

          <div className="p-4 bg-yellow-900/20 border border-yellow-700 rounded">
            <h3 className="font-bold mb-2 text-yellow-400">Scope 2 (간접 배출)</h3>
            <ul className="text-sm space-y-1 text-gray-300">
              <li>• 한국전력 (그리드 전력)</li>
              <li>• 배출계수: 0.4593 tCO₂/MWh</li>
            </ul>
          </div>

          <div className="p-4 bg-green-900/20 border border-green-700 rounded">
            <h3 className="font-bold mb-2 text-green-400">Scope 3 (기타)</h3>
            <ul className="text-sm space-y-1 text-gray-300">
              <li>• 운송 (화물)</li>
              <li>• 출장 (항공, 철도)</li>
              <li>• 폐기물 처리</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}