'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { AlertTriangle, Zap, TrendingDown, Loader2 } from 'lucide-react';
import { apiPost, ApiError } from '@/lib/api/client';
import { PlanLockedBanner } from '@/components/subscription/PlanLockedBanner';

interface Anomaly {
  index: number;
  timestamp: string;
  value: number;
  score: number;
  severity: 'high' | 'medium' | 'low' | 'critical';
  reason: string;
}

interface AnomalyApiData {
  anomalies: Anomaly[];
  anomaly_rate: number;
  model: string;
  timestamp: string;
  metadata?: { dataPoints: number; message?: string };
}

export default function AnomalyDetectionPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [anomalyRate, setAnomalyRate] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlanLocked, setIsPlanLocked] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);

  const detectAnomalies = async () => {
    setIsLoading(true);
    setError(null);
    setIsPlanLocked(false);
    try {
      // apiPost는 항상 ApiError(extends Error)를 throw하므로 fallback 문자열이 표시되지 않음
      const result = await apiPost('/api/ai/anomaly', { sensitivity: 0.1 });
      const data = result as unknown as AnomalyApiData;

      setAnomalies(data.anomalies ?? []);
      setAnomalyRate(data.anomaly_rate ?? 0);

      // 차트 데이터 구성
      const chart = (data.anomalies ?? []).map((anom) => ({
        timestamp: new Date(anom.timestamp).getHours() + '시',
        value: anom.value,
        score: Math.abs(anom.score),
        severity: anom.severity,
      }));
      setChartData(chart);
    } catch (err) {
      // 402 → 플랜 잠금
      if (err instanceof ApiError && err.status === 402) {
        setIsPlanLocked(true);
      }
      setError(err instanceof Error ? err.message : '이상 탐지 분석에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    detectAnomalies();
  }, []);

  const severityColors = {
    critical: 'bg-red-900 text-red-200 border-red-700',
    high: 'bg-orange-900 text-orange-200 border-orange-700',
    medium: 'bg-yellow-900 text-yellow-200 border-yellow-700',
    low: 'bg-blue-900 text-blue-200 border-blue-700',
  };

  const criticalAnomalies = anomalies.filter((a) => a.severity === 'critical');
  const highAnomalies = anomalies.filter((a) => a.severity === 'high');

  return (
    <div className="h-full bg-[#051225] text-white p-6">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <AlertTriangle className="w-10 h-10 text-red-400" />
          이상 탐지
        </h1>
        <p className="text-slate-400">AI 기반 전력 사용 패턴 이상 감지 및 분석</p>
      </div>

      {/* 통계 카드 */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* 전체 이상 */}
        <div className="bg-gradient-to-br from-red-800 to-red-900 p-6 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-300">감지된 이상</span>
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div className="text-3xl font-bold">{anomalies.length}</div>
          <div className="text-sm text-slate-400 mt-2">개의 이상 포인트</div>
        </div>

        {/* 이상률 */}
        <div className="bg-gradient-to-br from-orange-800 to-orange-900 p-6 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-300">이상률</span>
            <TrendingDown className="w-5 h-5 text-orange-400" />
          </div>
          <div className="text-3xl font-bold">{(anomalyRate * 100).toFixed(1)}%</div>
          <div className="text-sm text-slate-400 mt-2">전체 데이터 대비</div>
        </div>

        {/* 심각 이상 */}
        <div className="bg-gradient-to-br from-pink-800 to-pink-900 p-6 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-300">심각 이상</span>
            <AlertTriangle className="w-5 h-5 text-pink-400" />
          </div>
          <div className="text-3xl font-bold">{criticalAnomalies.length}</div>
          <div className="text-sm text-slate-400 mt-2">즉시 조치 필요</div>
        </div>

        {/* 높음 이상 */}
        <div className="bg-gradient-to-br from-yellow-800 to-yellow-900 p-6 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-300">높음 이상</span>
            <Zap className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="text-3xl font-bold">{highAnomalies.length}</div>
          <div className="text-sm text-slate-400 mt-2">주시 필요</div>
        </div>
      </div>

      {/* 플랜 잠금 — 앰버 테마 */}
      {isPlanLocked && error && (
        <PlanLockedBanner
          message={error}
          requiredPlan="PROFESSIONAL"
          onRetry={() => { setIsPlanLocked(false); detectAnomalies(); }}
          className="mb-8"
        />
      )}

      {/* 일반 오류 — 빨간 박스 */}
      {error && !isPlanLocked && (
        <div className="mb-8 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-400 font-medium">분석 오류</p>
            <p className="text-red-300/80 text-sm">{error}</p>
          </div>
          <button
            onClick={detectAnomalies}
            className="shrink-0 text-xs text-red-300 border border-red-500/40 px-3 py-1 rounded hover:bg-red-500/10 transition"
          >
            재시도
          </button>
        </div>
      )}

      {/* 이상 점수 차트 */}
      {chartData.length > 0 && (
        <div className="bg-slate-800/50 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <BarChart className="w-6 h-6 text-orange-400" />
            이상 점수 분포
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="timestamp" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                cursor={{ fill: 'rgba(255,255,255,0.1)' }}
              />
              <Bar dataKey="score" fill="#EF4444" name="이상 점수" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 이상 목록 */}
      <div className="bg-slate-800/50 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-red-400" />
          감지된 이상 상세
        </h2>

        {anomalies.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-slate-400 text-lg">정상 범위의 데이터입니다</div>
            <div className="text-gray-500 text-sm">이상 패턴이 감지되지 않았습니다</div>
          </div>
        ) : (
          <div className="space-y-4">
            {anomalies.map((anom, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-lg border-l-4 ${severityColors[anom.severity]}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-lg">{new Date(anom.timestamp).toLocaleTimeString()}</span>
                      <span className="px-2 py-1 bg-opacity-30 rounded text-xs font-semibold">
                        {anom.severity.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-sm mb-2">{anom.reason}</div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-slate-400">전력값</span>
                        <div className="font-semibold">{anom.value.toFixed(1)} kW</div>
                      </div>
                      <div>
                        <span className="text-slate-400">이상 점수</span>
                        <div className="font-semibold">{anom.score.toFixed(3)}</div>
                      </div>
                      <div>
                        <span className="text-slate-400">권장 조치</span>
                        <div className="font-semibold text-xs">
                          {anom.severity === 'critical' && '즉시 확인'}
                          {anom.severity === 'high' && '점검 필요'}
                          {anom.severity === 'medium' && '모니터링'}
                          {anom.severity === 'low' && '정상'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center rounded">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-slate-300">이상 탐지 중입니다...</p>
          </div>
        </div>
      )}
    </div>
  );
}
