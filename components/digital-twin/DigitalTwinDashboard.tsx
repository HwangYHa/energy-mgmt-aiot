'use client';

import { useState, useEffect } from 'react';
import {
  Activity,
  Zap,
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from 'lucide-react';
import { SystemStatusIndicator } from './SystemStatusIndicator';
import { EnergyFlowDiagram } from './EnergyFlowDiagram';
import { EquipmentStatusCard } from './EquipmentStatusCard';
import { RealTimeMetrics } from './RealTimeMetrics';

/**
 * 디지털 트윈 메인 대시보드
 * 실시간 시설 상태 모니터링 및 즉시 판단
 */

export interface SystemStatus {
  overall: 'normal' | 'warning' | 'critical';
  message: string;
  score: number;
}

export interface Equipment {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'warning' | 'offline';
  power: number;
  efficiency: number;
  temperature?: number;
  lastUpdate: string;
}

export function DigitalTwinDashboard() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    overall: 'normal',
    message: '모든 시스템이 정상 작동 중입니다',
    score: 98,
  });

  const [equipment, setEquipment] = useState<Equipment[]>([
    {
      id: 'hvac-1',
      name: 'HVAC 시스템 #1',
      type: 'HVAC',
      status: 'online',
      power: 145.2,
      efficiency: 92,
      temperature: 22.5,
      lastUpdate: new Date().toISOString(),
    },
    {
      id: 'chiller-1',
      name: '냉동기 #1',
      type: 'Chiller',
      status: 'online',
      power: 280.5,
      efficiency: 88,
      temperature: 7.2,
      lastUpdate: new Date().toISOString(),
    },
    {
      id: 'boiler-1',
      name: '보일러 #1',
      type: 'Boiler',
      status: 'warning',
      power: 95.8,
      efficiency: 75,
      temperature: 85.0,
      lastUpdate: new Date().toISOString(),
    },
    {
      id: 'ups-1',
      name: 'UPS #1',
      type: 'UPS',
      status: 'online',
      power: 52.3,
      efficiency: 96,
      lastUpdate: new Date().toISOString(),
    },
  ]);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // 실시간 데이터 갱신 시뮬레이션
  useEffect(() => {
    const interval = setInterval(() => {
      // 시스템 상태 업데이트
      const warningCount = equipment.filter((e) => e.status === 'warning').length;
      const criticalCount = equipment.filter((e) => e.status === 'offline').length;

      if (criticalCount > 0) {
        setSystemStatus({
          overall: 'critical',
          message: `${criticalCount}개 설비에 긴급 조치가 필요합니다`,
          score: 65,
        });
      } else if (warningCount > 0) {
        setSystemStatus({
          overall: 'warning',
          message: `${warningCount}개 설비에 주의가 필요합니다`,
          score: 82,
        });
      } else {
        setSystemStatus({
          overall: 'normal',
          message: '모든 시스템이 정상 작동 중입니다',
          score: 98,
        });
      }

      // 설비 데이터 미세 조정
      setEquipment((prev) =>
        prev.map((eq) => ({
          ...eq,
          power: eq.power + (Math.random() - 0.5) * 5,
          efficiency: Math.min(100, Math.max(0, eq.efficiency + (Math.random() - 0.5) * 2)),
          temperature: eq.temperature
            ? eq.temperature + (Math.random() - 0.5) * 0.5
            : undefined,
          lastUpdate: new Date().toISOString(),
        }))
      );
    }, 3000);

    return () => clearInterval(interval);
  }, [equipment]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // 실제 환경에서는 API 호출
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  const totalPower = equipment.reduce((sum, eq) => sum + eq.power, 0);
  const avgEfficiency =
    equipment.reduce((sum, eq) => sum + eq.efficiency, 0) / equipment.length;

  return (
    <div className="space-y-6">
      {/* 전체 상태 및 주요 메트릭 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 메인 상태 인디케이터 - "지금 괜찮은가?" */}
        <div className="lg:col-span-2">
          <SystemStatusIndicator
            status={systemStatus.overall}
            message={systemStatus.message}
            score={systemStatus.score}
          />
        </div>

        {/* 주요 메트릭 */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                총 전력 소비
              </span>
              <Zap className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">
              {totalPower.toFixed(1)} kW
            </div>
            <div className="flex items-center gap-1 mt-2 text-sm text-green-600 dark:text-green-400">
              <TrendingDown className="w-4 h-4" />
              <span>전주 대비 12% 감소</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                평균 효율
              </span>
              <Activity className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">
              {avgEfficiency.toFixed(1)}%
            </div>
            <div className="flex items-center gap-1 mt-2 text-sm text-green-600 dark:text-green-400">
              <TrendingUp className="w-4 h-4" />
              <span>목표 대비 +3.2%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 에너지 흐름 다이어그램 */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            실시간 에너지 흐름
          </h2>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-5 h-5 text-slate-600 dark:text-slate-400 ${
                isRefreshing ? 'animate-spin' : ''
              }`}
            />
          </button>
        </div>
        <EnergyFlowDiagram equipment={equipment} totalPower={totalPower} />
      </div>

      {/* 설비 상태 카드 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            설비 상태 모니터링
          </h2>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <span className="text-slate-600 dark:text-slate-400">
                정상 {equipment.filter((e) => e.status === 'online').length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full" />
              <span className="text-slate-600 dark:text-slate-400">
                주의 {equipment.filter((e) => e.status === 'warning').length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full" />
              <span className="text-slate-600 dark:text-slate-400">
                오류 {equipment.filter((e) => e.status === 'offline').length}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {equipment.map((eq) => (
            <EquipmentStatusCard key={eq.id} equipment={eq} />
          ))}
        </div>
      </div>

      {/* 실시간 메트릭 */}
      <RealTimeMetrics />
    </div>
  );
}
