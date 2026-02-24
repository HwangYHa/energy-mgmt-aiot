'use client';

/**
 * components/dashboard/DashboardClient.tsx
 *
 * SWR + Zustand 실시간 스토어를 사용하는 대시보드 클라이언트 컴포넌트.
 * - useSWR: 30초 자동 갱신 (fallbackData = SSR 초기값으로 LCP 개선)
 * - useRealtime: SSE 단일 연결로 전력값 실시간 오버레이
 */

import React, { useState, useEffect } from 'react';
import useSWR from 'swr';
import {
  DashboardPanel,
  DashboardHeader,
  EnergyBarChart,
  EnergyLineChart,
  CircularGauge,
  ImageGauge,
  StatDisplay,
} from '@/components/dashboard';
import { Loader2, AlertCircle, RefreshCw, Wifi, WifiOff, FileText, Settings, Radio } from 'lucide-react';
import Link from 'next/link';
import { useRealtime, useRealtimeAggregates } from '@/hooks/use-realtime';

// ─────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────

interface DashboardStats {
  kpis: {
    totalConsumption: number;
    consumptionUnit: string;
    consumptionTrend: { value: number; direction: 'up' | 'down' };
    efficiency: number;
    equipmentRate: number;
    drParticipation: number;
    carbonGoal: number;
  };
  realtime: {
    currentPower: number;
    dailyUsage: number;
    peakRatio: number;
    estimatedCost: number;
  };
  monthlyConsumption: Array<{ name: string; consumption: number; target: number }>;
  weeklyTrend: Array<{ name: string; current: number; previous: number }>;
  hourlyLoad: Array<{ name: string; load: number; peak: number }>;
  costAnalysis: Array<{ name: string; cost: number; savings: number }>;
  efficiencyTrend: Array<{ name: string; efficiency: number; target: number }>;
  carbonEmission: Array<{ name: string; emission: number; limit: number }>;
  costSavings: Array<{ name: string; profit: number; target: number }>;
  renewableEnergy: Array<{ name: string; solar: number; wind: number; ess: number }>;
  peakHourAnalysis: Array<{ name: string; value: number; avg: number }>;
  meta?: { hasInvoiceData?: boolean };
}

// ─────────────────────────────────────────────────────
// 포맷팅 함수
// ─────────────────────────────────────────────────────

const formatNumber = (num: number) => num.toLocaleString('ko-KR');
const formatCurrency = (num: number) => `₩${num.toLocaleString('ko-KR')}`;

// SWR fetcher
const fetcher = (url: string) => fetch(url).then(r => r.json()).then(j => {
  if (!j.success) throw new Error(j.error || '데이터 조회 실패');
  return j.data as DashboardStats;
});

// ─────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────

interface DashboardClientProps {
  initialData: DashboardStats | null;
}

