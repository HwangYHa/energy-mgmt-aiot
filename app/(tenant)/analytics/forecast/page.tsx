'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, Zap, Target, AlertCircle, Loader2 } from 'lucide-react';

interface Prediction {
  timestamp: string;
  value: number;
  lower: number;
  upper: number;
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [charData, setChartData] = useState<any[]>([]);

  const handleForecast = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/forecast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ horizon }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      const data: ForecastData = await response.json();
      setPredictions(data.predictions);
      setAccuracy(data.accuracy);

      // 차트 데이터 변환
      const chartData = data.predictions.map((p) => ({
        time: new Date(p.timestamp).getHours() + '시',
        actual: null,
        forecast: Math.round(p.value * 10) / 10,
        lower: Math.round(p.lower * 10) / 10,
        upper: Math.round(p.upper * 10) / 10,
      }));
      setChartData(chartData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
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
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <TrendingUp className="w-10 h-10 text-blue-400" />
          🔮 부하 예측
        </h1>
        <p className="text-gray-400">AI 기반 전력 수요 예측으로 효율적인 에너지 관리</p>
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
                : 'bg-gray-800 border-2 border-gray-700 hover:border-blue-500'
            }`}
          >
            <div className="text-lg">{option.label}</div>
            <div className="text-sm text-gray-300">{option.description}</div>
          </button>
        ))}
      </div>

      {/* 통계 카드 */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 평균 예측값 */}
        <div className="bg-gradient-to-br from-blue-800 to-blue-900 p-6 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-300">평균 예측 전력</span>
            <Zap className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="text-3xl font-bold">{avgPrediction} kW</div>
          <div className="text-sm text-gray-400 mt-2">예측 기간 평균</div>
        </div>

        {/* 최대 예측값 */}
        <div className="bg-gradient-to-br from-red-800 to-red-900 p-6 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-300">최대 예측 전력</span>
            <Target className="w-5 h-5 text-orange-400" />
          </div>
          <div className="text-3xl font-bold">{Math.round(maxPrediction)} kW</div>
          <div className="text-sm text-gray-400 mt-2">피크 부하</div>
        </div>

        {/* 예측 정확도 */}
        <div className="bg-gradient-to-br from-green-800 to-green-900 p-6 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-300">예측 정확도</span>
            <Target className="w-5 h-5 text-green-400" />
          </div>
          <div className="text-3xl font-bold">{(accuracy * 100).toFixed(1)}%</div>
          <div className="text-sm text-gray-400 mt-2">
            {accuracy > 0.9 ? '✅ 매우 높음' : accuracy > 0.8 ? '⚠️ 높음' : '📊 보통'}
          </div>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-6 bg-red-900 border-l-4 border-red-500 p-4 rounded flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-red-300">오류 발생</h3>
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* 예측 차트 */}
      {charData.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <LineChart className="w-6 h-6 text-blue-400" />
            전력 부하 예측 그래프
          </h2>

          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={charData}>
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
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" label={{ value: 'kW', angle: -90, position: 'insideLeft' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
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
              <span>모델: {predictions.length > 0 ? 'LSTM' : '-'}</span>
            </div>
          </div>
        </div>
      )}

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-gray-300">예측 데이터를 처리 중입니다...</p>
          </div>
        </div>
      )}

      {/* 예측 정보 테이블 (선택) */}
      {predictions.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">상세 예측 데이터</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-4">시간</th>
                  <th className="text-right py-2 px-4">예측 (kW)</th>
                  <th className="text-right py-2 px-4">하한 (kW)</th>
                  <th className="text-right py-2 px-4">상한 (kW)</th>
                </tr>
              </thead>
              <tbody>
                {predictions.slice(0, 12).map((p, idx) => (
                  <tr key={idx} className="border-b border-gray-700 hover:bg-gray-700/50">
                    <td className="py-2 px-4">{new Date(p.timestamp).getHours()}시</td>
                    <td className="text-right py-2 px-4 text-blue-400 font-semibold">
                      {p.value.toFixed(1)}
                    </td>
                    <td className="text-right py-2 px-4 text-green-400">{p.lower.toFixed(1)}</td>
                    <td className="text-right py-2 px-4 text-red-400">{p.upper.toFixed(1)}</td>
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
