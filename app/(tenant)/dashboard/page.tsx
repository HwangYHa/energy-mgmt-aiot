'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { MetricCard } from '@/components/ui/MetricCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EnergyGauge } from '@/components/ui/EnergyGauge';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { Alert } from '@/components/ui/Alert';
import { ControlPanel } from '@/components/ui/ControlPanel';

interface DashboardStats {
  sites: number;
  devices: {
    total: number;
    online: number;
    offline: number;
  };
  energy: {
    current: number;
    today: number;
    thisMonth: number;
  };
  alerts: {
    critical: number;
    warning: number;
    info: number;
  };
}

export default function DashboardPage() {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isPeakHours, setIsPeakHours] = useState(false);

  // Simulate real-time data
  const [energyData] = useState({
    current: 245.7,
    max: 500,
    trend: 'stable' as const,
  });

  const [alerts] = useState([
    {
      id: '1',
      severity: 'warning' as const,
      title: '피크 시간 접근',
      message: '30분 후 피크 시간이 시작됩니다. 소비 최적화를 시작하세요.',
      action: { label: '보기', onClick: () => {} },
    },
  ]);

  const [devices] = useState([
    {
      id: 'hvac-01',
      name: 'HVAC System',
      status: 'online' as const,
      lastUpdate: new Date(),
      controls: [
        {
          id: 'cool',
          label: '냉각',
          icon: '❄️',
          onClick: () => console.log('Cooling'),
        },
        {
          id: 'heat',
          label: '난방',
          icon: '🔥',
          onClick: () => console.log('Heating'),
        },
      ],
    },
    {
      id: 'lighting-01',
      name: '조명 시스템',
      status: 'online' as const,
      lastUpdate: new Date(),
      controls: [
        {
          id: 'dim',
          label: '어두워짐',
          icon: '💡',
          onClick: () => console.log('Dimming'),
        },
      ],
    },
    {
      id: 'production-01',
      name: '생산 장비',
      status: 'error' as const,
      lastUpdate: new Date(),
      controls: [
        {
          id: 'restart',
          label: '재시작',
          icon: '⚡',
          onClick: () => console.log('Restart'),
          variant: 'danger' as const,
        },
      ],
    },
  ]);

  // Update time
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));

      // Simple peak hours check (9-11 AM, 6-8 PM)
      const hour = now.getHours();
      setIsPeakHours((hour >= 9 && hour < 11) || (hour >= 18 && hour < 20));
    };

    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white">
                에너지 관리 대시보드
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                실시간 모니터링 • {currentTime}
              </p>
            </div>
            <div className="flex gap-3">
              <StatusBadge
                status={isPeakHours ? 'peak-hours' : 'normal'}
                label={isPeakHours ? '피크 시간' : '일반'}
                size="md"
              />
              <Button variant="secondary" size="md">
                설정
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Critical Alerts */}
        {alerts.length > 0 && (
          <div>
            {alerts.map((alert) => (
              <Alert
                key={alert.id}
                severity={alert.severity}
                title={alert.title}
                message={alert.message}
                onAction={alert.action?.onClick}
                actionLabel={alert.action?.label}
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

        {/* Device Status Overview */}
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
                  className="flex items-center justify-between p-3 bg-slate-800 rounded border border-slate-700"
                >
                  <div className="flex items-center gap-3">
                    <StatusIndicator
                      status={device.status}
                      label={device.name}
                      size="md"
                    />
                  </div>
                  <Button variant="ghost" size="xs">
                    상세보기
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Active Alerts Summary */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
            <h2 className="text-lg font-bold text-slate-100 uppercase tracking-wider mb-4">
              알림 요약
            </h2>
            <div className="space-y-3">
              <div className="p-4 bg-red-950 border border-red-700 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-red-200">긴급</p>
                  <span className="text-2xl font-bold text-red-400">1</span>
                </div>
                <p className="text-xs text-red-300">생산 장비 오류</p>
              </div>

              <div className="p-4 bg-amber-950 border border-amber-700 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-amber-200">주의</p>
                  <span className="text-2xl font-bold text-amber-400">2</span>
                </div>
                <p className="text-xs text-amber-300">피크 시간 접근, 유지보수 예정</p>
              </div>

              <div className="p-4 bg-emerald-950 border border-emerald-700 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-emerald-200">정상</p>
                  <span className="text-2xl font-bold text-emerald-400">5</span>
                </div>
                <p className="text-xs text-emerald-300">모든 시스템 정상 작동</p>
              </div>
            </div>
          </div>
        </div>

        {/* Device Control Panel */}
        <ControlPanel
          title="장비 제어"
          devices={devices}
          onDeviceClick={(id) => console.log('Device clicked:', id)}
          compact={false}
        />

        {/* Quick Actions */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
          <h2 className="text-lg font-bold text-slate-100 uppercase tracking-wider mb-4">
            빠른 명령
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button variant="primary" size="lg" className="w-full">
              전체 최적화
            </Button>
            <Button variant="secondary" size="lg" className="w-full">
              DR 활성화
            </Button>
            <Button variant="warning" size="lg" className="w-full">
              피크 대응
            </Button>
            <Button variant="ghost" size="lg" className="w-full">
              더보기
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}