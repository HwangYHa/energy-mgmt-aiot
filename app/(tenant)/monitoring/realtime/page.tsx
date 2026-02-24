'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Activity,
  MonitorSmartphone,
  Radio,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Wrench,
  Loader2,
  RefreshCw,
  Thermometer,
  Zap,
  Droplets,
  Gauge,
  Wind,
  Signal,
  Eye,
} from 'lucide-react';

interface DeviceItem {
  id: string;
  name: string;
  code: string | null;
  deviceType: string;
  status: 'online' | 'offline' | 'error' | 'maintenance';
  lastSeenAt: string | null;
  controlCapable: boolean;
  controlMode: string;
  site: { id: string; name: string };
}

interface SensorItem {
  id: string;
  name: string;
  code: string | null;
  sensorType: string;
  unit: string | null;
  status: string;
  lastValue: number | null;
  lastSeenAt: string | null;
  quality: string;
  minRange: number | null;
  maxRange: number | null;
  device: { id: string; name: string; siteId: string };
}

interface Anomaly {
  sensorId: string;
  sensorName: string;
  value: number;
  unit: string | null;
  type: string;
}

interface RealtimeData {
  timestamp: string;
  devices: DeviceItem[];
  deviceSummary: { total: number; online: number; offline: number; error: number; maintenance: number };
  sensors: SensorItem[];
  sensorSummary: { total: number; online: number; offline: number; error: number };
  anomalies: Anomaly[];
  activeAlertRules: number;
  recentMeasurementCount: number;
}

type DeviceStatusCfg = { label: string; color: string; bg: string; icon: typeof CheckCircle2 };
const STATUS_CONFIG: Record<string, DeviceStatusCfg> = {
  online: { label: '온라인', color: 'text-emerald-400', bg: 'bg-emerald-500/20', icon: CheckCircle2 },
  offline: { label: '오프라인', color: 'text-slate-400', bg: 'bg-slate-500/20', icon: XCircle },
  error: { label: '오류', color: 'text-red-400', bg: 'bg-red-500/20', icon: AlertTriangle },
  maintenance: { label: '점검중', color: 'text-amber-400', bg: 'bg-amber-500/20', icon: Wrench },
};

const SENSOR_ICONS: Record<string, typeof Thermometer> = {
  temperature: Thermometer,
  humidity: Droplets,
  pressure: Gauge,
  power_meter: Zap,
  energy_meter: Zap,
  flow_meter: Wind,
};

const REFRESH_OPTIONS = [
  { value: 5000, label: '5초' },
  { value: 10000, label: '10초' },
  { value: 30000, label: '30초' },
  { value: 60000, label: '1분' },
];

