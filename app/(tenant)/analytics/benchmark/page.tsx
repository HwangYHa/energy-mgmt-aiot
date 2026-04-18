'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { Award, TrendingUp, TrendingDown, Loader2, RefreshCw, BarChart2, Factory } from 'lucide-react';
import { apiGet, ApiError } from '@/lib/api/client';

interface BenchmarkData {
  tenantIntensity: number | null;
  industryAvg: number;
  industryBest: number;
  industryLabel: string;
  industryType: string;
  unit: string;
  percentile: number;
  rating: string;
  effectiveArea: number;
  monthlyKwh: number;
  savingsPotential: number;
  benchmarkItems: Array<{
    label: string;
    tenant: number;
    avg: number;
    best: number;
    unit: string;
    better: boolean;
  }>;
  monthlyTrend: Array<{ month: string; intensity: number | null; avg: number }>;
  dataAvailable: boolean;
}

const RATING_STYLE: Record<string, { bg: string; border: string; text: string; label: string }> = {
  'A+': { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', label: '최우수' },
  'A':  { bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30',    text: 'text-cyan-400',    label: '우수'   },
  'B':  { bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    text: 'text-blue-400',    label: '양호'   },
  'C':  { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-400',   label: '보통'   },
  'D':  { bg: 'bg-red-500/10',     border: 'border-red-500/30',     text: 'text-red-400',     label: '개선 필요' },
};

export default function BenchmarkPage() {
  const [data, setData]       = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await apiGet<BenchmarkData>('/api/analytics/benchmark');
      setData(res.data ?? null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : '오류');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-400 mb-4">{error ?? '데이터 없음'}</p>
        <button onClick={load} className="px-4 py-2 bg-cyan-700 rounded text-sm text-white">재시도</button>
      </div>
    );
  }

  const ratingStyle = (RATING_STYLE[data.rating] ?? RATING_STYLE['C'])!;

  // 바 차트 데이터
  const barData = data.benchmarkItems.map(item => ({
    name: item.label,
    우리사업장: item.tenant,
    업종평균:   item.avg,
    최우수:     item.best,
    unit:       item.unit,
  }));

  // 추이 차트 — null을 0으로 대체하되 null인 경우 표시 안함
  const trendData = data.monthlyTrend.map(t => ({
    month: t.month.slice(2),  // YY-MM
    원단위: t.intensity ?? undefined,
    업종평균: t.avg,
  }));

  return (
    <div className="min-h-screen bg-[#051225] text-white p-4 md:p-6">

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <BarChart2 className="w-6 h-6 text-cyan-400" />
            </div>
            에너지 효율 벤치마킹
          </h1>
          <p className="text-slate-400 mt-1">같은 업종 평균 대비 에너지 원단위 순위 비교</p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 hover:border-cyan-500/30 rounded-lg text-sm transition">
          <RefreshCw className="w-4 h-4 text-cyan-400" />
          새로고침
        </button>
      </div>

      {/* 데이터 없음 안내 */}
      {!data.dataAvailable && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3">
          <Factory className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-amber-300 font-medium text-sm">측정 데이터가 없습니다</p>
            <p className="text-amber-400/70 text-xs mt-0.5">
              IoT 게이트웨이 연결 후 데이터가 수집되면 정확한 벤치마킹을 제공합니다. 아래는 업종 기준 참고 수치입니다.
            </p>
          </div>
        </div>
      )}

      {/* 상단 KPI 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">

        {/* 등급 */}
        <div className={`${ratingStyle.bg} border ${ratingStyle.border} rounded-xl p-4`}>
          <div className="flex items-center gap-2 mb-2">
            <Award className={`w-5 h-5 ${ratingStyle.text}`} />
            <span className="text-xs text-slate-400">에너지 등급</span>
          </div>
          <div className={`text-4xl font-black ${ratingStyle.text}`}>{data.rating}</div>
          <div className="text-xs text-slate-400 mt-1">{ratingStyle.label}</div>
        </div>

        {/* 백분위 */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            <span className="text-xs text-slate-400">업종 내 순위</span>
          </div>
          <div className="text-3xl font-bold text-purple-300">
            상위 {100 - data.percentile + 1}%
          </div>
          <div className="text-xs text-slate-400 mt-1">{data.industryLabel} 기준</div>
        </div>

        {/* 에너지 원단위 */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart2 className="w-5 h-5 text-cyan-400" />
            <span className="text-xs text-slate-400">에너지 원단위</span>
          </div>
          <div className="text-3xl font-bold text-cyan-300">
            {data.tenantIntensity !== null ? data.tenantIntensity.toFixed(1) : '—'}
          </div>
          <div className="text-xs text-slate-400 mt-1">{data.unit}</div>
          <div className="text-xs mt-1">
            {data.tenantIntensity !== null && data.tenantIntensity < data.industryAvg ? (
              <span className="text-emerald-400">▼ 평균 대비 {((1 - data.tenantIntensity / data.industryAvg) * 100).toFixed(0)}% 절감</span>
            ) : data.tenantIntensity !== null ? (
              <span className="text-red-400">▲ 평균 대비 {((data.tenantIntensity / data.industryAvg - 1) * 100).toFixed(0)}% 초과</span>
            ) : (
              <span className="text-slate-500">업종 평균: {data.industryAvg} {data.unit}</span>
            )}
          </div>
        </div>

        {/* 절감 잠재액 */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            {data.savingsPotential > 0
              ? <TrendingDown className="w-5 h-5 text-emerald-400" />
              : <TrendingUp    className="w-5 h-5 text-slate-400" />}
            <span className="text-xs text-slate-400">절감 잠재액</span>
          </div>
          <div className={`text-2xl font-bold ${data.savingsPotential > 0 ? 'text-emerald-300' : 'text-slate-400'}`}>
            {data.savingsPotential > 0
              ? `₩${(data.savingsPotential / 10000).toFixed(0)}만`
              : '최우수 수준'}
          </div>
          <div className="text-xs text-slate-400 mt-1">업종 평균 달성 시 /월</div>
        </div>
      </div>

      {/* 항목별 비교 바 차트 */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 mb-6">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-cyan-400" />
          항목별 비교 — 우리사업장 vs 업종 평균 vs 최우수
        </h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={barData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#0f1e35', border: '1px solid #1e3a5f', borderRadius: 8 }}
              labelStyle={{ color: '#67e8f9' }}
            />
            <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
            <Bar dataKey="우리사업장" fill="#22d3ee" radius={[3,3,0,0]} />
            <Bar dataKey="업종평균"   fill="#6366f1" radius={[3,3,0,0]} />
            <Bar dataKey="최우수"     fill="#4ade80" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 원단위 추이 */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 mb-6">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-purple-400" />
          월별 에너지 원단위 추이 (최근 6개월)
        </h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={trendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
            <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#0f1e35', border: '1px solid #1e3a5f', borderRadius: 8 }}
            />
            <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
            <ReferenceLine y={data.industryAvg}  stroke="#6366f1" strokeDasharray="4 3" label={{ value: '업종평균', fill: '#6366f1', fontSize: 10 }} />
            <ReferenceLine y={data.industryBest} stroke="#4ade80" strokeDasharray="4 3" label={{ value: '최우수', fill: '#4ade80', fontSize: 10 }} />
            <Bar dataKey="원단위"  fill="#22d3ee" radius={[3,3,0,0]} />
            <Bar dataKey="업종평균" fill="#6366f1" radius={[3,3,0,0]} opacity={0.3} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 개선 제안 */}
      {data.savingsPotential > 0 && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5">
          <h2 className="text-base font-semibold text-emerald-300 mb-3 flex items-center gap-2">
            <TrendingDown className="w-4 h-4" />
            절감 로드맵
          </h2>
          <div className="space-y-2 text-sm text-slate-300">
            <p>• 업종 평균({data.industryAvg} {data.unit})을 달성하면 월 <span className="text-emerald-400 font-semibold">₩{(data.savingsPotential / 10000).toFixed(0)}만원</span> 절감이 가능합니다.</p>
            <p>• 에너지 원단위를 10% 낮추려면: 피크부하 이전, 인버터 적용, 고효율 조명 교체가 효과적입니다.</p>
            <p>• 업종 최우수({data.industryBest} {data.unit})를 목표로 할 경우 연간 <span className="text-emerald-400 font-semibold">₩{((data.savingsPotential * 2.5 * 12) / 10000).toFixed(0)}만원</span> 절감이 가능합니다.</p>
            <p>• 탄소이음 AI 추천(에너지 분석 → AI 최적화)을 활용하면 자동 절감 스케줄을 생성할 수 있습니다.</p>
          </div>
        </div>
      )}
    </div>
  );
}
