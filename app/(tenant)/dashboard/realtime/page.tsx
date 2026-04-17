'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import {
  Activity,
  Wifi,
  WifiOff,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Radio,
  XCircle,
  Zap,
  Thermometer,
  Gauge,
  Bell,
} from 'lucide-react';

// ─── 타입 ──────────────────────────────────────────────────────

interface DeviceInfo {
  id: string;
  name: string;
  code: string;
  deviceType: string;
  status: 'online' | 'offline' | 'error' | 'maintenance';
  lastSeenAt: string | null;
  controlCapable: boolean;
  controlMode: string;
  site: { id: string; name: string } | null;
}

interface SensorInfo {
  id: string;
  name: string;
  code: string;
  sensorType: string;
  unit: string;
  status: 'online' | 'offline' | 'error';
  lastValue: number | null;
  lastSeenAt: string | null;
  quality: string;
  minRange: number | null;
  maxRange: number | null;
  device: { id: string; name: string; siteId: string } | null;
}

interface Anomaly {
  sensorId: string;
  sensorName: string;
  value: number | null;
  unit: string;
  minRange: number | null;
  maxRange: number | null;
  type: 'below_range' | 'above_range';
}

interface RealtimeData {
  timestamp: string;
  devices: DeviceInfo[];
  deviceSummary: { total: number; online: number; offline: number; error: number; maintenance: number };
  sensors: SensorInfo[];
  sensorSummary: { total: number; online: number; offline: number; error: number };
  anomalies: Anomaly[];
  activeAlertRules: number;
  recentMeasurementCount: number;
}

// ─── 상수 ──────────────────────────────────────────────────────

const DEVICE_STATUS_CONFIG = {
  online:      { label: '온라인',    color: 'text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-400' },
  offline:     { label: '오프라인',  color: 'text-slate-400',   bg: 'bg-slate-500/10',  dot: 'bg-slate-400' },
  error:       { label: '오류',      color: 'text-red-400',     bg: 'bg-red-500/10',    dot: 'bg-red-400' },
  maintenance: { label: '점검중',    color: 'text-amber-400',   bg: 'bg-amber-500/10',  dot: 'bg-amber-400' },
};

const SENSOR_TYPE_ICON: Record<string, React.ElementType> = {
  power:       Zap,
  temperature: Thermometer,
  pressure:    Gauge,
  default:     Radio,
};

const fetcher = (url: string) =>
  fetch(url, { credentials: 'same-origin' })
    .then(r => r.json())
    .then(j => j.data as RealtimeData);

function getSensorIcon(type: string): React.ElementType {
  return (SENSOR_TYPE_ICON[type] ?? SENSOR_TYPE_ICON['default']) as React.ElementType;
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60)  return `${sec}초 전`;
  const min = Math.floor(sec / 60);
  if (min < 60)  return `${min}분 전`;
  const hr = Math.floor(min / 60);
  return `${hr}시간 전`;
}

function formatValue(v: number | null, unit: string): string {
  if (v === null) return '—';
  return `${v.toLocaleString('ko-KR', { maximumFractionDigits: 2 })} ${unit}`;
}

// ─── 컴포넌트 ───────────────────────────────────────────────────

function StatusDot({ status }: { status: keyof typeof DEVICE_STATUS_CONFIG }) {
  const cfg = DEVICE_STATUS_CONFIG[status] ?? DEVICE_STATUS_CONFIG.offline;
  return (
    <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
      {status === 'online' && (
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.dot} opacity-60`} />
      )}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${cfg.dot}`} />
    </span>
  );
}

function SummaryCard({
  label, online, total, icon: Icon, errorCount = 0,
}: {
  label: string; online: number; total: number;
  icon: React.ElementType; errorCount?: number;
}) {
  const pct = total > 0 ? Math.round((online / total) * 100) : 0;
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-emerald-400" />
          <span className="text-sm text-slate-300">{label}</span>
        </div>
        {errorCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
            <AlertTriangle className="w-3 h-3" /> {errorCount}
          </span>
        )}
      </div>
      <div className="flex items-end gap-2 mb-2">
        <span className="text-3xl font-bold text-white">{online}</span>
        <span className="text-slate-500 text-sm mb-1">/ {total}</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-700 ${pct >= 80 ? 'bg-emerald-400' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-slate-500 mt-1 text-right">{pct}% 정상</div>
    </div>
  );
}

// ─── 메인 페이지 ────────────────────────────────────────────────

