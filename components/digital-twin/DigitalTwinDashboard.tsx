/**
 * DigitalTwinDashboard
 *
 * 공간 계층 (Site → Building → Floor → Zone → Room) + 설비(TwinNode) 실시간 모니터링
 * - useSWR 기반 30초 자동 갱신
 * - 데이터 있는 사이트 우선 선택
 * - 시스템별 설비 분류 + 메트릭 카드
 */
'use client';

import { useState, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import {
  Loader2, AlertTriangle, RefreshCw, Zap, Activity,
  Thermometer, Wind, Droplets, Cpu, ChevronDown,
  ChevronRight, CheckCircle, XCircle, MapPin, Server,
  Gauge, Wifi, WifiOff, Wrench, ExternalLink,
} from 'lucide-react';
import {
  SpaceTreePanel,
  type SiteWithSpaces,
  type SpaceNode,
  type TwinNodeSummary,
} from './SpaceTreePanel';
import { SystemStatusIndicator } from './SystemStatusIndicator';
import { cn } from '@/lib/utils';

// ──────────────────────────────────────────────────────────────
// 상수
// ──────────────────────────────────────────────────────────────

const EQUIP_LABEL: Record<string, string> = {
  AHU: '공조기', FCU: '팬코일', CHILLER: '냉동기',
  COOLING_TOWER: '냉각탑', BOILER: '보일러', PUMP: '펌프',
  FAN: '팬', TRANSFORMER: '변압기', UPS: 'UPS',
  PANEL: '분전반', METER: '전력계', SENSOR: '센서', OTHER: '기타',
};

const SYSTEM_COLOR: Record<string, string> = {
  HVAC:       'text-cyan-400 bg-cyan-900/30 border-cyan-700/40',
  ELECTRICAL: 'text-yellow-400 bg-yellow-900/30 border-yellow-700/40',
  PLUMBING:   'text-blue-400 bg-blue-900/30 border-blue-700/40',
  FIRE_SAFETY:'text-red-400 bg-red-900/30 border-red-700/40',
  LIGHTING:   'text-amber-400 bg-amber-900/30 border-amber-700/40',
  MECHANICAL: 'text-purple-400 bg-purple-900/30 border-purple-700/40',
  OTHER:      'text-slate-400 bg-slate-700/30 border-slate-600/40',
};

const SYSTEM_LABEL: Record<string, string> = {
  HVAC: '냉난방공조', ELECTRICAL: '전기', PLUMBING: '배관/열',
  FIRE_SAFETY: '소방', LIGHTING: '조명', MECHANICAL: '기계', OTHER: '기타',
};

// ──────────────────────────────────────────────────────────────
// API 타입
// ──────────────────────────────────────────────────────────────

interface TreeApiResponse {
  sites: SiteWithSpaces[];
  summary: {
    totalSites: number;
    totalNodes: number;
    onlineNodes: number;
    totalPowerKw: number;
  };
}

// ──────────────────────────────────────────────────────────────
// SWR fetcher
// ──────────────────────────────────────────────────────────────

const fetcher = (url: string) =>
  fetch(url, { credentials: 'same-origin' }).then(async (res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message ?? 'API 오류');
    return json.data as TreeApiResponse;
  });

// ──────────────────────────────────────────────────────────────
// MetricPill
// ──────────────────────────────────────────────────────────────

function MetricPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 bg-slate-700/50 rounded-lg px-2 py-1.5 min-w-0">
      <span className="flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[9px] text-slate-500 leading-none">{label}</p>
        <p className="text-xs font-semibold text-slate-200 truncate">{value}</p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// DeviceStatusBadge
// ──────────────────────────────────────────────────────────────

