'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Zap,
  TrendingDown,
  RefreshCw,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { SystemStatusIndicator } from './SystemStatusIndicator';
import { EnergyFlowDiagram } from './EnergyFlowDiagram';
import { EquipmentStatusCard } from './EquipmentStatusCard';
import { RealTimeMetrics } from './RealTimeMetrics';

/**
 * 디지털 트윈 메인 대시보드
 * 실시간 시설 상태 모니터링 및 즉시 판단
 * /api/dashboard/realtime 30초 폴링으로 실제 DB 데이터 표시
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

interface RealtimeDevice {
  id: string;
  name: string;
  deviceType: string;
  status: string;
  lastSeenAt: string | null;
}

interface RealtimeSensor {
  id: string;
  sensorType: string;
  lastValue: number | null;
  device: { id: string; name: string; siteId: string } | null;
}

interface DeviceSummary {
  total: number;
  online: number;
  offline: number;
  error: number;
  maintenance: number;
}

export function DigitalTwinDashboard() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    overall: 'normal',
    message: '데이터 로딩 중...',
    score: 0,
  });

  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [uptimePercent, setUptimePercent] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/realtime');
      if (!res.ok) return;
      const json = await res.json();
      if (!json.success) return;

      const { devices, sensors, deviceSummary } = json.data as {
        devices: RealtimeDevice[];
        sensors: RealtimeSensor[];
        deviceSummary: DeviceSummary;
      };

      // Device → Equipment 매핑
      const equipmentList: Equipment[] = devices.map((d) => {
        const powerSensor = sensors.find(
          (s) => s.device?.id === d.id && s.sensorType === 'power_meter'
        );
        const tempSensor = sensors.find(
          (s) => s.device?.id === d.id && s.sensorType === 'temperature'
        );

        const status: Equipment['status'] =
          d.status === 'online' ? 'online' :
          d.status === 'error' ? 'offline' : 'warning';

        return {
          id: d.id,
          name: d.name,
          type: d.deviceType,
          status,
          power: powerSensor?.lastValue ?? 0,
          efficiency: 0,
          temperature: tempSensor?.lastValue ?? undefined,
          lastUpdate: d.lastSeenAt || new Date().toISOString(),
        };
      });

      setEquipment(equipmentList);

      // 가동률 계산 (online / total)
      const uptime =
        deviceSummary.total > 0
          ? (deviceSummary.online / deviceSummary.total) * 100
          : null;
      setUptimePercent(uptime);

      // 시스템 상태 집계
      const warningCount = deviceSummary.offline + deviceSummary.maintenance;
      if (deviceSummary.error > 0) {
        setSystemStatus({
          overall: 'critical',
          message: `${deviceSummary.error}개 설비에 긴급 조치가 필요합니다`,
          score: 65,
        });
      } else if (warningCount > 0) {
        setSystemStatus({
          overall: 'warning',
          message: `${warningCount}개 설비에 주의가 필요합니다`,
          score: 82,
        });
      } else if (deviceSummary.total === 0) {
        setSystemStatus({
          overall: 'normal',
          message: '등록된 설비가 없습니다',
          score: 0,
        });
      } else {
        setSystemStatus({
          overall: 'normal',
          message: '모든 시스템이 정상 작동 중입니다',
          score: 98,
        });
      }
    } catch (err) {
      console.error('[DigitalTwin]', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30000);
    return () => clearInterval(id);
  }, [fetchData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  const totalPower = equipment.reduce((sum, eq) => sum + eq.power, 0);

  return (
    <div className="space-y-6">
      {/* 전체 상태 및 주요 메트릭 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 메인 상태 인디케이터 */}
        <div className="lg:col-span-2">
          <SystemStatusIndicator
            status={systemStatus.overall}
            message={systemStatus.message}
            score={systemStatus.score}
            uptimePercent={uptimePercent}
            latencyMs={null}
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
              {totalPower > 0 ? `${totalPower.toFixed(1)} kW` : '-'}
            </div>
            {totalPower > 0 && (
              <div className="flex items-center gap-1 mt-2 text-sm text-slate-500 dark:text-slate-400">
                <TrendingDown className="w-4 h-4" />
                <span>설비 합산</span>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                정상 가동 설비
              </span>
              <Activity className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">
              {equipment.length > 0
                ? `${equipment.filter((e) => e.status === 'online').length} / ${equipment.length}`
                : '-'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              경고: {equipment.filter((e) => e.status === 'warning').length} •
              오프라인: {equipment.filter((e) => e.status === 'offline').length}
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

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : equipment.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
            <AlertTriangle className="w-10 h-10" />
            <p className="text-sm">등록된 설비가 없습니다.</p>
            <p className="text-xs text-slate-500">디바이스와 센서를 먼저 등록하세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {equipment.map((eq) => (
              <EquipmentStatusCard key={eq.id} equipment={eq} />
            ))}
          </div>
        )}
      </div>

      {/* 실시간 메트릭 */}
      <RealTimeMetrics />
    </div>
  );
}