export default function RealtimePage() {
  const [isPaused, setIsPaused] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [siteFilter, setSiteFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading, isValidating, mutate } = useSWR<RealtimeData>(
    '/api/monitoring/realtime',
    fetcher,
    {
      refreshInterval: isPaused ? 0 : 5000,
      revalidateOnFocus: true,
      dedupingInterval: 3000,
      onSuccess: () => setLastUpdated(new Date()),
    }
  );

  // 사이트 목록 추출 (메모이제이션)
  const sites = useMemo(() =>
    data
      ? [...new Map(
          data.devices.filter(d => d.site).map(d => [d.site!.id, d.site!.name])
        ).entries()].map(([id, name]) => ({ id, name }))
      : [],
    [data]
  );

  // 필터링 (메모이제이션)
  const filteredDevices = useMemo(() =>
    (data?.devices ?? []).filter(d => {
      if (siteFilter && d.site?.id !== siteFilter) return false;
      if (statusFilter && d.status !== statusFilter) return false;
      return true;
    }),
    [data, siteFilter, statusFilter]
  );

  const filteredSensors = useMemo(() =>
    (data?.sensors ?? []).filter(s => {
      if (statusFilter && s.status !== statusFilter) return false;
      return true;
    }),
    [data, statusFilter]
  );

  const anomalyIds = useMemo(() =>
    new Set((data?.anomalies ?? []).map(a => a.sensorId)),
    [data]
  );

  return (
    <div className="h-full bg-[#051225] p-4 md:p-6">

      {/* ─── 헤더 ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <Activity className="w-6 h-6 text-emerald-400" />
            </div>
            실시간 모니터링
            <span className="flex items-center gap-1.5 text-xs font-normal bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              <span className={`w-1.5 h-1.5 rounded-full bg-emerald-400 ${!isPaused ? 'animate-pulse' : ''}`} />
              {isPaused ? 'PAUSED' : 'LIVE'}
            </span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {isPaused ? '일시정지됨' : '5초마다 자동 갱신'}
            {lastUpdated && <span className="ml-2 text-slate-500">마지막: {lastUpdated.toLocaleTimeString('ko-KR')}</span>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPaused(p => !p)}
            className={`px-3 py-2 rounded-lg text-xs font-medium border transition ${
              isPaused
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            {isPaused ? '▶ 재개' : '⏸ 일시정지'}
          </button>
          <button
            onClick={() => mutate()}
            disabled={isValidating}
            className="p-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 text-slate-400 disabled:opacity-50"
            title="수동 새로고침"
          >
            <RefreshCw className={`w-4 h-4 ${isValidating ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ─── 이상 탐지 배너 ───────────────────── */}
      {(data?.anomalies?.length ?? 0) > 0 && (
        <div className="mb-5 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-300 mb-1">
              {data!.anomalies.length}개 센서 이상 탐지
            </p>
            <div className="flex flex-wrap gap-2">
              {data!.anomalies.map((a) => (
                <span key={a.sensorId} className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
                  {a.sensorName}: {formatValue(a.value, a.unit)}
                  ({a.type === 'above_range' ? '상한 초과' : '하한 미달'})
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── 요약 카드 ────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard
          label="디바이스"
          online={data?.deviceSummary.online ?? 0}
          total={data?.deviceSummary.total ?? 0}
          errorCount={data?.deviceSummary.error ?? 0}
          icon={Cpu}
        />
        <SummaryCard
          label="센서"
          online={data?.sensorSummary.online ?? 0}
          total={data?.sensorSummary.total ?? 0}
          errorCount={data?.sensorSummary.error ?? 0}
          icon={Radio}
        />
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-cyan-400" />
            <span className="text-sm text-slate-300">활성 알림 규칙</span>
          </div>
          <div className="text-3xl font-bold text-cyan-400">{data?.activeAlertRules ?? 0}</div>
          <div className="text-xs text-slate-500 mt-1">설정된 임계값</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-slate-300">최근 5분 수신</span>
          </div>
          <div className="text-3xl font-bold text-purple-400">{data?.recentMeasurementCount ?? 0}</div>
          <div className="text-xs text-slate-500 mt-1">측정 데이터 건수</div>
        </div>
      </div>

      {/* ─── 필터 ─────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select
          value={siteFilter}
          onChange={e => setSiteFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="">모든 사이트</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="">모든 상태</option>
          <option value="online">온라인</option>
          <option value="offline">오프라인</option>
          <option value="error">오류</option>
          <option value="maintenance">점검중</option>
        </select>
        {(siteFilter || statusFilter) && (
          <button
            onClick={() => { setSiteFilter(''); setStatusFilter(''); }}
            className="text-xs text-slate-400 hover:text-white px-2 py-1.5 rounded border border-slate-700 hover:border-slate-600"
          >
            필터 초기화
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ─── 디바이스 목록 ─────────────────── */}
        <section>
          <h2 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
            <Cpu className="w-4 h-4" /> 디바이스 현황 ({filteredDevices.length})
          </h2>
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
            {filteredDevices.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">
                <Cpu className="w-8 h-8 mx-auto mb-2 opacity-30" />
                {isLoading ? '로딩 중...' : '디바이스가 없습니다'}
              </div>
            ) : (
              <div className="divide-y divide-slate-700/30">
                {filteredDevices.map(device => {
                  const cfg = DEVICE_STATUS_CONFIG[device.status] ?? DEVICE_STATUS_CONFIG.offline;
                  return (
                    <div key={device.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-800/30">
                      <StatusDot status={device.status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white font-medium truncate">{device.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">{device.code}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-slate-500">{device.site?.name ?? '—'}</span>
                          <span className="text-xs text-slate-600">{device.deviceType}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <div className="text-[10px] text-slate-600 mt-1">
                          {formatRelativeTime(device.lastSeenAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ─── 센서 목록 ─────────────────────── */}
        <section>
          <h2 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
            <Radio className="w-4 h-4" /> 센서 실시간 값 ({filteredSensors.length})
          </h2>
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
            {filteredSensors.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">
                <Radio className="w-8 h-8 mx-auto mb-2 opacity-30" />
                {isLoading ? '로딩 중...' : '센서가 없습니다'}
              </div>
            ) : (
              <div className="divide-y divide-slate-700/30">
                {filteredSensors.map(sensor => {
                  const Icon = getSensorIcon(sensor.sensorType);
                  const isAnomaly = anomalyIds.has(sensor.id);
                  const isOnline = sensor.status === 'online';
                  return (
                    <div key={sensor.id} className={`px-4 py-3 flex items-center gap-3 hover:bg-slate-800/30 ${isAnomaly ? 'bg-red-500/5' : ''}`}>
                      <div className={`p-1.5 rounded-lg flex-shrink-0 ${isAnomaly ? 'bg-red-500/20' : isOnline ? 'bg-emerald-500/10' : 'bg-slate-700/50'}`}>
                        <Icon className={`w-3.5 h-3.5 ${isAnomaly ? 'text-red-400' : isOnline ? 'text-emerald-400' : 'text-slate-500'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white font-medium truncate">{sensor.name}</span>
                          {isAnomaly && <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate">
                          {sensor.device?.name ?? '—'} · {sensor.sensorType}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {isOnline ? (
                          <span className={`text-sm font-bold font-mono ${isAnomaly ? 'text-red-400' : 'text-emerald-400'}`}>
                            {formatValue(sensor.lastValue, sensor.unit)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">
                            {sensor.status === 'error' ? (
                              <XCircle className="w-4 h-4 text-red-400 inline" />
                            ) : (
                              <WifiOff className="w-4 h-4 text-slate-500 inline" />
                            )}
                          </span>
                        )}
                        <div className="text-[10px] text-slate-600 mt-1">
                          {formatRelativeTime(sensor.lastSeenAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ─── 오프라인 디바이스 경고 ─────────── */}
      {(data?.deviceSummary.offline ?? 0) + (data?.deviceSummary.error ?? 0) > 0 && (
        <div className="mt-6 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <WifiOff className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-400">연결 끊긴 디바이스</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {data!.devices
              .filter(d => d.status === 'offline' || d.status === 'error')
              .map(d => (
                <div key={d.id} className="flex items-center gap-1.5 text-xs bg-slate-800 rounded px-2 py-1">
                  {d.status === 'error'
                    ? <XCircle className="w-3 h-3 text-red-400" />
                    : <WifiOff className="w-3 h-3 text-slate-500" />}
                  <span className="text-slate-300">{d.name}</span>
                  <span className="text-slate-500">{formatRelativeTime(d.lastSeenAt)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ─── 데이터 없음 안내 ─────────────────── */}
      {!isLoading && data && data.devices.length === 0 && data.sensors.length === 0 && (
        <div className="mt-8 text-center py-16 bg-slate-800/30 border border-slate-700/50 rounded-xl">
          <Wifi className="w-12 h-12 mx-auto mb-4 text-slate-600 opacity-50" />
          <p className="text-slate-400 font-medium">연결된 디바이스가 없습니다</p>
          <p className="text-slate-500 text-sm mt-2">
            운영 관리 &gt; 디바이스 관리에서 디바이스를 등록하고 게이트웨이를 연결하세요.
          </p>
        </div>
      )}
    </div>
  );
}
