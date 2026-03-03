'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Zap, Target, AlertCircle, Loader2 } from 'lucide-react';
import { apiPost, ApiError } from '@/lib/api/client';
import { PlanLockedBanner } from '@/components/subscription/PlanLockedBanner';

interface Prediction {
  timestamp: string;
  value: number;
  lower?: number;
  upper?: number;
}

interface ForecastData {
  predictions: Prediction[];
  accuracy: number;
  model: string;
  timestamp: string;
}

export default function ForecastPage() {
  const [horizon, setHorizon] = useState('24h');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [accuracy, setAccuracy] = useState(0);
  const [modelName, setModelName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlanLocked, setIsPlanLocked] = useState(false);
  const [chartData, setChartData] = useState<{ time: string; actual: null; forecast: number; lower: number; upper: number }[]>([]);

  const handleForecast = async () => {
    setIsLoading(true);
    setError(null);
    setIsPlanLocked(false);

    try {
      // forecast API는 successResponse() 미사용 → 필드가 직접 노출됨
      const res = await apiPost('/api/ai/forecast', { horizon });
      const raw = res as unknown as ForecastData & { predictions: Prediction[] };

      setPredictions(raw.predictions ?? []);
      setAccuracy(raw.accuracy ?? 0);
      setModelName(raw.model || 'SEASONAL-LOCAL');

      // 차트 데이터 변환
      const built = (raw.predictions ?? []).map((p) => ({
        time: new Date(p.timestamp).getHours() + '시',
        actual: null,
        forecast: Math.round(p.value * 10) / 10,
        lower: Math.round((p.lower ?? p.value * 0.85) * 10) / 10,
        upper: Math.round((p.upper ?? p.value * 1.15) * 10) / 10,
      }));
      setChartData(built);
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        setIsPlanLocked(true);
      }
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsLoading(false);
    }
  };

  // 초기 로드
  useEffect(() => {
    handleForecast();
  }, [horizon]);

  const horizonOptions = [
    { value: '24h', label: '24시간', description: '내일 예측' },
    { value: '7d', label: '7일', description: '주간 예측' },
    { value: '30d', label: '30일', description: '월간 예측' },
  ];

  const avgPrediction =
    predictions.length > 0
      ? Math.round(
          (predictions.reduce((sum, p) => sum + p.value, 0) / predictions.length) * 10
        ) / 10
      : 0;

  const maxPrediction = predictions.length > 0 ? Math.max(...predictions.map((p) => p.value)) : 0;

  return (
    <div className="min-h-screen bg-[#051225] text-white p-6">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <TrendingUp className="w-10 h-10 text-blue-400" />
          부하 예측
        </h1>
        <p className="text-slate-400">AI 기반 전력 수요 예측으로 효율적인 에너지 관리</p>
      </div>

      {/* 예측 기간 선택 */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        {horizonOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => setHorizon(option.value)}
            className={`p-4 rounded-lg font-medium transition ${
              horizon === option.value
                ? 'bg-blue-600 border-2 border-blue-400'
                : 'bg-slate-800/50 border-2 border-slate-700/50 hover:border-blue-500'
            }`}
          >
            <div className="text-lg">{option.label}</div>
            <div className="text-sm text-slate-300">{option.description}</div>
          </button>
        ))}
      </div>

      {/* 통계 카드 */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 평균 예측값 */}
        <div className="bg-gradient-to-br from-blue-800 to-blue-900 p-6 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-300">평균 예측 전력</span>
            <Zap className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="text-3xl font-bold">{avgPrediction} kW</div>
          <div className="text-sm text-slate-400 mt-2">예측 기간 평균</div>
        </div>

        {/* 최대 예측값 */}
        <div className="bg-gradient-to-br from-red-800 to-red-900 p-6 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-300">최대 예측 전력</span>
            <Target className="w-5 h-5 text-orange-400" />
          </div>
          <div className="text-3xl font-bold">{Math.round(maxPrediction)} kW</div>
          <div className="text-sm text-slate-400 mt-2">피크 부하</div>
        </div>

        {/* 예측 정확도 */}
        <div className="bg-gradient-to-br from-green-800 to-green-900 p-6 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-300">예측 정확도</span>
            <Target className="w-5 h-5 text-green-400" />
          </div>
          <div className="text-3xl font-bold">{(accuracy * 100).toFixed(1)}%</div>
          <div className="text-sm text-slate-400 mt-2">
            {accuracy > 0.9 ? '매우 높음' : accuracy > 0.8 ? '높음' : '보통'}
          </div>
        </div>
      </div>

      {/* 플랜 잠금 — 앰버 테마 */}
      {isPlanLocked && error && (
        <PlanLockedBanner
          message={error}
          requiredPlan="STARTER"
          onRetry={() => { setIsPlanLocked(false); handleForecast(); }}
          className="mb-6"
        />
      )}

      {/* 일반 오류 — 빨간 박스 */}
      {error && !isPlanLocked && (
        <div className="mb-6 bg-red-500/10 border-l-4 border-red-500/30 p-4 rounded flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-bold text-red-300">오류 발생</h3>
            <p className="text-red-200 text-sm">{error}</p>
          </div>
          <button
            onClick={handleForecast}
            className="shrink-0 text-xs text-red-300 border border-red-500/40 px-3 py-1 rounded hover:bg-red-500/10 transition"
          >
            재시도
          </button>
        </div>
      )}

      {/* 예측 차트 */}
      {chartData.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <LineChart className="w-6 h-6 text-blue-400" />
            전력 부하 예측 그래프
          </h2>

          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" label={{ value: 'kW', angle: -90, position: 'insideLeft' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                }}
                // softer highlight so hovering doesn't paint a bright box
                cursor={{ fill: 'rgba(255,255,255,0.1)' }}
                formatter={(value: number) => [value.toFixed(1), '']}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="forecast"
                stroke="#3B82F6"
                fillOpacity={1}
                fill="url(#colorForecast)"
                name="예측 부하"
              />
              <Area
                type="monotone"
                dataKey="upper"
                stroke="#10B981"
                fill="url(#colorConfidence)"
                name="신뢰 구간 상한"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>

          {/* 범례 설명 */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span>예측값 - AI 모델 기반 부하 예측</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>신뢰 구간 - 95% 신뢰도</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span>모델: {predictions.length > 0 ? modelName || 'SEASONAL-LOCAL' : '-'}</span>
            </div>
          </div>
        </div>
      )}

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-slate-300">예측 데이터를 처리 중입니다...</p>
          </div>
        </div>
      )}

      {/* 예측 정보 테이블 (선택) */}
      {predictions.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">상세 예측 데이터</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left py-2 px-4">시간</th>
                  <th className="text-right py-2 px-4">예측 (kW)</th>
                  <th className="text-right py-2 px-4">하한 (kW)</th>
                  <th className="text-right py-2 px-4">상한 (kW)</th>
                </tr>
              </thead>
              <tbody>
                {predictions.slice(0, 12).map((p, idx) => (
                  <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/50">
                    <td className="py-2 px-4">{new Date(p.timestamp).getHours()}시</td>
                    <td className="text-right py-2 px-4 text-blue-400 font-semibold">
                      {p.value.toFixed(1)}
                    </td>
                    <td className="text-right py-2 px-4 text-green-400">{(p.lower ?? p.value * 0.85).toFixed(1)}</td>
                    <td className="text-right py-2 px-4 text-red-400">{(p.upper ?? p.value * 1.15).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
