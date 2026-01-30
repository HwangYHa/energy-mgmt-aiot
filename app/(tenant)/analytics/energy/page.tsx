// app/web/app/(tenant)/analytics/energy/page.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
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
  TrendingUp,
  TrendingDown,
  Zap,
  Calendar,
  Target,
  Activity,
} from 'lucide-react';

interface EnergyData {
  timestamp: string;
  value: number;
}

interface PeakAnalysis {
  peak: { value: number; timestamp: string };
  valley: { value: number; timestamp: string };
  average: number;
  loadFactor: number;
}

interface Comparison {
  current: number;
  previous: number;
  difference: number;
  percentageChange: number;
}

export default function EnergyAnalyticsPage() {
  const [period, setPeriod] = useState<'hourly' | 'daily' | 'weekly' | 'monthly'>('daily');
  const [energyData, setEnergyData] = useState<EnergyData[]>([]);
  const [peakAnalysis, setPeakAnalysis] = useState<PeakAnalysis | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      
      // 기간 설정
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case 'hourly':
          startDate.setDate(startDate.getDate() - 1); // 24시간
          break;
        case 'daily':
          startDate.setDate(startDate.getDate() - 30); // 30일
          break;
        case 'weekly':
          startDate.setDate(startDate.getDate() - 90); // 90일
          break;
        case 'monthly':
          startDate.setMonth(startDate.getMonth() - 12); // 12개월
          break;
      }

      // 에너지 데이터
      const energyResponse = await fetch(
        `http://localhost:4000/api/analytics/energy/${period}?` +
        `metricKey=energy&` +
        `startDate=${startDate.toISOString()}&` +
        `endDate=${endDate.toISOString()}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        },
      );

      if (energyResponse.ok) {
        const data = await energyResponse.json();
        setEnergyData(data.map((d: any) => ({
          timestamp: new Date(d.timestamp).toLocaleDateString('ko-KR'),
          value: Math.round(d.value * 10) / 10,
        })));
      }

      // 피크 분석
      const peakResponse = await fetch(
        `http://localhost:4000/api/analytics/energy/peak?` +
        `metricKey=power&` +
        `startDate=${startDate.toISOString()}&` +
        `endDate=${endDate.toISOString()}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        },
      );

      if (peakResponse.ok) {
        setPeakAnalysis(await peakResponse.json());
      }

      // 전월 대비
      const compareResponse = await fetch(
        `http://localhost:4000/api/analytics/energy/compare?` +
        `metricKey=energy&` +
        `currentMonth=${new Date().toISOString()}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        },
      );

      if (compareResponse.ok) {
        setComparison(await compareResponse.json());
      }

    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-xl">분석 데이터 로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">⚡ 에너지 분석</h1>
          <p className="text-gray-400 mt-1">전력 사용량 및 패턴 분석</p>
        </div>

        {/* 기간 선택 */}
        <div className="flex gap-2 bg-gray-800 p-2 rounded-lg">
          {['hourly', 'daily', 'weekly', 'monthly'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p as any)}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-700'
              }`}
            >
              {p === 'hourly' && '시간'}
              {p === 'daily' && '일'}
              {p === 'weekly' && '주'}
              {p === 'monthly' && '월'}
            </button>
          ))}
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-4">
        {/* 피크 전력 */}
        <div className="bg-gray-800 rounded-lg p-6 border-2 border-red-500">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-red-400" />
            <span className="text-sm text-gray-400">피크 전력</span>
          </div>
          <div className="text-4xl font-bold text-red-400 mb-1">
            {peakAnalysis?.peak.value.toFixed(1) || 0}
          </div>
          <div className="text-sm text-gray-400">kW</div>
          <div className="text-xs text-gray-500 mt-2">
            {peakAnalysis?.peak.timestamp
              ? new Date(peakAnalysis.peak.timestamp).toLocaleString('ko-KR')
              : '-'}
          </div>
        </div>

        {/* 평균 전력 */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-blue-400" />
            <span className="text-sm text-gray-400">평균 전력</span>
          </div>
          <div className="text-4xl font-bold text-blue-400 mb-1">
            {peakAnalysis?.average.toFixed(1) || 0}
          </div>
          <div className="text-sm text-gray-400">kW</div>
        </div>

        {/* 부하율 */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-5 h-5 text-green-400" />
            <span className="text-sm text-gray-400">부하율</span>
          </div>
          <div className="text-4xl font-bold text-green-400 mb-1">
            {peakAnalysis?.loadFactor.toFixed(1) || 0}
          </div>
          <div className="text-sm text-gray-400">%</div>
        </div>

        {/* 전월 대비 */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-5 h-5 text-yellow-400" />
            <span className="text-sm text-gray-400">전월 대비</span>
          </div>
          <div className={`text-4xl font-bold mb-1 ${
            comparison && comparison.percentageChange < 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {comparison?.percentageChange.toFixed(1) || 0}
          </div>
          <div className="text-sm text-gray-400">%</div>
          <div className="text-xs text-gray-500 mt-2">
            {comparison && comparison.difference > 0 ? '+' : ''}
            {comparison?.difference.toFixed(0) || 0} kWh
          </div>
        </div>
      </div>

      {/* 에너지 사용량 차트 */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-400" />
          에너지 사용량 추이
        </h2>

        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={energyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="timestamp" 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF' }}
            />
            <YAxis 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF' }}
              label={{ 
                value: 'kWh', 
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
            <Legend 
              wrapperStyle={{ color: '#9CA3AF' }}
            />
            <Line
              type="monotone"
              dataKey="value"
              name="사용량"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={{ fill: '#3B82F6', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 사용량 분포 (Bar Chart) */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-xl font-bold mb-4">일별 사용량 분포</h2>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={energyData.slice(-7)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="timestamp" 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF' }}
            />
            <YAxis 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF' }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#fff',
              }}
            />
            <Bar dataKey="value" fill="#10B981" name="사용량 (kWh)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}