function DeviceStatusBadge({ status }: { status: string }) {
  const cfg = {
    online:      { icon: Wifi,    cls: 'text-emerald-400', label: '정상' },
    offline:     { icon: WifiOff, cls: 'text-slate-500',   label: '오프라인' },
    error:       { icon: XCircle, cls: 'text-red-400',     label: '오류' },
    maintenance: { icon: Wrench,  cls: 'text-amber-400',   label: '정비중' },
  }[status] ?? { icon: WifiOff, cls: 'text-slate-500', label: status };

  const Icon = cfg.icon;
  return (
    <div className={cn('flex items-center gap-1 text-[10px]', cfg.cls)}>
      <Icon className="w-3.5 h-3.5" />
      <span>{cfg.label}</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// TwinNodeCard
// ──────────────────────────────────────────────────────────────

function TwinNodeCard({ node }: { node: TwinNodeSummary }) {
  const [expanded, setExpanded] = useState(false);
  const systemColor = SYSTEM_COLOR[node.systemType] ?? SYSTEM_COLOR.OTHER;
  const isOnline    = node.device.status === 'online';
  const m           = node.currentMetrics;
  const hasMetrics  =
    m.power !== null || m.temperature !== null || m.flowRate !== null ||
    m.cop !== null   || m.humidity !== null    || m.co2 !== null;

  return (
    <div className={cn(
      'rounded-xl border transition-all bg-slate-800/60',
      isOnline
        ? 'border-slate-700/60 hover:border-slate-600/60 hover:shadow-lg'
        : node.device.status === 'error'
        ? 'border-red-700/40 bg-red-900/10'
        : 'border-slate-700/40 opacity-65'
    )}>
      {/* 헤더 */}
      <div className="flex items-start justify-between p-3 gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn('flex-shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center', systemColor)}>
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate leading-tight">{node.device.name}</p>
            <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
              {EQUIP_LABEL[node.equipClass] ?? node.equipClass}
              {' · '}
              <span className="text-slate-600">{SYSTEM_LABEL[node.systemType] ?? node.systemType}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <DeviceStatusBadge status={node.device.status} />
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 핵심 메트릭 */}
      {hasMetrics && (
        <div className="grid grid-cols-2 gap-1.5 px-3 pb-3">
          {m.power !== null && (
            <MetricPill icon={<Zap className="w-3 h-3 text-yellow-400" />} label="전력" value={`${m.power} kW`} />
          )}
          {m.temperature !== null && (
            <MetricPill icon={<Thermometer className="w-3 h-3 text-orange-400" />} label="온도" value={`${m.temperature}°C`} />
          )}
          {m.flowRate !== null && (
            <MetricPill icon={<Droplets className="w-3 h-3 text-blue-400" />} label="유량" value={`${m.flowRate} m³/h`} />
          )}
          {m.cop !== null && (
            <MetricPill icon={<Gauge className="w-3 h-3 text-emerald-400" />} label="COP" value={m.cop.toFixed(2)} />
          )}
          {m.humidity !== null && (
            <MetricPill icon={<Wind className="w-3 h-3 text-cyan-400" />} label="습도" value={`${m.humidity}%`} />
          )}
          {m.co2 !== null && (
            <MetricPill icon={<Activity className="w-3 h-3 text-purple-400" />} label="CO₂" value={`${m.co2} ppm`} />
          )}
        </div>
      )}

      {/* 상세 펼치기 */}
      {expanded && (
        <div className="border-t border-slate-700/60 px-3 py-2.5 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">
              센서 ({node.sensors.length}개)
            </p>
            {node.device.controlCapable && (
              <span className="text-[10px] text-emerald-500 bg-emerald-900/20 px-1.5 py-0.5 rounded border border-emerald-700/30">
                제어가능 · {node.device.controlMode}
              </span>
            )}
          </div>
          {node.sensors.length === 0 ? (
            <p className="text-[11px] text-slate-600">등록된 센서 없음</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              {node.sensors.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-[11px] py-0.5 border-b border-slate-800/60 last:border-0">
                  <span className="text-slate-500 truncate">{s.sensorType.replace(/_/g, ' ')}</span>
                  <span className="text-slate-300 font-mono ml-2 flex-shrink-0">
                    {s.lastValue !== null ? `${s.lastValue} ${s.unit ?? ''}`.trim() : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 유틸: 공간 재귀 flatten
// ──────────────────────────────────────────────────────────────

function flattenSpaces(spaces: SpaceNode[]): SpaceNode[] {
  return spaces.flatMap((s) => [s, ...flattenSpaces(s.children)]);
}

function collectAllNodes(space: SpaceNode): TwinNodeSummary[] {
  return [...space.twinNodes, ...space.children.flatMap(collectAllNodes)];
}

// ──────────────────────────────────────────────────────────────
// SelectedSpaceView — 공간 클릭 시 해당 공간 + 하위 공간의 설비 표시
// ──────────────────────────────────────────────────────────────

function SelectedSpaceView({ space }: { space: SpaceNode }) {
  const allNodes = useMemo(() => collectAllNodes(space), [space]);
  const bySystem = useMemo(
    () => allNodes.reduce<Record<string, TwinNodeSummary[]>>((acc, n) => {
      acc[n.systemType] = [...(acc[n.systemType] ?? []), n];
      return acc;
    }, {}),
    [allNodes]
  );
  const totalPowerKw  = allNodes.reduce((s, n) => s + (n.currentMetrics.power ?? 0), 0);
  const onlineCount   = allNodes.filter((n) => n.device.status === 'online').length;
  const warningCount  = allNodes.filter((n) => n.device.status === 'error' || n.device.status === 'maintenance').length;

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <MapPin className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            {space.name}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {space.type} · Level {space.level}
            {space.code && ` · ${space.code}`}
            {' · '}설비 {allNodes.length}개
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {totalPowerKw > 0 && (
            <div className="flex items-center gap-1.5 bg-yellow-900/20 border border-yellow-700/30 rounded-lg px-3 py-1.5">
              <Zap className="w-4 h-4 text-yellow-400" />
              <div>
                <p className="text-[9px] text-yellow-600">총 전력</p>
                <p className="text-sm font-bold text-yellow-300">{Math.round(totalPowerKw * 10) / 10} kW</p>
              </div>
            </div>
          )}
          {warningCount > 0 && (
            <div className="flex items-center gap-1.5 bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-1.5">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <div>
                <p className="text-[9px] text-red-600">주의 필요</p>
                <p className="text-sm font-bold text-red-300">{warningCount}개</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-1.5 bg-emerald-900/20 border border-emerald-700/30 rounded-lg px-3 py-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <div>
              <p className="text-[9px] text-emerald-600">온라인</p>
              <p className="text-sm font-bold text-emerald-300">{onlineCount}/{allNodes.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 하위 공간 요약 */}
      {space.children.length > 0 && (
        <div>
          <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-2">하위 공간 ({space.children.length})</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {space.children.map((child) => (
              <div key={child.id} className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-2.5">
                <p className="text-[11px] text-slate-300 font-medium truncate">{child.name}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0',
                    child.totalNodes === 0 ? 'bg-slate-600'
                    : child.onlineNodes === child.totalNodes ? 'bg-emerald-500'
                    : child.onlineNodes === 0 ? 'bg-red-500' : 'bg-yellow-500'
                  )} />
                  <span className="text-[10px] text-slate-500">
                    {child.onlineNodes}/{child.totalNodes} 대
                  </span>
                  {child.totalPowerKw > 0 && (
                    <span className="text-[10px] text-yellow-600 ml-auto">{child.totalPowerKw}kW</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 시스템별 TwinNode */}
      {allNodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-600 gap-2">
          <Cpu className="w-8 h-8 opacity-30" />
          <p className="text-sm">이 공간에 등록된 설비가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(bySystem).map(([systemType, nodes]) => (
            <div key={systemType}>
              <div className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border mb-2.5',
                SYSTEM_COLOR[systemType] ?? SYSTEM_COLOR.OTHER
              )}>
                <div className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                {SYSTEM_LABEL[systemType] ?? systemType} ({nodes.length})
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {nodes.map((node) => (
                  <TwinNodeCard key={node.id} node={node} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// SiteOverview — 사이트 전체 현황 (사이트 클릭 시)
// ──────────────────────────────────────────────────────────────

function SiteOverview({ site }: { site: SiteWithSpaces }) {
  const allNodes   = useMemo(() => flattenSpaces(site.spaces).flatMap((s) => s.twinNodes), [site]);
  const bySystem   = useMemo(
    () => allNodes.reduce<Record<string, TwinNodeSummary[]>>((acc, n) => {
      acc[n.systemType] = [...(acc[n.systemType] ?? []), n];
      return acc;
    }, {}),
    [allNodes]
  );

  const onlineCount   = allNodes.filter((n) => n.device.status === 'online').length;
  const errorCount    = allNodes.filter((n) => n.device.status === 'error').length;
  const maintCount    = allNodes.filter((n) => n.device.status === 'maintenance').length;
  const offlineCount  = allNodes.filter((n) => n.device.status === 'offline').length;
  const score         = allNodes.length > 0 ? Math.round((onlineCount / allNodes.length) * 100) : 0;
  const overallStatus: 'normal' | 'warning' | 'critical' =
    errorCount > 0 ? 'critical' : score < 100 ? 'warning' : 'normal';
  const totalPower    = Math.round(allNodes.reduce((s, n) => s + (n.currentMetrics.power ?? 0), 0) * 10) / 10;

  return (
    <div className="space-y-5">
      {/* 시스템 상태 */}
      <SystemStatusIndicator
        status={overallStatus}
        message={
          allNodes.length === 0 ? '등록된 설비가 없습니다'
          : errorCount > 0      ? `${errorCount}개 설비 오류 — 점검이 필요합니다`
          : maintCount > 0      ? `${maintCount}개 설비 정비 중`
          : offlineCount > 0    ? `${offlineCount}개 설비 오프라인`
          : '모든 설비가 정상 작동 중입니다'
        }
        score={score}
        uptimePercent={allNodes.length > 0 ? (onlineCount / allNodes.length) * 100 : null}
      />

      {/* 사이트 요약 KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '총 설비',    value: String(allNodes.length),   sub: '등록 TwinNode', color: 'text-white' },
          { label: '온라인',     value: String(onlineCount),       sub: `${score}% 가동`,  color: 'text-emerald-400' },
          { label: '주의/오류',  value: String(errorCount + maintCount + offlineCount), sub: '점검 필요', color: errorCount > 0 ? 'text-red-400' : offlineCount > 0 ? 'text-slate-400' : 'text-emerald-400' },
          { label: '총 소비전력', value: `${totalPower} kW`,        sub: '현재 합산',     color: 'text-yellow-400' },
        ].map((k) => (
          <div key={k.label} className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{k.label}</p>
            <p className={cn('text-xl font-bold mt-0.5', k.color)}>{k.value}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* 시스템 분류 카드 */}
      {allNodes.length > 0 ? (
        <div>
          <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-3">시스템 분류</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(bySystem).map(([sys, nodes]) => {
              const online  = nodes.filter((n) => n.device.status === 'online').length;
              const errored = nodes.filter((n) => n.device.status === 'error').length;
              const pow     = Math.round(nodes.reduce((s, n) => s + (n.currentMetrics.power ?? 0), 0) * 10) / 10;
              return (
                <div key={sys} className={cn('rounded-xl border p-3', SYSTEM_COLOR[sys] ?? SYSTEM_COLOR.OTHER)}>
                  <p className="text-xs font-bold mb-1">{SYSTEM_LABEL[sys] ?? sys}</p>
                  <p className="text-2xl font-bold leading-none">{nodes.length}</p>
                  <div className="flex items-center justify-between mt-2 text-[10px] opacity-80">
                    <span>온라인 {online}개</span>
                    {errored > 0 && <span className="text-red-300">오류 {errored}</span>}
                  </div>
                  {pow > 0 && <p className="text-[10px] opacity-60 mt-0.5">{pow} kW</p>}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-slate-600 gap-2">
          <Server className="w-8 h-8 opacity-30" />
          <p className="text-sm">좌측 트리에서 공간을 선택하면 설비 현황을 확인할 수 있습니다.</p>
        </div>
      )}

      {/* 주의/오류 설비 목록 */}
      {(() => {
        const alertNodes = allNodes.filter(n => n.device.status === 'error' || n.device.status === 'maintenance' || n.device.status === 'offline');
        if (alertNodes.length === 0) return null;
        return (
          <div>
            <p className="text-[11px] text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              주의/오류 설비 ({alertNodes.length})
            </p>
            <div className="space-y-1.5">
              {alertNodes.map((n) => {
                const isError = n.device.status === 'error';
                const isMaint = n.device.status === 'maintenance';
                return (
                  <div key={n.id} className={cn(
                    'flex items-center justify-between rounded-lg border px-3 py-2 gap-2',
                    isError ? 'bg-red-900/15 border-red-700/40'
                    : isMaint ? 'bg-amber-900/15 border-amber-700/40'
                    : 'bg-slate-800/60 border-slate-700/40'
                  )}>
                    <div className="flex items-center gap-2 min-w-0">
                      {isError ? <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      : isMaint ? <Wrench className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      : <WifiOff className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />}
                      <span className="text-sm text-slate-200 truncate">{n.device.name}</span>
                      <span className="text-[10px] text-slate-600 flex-shrink-0">
                        {EQUIP_LABEL[n.equipClass] ?? n.equipClass}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={cn('text-[10px] font-medium',
                        isError ? 'text-red-400' : isMaint ? 'text-amber-400' : 'text-slate-500'
                      )}>
                        {isError ? '오류' : isMaint ? '정비중' : '오프라인'}
                      </span>
                      {n.device.id && (
                        <Link href={`/devices/${n.device.id}`}
                          className="text-cyan-600 hover:text-cyan-400 transition-colors"
                          title="설비 상세 보기">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// KPI 칩
// ──────────────────────────────────────────────────────────────

function KpiChip({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-3">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={cn('text-xl font-bold mt-0.5', color)}>{value}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 메인 대시보드
// ──────────────────────────────────────────────────────────────

export function DigitalTwinDashboard() {
  const [selectedSiteId,  setSelectedSiteId]  = useState<string | null>(null);
  const [selectedSpace,   setSelectedSpace]    = useState<SpaceNode | null>(null);

  const { data, error, isLoading, mutate } = useSWR<TreeApiResponse>(
    '/api/digital-twin/tree',
    fetcher,
    {
      refreshInterval: 30_000,
      revalidateOnFocus: true,
      dedupingInterval: 10_000,
      onSuccess: (d) => {
        // 데이터 있는 첫 번째 사이트 자동 선택 (최초 1회만)
        if (!selectedSiteId && d.sites.length > 0) {
          const preferred =
            d.sites.find((s) => s.summary.totalNodes > 0) ?? d.sites[0];
          setSelectedSiteId(preferred?.id ?? null);
        }
      },
    }
  );

  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await mutate();
    setIsRefreshing(false);
  }, [mutate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          <p className="text-sm font-mono tracking-wider">LOADING DIGITAL TWIN...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-red-400">{error.message}</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  const sites      = data?.sites ?? [];
  const summary    = data?.summary;
  const currentSite = sites.find((s) => s.id === selectedSiteId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      {/* KPI 바 */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiChip
            label="사이트"
            value={String(summary.totalSites)}
            sub="등록 현장"
            color="text-cyan-400"
          />
          <KpiChip
            label="총 설비"
            value={String(summary.totalNodes)}
            sub={`온라인 ${summary.onlineNodes}개`}
            color={
              summary.totalNodes === 0       ? 'text-slate-400'
              : summary.onlineNodes === summary.totalNodes ? 'text-emerald-400'
              : 'text-yellow-400'
            }
          />
          <KpiChip
            label="총 전력"
            value={`${summary.totalPowerKw} kW`}
            sub="현재 합산 소비"
            color="text-yellow-400"
          />
          <KpiChip
            label="가동률"
            value={
              summary.totalNodes > 0
                ? `${Math.round((summary.onlineNodes / summary.totalNodes) * 1000) / 10}%`
                : '—'
            }
            sub="온라인 비율"
            color={
              summary.totalNodes === 0       ? 'text-slate-400'
              : summary.onlineNodes === summary.totalNodes ? 'text-emerald-400'
              : 'text-yellow-400'
            }
          />
        </div>
      )}

      {/* 본문 2-패널 레이아웃 */}
      <div className="flex gap-3" style={{ minHeight: 620 }}>
        {/* 좌: 공간 트리 */}
        <div className="w-60 lg:w-68 flex-shrink-0 bg-slate-900/60 border border-slate-700/60 rounded-xl overflow-hidden">
          <SpaceTreePanel
            sites={sites}
            selectedSpaceId={selectedSpace?.id ?? null}
            selectedSiteId={selectedSiteId}
            onSelectSite={(siteId) => {
              setSelectedSiteId(siteId);
              setSelectedSpace(null);
            }}
            onSelectSpace={(_, space) => setSelectedSpace(space)}
          />
        </div>

        {/* 우: 선택 공간 or 사이트 전체 */}
        <div className="flex-1 min-w-0 bg-slate-900/40 border border-slate-700/60 rounded-xl flex flex-col">
          {/* 패널 상단 바 */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/60 flex-shrink-0">
            <div className="flex items-center gap-2">
              {selectedSpace ? (
                <>
                  <button
                    onClick={() => setSelectedSpace(null)}
                    className="text-slate-500 hover:text-slate-300 text-xs transition-colors flex items-center gap-1"
                  >
                    <ChevronRight className="w-3 h-3 rotate-180" />
                    {currentSite?.name}
                  </button>
                  <ChevronRight className="w-3 h-3 text-slate-600" />
                  <span className="text-xs text-slate-300">{selectedSpace.name}</span>
                </>
              ) : (
                <span className="text-xs text-slate-400">{currentSite?.name ?? '사이트 선택'}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {error && (
                <span className="text-[10px] text-amber-500">⚠ 갱신 실패 · 캐시 표시 중</span>
              )}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1 px-2.5 py-1 bg-slate-700/60 hover:bg-slate-600/60 rounded-lg text-[11px] text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-40"
              >
                <RefreshCw className={cn('w-3 h-3', isRefreshing && 'animate-spin')} />
                새로고침
                <span className="text-slate-600 ml-0.5">· 30s</span>
              </button>
            </div>
          </div>

          {/* 패널 내용 */}
          <div className="flex-1 overflow-y-auto p-4">
            {selectedSpace ? (
              <SelectedSpaceView space={selectedSpace} />
            ) : currentSite ? (
              <SiteOverview site={currentSite} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-2">
                <Server className="w-10 h-10 opacity-30" />
                <p className="text-sm">좌측 패널에서 사이트 또는 공간을 선택하세요</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
