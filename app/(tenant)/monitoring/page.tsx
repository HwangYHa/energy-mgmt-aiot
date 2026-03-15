'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
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
  MapPin,
  XCircle,
  WifiOff,
  Wrench,
  ExternalLink,
} from 'lucide-react';

interface Site {
  id: string;
  name: string;
  code: string;
  siteType: string;
}

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

interface ErrorDevice {
  id: string;
  name: string;
  deviceType: string;
  status: string;
  lastSeenAt: string | null;
  site: { name: string } | null;
}

export default function MonitoringPage() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(10);
  const [errorDevices, setErrorDevices] = useState<ErrorDevice[]>([]);

  // 사이트 목록 로드 (최초 1회)
  useEffect(() => {
    fetch('/api/sites?take=100')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setSites(json.data);
        }
      })
      .catch(() => {/* 사이트 목록 로드 실패 시 무시 */});
  }, []);

  const fetchData = useCallback(async (siteId?: string) => {
    try {
      const url = siteId ? `/api/dashboard/stats?siteId=${siteId}` : '/api/dashboard/stats';
      const res = await fetch(url);
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
        // 오류/점검/오프라인 설비 상세 조회
        const devUrl = siteId
          ? `/api/devices?siteId=${siteId}&take=20`
          : '/api/devices?take=20';
        const devRes = await fetch(devUrl);
        const devJson = await devRes.json();
        if (devJson.success && Array.isArray(devJson.data)) {
          setErrorDevices(
            devJson.data.filter((d: ErrorDevice) =>
              d.status === 'error' || d.status === 'maintenance' || d.status === 'offline'
            )
          );
        }
      }
    } catch {
      setError('모니터링 데이터를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(selectedSiteId || undefined);
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      fetchData(selectedSiteId || undefined);
    }, refreshInterval * 1000);
    return () => clearInterval(timer);
  }, [fetchData, refreshInterval, selectedSiteId]);

  const getSystemStatus = () => {
    if (!data) return { status: 'normal', label: '로딩 중', color: 'bg-slate-600' };
    if (data.devices.error > 0) return { status: 'critical', label: '위험', color: 'bg-red-600' };
    if (data.devices.offline > 2 || data.realtime.peakRatio > 90) return { status: 'warning', label: '주의', color: 'bg-amber-500' };
    return { status: 'normal', label: '정상', color: 'bg-green-600' };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 bg-[#051225]">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full bg-[#051225] text-white flex items-center justify-center">
        <div className="text-center">
          {error ? (
            <>
              <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
              <p className="text-red-300 mb-3">{error}</p>
              <button onClick={() => fetchData(selectedSiteId || undefined)} className="px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition">
                재시도
              </button>
            </>
          ) : (
            <p className="text-slate-400">데이터가 없습니다.</p>
          )}
        </div>
      </div>
    );
  }

  const systemStatus = getSystemStatus();
  const carbonEmission = data.realtime.dailyUsage * 0.4567;

  const selectedSite = sites.find((s) => s.id === selectedSiteId);

  return (
    <div className="h-full bg-[#051225] text-white p-6 space-y-4">
      {/* 사이트 선택 바 */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-3 flex items-center gap-3">
        <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
        <span className="text-sm text-gray-400 shrink-0">모니터링 범위</span>
        <select
          value={selectedSiteId}
          onChange={(e) => {
            setSelectedSiteId(e.target.value);
            setIsLoading(true);
          }}
          className="bg-slate-700 border border-slate-600 text-white rounded px-3 py-1.5 text-sm cursor-pointer focus:outline-none focus:border-cyan-500 min-w-[200px]"
        >
          <option value="" className="bg-slate-700 text-white">전체 사이트</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id} className="bg-slate-700 text-white">
              {s.name} ({s.code})
            </option>
          ))}
        </select>
        {selectedSite && (
          <span className="text-xs text-cyan-300 bg-cyan-900/40 border border-cyan-700/50 px-2 py-1 rounded">
            {selectedSite.siteType}
          </span>
        )}
        {!selectedSiteId && sites.length > 0 && (
          <span className="text-xs text-gray-500">— {sites.length}개 사이트 전체</span>
        )}
      </div>

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
              {selectedSite ? `[${selectedSite.name}] ` : ''}
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
            className="bg-slate-700 border border-slate-600 text-white rounded px-2 py-1 text-sm cursor-pointer focus:outline-none focus:border-cyan-500"
          >
            <option value={5} className="bg-slate-700 text-white">5초</option>
            <option value={10} className="bg-slate-700 text-white">10초</option>
            <option value={30} className="bg-slate-700 text-white">30초</option>
            <option value={60} className="bg-slate-700 text-white">1분</option>
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

      {/* 오류/주의 설비 상세 */}
      {errorDevices.length > 0 && (
        <div className="bg-slate-800 rounded-lg border border-red-800/40 p-5">
          <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            주의·오류 설비 ({errorDevices.length}대) — 즉시 확인 필요
          </h3>
          <div className="space-y-2">
            {errorDevices.map((dev) => {
              const isError = dev.status === 'error';
              const isMaint = dev.status === 'maintenance';
              return (
                <div key={dev.id} className={`flex items-center justify-between rounded-lg border px-4 py-2.5 ${
                  isError ? 'bg-red-900/20 border-red-700/40'
                  : isMaint ? 'bg-amber-900/20 border-amber-700/40'
                  : 'bg-slate-700/30 border-slate-600/40'
                }`}>
                  <div className="flex items-center gap-3">
                    {isError ? <XCircle className="w-4 h-4 text-red-400" />
                    : isMaint ? <Wrench className="w-4 h-4 text-amber-400" />
                    : <WifiOff className="w-4 h-4 text-slate-500" />}
                    <div>
                      <p className="text-sm font-medium text-white">{dev.name}</p>
                      <p className="text-xs text-slate-500">
                        {dev.deviceType}{dev.site ? ` · ${dev.site.name}` : ''}
                        {dev.lastSeenAt && ` · 최근 통신: ${new Date(dev.lastSeenAt).toLocaleString('ko-KR')}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      isError ? 'bg-red-900/50 text-red-400'
                      : isMaint ? 'bg-amber-900/50 text-amber-400'
                      : 'bg-slate-700 text-slate-400'
                    }`}>
                      {isError ? '오류' : isMaint ? '점검중' : '오프라인'}
                    </span>
                    <Link href={`/devices/${dev.id}`} className="text-cyan-500 hover:text-cyan-400 transition-colors" title="상세 보기">
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 빠른 액션 */}
      <div className="grid grid-cols-4 gap-3">
        <a
          href={selectedSiteId ? `/control/manual?siteId=${selectedSiteId}` : '/control/manual'}
          className="bg-blue-600 hover:bg-blue-700 p-4 rounded-lg font-bold text-center transition-colors"
        >
          수동 제어
        </a>
        <a
          href={selectedSiteId ? `/devices?siteId=${selectedSiteId}` : '/devices'}
          className="bg-cyan-600 hover:bg-cyan-700 p-4 rounded-lg font-bold text-center transition-colors"
        >
          설비 관리
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
