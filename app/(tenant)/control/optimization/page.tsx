'use client';

import React, { useState } from 'react';
import { TrendingDown, AlertCircle, Zap, DollarSign, Activity, Target, Loader2, Info, FlaskConical } from 'lucide-react';
import { apiPost, ApiError } from '@/lib/api/client';

interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  estimatedSavings: number;
  estimatedCostSaving: number;
  confidence: number;
  actions?: string[];
}

interface OptimizationResult {
  recommendations: Recommendation[];
  summary: {
    totalEstimatedSavings: number;
    totalCostSaving: number;
    overallEfficiency: number;
    peakReductionOpportunity: number;
  };
  model: string;
  timestamp: string;
  metadata?: {
    dataPoints: number;
    realDataPoints?: number;
    siteId: string;
    targetReduction: number;
    dataQuality: 'real' | 'partial' | 'synthetic';
  };
}

const PRIORITY_STYLES = {
  high:   { label: '높음', bg: 'bg-red-500/20',   text: 'text-red-400',   border: 'border-red-500/30'   },
  medium: { label: '중간', bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
  low:    { label: '낮음', bg: 'bg-blue-500/20',  text: 'text-blue-400',  border: 'border-blue-500/30'  },
} as const;

const DEFAULT_PRIORITY_STYLE = PRIORITY_STYLES.low;

export default function OptimizationPage() {
  const [targetReduction, setTargetReduction] = useState(20);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOptimize = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // API는 { success: true, recommendations, summary, model, timestamp, metadata } 구조로 응답
      const response = await apiPost('/api/ai/optimize', { targetReduction });

      const raw = response as unknown as Record<string, unknown>;

      if (!response.success) {
        throw new Error(
          (raw.message as string) ||
          (raw.error as string) ||
          '최적화 계산 실패'
        );
      }

      // API가 { success: true, ...result } 형태로 응답 — recommendations 최상위 위치 확인
      const recommendations = raw.recommendations;
      const summary = raw.summary;

      if (!Array.isArray(recommendations) || !summary) {
        throw new Error('최적화 결과 형식이 올바르지 않습니다. 페이지를 새로고침 후 다시 시도해주세요.');
      }

      setResult(raw as unknown as OptimizationResult);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : '알 수 없는 오류');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full bg-[#051225] text-white p-6">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
          <TrendingDown className="w-10 h-10 text-green-400" />
          에너지 최적화
        </h1>
        <p className="text-slate-400">AI 기반 패턴 분석으로 절감 기회를 발굴합니다</p>
      </div>

      {/* 제어판 */}
      <div className="bg-slate-800/50 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">목표 감축량 설정</h2>
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm text-slate-300 mb-2">감축 목표 (%)</label>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={targetReduction}
              onChange={(e) => setTargetReduction(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-700/50 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-2">
              <span>5%</span>
              <span className="text-blue-400 font-bold">{targetReduction}%</span>
              <span>50%</span>
            </div>
          </div>
          <button
            onClick={handleOptimize}
            disabled={isLoading}
            className="px-8 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-bold transition"
          >
            {isLoading ? '분석 중...' : '최적화 실행'}
          </button>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-red-300">오류 발생</h3>
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* 결과 */}
      {result && (
        <>
          {/* 데이터 품질 경고 배너 */}
          {result.metadata?.dataQuality === 'synthetic' && (
            <div className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
              <FlaskConical className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-amber-300 text-sm">산업 기준 데이터 사용 중</h3>
                <p className="text-amber-200/70 text-xs mt-0.5">
                  실측 센서 데이터가 없어 제조업 평균 패턴으로 분석했습니다. 센서/설비를 등록하면 실측 기반 정밀 분석이 가능합니다.
                </p>
              </div>
            </div>
          )}
          {result.metadata?.dataQuality === 'partial' && (
            <div className="mb-6 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-blue-300 text-sm">부분 실측 데이터 사용 중</h3>
                <p className="text-blue-200/70 text-xs mt-0.5">
                  실측 데이터({result.metadata.realDataPoints ?? 0}건)와 산업 기준 패턴을 혼합하여 분석했습니다. 더 많은 데이터가 쌓이면 정확도가 향상됩니다.
                </p>
              </div>
            </div>
          )}

          {/* 요약 KPI */}
          <div className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-green-800 to-green-900 p-6 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-300">총 절감량</span>
                <TrendingDown className="w-5 h-5 text-green-400" />
              </div>
              <div className="text-3xl font-bold">
                {result.summary.totalEstimatedSavings.toLocaleString()}
              </div>
              <div className="text-sm text-slate-400 mt-2">kWh / 월 추정</div>
            </div>

            <div className="bg-gradient-to-br from-blue-800 to-blue-900 p-6 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-300">절감 비용</span>
                <DollarSign className="w-5 h-5 text-yellow-400" />
              </div>
              <div className="text-3xl font-bold">
                ₩{(result.summary.totalCostSaving / 1000).toFixed(0)}K
              </div>
              <div className="text-sm text-slate-400 mt-2">월간 예상 절감액</div>
            </div>

            <div className="bg-gradient-to-br from-purple-800 to-purple-900 p-6 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-300">에너지 효율</span>
                <Activity className="w-5 h-5 text-purple-400" />
              </div>
              <div className="text-3xl font-bold">{result.summary.overallEfficiency}%</div>
              <div className="text-sm text-slate-400 mt-2">현재 운영 효율</div>
            </div>

            <div className="bg-gradient-to-br from-cyan-800 to-cyan-900 p-6 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-300">피크 감축 기회</span>
                <Target className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="text-3xl font-bold">{result.summary.peakReductionOpportunity}%</div>
              <div className="text-sm text-slate-400 mt-2">최대 감축 가능</div>
            </div>
          </div>

          {/* 추천사항 */}
          <div className="bg-slate-800/50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              AI 최적화 추천 ({result.recommendations?.length ?? 0}건)
            </h2>

            {(result.recommendations?.length ?? 0) === 0 ? (
              <p className="text-slate-400 text-sm">추천 사항이 없습니다.</p>
            ) : (
              <div className="space-y-4">
                {(result.recommendations ?? []).map((rec) => {
                  const ps = PRIORITY_STYLES[rec.priority as keyof typeof PRIORITY_STYLES] ?? DEFAULT_PRIORITY_STYLE;
                  return (
                    <div
                      key={rec.id}
                      className={`rounded-xl border ${ps.border} bg-slate-900/40 p-5`}
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`text-xs px-2.5 py-1 rounded-full ${ps.bg} ${ps.text} font-medium`}>
                            우선순위: {ps.label}
                          </span>
                          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-700/50 text-slate-300">
                            {rec.category}
                          </span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-green-400 font-bold text-sm">
                            -{rec.estimatedSavings.toLocaleString()} kWh/월
                          </div>
                          <div className="text-yellow-400 text-xs mt-0.5">
                            ₩{(rec.estimatedCostSaving / 1000).toFixed(0)}K 절감
                          </div>
                        </div>
                      </div>

                      <h3 className="font-semibold text-white mb-2">{rec.title}</h3>
                      <p className="text-sm text-slate-400 leading-relaxed">{rec.description}</p>

                      {/* 실행 조치 */}
                      {rec.actions && rec.actions.length > 0 && (
                        <ul className="mt-3 space-y-1">
                          {rec.actions.map((action, i) => (
                            <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                              <span className="text-cyan-500 mt-0.5">›</span>
                              {action}
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* 신뢰도 바 */}
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-slate-500 w-10 flex-shrink-0">신뢰도</span>
                        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${rec.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400 w-8 text-right">
                          {(rec.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 메타 정보 */}
          <div className="text-xs text-slate-600 flex items-center gap-3 flex-wrap">
            <span>모델: {result.model}</span>
            <span>·</span>
            <span>분석 시각: {new Date(result.timestamp).toLocaleString('ko-KR')}</span>
            {result.metadata && (
              <>
                <span>·</span>
                <span>데이터 포인트: {result.metadata.dataPoints.toLocaleString()}건</span>
              </>
            )}
          </div>
        </>
      )}

      {/* 로딩 오버레이 */}
      {isLoading && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-slate-300">최적화 분석 중입니다...</p>
          </div>
        </div>
      )}
    </div>
  );
}