export default function RealtimeDashboardPage() {
  const [data, setData] = useState<RealtimeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(10000);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [filterSite, setFilterSite] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/monitoring/realtime');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setLastRefresh(new Date());
        setError(null);
      } else {
        setError('실시간 데이터를 불러오지 못했습니다.');
      }
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, refreshInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData, refreshInterval]);

  // 사이트 목록 추출
  const sites = data
    ? [...new Map(data.devices.map((d) => [d.site.id, d.site])).values()]
    : [];

  const filteredDevices = data?.devices.filter((d) =>
    filterSite ? d.site.id === filterSite : true
  ) || [];

  const filteredSensors = data?.sensors.filter((s) =>
    filterSite ? s.device.siteId === filterSite : true
  ) || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#051225] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mx-auto" />
          <p className="text-slate-400 mt-3">실시간 데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#051225] p-4 md:p-6">
      {/* 에러 배너 */}
      {error && !data && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-center justify-between">
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={fetchData} className="px-3 py-1.5 bg-red-500/20 text-red-300 rounded-lg text-sm hover:bg-red-500/30 transition">
            재시도
          </button>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <Activity className="w-6 h-6 text-cyan-400" />
            </div>
            실시간 모니터링
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            설비·센서 상태 및 측정값 실시간 모니터링
            {lastRefresh && (
              <span className="ml-2 text-slate-500">
                · 마지막 갱신: {lastRefresh.toLocaleTimeString('ko-KR')}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* 사이트 필터 */}
          {sites.length > 1 && (
            <select
              value={filterSite}
              onChange={(e) => setFilterSite(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">전체 사이트</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          {/* 뷰 모드 */}
          <div className="flex bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-2 text-sm ${viewMode === 'grid' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}
            >
              그리드
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-2 text-sm ${viewMode === 'table' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}
            >
              테이블
            </button>
          </div>
          {/* 갱신 주기 */}
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            {REFRESH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={fetchData}
            className="p-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition text-slate-400 hover:text-white"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 상태 요약 카드 */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          <SummaryCard icon={MonitorSmartphone} label="디바이스" value={data.deviceSummary.total} sub={`온라인 ${data.deviceSummary.online}`} color="text-cyan-400" />
          <SummaryCard icon={Radio} label="센서" value={data.sensorSummary.total} sub={`온라인 ${data.sensorSummary.online}`} color="text-blue-400" />
          <SummaryCard icon={CheckCircle2} label="정상" value={data.deviceSummary.online + data.sensorSummary.online} sub="디바이스+센서" color="text-emerald-400" />
          <SummaryCard icon={AlertTriangle} label="이상감지" value={data.anomalies.length} sub="범위 초과" color={data.anomalies.length > 0 ? 'text-red-400' : 'text-slate-400'} />
          <SummaryCard icon={Signal} label="최근 측정" value={data.recentMeasurementCount} sub="5분 이내" color="text-purple-400" />
          <SummaryCard icon={Eye} label="알림 규칙" value={data.activeAlertRules} sub="활성 규칙" color="text-amber-400" />
        </div>
      )}

      {/* 이상 감지 알림 */}
      {data && data.anomalies.length > 0 && (
        <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="font-semibold text-red-400">이상 감지 ({data.anomalies.length}건)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.anomalies.map((a) => (
              <div key={a.sensorId} className="flex items-center justify-between bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                <div>
                  <span className="text-sm text-white font-medium">{a.sensorName}</span>
                  <span className="text-xs text-red-400 ml-2">
                    {a.type === 'above_range' ? '상한 초과' : '하한 미달'}
                  </span>
                </div>
                <span className="text-sm font-bold text-red-400">{a.value} {a.unit || ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 디바이스 섹션 */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <MonitorSmartphone className="w-5 h-5 text-cyan-400" />
          디바이스 현황
          <span className="text-sm text-slate-400 font-normal ml-2">{filteredDevices.length}대</span>
        </h2>
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {filteredDevices.map((device) => {
              const cfg = (STATUS_CONFIG[device.status] || STATUS_CONFIG.offline) as DeviceStatusCfg;
              const StatusIcon = cfg.icon;
              return (
                <div key={device.id} className={`${cfg.bg} border border-slate-700/50 rounded-xl p-4 transition hover:border-slate-600`}>
                  <div className="flex items-center justify-between mb-2">
                    <StatusIcon className={`w-5 h-5 ${cfg.color}`} />
                    <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <div className="text-sm font-semibold text-white truncate">{device.name}</div>
                  <div className="text-xs text-slate-400 truncate">{device.site.name}</div>
                  <div className="text-xs text-slate-500 mt-1">{device.deviceType}</div>
                  {device.lastSeenAt && (
                    <div className="text-[10px] text-slate-600 mt-1">
                      {formatTimeAgo(device.lastSeenAt)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <DeviceTable devices={filteredDevices} />
        )}
      </section>

      {/* 센서 섹션 */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Radio className="w-5 h-5 text-blue-400" />
          센서 실시간 값
          <span className="text-sm text-slate-400 font-normal ml-2">{filteredSensors.length}개</span>
        </h2>
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredSensors.map((sensor) => {
              const cfg = (STATUS_CONFIG[sensor.status] || STATUS_CONFIG.offline) as DeviceStatusCfg;
              const SensorIcon = SENSOR_ICONS[sensor.sensorType] || Gauge;
              const isAnomaly = data?.anomalies.some((a) => a.sensorId === sensor.id);
              const valuePercent = getValuePercent(sensor.lastValue, sensor.minRange, sensor.maxRange);

              return (
                <div
                  key={sensor.id}
                  className={`rounded-xl border p-4 transition ${
                    isAnomaly
                      ? 'bg-red-500/10 border-red-500/30 animate-pulse'
                      : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <SensorIcon className={`w-4 h-4 ${cfg.color}`} />
                      <span className="text-sm font-medium text-white truncate">{sensor.name}</span>
                    </div>
                    <span className={`w-2.5 h-2.5 rounded-full ${
                      sensor.status === 'online' ? 'bg-emerald-400' :
                      sensor.status === 'error' ? 'bg-red-400' : 'bg-slate-500'
                    }`} />
                  </div>

                  {/* 값 표시 */}
                  <div className="text-center mb-3">
                    <div className={`text-3xl font-bold ${isAnomaly ? 'text-red-400' : 'text-white'}`}>
                      {sensor.lastValue !== null ? sensor.lastValue.toFixed(1) : '--'}
                    </div>
                    <div className="text-xs text-slate-400">{sensor.unit || '-'}</div>
                  </div>

                  {/* 범위 게이지 */}
                  {sensor.minRange !== null && sensor.maxRange !== null && (
                    <div className="mb-2">
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isAnomaly ? 'bg-red-400' :
                            valuePercent > 80 ? 'bg-amber-400' : 'bg-emerald-400'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, valuePercent))}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
                        <span>{sensor.minRange}</span>
                        <span>{sensor.maxRange}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>{sensor.device.name}</span>
                    <span className={sensor.quality === 'good' ? 'text-emerald-500' : 'text-amber-500'}>
                      {sensor.quality === 'good' ? '양호' : '불량'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <SensorTable sensors={filteredSensors} anomalyIds={data?.anomalies.map((a) => a.sensorId) || []} />
        )}
      </section>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, sub, color }: {
  icon: typeof Activity; label: string; value: number; sub: string; color: string;
}) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-slate-500">{sub}</div>
    </div>
  );
}

function DeviceTable({ devices }: { devices: DeviceItem[] }) {
  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700/50 bg-slate-800/50">
            <th className="text-left py-3 px-4 text-slate-400 font-medium">상태</th>
            <th className="text-left py-3 px-4 text-slate-400 font-medium">디바이스</th>
            <th className="text-left py-3 px-4 text-slate-400 font-medium">유형</th>
            <th className="text-left py-3 px-4 text-slate-400 font-medium">사이트</th>
            <th className="text-left py-3 px-4 text-slate-400 font-medium">제어</th>
            <th className="text-left py-3 px-4 text-slate-400 font-medium">마지막 통신</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((d) => {
            const cfg = (STATUS_CONFIG[d.status] || STATUS_CONFIG.offline) as DeviceStatusCfg;
            return (
              <tr key={d.id} className="border-b border-slate-700/30 hover:bg-slate-800/30">
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${d.status === 'online' ? 'bg-emerald-400' : d.status === 'error' ? 'bg-red-400' : 'bg-slate-400'}`} />
                    {cfg.label}
                  </span>
                </td>
                <td className="py-3 px-4 text-white font-medium">{d.name}</td>
                <td className="py-3 px-4 text-slate-300">{d.deviceType}</td>
                <td className="py-3 px-4 text-slate-300">{d.site.name}</td>
                <td className="py-3 px-4">
                  {d.controlCapable ? (
                    <span className="text-xs text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">{d.controlMode}</span>
                  ) : (
                    <span className="text-xs text-slate-500">-</span>
                  )}
                </td>
                <td className="py-3 px-4 text-xs text-slate-500">{d.lastSeenAt ? formatTimeAgo(d.lastSeenAt) : '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SensorTable({ sensors, anomalyIds }: { sensors: SensorItem[]; anomalyIds: string[] }) {
  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700/50 bg-slate-800/50">
            <th className="text-left py-3 px-4 text-slate-400 font-medium">상태</th>
            <th className="text-left py-3 px-4 text-slate-400 font-medium">센서</th>
            <th className="text-left py-3 px-4 text-slate-400 font-medium">유형</th>
            <th className="text-right py-3 px-4 text-slate-400 font-medium">현재값</th>
            <th className="text-left py-3 px-4 text-slate-400 font-medium">품질</th>
            <th className="text-left py-3 px-4 text-slate-400 font-medium">디바이스</th>
          </tr>
        </thead>
        <tbody>
          {sensors.map((s) => {
            const isAnomaly = anomalyIds.includes(s.id);
            return (
              <tr key={s.id} className={`border-b border-slate-700/30 ${isAnomaly ? 'bg-red-500/5' : 'hover:bg-slate-800/30'}`}>
                <td className="py-3 px-4">
                  <span className={`w-2.5 h-2.5 rounded-full inline-block ${s.status === 'online' ? 'bg-emerald-400' : s.status === 'error' ? 'bg-red-400' : 'bg-slate-500'}`} />
                </td>
                <td className="py-3 px-4 text-white font-medium">
                  {s.name}
                  {isAnomaly && <AlertTriangle className="w-3.5 h-3.5 text-red-400 inline ml-1.5" />}
                </td>
                <td className="py-3 px-4 text-slate-300">{s.sensorType}</td>
                <td className={`py-3 px-4 text-right font-mono font-bold ${isAnomaly ? 'text-red-400' : 'text-white'}`}>
                  {s.lastValue !== null ? s.lastValue.toFixed(1) : '--'} <span className="text-xs text-slate-500 font-normal">{s.unit}</span>
                </td>
                <td className="py-3 px-4">
                  <span className={`text-xs ${s.quality === 'good' ? 'text-emerald-400' : 'text-amber-400'}`}>{s.quality === 'good' ? '양호' : '불량'}</span>
                </td>
                <td className="py-3 px-4 text-slate-400 text-xs">{s.device.name}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function getValuePercent(value: number | null, min: number | null, max: number | null): number {
  if (value === null || min === null || max === null || max === min) return 0;
  return ((value - min) / (max - min)) * 100;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}초 전`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}