export default function DashboardClient({ initialData }: DashboardClientProps) {
  const [currentTime, setCurrentTime] = useState('');

  // ── SWR: 30초 자동 갱신 ──
  const { data: stats, error, isLoading, mutate } = useSWR<DashboardStats>(
    '/api/dashboard/stats',
    fetcher,
    {
      fallbackData: initialData ?? undefined,
      refreshInterval: 30_000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5_000,
      keepPreviousData: true,
    }
  );

  // ── Zustand SSE: 실시간 집계값 ──
  const { status: sseStatus, isConnected: sseConnected } = useRealtime();
  const realtimeAggregates = useRealtimeAggregates();

  // 시계
  useEffect(() => {
    const update = () => {
      setCurrentTime(
        new Date().toLocaleString('ko-KR', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        })
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  // 데이터 연결 상태 추론
  const dataConnectionStatus: 'connected' | 'invoice_only' | 'disconnected' = (() => {
    if (realtimeAggregates.totalPower > 0 || (stats?.realtime?.currentPower ?? 0) > 0) return 'connected';
    if (stats?.meta?.hasInvoiceData) return 'invoice_only';
    return 'disconnected';
  })();

  // SSE로 오버레이되는 전력값 (SSE > API fallback)
  const livePower = realtimeAggregates.totalPower > 0
    ? realtimeAggregates.totalPower
    : (stats?.realtime?.currentPower ?? 0);

  // ─── 로딩 (초기 데이터 없을 때만) ───
  if (isLoading && !stats) {
    return (
      <div className="min-h-screen bg-[#051225] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-cyan-400 animate-spin mx-auto" />
          <p className="mt-4 text-slate-400 text-lg">대시보드 로딩 중...</p>
        </div>
      </div>
    );
  }

  // ─── 오류 (데이터 없을 때만) ───
  if (error && !stats) {
    return (
      <div className="min-h-screen bg-[#051225] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto" />
          <h2 className="mt-4 text-xl font-semibold text-white">데이터 로드 실패</h2>
          <p className="mt-2 text-slate-400">{error.message}</p>
          <button
            onClick={() => mutate()}
            className="mt-6 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg flex items-center gap-2 mx-auto transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-[#051225] flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-slate-400 text-lg">표시할 데이터가 없습니다.</p>
          <p className="text-slate-500 text-sm">사이트와 디바이스를 먼저 등록하세요.</p>
          <button
            onClick={() => mutate()}
            className="mt-4 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg flex items-center gap-2 mx-auto transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            새로고침
          </button>
        </div>
      </div>
    );
  }

  const data = stats;

  return (
    <div className="min-h-screen bg-[#051225] p-2 md:p-3 lg:p-4">
      {/* 헤더 배너 */}
      <DashboardHeader
        title="에너지 운영 관리 시스템"
        subtitle={currentTime}
      />

      {/* ─── SSE 연결 상태 뱃지 ─── */}
      <div className="flex items-center gap-2 mb-2">
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${
          sseConnected
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : sseStatus === 'connecting'
            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            : 'bg-slate-700/50 border-slate-600/30 text-slate-400'
        }`}>
          <Radio className={`w-3 h-3 ${sseConnected ? 'animate-pulse' : ''}`} />
          <span>
            {sseConnected ? `SSE 실시간 연결됨 · 총 전력 ${realtimeAggregates.totalPower.toFixed(1)} kW`
              : sseStatus === 'connecting' ? 'SSE 연결 중...'
              : 'SSE 대기'}
          </span>
        </div>
      </div>

      {/* ─── 데이터 연결 상태 배너 ─── */}
      {dataConnectionStatus !== 'connected' && (
        <div className={`mb-3 p-3 border rounded-lg flex items-center justify-between gap-3 ${
          dataConnectionStatus === 'invoice_only'
            ? 'bg-blue-500/10 border-blue-500/30'
            : 'bg-amber-500/10 border-amber-500/30'
        }`}>
          <div className="flex items-center gap-2.5">
            {dataConnectionStatus === 'disconnected' ? (
              <WifiOff className="w-4 h-4 text-amber-400 flex-shrink-0" />
            ) : (
              <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
            )}
            <div>
              <p className={`text-sm font-semibold ${dataConnectionStatus === 'invoice_only' ? 'text-blue-400' : 'text-amber-400'}`}>
                {dataConnectionStatus === 'invoice_only' ? '고지서 데이터 수집 중' : '데이터 연결 대기 중'}
              </p>
              <p className="text-xs text-slate-400">
                {dataConnectionStatus === 'invoice_only'
                  ? '고지서 기반 데이터입니다. IoT 센서 연동 시 실시간 모니터링이 활성화됩니다.'
                  : '아직 에너지 데이터가 연동되지 않았습니다. 고지서 업로드 또는 IoT 연동으로 시작하세요.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {dataConnectionStatus === 'disconnected' && (
              <Link href="/onboarding">
                <button className="text-xs px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 rounded-lg flex items-center gap-1.5 transition">
                  <Settings className="w-3 h-3" /> 시작 설정
                </button>
              </Link>
            )}
            <Link href="/analytics/carbon">
              <button className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition border ${
                dataConnectionStatus === 'invoice_only'
                  ? 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border-blue-500/30'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border-amber-500/30'
              }`}>
                <FileText className="w-3 h-3" /> 고지서 업로드
              </button>
            </Link>
          </div>
        </div>
      )}

      {/* ─── 연결 완료 + SSE 활성 상태 표시 ─── */}
      {dataConnectionStatus === 'connected' && sseConnected && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg w-fit">
          <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs text-emerald-400 font-medium">실시간 데이터 수집 중</span>
          <span className="text-xs text-slate-500">· 활성 센서 {realtimeAggregates.activeSensors}개</span>
        </div>
      )}

      {/* 오류 알림 (데이터 있지만 재갱신 실패) */}
      {error && stats && (
        <div className="mb-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center justify-between">
          <span className="text-yellow-400 text-sm">데이터 새로고침 실패. 이전 데이터를 표시합니다.</span>
          <button
            onClick={() => mutate()}
            className="text-yellow-400 hover:text-yellow-300 text-sm flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" />
            재시도
          </button>
        </div>
      )}

      {/* 메인 그리드 레이아웃 - 3컬럼 */}
      <div className="grid grid-cols-12 gap-2 md:gap-3">
        {/* ==================== 좌측 컬럼 ==================== */}
        <div className="col-span-12 lg:col-span-3 space-y-2 md:space-y-3">
          <DashboardPanel title="월별 에너지 소비량" variant="frame">
            <EnergyBarChart
              data={data.monthlyConsumption}
              bars={[
                { dataKey: 'consumption', color: '#22d3ee', name: '소비량' },
                { dataKey: 'target', color: '#4ade80', name: '목표' },
              ]}
              height={130}
              showLegend={false}
            />
          </DashboardPanel>

          <DashboardPanel title="주간 소비 추이" variant="frame">
            <EnergyBarChart
              data={data.weeklyTrend}
              bars={[
                { dataKey: 'current', color: '#06b6d4', name: '이번주' },
                { dataKey: 'previous', color: '#0891b2', name: '지난주' },
              ]}
              height={110}
              showLegend={false}
            />
          </DashboardPanel>

          <DashboardPanel title="시간대별 부하" variant="frame">
            <EnergyBarChart
              data={data.hourlyLoad}
              bars={[
                { dataKey: 'load', color: '#22d3ee', name: '현재 부하' },
                { dataKey: 'peak', color: '#f59e0b', name: '피크' },
              ]}
              height={110}
              showLegend={false}
            />
          </DashboardPanel>

          <DashboardPanel title="피크 시간대 분석" variant="frame">
            <EnergyBarChart
              data={data.peakHourAnalysis}
              bars={[
                { dataKey: 'value', color: '#fbbf24', name: '사용량' },
                { dataKey: 'avg', color: '#6366f1', name: '평균' },
              ]}
              height={110}
              showLegend={false}
            />
          </DashboardPanel>
        </div>

        {/* ==================== 중앙 컬럼 ==================== */}
        <div className="col-span-12 lg:col-span-6 space-y-2 md:space-y-3">
          <DashboardPanel variant="frame" className="py-4 md:py-6">
            <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10">
              <StatDisplay
                value={data.kpis.totalConsumption}
                label="총 에너지 소비량"
                sublabel={`${data.kpis.consumptionUnit} (연간 누계)`}
                size="xl"
                trend={{
                  value: data.kpis.consumptionTrend.value,
                  direction: data.kpis.consumptionTrend.direction,
                }}
              />
              <div className="hidden md:block h-20 w-px bg-gradient-to-b from-transparent via-cyan-500/30 to-transparent" />
              <ImageGauge
                value={data.kpis.efficiency}
                label="효율"
                size="lg"
              />
            </div>
          </DashboardPanel>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
            <DashboardPanel title="비용 분석 (천원)" variant="frame">
              <EnergyBarChart
                data={data.costAnalysis}
                bars={[
                  { dataKey: 'cost', color: '#f97316', name: '비용' },
                  { dataKey: 'savings', color: '#22c55e', name: '절감' },
                ]}
                height={150}
                showLegend
              />
            </DashboardPanel>

            <DashboardPanel title="분기별 신재생 에너지" variant="frame">
              <EnergyBarChart
                data={data.renewableEnergy}
                bars={[
                  { dataKey: 'solar', color: '#fbbf24', name: '태양광' },
                  { dataKey: 'wind', color: '#22d3ee', name: '풍력' },
                  { dataKey: 'ess', color: '#a78bfa', name: 'ESS' },
                ]}
                height={150}
                showLegend
              />
            </DashboardPanel>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
            <DashboardPanel variant="glow" className="py-3 md:py-4">
              <CircularGauge value={data.kpis.equipmentRate} label="설비 가동률" sublabel="Equipment" color="green" size="sm" />
            </DashboardPanel>
            <DashboardPanel variant="glow" className="py-3 md:py-4">
              <CircularGauge value={data.kpis.efficiency} label="에너지 효율" sublabel="Efficiency" color="cyan" size="sm" />
            </DashboardPanel>
            <DashboardPanel variant="glow" className="py-3 md:py-4">
              <CircularGauge value={data.kpis.drParticipation} label="DR 참여율" sublabel="Demand Response" color="yellow" size="sm" />
            </DashboardPanel>
            <DashboardPanel variant="glow" className="py-3 md:py-4">
              <CircularGauge value={data.kpis.carbonGoal} label="탄소 목표" sublabel="Carbon Goal" color="purple" size="sm" />
            </DashboardPanel>
          </div>
        </div>

        {/* ==================== 우측 컬럼 ==================== */}
        <div className="col-span-12 lg:col-span-3 space-y-2 md:space-y-3">
          <DashboardPanel title="효율성 추이" variant="frame">
            <EnergyLineChart
              data={data.efficiencyTrend}
              lines={[
                { dataKey: 'efficiency', color: '#22d3ee', name: '효율' },
                { dataKey: 'target', color: '#f59e0b', name: '목표', dot: false },
              ]}
              height={130}
              showLegend={false}
            />
          </DashboardPanel>

          <DashboardPanel title="비용 절감 추이" variant="frame">
            <EnergyLineChart
              data={data.costSavings}
              lines={[
                { dataKey: 'profit', color: '#4ade80', name: '절감액' },
                { dataKey: 'target', color: '#f97316', name: '목표', dot: false },
              ]}
              height={110}
              showLegend={false}
            />
          </DashboardPanel>

          <DashboardPanel title="탄소 배출량 (tCO₂)" variant="frame">
            <EnergyBarChart
              data={data.carbonEmission}
              bars={[
                { dataKey: 'emission', color: '#a78bfa', name: '배출량' },
                { dataKey: 'limit', color: '#ef4444', name: '한도' },
              ]}
              height={110}
              showLegend={false}
            />
          </DashboardPanel>

          {/* 실시간 현황 (SSE 오버레이 적용) */}
          <DashboardPanel title="실시간 현황" variant="frame">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center p-2.5 bg-[#0d2847]/50 rounded-lg border border-cyan-500/20 hover:border-cyan-500/40 transition-colors">
                <span className="text-slate-400 text-xs">현재 전력</span>
                <div className="flex items-center gap-1.5">
                  {sseConnected && realtimeAggregates.totalPower > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                  <span className="text-cyan-400 font-bold text-sm tabular-nums">
                    {formatNumber(livePower)} kW
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-[#0d2847]/50 rounded-lg border border-emerald-500/20 hover:border-emerald-500/40 transition-colors">
                <span className="text-slate-400 text-xs">금일 사용량</span>
                <span className="text-emerald-400 font-bold text-sm tabular-nums">
                  {formatNumber(data.realtime.dailyUsage)} kWh
                </span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-[#0d2847]/50 rounded-lg border border-yellow-500/20 hover:border-yellow-500/40 transition-colors">
                <span className="text-slate-400 text-xs">피크 대비</span>
                <span className="text-yellow-400 font-bold text-sm tabular-nums">
                  {data.realtime.peakRatio}%
                </span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-[#0d2847]/50 rounded-lg border border-orange-500/20 hover:border-orange-500/40 transition-colors">
                <span className="text-slate-400 text-xs">예상 요금</span>
                <span className="text-orange-400 font-bold text-sm tabular-nums">
                  {formatCurrency(data.realtime.estimatedCost)}
                </span>
              </div>
              {/* SSE 알림 수 */}
              {realtimeAggregates.alertCount > 0 && (
                <div className="flex justify-between items-center p-2.5 bg-red-500/10 rounded-lg border border-red-500/20">
                  <span className="text-slate-400 text-xs">실시간 알림</span>
                  <span className="text-red-400 font-bold text-sm tabular-nums">
                    {realtimeAggregates.alertCount}건
                  </span>
                </div>
              )}
            </div>
          </DashboardPanel>
        </div>
      </div>
    </div>
  );
}
