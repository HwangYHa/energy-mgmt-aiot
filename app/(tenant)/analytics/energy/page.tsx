// app/(tenant)/analytics/energy/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
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
  Zap,
  Calendar,
  Target,
  Activity,
  Loader2,
  BarChart3,
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

const PERIOD_LABELS: Record<string, string> = {
  hourly: '시간',
  daily: '일',
  weekly: '주',
  monthly: '월',
};

export default function EnergyAnalyticsPage() {
  const [period, setPeriod] = useState<'hourly' | 'daily' | 'weekly' | 'monthly'>('daily');
  const [energyData, setEnergyData] = useState<EnergyData[]>([]);
  const [peakAnalysis, setPeakAnalysis] = useState<PeakAnalysis | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSimulated, setIsSimulated] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/analytics/energy?period=${period}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        setEnergyData(data.energyData || []);
        setPeakAnalysis(data.peakAnalysis || null);
        setComparison(data.comparison || null);
        setIsSimulated(data.isSimulated || false);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#051225] text-white">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-cyan-400" />
          <p className="text-slate-400">분석 데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#051225] text-white p-4 md:p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <Zap className="w-6 h-6 text-yellow-400" />
            </div>
            에너지 분석
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            전력 사용량 및 패턴 분석
            {isSimulated && (
              <span className="ml-2 text-amber-400 text-xs">(시뮬레이션 데이터)</span>
            )}
          </p>
        </div>

        {/* 기간 선택 */}
        <div className="flex gap-1 bg-slate-800/50 border border-slate-700/50 p-1 rounded-lg">
          {(['hourly', 'daily', 'weekly', 'monthly'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-cyan-500 text-white'
                  : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 피크 전력 */}
        <div className="bg-slate-800/50 border border-red-500/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-red-400" />
            <span className="text-sm text-slate-400">피크 전력</span>
          </div>
          <div className="text-3xl font-bold text-red-400 mb-1">
            {peakAnalysis?.peak.value.toFixed(1) || '0'}
          </div>
          <div className="text-sm text-slate-500">kW</div>
          <div className="text-xs text-slate-600 mt-2">
            {peakAnalysis?.peak.timestamp
              ? new Date(peakAnalysis.peak.timestamp).toLocaleString('ko-KR')
              : '-'}
          </div>
        </div>

        {/* 평균 전력 */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-5 h-5 text-blue-400" />
            <span className="text-sm text-slate-400">평균 전력</span>
          </div>
          <div className="text-3xl font-bold text-blue-400 mb-1">
            {peakAnalysis?.average.toFixed(1) || '0'}
          </div>
          <div className="text-sm text-slate-500">kW</div>
        </div>

        {/* 부하율 */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-emerald-400" />
            <span className="text-sm text-slate-400">부하율</span>
          </div>
          <div className="text-3xl font-bold text-emerald-400 mb-1">
            {peakAnalysis?.loadFactor.toFixed(1) || '0'}
          </div>
          <div className="text-sm text-slate-500">%</div>
        </div>

        {/* 전월 대비 */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-5 h-5 text-amber-400" />
            <span className="text-sm text-slate-400">전월 대비</span>
          </div>
          <div className={`text-3xl font-bold mb-1 ${
            comparison && comparison.percentageChange < 0 ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {comparison ? `${comparison.percentageChange > 0 ? '+' : ''}${comparison.percentageChange.toFixed(1)}` : '0'}
          </div>
          <div className="text-sm text-slate-500">%</div>
          <div className="text-xs text-slate-600 mt-2">
            {comparison ? `${comparison.difference > 0 ? '+' : ''}${comparison.difference.toFixed(0)} kWh` : '-'}
          </div>
        </div>
      </div>

      {/* 에너지 사용량 추이 차트 */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-400" />
          에너지 사용량 추이
        </h2>

        {energyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={energyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="timestamp"
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 12 }}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 12 }}
                label={{
                  value: 'kWh',
                  angle: -90,
                  position: 'insideLeft',
                  fill: '#64748b',
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#e2e8f0',
                }}
              />
              <Legend wrapperStyle={{ color: '#94a3b8' }} />
              <Line
                type="monotone"
                dataKey="value"
                name="사용량 (kWh)"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={{ fill: '#06b6d4', r: 3 }}
                activeDot={{ r: 5, fill: '#22d3ee' }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-64 text-slate-500">
            <p>에너지 데이터가 없습니다</p>
          </div>
        )}
      </div>

      {/* 일별 사용량 분포 */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-400" />
          최근 사용량 분포
        </h2>

        {energyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={energyData.slice(-10)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="timestamp"
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 12 }}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#e2e8f0',
                }}
              />
              <Bar dataKey="value" fill="#10b981" name="사용량 (kWh)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-48 text-slate-500">
            <p>데이터가 없습니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
