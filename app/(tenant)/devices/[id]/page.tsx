'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, RefreshCw, Settings, Activity, Zap, Thermometer,
  Gauge, Cpu, Lightbulb, AlertCircle, CheckCircle,
  XCircle, WifiOff, MapPin, Radio,
  BarChart2, Loader2, Server,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiGet } from '@/lib/api/client';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface Metric {
  id: string;
  key: string;
  name: string;
  unit: string | null;
}

interface Sensor {
  id: string;
  name: string;
  sensorType: string;
  unit: string | null;
  lastValue: number | null;
  lastSeenAt: string | null;
  status: string;
}

interface DeviceDetail {
  id: string;
  name: string;
  deviceType: string;
  protocol: string;
  status: 'online' | 'offline' | 'error' | 'maintenance';
  controlCapable: boolean;
  controlMode: string;
  lastSeenAt: string | null;
  createdAt: string;
  site: { id: string; name: string; code: string | null } | null;
  gateway: { id: string; name: string; serialNumber: string | null; status: string } | null;
  metrics: Metric[];
  sensors: Sensor[];
  _count: { metrics: number; sensors: number };
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const STATUS_CONFIG = {
  online:      { label: '온라인',   icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  offline:     { label: '오프라인', icon: WifiOff,     color: 'text-slate-400',   bg: 'bg-slate-500/10 border-slate-500/30' },
  error:       { label: '오류',     icon: XCircle,     color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30' },
  maintenance: { label: '점검중',   icon: Settings,    color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30' },
};

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  HVAC: Thermometer,
  LIGHTING: Lightbulb,
  METER: Gauge,
  POWER_FACTOR: Zap,
  PRODUCTION_EQUIPMENT: Cpu,
  sensor_hub: Radio,
  OTHER: Server,
};

function DeviceIcon({ type, className }: { type: string; className?: string }) {
  const Icon = TYPE_ICON[type] ?? Server;
  return <Icon className={className} />;
}

function formatValue(v: number | null, unit: string | null): string {
  if (v === null) return '—';
  const rounded = Math.round(Number(v) * 100) / 100;
  return unit ? `${rounded} ${unit}` : `${rounded}`;
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  try {
    return format(new Date(d), 'yyyy-MM-dd HH:mm:ss', { locale: ko });
  } catch {
    return d;
  }
}

// ─────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────

export default function DeviceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [device, setDevice] = useState<DeviceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'metrics' | 'sensors'>('overview');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<DeviceDetail>(`/api/devices/${id}`);
      if (res.data) setDevice(res.data);
    } catch (e: any) {
      setError(e.message ?? '설비 정보를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mx-auto" />
          <p className="text-slate-400 text-sm">설비 정보 로드 중...</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error || !device) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center space-y-4 max-w-sm">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <p className="text-white font-semibold text-lg">설비를 찾을 수 없습니다</p>
          <p className="text-slate-400 text-sm">{error}</p>
          <Link href="/devices">
            <button className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg text-sm transition">
              목록으로 돌아가기
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[device.status] ?? STATUS_CONFIG.offline;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="flex flex-col gap-4 h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/devices">
            <button className="p-2 rounded-lg border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white transition">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700">
            <DeviceIcon type={device.deviceType} className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{device.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
                statusCfg.bg, statusCfg.color
              )}>
                <StatusIcon className="w-3 h-3" />
                {statusCfg.label}
              </span>
              <span className="text-xs text-slate-500">{device.deviceType}</span>
              <span className="text-xs text-slate-600">•</span>
              <span className="text-xs text-slate-500">{device.protocol}</span>
            </div>
          </div>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg border border-slate-700 hover:border-cyan-500/50 text-slate-400 hover:text-cyan-400 transition"
          title="새로고침"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-shrink-0">
        {[
          { label: '사이트', value: device.site?.name ?? '미등록', icon: MapPin, color: 'text-blue-400' },
          { label: '게이트웨이', value: device.gateway?.name ?? '직접 연결', icon: Radio, color: 'text-purple-400' },
          { label: '계측 항목', value: `${device._count.metrics}개`, icon: BarChart2, color: 'text-amber-400' },
          { label: '최근 통신', value: device.lastSeenAt ? format(new Date(device.lastSeenAt), 'HH:mm:ss') : '—', icon: Activity, color: 'text-emerald-400' },
        ].map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-slate-900 border border-slate-700/60 rounded-xl p-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-800">
                <Icon className={cn('w-4 h-4', card.color)} />
              </div>
              <div>
                <p className="text-[11px] text-slate-500">{card.label}</p>
                <p className="text-sm font-semibold text-white truncate">{card.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b border-slate-700/60 flex-shrink-0">
        {([
          { key: 'overview', label: '기본 정보' },
          { key: 'metrics',  label: `계측 데이터 (${device._count.metrics})` },
          { key: 'sensors',  label: `센서 (${device._count.sensors})` },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition',
              activeTab === tab.key
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 기본 정보 */}
            <div className="bg-slate-900 border border-slate-700/60 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">기본 정보</h3>
              {[
                { label: 'ID',        value: device.id, mono: true },
                { label: '장치명',    value: device.name },
                { label: '유형',      value: device.deviceType },
                { label: '프로토콜',  value: device.protocol },
                { label: '제어 모드', value: device.controlMode },
                { label: '제어 가능', value: device.controlCapable ? '가능' : '불가' },
                { label: '등록일',    value: formatDate(device.createdAt) },
                { label: '최근 통신', value: formatDate(device.lastSeenAt) },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-start gap-2 py-1.5 border-b border-slate-800 last:border-0">
                  <span className="text-xs text-slate-500 flex-shrink-0">{row.label}</span>
                  <span className={cn('text-xs text-slate-200 text-right break-all', row.mono && 'font-mono text-[10px] text-slate-400')}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            {/* 사이트 / 게이트웨이 */}
            <div className="space-y-4">
              {device.site && (
                <div className="bg-slate-900 border border-slate-700/60 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-400" /> 사이트
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs"><span className="text-slate-500">이름</span><span className="text-slate-200">{device.site.name}</span></div>
                    {device.site.code && <div className="flex justify-between text-xs"><span className="text-slate-500">코드</span><span className="text-slate-400 font-mono">{device.site.code}</span></div>}
                  </div>
                  <Link href={`/sites/${device.site.id}`}>
                    <button className="mt-3 text-xs text-cyan-400 hover:underline">사이트 보기 →</button>
                  </Link>
                </div>
              )}
              {device.gateway && (
                <div className="bg-slate-900 border border-slate-700/60 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                    <Radio className="w-4 h-4 text-purple-400" /> 게이트웨이
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs"><span className="text-slate-500">이름</span><span className="text-slate-200">{device.gateway.name}</span></div>
                    {device.gateway.serialNumber && <div className="flex justify-between text-xs"><span className="text-slate-500">S/N</span><span className="text-slate-400 font-mono">{device.gateway.serialNumber}</span></div>}
                    <div className="flex justify-between text-xs"><span className="text-slate-500">상태</span><span className={device.gateway.status === 'online' ? 'text-emerald-400' : 'text-slate-400'}>{device.gateway.status}</span></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'metrics' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {device.metrics.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
                <BarChart2 className="w-10 h-10 opacity-30" />
                <p className="text-sm">계측 데이터가 없습니다</p>
              </div>
            ) : device.metrics.map(m => (
              <div key={m.id} className="bg-slate-900 border border-slate-700/60 rounded-xl p-4">
                <p className="text-xs text-slate-500 mb-1">{m.name || m.key}</p>
                <p className="text-lg font-bold text-white font-mono">{m.unit ?? '—'}</p>
                <p className="text-[10px] text-slate-600 mt-1">{m.key}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'sensors' && (
          <div className="space-y-2">
            {device.sensors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
                <Activity className="w-10 h-10 opacity-30" />
                <p className="text-sm">연결된 센서가 없습니다</p>
              </div>
            ) : device.sensors.map(s => {
              const sCfg = STATUS_CONFIG[s.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.offline;
              const SIcon = sCfg.icon;
              return (
                <div key={s.id} className="bg-slate-900 border border-slate-700/60 rounded-xl p-3 flex items-center gap-4">
                  <div className={cn('p-2 rounded-lg', sCfg.bg)}>
                    <SIcon className={cn('w-4 h-4', sCfg.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{s.name}</p>
                    <p className="text-[11px] text-slate-500">{s.sensorType}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-white">{formatValue(s.lastValue, s.unit)}</p>
                    <p className="text-[10px] text-slate-600">
                      {s.lastSeenAt ? format(new Date(s.lastSeenAt), 'HH:mm') : '—'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
