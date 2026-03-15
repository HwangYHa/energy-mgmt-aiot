'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MetricCard } from '@/components/ui/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EnergyGauge } from '@/components/ui/EnergyGauge';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { Alert } from '@/components/ui/Alert';
import { Lock, Eye, AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import type { DashboardOverview } from '@/lib/types/hmi';

export default function ViewerDashboardPage() {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isPeakHours, setIsPeakHours] = useState(false);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/overview');
      if (res.ok) {
        const data: DashboardOverview = await res.json();
        setOverview(data);
        setFetchError(null);
      } else {
        setFetchError('대시보드 데이터를 불러올 수 없습니다.');
      }
    } catch {
      setFetchError('네트워크 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
    const dataInterval = setInterval(fetchOverview, 30000);
    return () => clearInterval(dataInterval);
  }, [fetchOverview]);

  // 시간 갱신
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      );
      const hour = now.getHours();
      setIsPeakHours((hour >= 9 && hour < 11) || (hour >= 18 && hour < 20));
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  // 전체 상태 판단
  const equipment = overview?.equipment;
  const getOverallStatusColor = () => {
    if (!equipment) return 'bg-slate-900 border-slate-700';
    if (equipment.dangerCount > 0) return 'bg-red-950 border-red-700';
    if (equipment.warningCount > 0) return 'bg-amber-950 border-amber-700';
    return 'bg-emerald-950 border-emerald-700';
  };

  const getOverallStatusText = () => {
    if (!equipment) return '데이터 없음';
    if (equipment.dangerCount > 0) return '이상 감지';
    if (equipment.warningCount > 0) return '주의 필요';
    return '정상 운영';
  };

  const getOverallStatusIcon = () => {
    if (!equipment) return <AlertTriangle className="w-8 h-8 text-slate-400" />;
    if (equipment.dangerCount > 0) return <AlertTriangle className="w-8 h-8 text-red-400" />;
    if (equipment.warningCount > 0) return <AlertTriangle className="w-8 h-8 text-amber-400" />;
    return <CheckCircle2 className="w-8 h-8 text-emerald-400" />;
  };

  return (
    <div className="h-full bg-[#051225]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-800/80 backdrop-blur border-b border-slate-700/50 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Eye className="w-8 h-8 text-blue-400" />
                실시간 모니터링
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                조회 전용 • {currentTime}
              </p>
            </div>
            <div className="flex gap-3">
              <div className="px-4 py-2 bg-blue-900/30 border border-blue-600/30 rounded-lg flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-blue-300 font-medium">읽기 전용</span>
              </div>
              <StatusBadge
                status={isPeakHours ? 'peak-hours' : 'normal'}
                label={isPeakHours ? '피크 시간' : '일반'}
                size="md"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* 로딩 상태 */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
          </div>
        )}

        {/* 오류 상태 */}
        {!isLoading && fetchError && !overview && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <AlertTriangle className="w-12 h-12 text-red-400" />
            <p className="text-slate-400">{fetchError}</p>
            <button
              onClick={fetchOverview}
              className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm transition"
            >
              <RefreshCw className="w-4 h-4" />
              다시 시도
            </button>
          </div>
        )}

        {/* 데이터 로드 완료 */}
        {!isLoading && overview && (
          <>
            {/* Overall Status */}
            <div className={`p-8 border rounded-lg ${getOverallStatusColor()} transition-all`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  {getOverallStatusIcon()}
                  <div>
                    <h2 className="text-3xl font-bold text-white mb-2">
                      {getOverallStatusText()}
                    </h2>
                    <p className="text-slate-300">
                      전체 {equipment?.totalCount ?? 0}개 설비 중
                      정상 {equipment?.normalCount ?? 0}개 •
                      주의 {equipment?.warningCount ?? 0}개 •
                      이상 {equipment?.dangerCount ?? 0}개
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-5xl font-bold text-white mb-1">
                    {overview.energy.currentUsage.toFixed(1)}
                    <span className="text-2xl text-slate-400 ml-2">kW</span>
                  </div>
                  <p className="text-sm text-slate-400">현재 전력 소비</p>
                </div>
              </div>
            </div>

            {/* Critical Alerts */}
            {overview.alerts.filter(a => !a.acknowledged).length > 0 && (
              <div className="space-y-2">
                {overview.alerts
                  .filter(a => !a.acknowledged)
                  .slice(0, 3)
                  .map((alert) => (
                    <Alert
                      key={alert.id}
                      severity={
                        alert.severity === 'danger'
                          ? 'critical'
                          : alert.severity === 'normal'
                          ? 'info'
                          : alert.severity
                      }
                      title={alert.title}
                      message={alert.message}
                    />
                  ))}
              </div>
            )}

            {/* Energy Status Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 bg-slate-800/50 border border-slate-700/50 rounded-lg p-6">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                  현재 전력 소비
                </h2>
                <EnergyGauge
                  current={overview.energy.currentUsage}
                  max={overview.energy.peakLimit}
                  unit="kW"
                  size="lg"
                  showTrend
                  trend="stable"
                />
              </div>

              <div className="lg:col-span-1">
                <MetricCard
                  label="일일 절감액"
                  value={`₩${overview.energy.savingsCost.toLocaleString('ko-KR')}`}
                  subValue={`${overview.energy.usageRate.toFixed(1)}%`}
                  subLabel="목표 대비 사용률"
                  trend={{
                    direction: overview.energy.savingsCost > 0 ? 'down' : 'up',
                    percentage: Math.abs(overview.energy.usageRate - 100),
                  }}
                  variant="savings"
                  size="md"
                />
              </div>

              <div className="lg:col-span-1">
                <MetricCard
                  label="에너지 절감량"
                  value={overview.energy.savings.toFixed(1)}
                  unit="kWh"
                  subValue="목표 대비"
                  subLabel={`${overview.energy.peakRate.toFixed(1)}% (피크율)`}
                  trend={{
                    direction: overview.energy.savings > 0 ? 'down' : 'up',
                    percentage: overview.energy.peakRate,
                  }}
                  variant="default"
                  size="md"
                />
              </div>
            </div>

            {/* Device & Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Equipment Status */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6">
                <h2 className="text-lg font-bold text-slate-100 uppercase tracking-wider mb-4">
                  이상 설비 현황
                </h2>
                {equipment && equipment.abnormalDevices.length > 0 ? (
                  <div className="space-y-3">
                    {equipment.abnormalDevices.slice(0, 5).map((device) => (
                      <div
                        key={device.id}
                        className="flex items-center justify-between p-4 bg-slate-800 rounded border border-slate-700"
                      >
                        <div className="flex items-center gap-3">
                          <StatusIndicator
                            status={
                              device.status === 'danger'
                                ? 'error'
                                : device.status === 'normal'
                                ? 'online'
                                : device.status
                            }
                            label={device.deviceName}
                            size="md"
                          />
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">{device.siteName}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{device.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 text-emerald-400">
                    <CheckCircle2 className="w-6 h-6 mr-2" />
                    <span className="text-sm">모든 설비 정상 운영 중</span>
                  </div>
                )}
              </div>

              {/* Alert Summary */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6">
                <h2 className="text-lg font-bold text-slate-100 uppercase tracking-wider mb-4">
                  알림 요약
                </h2>
                <div className="space-y-3">
                  <div
                    className={`p-4 rounded-lg border transition-all ${
                      (equipment?.dangerCount ?? 0) > 0
                        ? 'bg-red-950 border-red-700'
                        : 'bg-slate-800 border-slate-700 opacity-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-red-200">긴급</p>
                      <span className="text-3xl font-bold text-red-400">
                        {equipment?.dangerCount ?? 0}
                      </span>
                    </div>
                    <p className="text-xs text-red-300">
                      {(equipment?.dangerCount ?? 0) > 0 ? '즉시 확인 필요' : '이상 없음'}
                    </p>
                  </div>

                  <div
                    className={`p-4 rounded-lg border transition-all ${
                      (equipment?.warningCount ?? 0) > 0
                        ? 'bg-amber-950 border-amber-700'
                        : 'bg-slate-800 border-slate-700 opacity-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-amber-200">주의</p>
                      <span className="text-3xl font-bold text-amber-400">
                        {equipment?.warningCount ?? 0}
                      </span>
                    </div>
                    <p className="text-xs text-amber-300">
                      {(equipment?.warningCount ?? 0) > 0 ? '모니터링 필요' : '주의사항 없음'}
                    </p>
                  </div>

                  <div className="p-4 bg-emerald-950 border border-emerald-700 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-emerald-200">정상</p>
                      <span className="text-3xl font-bold text-emerald-400">
                        {equipment?.normalCount ?? 0}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-300">정상 작동 중</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* 읽기 전용 안내 */}
        <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <Lock className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-blue-300 mb-2">읽기 전용 모드</h3>
              <p className="text-blue-200 text-sm mb-3">
                현재 조회 권한으로 로그인하셨습니다. 실시간 상태 확인과 분석
                리포트는 자유롭게 이용 가능하나, 설비 제어 및 설정 변경은 불가능합니다.
              </p>
              <p className="text-blue-300 text-sm">제어 권한이 필요하신 경우 관리자에게 문의하세요.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
