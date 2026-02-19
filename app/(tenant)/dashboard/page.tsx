'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  DashboardPanel,
  DashboardHeader,
  EnergyBarChart,
  EnergyLineChart,
  CircularGauge,
  ImageGauge,
  StatDisplay,
} from '@/components/dashboard';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

// 대시보드 통계 데이터 타입
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
}

// 숫자 포맷팅 함수
const formatNumber = (num: number): string => {
  return num.toLocaleString('ko-KR');
};

const formatCurrency = (num: number): string => {
  return `₩${num.toLocaleString('ko-KR')}`;
};

export default function DashboardPage() {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // 시간 업데이트
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // 대시보드 데이터 조회
  const fetchDashboardData = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/dashboard/stats');

      if (!response.ok) {
        throw new Error('데이터를 불러올 수 없습니다');
      }

      const result = await response.json();

      if (result.success) {
        setStats(result.data);
        setLastUpdated(new Date());
      } else {
        throw new Error(result.error || '데이터 조회 실패');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 초기 로드 및 자동 새로고침 (30초마다)
  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#051225] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-cyan-400 animate-spin mx-auto" />
          <p className="mt-4 text-slate-400 text-lg">대시보드 로딩 중...</p>
        </div>
      </div>
    );
  }

  // 오류 상태
  if (error && !stats) {
    return (
      <div className="min-h-screen bg-[#051225] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto" />
          <h2 className="mt-4 text-xl font-semibold text-white">데이터 로드 실패</h2>
          <p className="mt-2 text-slate-400">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="mt-6 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg flex items-center gap-2 mx-auto transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // 데이터가 없는 경우 빈 상태 안내
  if (!stats) {
    return (
      <div className="min-h-screen bg-[#051225] flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-slate-400 text-lg">표시할 데이터가 없습니다.</p>
          <p className="text-slate-500 text-sm">사이트와 디바이스를 먼저 등록하세요.</p>
          <button
            onClick={fetchDashboardData}
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

      {/* 오류 알림 (데이터는 있지만 새로고침 실패 시) */}
      {error && stats && (
        <div className="mb-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center justify-between">
          <span className="text-yellow-400 text-sm">데이터 새로고침 실패. 이전 데이터를 표시합니다.</span>
          <button
            onClick={fetchDashboardData}
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
          {/* 월별 에너지 소비량 */}
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

          {/* 주간 소비 추이 */}
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

          {/* 설비별 에너지 사용 */}
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

          {/* 피크 시간대 분석 */}
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
          {/* 메인 통계 표시 */}
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

          {/* 비용 분석 행 */}
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

          {/* 하단 원형 게이지 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
            <DashboardPanel variant="glow" className="py-3 md:py-4">
              <CircularGauge
                value={data.kpis.equipmentRate}
                label="설비 가동률"
                sublabel="Equipment"
                color="green"
                size="sm"
              />
            </DashboardPanel>
            <DashboardPanel variant="glow" className="py-3 md:py-4">
              <CircularGauge
                value={data.kpis.efficiency}
                label="에너지 효율"
                sublabel="Efficiency"
                color="cyan"
                size="sm"
              />
            </DashboardPanel>
            <DashboardPanel variant="glow" className="py-3 md:py-4">
              <CircularGauge
                value={data.kpis.drParticipation}
                label="DR 참여율"
                sublabel="Demand Response"
                color="yellow"
                size="sm"
              />
            </DashboardPanel>
            <DashboardPanel variant="glow" className="py-3 md:py-4">
              <CircularGauge
                value={data.kpis.carbonGoal}
                label="탄소 목표"
                sublabel="Carbon Goal"
                color="purple"
                size="sm"
              />
            </DashboardPanel>
          </div>
        </div>

        {/* ==================== 우측 컬럼 ==================== */}
        <div className="col-span-12 lg:col-span-3 space-y-2 md:space-y-3">
          {/* 효율성 추이 */}
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

          {/* 비용 절감 추이 */}
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

          {/* 탄소 배출량 */}
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

          {/* 실시간 현황 */}
          <DashboardPanel title="실시간 현황" variant="frame">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center p-2.5 bg-[#0d2847]/50 rounded-lg border border-cyan-500/20 hover:border-cyan-500/40 transition-colors">
                <span className="text-slate-400 text-xs">현재 전력</span>
                <span className="text-cyan-400 font-bold text-sm tabular-nums">
                  {formatNumber(data.realtime.currentPower)} kW
                </span>
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
            </div>
          </DashboardPanel>

          {/* 마지막 업데이트 시간 */}
          {lastUpdated && (
            <div className="text-center text-xs text-slate-500">
              마지막 업데이트: {lastUpdated.toLocaleTimeString('ko-KR')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

