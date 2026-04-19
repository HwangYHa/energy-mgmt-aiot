'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import {
  TrendingUp, DollarSign, Zap, Award, RefreshCw, Loader2,
  Clock, PieChart,
} from 'lucide-react';
import { apiGet, ApiError } from '@/lib/api/client';

interface RoiData {
  monthlySavings:    number;
  annualSavings:     number;
  subscriptionCost:  number;
  roiMultiple:       number;
  roiPercent:        number;
  paybackMonths:     number;
  planTier:          string;
  avgMonthlyCost:    number;
  dataMonths:        number;
  trend: Array<{ month: string; savings: number; cost: number; kwh: number }>;
  savingBreakdown: {
    peakShift:     number;
    efficiency:    number;
    demandControl: number;
    total:         number;
  };
}

const PLAN_LABEL: Record<string, string> = {
  trial: 'Starter (체험)',
  basic: 'Starter',
  pro:   'Business',
  enterprise: 'Enterprise',
};

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-xs space-y-1 shadow-xl">
      <div className="font-semibold text-slate-300 mb-1">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="text-white font-medium">{p.value.toLocaleString()}원</span>
        </div>
      ))}
    </div>
  );
}

export default function RoiPage() {
  const [data, setData]       = useState<RoiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await apiGet<RoiData>('/api/analytics/roi');
      setData(res.data ?? null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
    </div>
  );

  if (error || !data) return (
    <div className="p-6">
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
        {error ?? '데이터 없음'}
      </div>
    </div>
  );

  const noData = data.dataMonths === 0;
  const roiColor = data.roiMultiple >= 3 ? 'text-emerald-400' : data.roiMultiple >= 1 ? 'text-cyan-400' : 'text-amber-400';
  const breakdownTotal = data.savingBreakdown.total || 1;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-cyan-400" />
            ROI 분석
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">에너지 절감액 vs 구독료 — 투자 대비 효과 분석</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 border border-slate-600 rounded-lg hover:border-slate-500 hover:text-white transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          새로고침
        </button>
      </div>

      {noData && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-amber-300 text-sm">
          센서 데이터가 아직 없습니다. 게이트웨이·센서를 연결하면 실제 절감액을 계산합니다.
          현재 수치는 업계 평균 기반 추정치입니다.
        </div>
      )}

      {/* 핵심 KPI 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* ROI 배수 */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 col-span-2 md:col-span-1">
          <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
            <Award className="w-3.5 h-3.5" />
            ROI 배수
          </div>
          <div className={`text-4xl font-bold ${roiColor}`}>
            {data.roiMultiple > 0 ? `${data.roiMultiple}x` : '–'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {data.roiPercent > 0 ? `+${data.roiPercent.toFixed(1)}%` : '데이터 부족'}
          </div>
        </div>

        {/* 월 절감 예상액 */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5" />
            월 절감 예상
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            {data.monthlySavings > 0 ? `₩${fmt(data.monthlySavings)}` : '–'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            연간 ₩{fmt(data.annualSavings)}
          </div>
        </div>

        {/* 구독료 */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" />
            월 구독료
          </div>
          <div className="text-2xl font-bold text-slate-200">
            {data.subscriptionCost > 0 ? `₩${fmt(data.subscriptionCost)}` : '무료'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {PLAN_LABEL[data.planTier] ?? data.planTier}
          </div>
        </div>

        {/* 회수 기간 */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            투자 회수
          </div>
          <div className="text-2xl font-bold text-cyan-400">
            {data.paybackMonths < 99 ? `${data.paybackMonths}개월` : '–'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {data.paybackMonths === 1 ? '첫 달부터 절감' : data.paybackMonths < 99 ? '누적 회수 기간' : '데이터 부족'}
          </div>
        </div>
      </div>

      {/* 6개월 추이 차트 */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-white mb-4">6개월 절감 추이</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.trend} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `${fmt(v)}`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            <Bar dataKey="savings" name="절감 예상액" fill="#10b981" radius={[3, 3, 0, 0]} />
            <ReferenceLine
              y={data.subscriptionCost}
              stroke="#f59e0b"
              strokeDasharray="4 2"
              label={{ value: '구독료', position: 'right', fill: '#f59e0b', fontSize: 10 }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 절감 원인 분류 + 월별 전기요금 추이 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 절감 원인 분류 */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-1.5">
            <PieChart className="w-4 h-4 text-cyan-400" />
            절감 원인 분류 (이번 달)
          </h2>
          <div className="space-y-3">
            {[
              { label: '피크 시프트',    value: data.savingBreakdown.peakShift,     color: 'bg-cyan-500',   desc: '최대부하 → 경부하 이전' },
              { label: '효율 개선',      value: data.savingBreakdown.efficiency,    color: 'bg-emerald-500', desc: 'EMS 최적화 효율 +8%' },
              { label: '수요 제어',      value: data.savingBreakdown.demandControl, color: 'bg-purple-500',  desc: '최대수요전력 절감' },
            ].map(({ label, value, color, desc }) => {
              const pct = Math.round((value / breakdownTotal) * 100);
              return (
                <div key={label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300">{label}</span>
                    <span className="text-white font-medium">₩{value.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{desc} · {pct}%</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 월별 전기요금 추이 */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white mb-4">월별 전기요금 추이</h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={v => `${fmt(v)}`} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="cost"
                name="전기요금"
                stroke="#60a5fa"
                strokeWidth={2}
                dot={{ r: 3, fill: '#60a5fa' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 요약 안내 */}
      <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 text-xs text-slate-400 space-y-1">
        <div className="font-semibold text-slate-300 mb-1">산출 기준</div>
        <div>· 피크 시프트: 최대부하 20%를 경부하로 이전 시 단가 차이 기반 절감 추정</div>
        <div>· 효율 개선: EMS 도입 후 평균 8% 에너지 효율 개선 가정 (산업부 통계)</div>
        <div>· 수요 제어: 최대수요전력 3% 절감 가정</div>
        <div>· 전기 단가: KEPCO 산업용 고압A 시간대별 요금 적용 (부가세·기금 포함)</div>
        {noData && <div className="text-amber-400">· 현재 센서 데이터가 없어 절감액이 0으로 표시됩니다. 게이트웨이 연결 후 실제 수치가 반영됩니다.</div>}
      </div>
    </div>
  );
}
