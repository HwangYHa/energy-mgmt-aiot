'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Zap,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Leaf,
  Target,
  Activity,
  Radio,
  MonitorSmartphone,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

interface MonitoringData {
  realtime: {
    currentPower: number;
    dailyUsage: number;
    peakRatio: number;
    estimatedCost: number;
  };
  devices: {
    total: number;
    online: number;
    offline: number;
    error: number;
  };
  sensors: {
    total: number;
    online: number;
    types: Array<{ type: string; count: number }>;
  };
  kpis: {
    equipmentRate: number;
    carbonGoal: number;
  };
  dataSource: 'db' | 'simulation';
}

const SENSOR_TYPE_LABELS: Record<string, string> = {
  power_meter: '전력계',
  energy_meter: '전력량계',
  temperature: '온도',
  humidity: '습도',
  pressure: '압력',
  flow_meter: '유량',
  vibration: '진동',
  gas: '가스',
  co2: 'CO2',
  light: '조도',
};

export default function MonitoringPage() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(10);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/stats');
      const json = await res.json();
      if (json.success) {
        setData({
          realtime: json.data.realtime,
          devices: json.data.devices,
          sensors: json.data.sensors,
          kpis: {
            equipmentRate: json.data.kpis.equipmentRate,
            carbonGoal: json.data.kpis.carbonGoal,
          },
          dataSource: json.data.dataSource,
        });
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      fetchData();
    }, refreshInterval * 1000);
    return () => clearInterval(timer);
  }, [fetchData, refreshInterval]);

  const getSystemStatus = () => {
    if (!data) return { status: 'normal', label: '로딩 중', color: 'bg-gray-600' };
    if (data.devices.error > 0) return { status: 'critical', label: '위험', color: 'bg-red-600' };
    if (data.devices.offline > 2 || data.realtime.peakRatio > 90) return { status: 'warning', label: '주의', color: 'bg-amber-500' };
    return { status: 'normal', label: '정상', color: 'bg-green-600' };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 bg-slate-900">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const systemStatus = getSystemStatus();
  const carbonEmission = data.realtime.dailyUsage * 0.4567;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 space-y-4">
      {/* 상태 배너 */}
      <div className={`${systemStatus.color} rounded-lg p-4 flex items-center justify-between shadow-lg`}>
        <div className="flex items-center gap-4">
          {systemStatus.status === 'normal' ? (
            <CheckCircle2 className="w-8 h-8" />
          ) : (
            <AlertTriangle className="w-8 h-8" />
          )}
          <div>
            <div className="text-2xl font-bold">{systemStatus.label}</div>
            <div className="text-sm opacity-90">
              디바이스 {data.devices.online}/{data.devices.total} 가동 중
              {data.devices.error > 0 && ` · 오류 ${data.devices.error}건`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {data.dataSource === 'simulation' && (
            <span className="text-xs bg-white/20 px-2 py-1 rounded">시뮬레이션</span>
          )}
          <div className="text-right">
            <div className="text-sm opacity-75">마지막 업데이트</div>
            <div className="text-lg font-mono">{currentTime.toLocaleTimeString('ko-KR')}</div>
          </div>
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="bg-white/20 border border-white/30 rounded px-2 py-1 text-sm"
          >
            <option value={5}>5초</option>
            <option value={10}>10초</option>
            <option value={30}>30초</option>
            <option value={60}>1분</option>
          </select>
        </div>
      </div>

      {/* 핵심 지표 */}
      <div className="grid grid-cols-4 gap-4">
        {/* 실시간 전력 */}
        <div className="bg-slate-800 rounded-lg p-5 border-2 border-amber-500/50 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <span className="text-xs text-gray-400">실시간 전력</span>
            </div>
            {data.realtime.peakRatio > 70 ? (
              <TrendingUp className="w-4 h-4 text-red-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-green-400" />
            )}
          </div>
          <div className="text-4xl font-bold text-amber-400">{data.realtime.currentPower.toLocaleString()}</div>
          <div className="text-sm text-gray-400 mt-1">kW</div>
          <div className="mt-3 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${data.realtime.peakRatio > 90 ? 'bg-red-500' : data.realtime.peakRatio > 70 ? 'bg-amber-400' : 'bg-green-400'}`}
              style={{ width: `${Math.min(data.realtime.peakRatio, 100)}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1">피크 대비 {data.realtime.peakRatio}%</div>
        </div>

        {/* 금일 사용량 */}
        <div className="bg-slate-800 rounded-lg p-5 border border-slate-700 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-5 h-5 text-blue-400" />
            <span className="text-xs text-gray-400">금일 사용량</span>
          </div>
          <div className="text-4xl font-bold text-blue-400">
            {data.realtime.dailyUsage >= 1000
              ? (data.realtime.dailyUsage / 1000).toFixed(1)
              : data.realtime.dailyUsage}
          </div>
          <div className="text-sm text-gray-400 mt-1">
            {data.realtime.dailyUsage >= 1000 ? 'MWh' : 'kWh'}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-700">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">예상 전력비</span>
              <span className="text-white font-medium">
                {data.realtime.estimatedCost >= 1000000
                  ? `₩${(data.realtime.estimatedCost / 1000000).toFixed(1)}M`
                  : `₩${data.realtime.estimatedCost.toLocaleString()}`}
              </span>
            </div>
          </div>
        </div>

        {/* 설비 가동률 */}
        <div className="bg-slate-800 rounded-lg p-5 border border-slate-700 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <MonitorSmartphone className="w-5 h-5 text-cyan-400" />
            <span className="text-xs text-gray-400">설비 가동률</span>
          </div>
          <div className={`text-4xl font-bold ${data.kpis.equipmentRate > 80 ? 'text-green-400' : data.kpis.equipmentRate > 50 ? 'text-amber-400' : 'text-red-400'}`}>
            {data.kpis.equipmentRate}%
          </div>
          <div className="text-sm text-gray-400 mt-1">{data.devices.online}대 / {data.devices.total}대</div>
          <div className="mt-3 h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-400 transition-all duration-500"
              style={{ width: `${data.kpis.equipmentRate}%` }}
            />
          </div>
        </div>

        {/* 탄소 배출 */}
        <div className="bg-slate-800 rounded-lg p-5 border border-green-700/50 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <Leaf className="w-5 h-5 text-green-400" />
            <span className="text-xs text-gray-400">금일 탄소 배출</span>
          </div>
          <div className="text-4xl font-bold text-green-400">{carbonEmission.toFixed(1)}</div>
          <div className="text-sm text-gray-400 mt-1">tCO₂</div>
          <div className="mt-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-green-400" />
            <span className="text-xs text-green-300">목표 달성률 {data.kpis.carbonGoal}%</span>
          </div>
        </div>
      </div>

      {/* 설비 & 센서 현황 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 설비 상태 */}
        <div className="bg-slate-800 rounded-lg p-5 border border-slate-700">
          <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <MonitorSmartphone className="w-4 h-4 text-cyan-400" />
            설비 현황
          </h3>
          <div className="grid grid-cols-4 gap-3">
            <DeviceStatBlock label="전체" value={data.devices.total} color="text-white" dotColor="bg-white" />
            <DeviceStatBlock label="운전 중" value={data.devices.online} color="text-green-400" dotColor="bg-green-400" />
            <DeviceStatBlock label="정지" value={data.devices.offline} color="text-gray-400" dotColor="bg-gray-400" />
            <DeviceStatBlock label="오류" value={data.devices.error} color="text-red-400" dotColor="bg-red-400" />
          </div>
        </div>

        {/* 센서 현황 */}
        <div className="bg-slate-800 rounded-lg p-5 border border-slate-700">
          <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            센서 현황
          </h3>
          <div className="flex items-center gap-8 mb-4">
            <div>
              <div className="text-3xl font-bold">{data.sensors.total}</div>
              <div className="text-xs text-gray-400">전체</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-400">{data.sensors.online}</div>
              <div className="text-xs text-gray-400">온라인</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-500">{data.sensors.total - data.sensors.online}</div>
              <div className="text-xs text-gray-400">오프라인</div>
            </div>
          </div>
          {data.sensors.types.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.sensors.types.map((t) => (
                <span key={t.type} className="text-xs bg-slate-700 px-2 py-1 rounded text-gray-300">
                  {SENSOR_TYPE_LABELS[t.type] || t.type}: {t.count}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 빠른 액션 */}
      <div className="grid grid-cols-4 gap-3">
        <a href="/control/manual" className="bg-blue-600 hover:bg-blue-700 p-4 rounded-lg font-bold text-center transition-colors">
          수동 제어
        </a>
        <a href="/sensors" className="bg-cyan-600 hover:bg-cyan-700 p-4 rounded-lg font-bold text-center transition-colors">
          센서 관리
        </a>
        <a href="/analytics/energy" className="bg-green-600 hover:bg-green-700 p-4 rounded-lg font-bold text-center transition-colors">
          에너지 분석
        </a>
        <a href="/analytics/forecast" className="bg-purple-600 hover:bg-purple-700 p-4 rounded-lg font-bold text-center transition-colors">
          AI 예측
        </a>
      </div>
    </div>
  );
}

function DeviceStatBlock({
  label,
  value,
  color,
  dotColor,
}: {
  label: string;
  value: number;
  color: string;
  dotColor: string;
}) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1.5 mb-1">
        <div className={`w-2 h-2 rounded-full ${dotColor}`} />
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  );
}
