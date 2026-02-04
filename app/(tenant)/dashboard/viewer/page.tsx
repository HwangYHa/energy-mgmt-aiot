'use client';

import React, { useState, useEffect } from 'react';
import { MetricCard } from '@/components/ui/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EnergyGauge } from '@/components/ui/EnergyGauge';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { Alert } from '@/components/ui/Alert';
import { Lock, Eye, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function ViewerDashboardPage() {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isPeakHours, setIsPeakHours] = useState(false);

  // Simulate real-time data
  const [energyData] = useState({
    current: 245.7,
    max: 500,
    trend: 'stable' as const,
    status: 'normal' as const, // normal, warning, critical
  });

  const [systemStatus] = useState<{
    overall: 'normal' | 'warning' | 'critical';
    online: number;
    warning: number;
    error: number;
    total: number;
  }>({
    overall: 'warning',
    online: 7,
    warning: 2,
    error: 1,
    total: 10,
  });

  const [alerts] = useState([
    {
      id: '1',
      severity: 'warning' as const,
      title: '피크 시간 접근',
      message: '30분 후 피크 시간이 시작됩니다.',
    },
  ]);

  const [devices] = useState([
    {
      id: 'hvac-01',
      name: 'HVAC System',
      status: 'online' as const,
      power: 45.2,
      unit: 'kW',
    },
    {
      id: 'lighting-01',
      name: '조명 시스템',
      status: 'online' as const,
      power: 12.8,
      unit: 'kW',
    },
    {
      id: 'production-01',
      name: '생산 장비',
      status: 'error' as const,
      power: 0,
      unit: 'kW',
    },
    {
      id: 'cooling-01',
      name: '냉각 시스템',
      status: 'warning' as const,
      power: 38.5,
      unit: 'kW',
    },
  ]);

  // Update time
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      );

      // Simple peak hours check (9-11 AM, 6-8 PM)
      const hour = now.getHours();
      setIsPeakHours((hour >= 9 && hour < 11) || (hour >= 18 && hour < 20));
    };

    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  // 전체 상태 판단
  const getOverallStatusColor = () => {
    if (systemStatus.overall === 'critical' || systemStatus.error > 0)
      return 'bg-red-950 border-red-700';
    if (systemStatus.overall === 'warning' || systemStatus.warning > 0)
      return 'bg-amber-950 border-amber-700';
    return 'bg-emerald-950 border-emerald-700';
  };

  const getOverallStatusText = () => {
    if (systemStatus.error > 0) return '이상 감지';
    if (systemStatus.warning > 0) return '주의 필요';
    return '정상 운영';
  };

  const getOverallStatusIcon = () => {
    if (systemStatus.error > 0)
      return <AlertTriangle className="w-8 h-8 text-red-400" />;
    if (systemStatus.warning > 0)
      return <AlertTriangle className="w-8 h-8 text-amber-400" />;
    return <CheckCircle2 className="w-8 h-8 text-emerald-400" />;
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 px-6 py-4">
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
                <span className="text-sm text-blue-300 font-medium">
                  읽기 전용
                </span>
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
        {/* Overall Status - HMI 중심: 한눈에 상태 파악 */}
        <div
          className={`p-8 border rounded-lg ${getOverallStatusColor()} transition-all`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {getOverallStatusIcon()}
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  {getOverallStatusText()}
                </h2>
                <p className="text-slate-300">
                  전체 {systemStatus.total}개 설비 중 정상 {systemStatus.online}
                  개 • 주의 {systemStatus.warning}개 • 이상 {systemStatus.error}개
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-5xl font-bold text-white mb-1">
                {energyData.current}
                <span className="text-2xl text-slate-400 ml-2">kW</span>
              </div>
              <p className="text-sm text-slate-400">현재 전력 소비</p>
            </div>
          </div>
        </div>

        {/* Critical Alerts */}
        {alerts.length > 0 && (
          <div>
            {alerts.map((alert) => (
              <Alert
                key={alert.id}
                severity={alert.severity}
                title={alert.title}
                message={alert.message}
              />
            ))}
          </div>
        )}

        {/* Energy Status Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Current Consumption */}
          <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-lg p-6">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
              현재 전력 소비
            </h2>
            <EnergyGauge
              current={energyData.current}
              max={energyData.max}
              unit="kW"
              size="lg"
              showTrend
              trend={energyData.trend}
            />
          </div>

          {/* Daily Savings */}
          <div className="lg:col-span-1">
            <MetricCard
              label="일일 절감액"
              value="₩7,240"
              subValue="12.5%"
              subLabel="절감율"
              trend={{ direction: 'down', percentage: 12.5 }}
              variant="savings"
              size="md"
            />
          </div>

          {/* Energy Reduction */}
          <div className="lg:col-span-1">
            <MetricCard
              label="에너지 감소"
              value="145.2"
              unit="kWh"
              subValue="어제 대비"
              subLabel="-8.3%"
              trend={{ direction: 'down', percentage: 8.3 }}
              variant="default"
              size="md"
            />
          </div>
        </div>

        {/* Device Status Overview - 상태 중심 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Equipment Status */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <h2 className="text-lg font-bold text-slate-100 uppercase tracking-wider mb-4">
              설비 상태
            </h2>
            <div className="space-y-3">
              {devices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-4 bg-slate-800 rounded border border-slate-700"
                >
                  <div className="flex items-center gap-3">
                    <StatusIndicator
                      status={device.status}
                      label={device.name}
                      size="md"
                    />
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-white">
                      {device.power}
                      <span className="text-sm text-slate-400 ml-1">
                        {device.unit}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Alerts Summary - 색상 중심 */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <h2 className="text-lg font-bold text-slate-100 uppercase tracking-wider mb-4">
              알림 요약
            </h2>
            <div className="space-y-3">
              {/* 이상 */}
              <div
                className={`p-4 rounded-lg border transition-all ${
                  systemStatus.error > 0
                    ? 'bg-red-950 border-red-700'
                    : 'bg-slate-800 border-slate-700 opacity-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-red-200">긴급</p>
                  <span className="text-3xl font-bold text-red-400">
                    {systemStatus.error}
                  </span>
                </div>
                <p className="text-xs text-red-300">
                  {systemStatus.error > 0
                    ? '즉시 확인 필요'
                    : '이상 없음'}
                </p>
              </div>

              {/* 주의 */}
              <div
                className={`p-4 rounded-lg border transition-all ${
                  systemStatus.warning > 0
                    ? 'bg-amber-950 border-amber-700'
                    : 'bg-slate-800 border-slate-700 opacity-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-amber-200">주의</p>
                  <span className="text-3xl font-bold text-amber-400">
                    {systemStatus.warning}
                  </span>
                </div>
                <p className="text-xs text-amber-300">
                  {systemStatus.warning > 0
                    ? '모니터링 필요'
                    : '주의사항 없음'}
                </p>
              </div>

              {/* 정상 */}
              <div className="p-4 bg-emerald-950 border border-emerald-700 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-emerald-200">정상</p>
                  <span className="text-3xl font-bold text-emerald-400">
                    {systemStatus.online}
                  </span>
                </div>
                <p className="text-xs text-emerald-300">정상 작동 중</p>
              </div>
            </div>
          </div>
        </div>

        {/* 읽기 전용 안내 */}
        <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <Lock className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-blue-300 mb-2">
                읽기 전용 모드
              </h3>
              <p className="text-blue-200 text-sm mb-3">
                현재 조회 권한으로 로그인하셨습니다. 실시간 상태 확인과 분석
                리포트는 자유롭게 이용 가능하나, 설비 제어 및 설정 변경은
                불가능합니다.
              </p>
              <p className="text-blue-300 text-sm">
                제어 권한이 필요하신 경우 관리자에게 문의하세요.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
