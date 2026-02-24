/**
 * DigitalTwinDashboard
 *
 * 단순 모니터링 대시보드 → 실제 디지털 트윈으로의 전환점
 *
 * 핵심 차이:
 *  - 이전: Device[] 단순 리스트 (공간 개념 없음)
 *  - 현재: Site → Building → Floor → Zone → Room → TwinNode (공간 계층 + 설비 매핑)
 *
 * 레이아웃:
 *  [좌: SpaceTreePanel] [중앙: 선택된 공간의 설비 목록]
 *
 * 데이터 소스:
 *  - GET /api/digital-twin/tree  (30초 폴링)
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  AlertTriangle,
  RefreshCw,
  Zap,
  Activity,
  Thermometer,
  Wind,
  Droplets,
  Server,
  Cpu,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  MapPin,
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
// EquipClass 표시명 + 시스템 컬러
// ──────────────────────────────────────────────────────────────

const EQUIP_LABEL: Record<string, string> = {
  AHU: '공조기', FCU: 'FCU', CHILLER: '냉동기',
  COOLING_TOWER: '냉각탑', BOILER: '보일러', PUMP: '펌프',
  FAN: '팬', TRANSFORMER: '변압기', UPS: 'UPS',
  PANEL: '분전반', METER: '전력계', SENSOR: '센서', OTHER: '기타',
};

const SYSTEM_COLOR: Record<string, string> = {
  HVAC: 'text-cyan-400 bg-cyan-900/30 border-cyan-700/40',
  ELECTRICAL: 'text-yellow-400 bg-yellow-900/30 border-yellow-700/40',
  PLUMBING: 'text-blue-400 bg-blue-900/30 border-blue-700/40',
  FIRE_SAFETY: 'text-red-400 bg-red-900/30 border-red-700/40',
  LIGHTING: 'text-amber-400 bg-amber-900/30 border-amber-700/40',
  MECHANICAL: 'text-purple-400 bg-purple-900/30 border-purple-700/40',
  OTHER: 'text-slate-400 bg-slate-700/30 border-slate-600/40',
};

// ──────────────────────────────────────────────────────────────
// MetricPill
// ──────────────────────────────────────────────────────────────

function MetricPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5 bg-slate-700/40 rounded-lg px-2 py-1.5">
      {icon}
      <div className="min-w-0">
        <p className="text-[9px] text-slate-500 leading-none">{label}</p>
        <p className="text-xs font-semibold text-slate-200 truncate">{value}</p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// TwinNodeCard
// ──────────────────────────────────────────────────────────────

function TwinNodeCard({ node }: { node: TwinNodeSummary }) {
  const [expanded, setExpanded] = useState(false);
  const systemColor = SYSTEM_COLOR[node.systemType] ?? SYSTEM_COLOR.OTHER;
  const isOnline = node.device.status === 'online';
  const m = node.currentMetrics;
  const hasMetrics =
    m.power !== null || m.temperature !== null || m.flowRate !== null ||
    m.cop !== null || m.humidity !== null || m.co2 !== null;

  return (
    <div
      className={cn(
        'rounded-xl border transition-shadow hover:shadow-lg bg-slate-800/60 border-slate-700/60',
        !isOnline && 'opacity-60'
      )}
    >
      {/* 헤더 */}
      <div className="flex items-start justify-between p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              'flex-shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center',
              systemColor
            )}
          >
            <Cpu className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{node.device.name}</p>
            <p className="text-[10px] text-slate-500">
              {EQUIP_LABEL[node.equipClass] ?? node.equipClass}
              {' · '}
              <span className={node.systemType === 'HVAC' ? 'text-cyan-500' : 'text-slate-500'}>
                {node.systemType}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <div className="flex items-center gap-1">
            {isOnline ? (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            ) : (
              <XCircle className="w-4 h-4 text-red-400" />
            )}
            <span className={cn('text-[10px]', isOnline ? 'text-emerald-400' : 'text-red-400')}>
              {isOnline ? '정상' : node.device.status === 'error' ? '오류' : '오프라인'}
            </span>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded hover:bg-slate-700 text-slate-500"
          >
            {expanded
              ? <ChevronDown className="w-3.5 h-3.5" />
              : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 핵심 메트릭 */}
      <div className="grid grid-cols-2 gap-2 px-4 pb-3">
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
          <MetricPill icon={<Activity className="w-3 h-3 text-emerald-400" />} label="COP" value={m.cop.toFixed(2)} />
        )}
        {m.humidity !== null && (
          <MetricPill icon={<Wind className="w-3 h-3 text-cyan-400" />} label="습도" value={`${m.humidity}%`} />
        )}
        {m.co2 !== null && (
          <MetricPill icon={<Activity className="w-3 h-3 text-purple-400" />} label="CO₂" value={`${m.co2} ppm`} />
        )}
        {!hasMetrics && (
          <p className="col-span-2 text-[11px] text-slate-600 text-center py-1">센서 데이터 없음</p>
        )}
      </div>

      {/* 상세 (펼치기) */}
      {expanded && (
        <div className="border-t border-slate-700/60 px-4 py-3 space-y-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">
            센서 ({node.sensors.length})
          </p>
          {node.sensors.length === 0 ? (
            <p className="text-[11px] text-slate-600">등록된 센서 없음</p>
          ) : (
            <div className="space-y-1">
              {node.sensors.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">{s.sensorType}</span>
                  <span className="text-slate-300 font-mono">
                    {s.lastValue !== null ? `${s.lastValue} ${s.unit ?? ''}` : '-'}
                  </span>
                </div>
              ))}
            </div>
          )}
          {node.device.controlCapable && (
            <div className="pt-2 border-t border-slate-700/60">
              <span className="text-[10px] text-emerald-500">제어 가능 · {node.device.controlMode}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 선택된 공간 뷰
// ──────────────────────────────────────────────────────────────

function collectNodes(s: SpaceNode): TwinNodeSummary[] {
  return [...s.twinNodes, ...s.children.flatMap(collectNodes)];
}

function SelectedSpaceView({ space }: { space: SpaceNode }) {
  const allNodes = collectNodes(space);
  const bySystem = allNodes.reduce<Record<string, TwinNodeSummary[]>>((acc, n) => {
    const k = n.systemType;
    acc[k] = [...(acc[k] ?? []), n];
    return acc;
  }, {});
  const totalPowerKw = allNodes.reduce((sum, n) => sum + (n.currentMetrics.power ?? 0), 0);

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-cyan-400" />
            {space.name}
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            유형: {space.type} · Level {space.level} · 설비 {allNodes.length}개
          </p>
        </div>
        {totalPowerKw > 0 && (
          <div className="flex items-center gap-1.5 bg-yellow-900/30 border border-yellow-700/40 rounded-xl px-4 py-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            <div>
              <p className="text-[10px] text-yellow-500">총 소비 전력</p>
              <p className="text-lg font-bold text-yellow-300">
                {Math.round(totalPowerKw * 10) / 10} kW
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 하위 공간 요약 */}
      {space.children.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {space.children.map((child) => (
            <div key={child.id} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3">
              <p className="text-xs text-slate-400 mb-1 truncate">{child.name}</p>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-2 h-2 rounded-full',
                    child.totalNodes === 0
                      ? 'bg-slate-600'
                      : child.onlineNodes === child.totalNodes
                      ? 'bg-emerald-500'
                      : child.onlineNodes === 0
                      ? 'bg-red-500'
                      : 'bg-yellow-500'
                  )}
                />
                <span className="text-xs text-slate-300">
                  설비 {child.onlineNodes}/{child.totalNodes}
                </span>
              </div>
              {child.totalPowerKw > 0 && (
                <p className="text-[10px] text-yellow-500 mt-1">{child.totalPowerKw} kW</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 시스템별 TwinNode */}
      {allNodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
          <Cpu className="w-10 h-10 opacity-40" />
          <p className="text-sm">이 공간에 등록된 설비가 없습니다.</p>
          <p className="text-xs text-slate-600">POST /api/digital-twin/nodes 로 TwinNode를 등록하세요.</p>
        </div>
      ) : (
        Object.entries(bySystem).map(([systemType, nodes]) => (
          <div key={systemType}>
            <div
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border mb-3',
                SYSTEM_COLOR[systemType] ?? SYSTEM_COLOR.OTHER
              )}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-current" />
              {systemType} ({nodes.length})
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {nodes.map((node) => (
                <TwinNodeCard key={node.id} node={node} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 사이트 전체 뷰
// ──────────────────────────────────────────────────────────────

function flattenSpaces(spaces: SpaceNode[]): SpaceNode[] {
  return spaces.flatMap((s) => [s, ...flattenSpaces(s.children)]);
}

function SiteOverview({ site }: { site: SiteWithSpaces }) {
  const allSpaces = flattenSpaces(site.spaces);
  const allNodes = allSpaces.flatMap((s) => s.twinNodes);
  const bySystem = allNodes.reduce<Record<string, TwinNodeSummary[]>>((acc, n) => {
    const k = n.systemType;
    acc[k] = [...(acc[k] ?? []), n];
    return acc;
  }, {});
  const onlineCount = allNodes.filter((n) => n.device.status === 'online').length;
  const score = allNodes.length > 0 ? Math.round((onlineCount / allNodes.length) * 100) : 0;
  const overallStatus: 'normal' | 'warning' | 'critical' =
    score === 100 ? 'normal' : score >= 70 ? 'warning' : 'critical';

  return (
    <div className="space-y-6">
      <SystemStatusIndicator
        status={overallStatus}
        message={
          score === 100
            ? '모든 설비가 정상 작동 중입니다'
            : `${allNodes.length - onlineCount}개 설비에 주의가 필요합니다`
        }
        score={score}
        uptimePercent={allNodes.length > 0 ? (onlineCount / allNodes.length) * 100 : null}
        latencyMs={null}
      />
      <div>
        <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">
          시스템 분류
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Object.entries(bySystem).map(([sys, nodes]) => {
            const online = nodes.filter((n) => n.device.status === 'online').length;
            const pow = Math.round(
              nodes.reduce((sum, n) => sum + (n.currentMetrics.power ?? 0), 0) * 10
            ) / 10;
            return (
              <div key={sys} className={cn('rounded-xl border p-4', SYSTEM_COLOR[sys] ?? SYSTEM_COLOR.OTHER)}>
                <p className="text-xs font-bold mb-1">{sys}</p>
                <p className="text-2xl font-bold">{nodes.length}</p>
                <p className="text-[10px] opacity-70">온라인 {online}개</p>
                {pow > 0 && <p className="text-[10px] opacity-70">{pow} kW</p>}
              </div>
            );
          })}
          {Object.keys(bySystem).length === 0 && (
            <p className="col-span-full text-sm text-slate-500 text-center py-4">
              TwinNode 없음 — 좌측 공간을 클릭하거나 설비를 등록하세요
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// KPI 칩
// ──────────────────────────────────────────────────────────────

function KpiChip({
  label, value, sub, color,
}: {
  label: string; value: string; sub: string; color: string;
}) {
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

interface TreeApiResponse {
  sites: SiteWithSpaces[];
  summary: {
    totalSites: number;
    totalNodes: number;
    onlineNodes: number;
    totalPowerKw: number;
  };
}

export function DigitalTwinDashboard() {
  const [treeData, setTreeData] = useState<TreeApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedSpace, setSelectedSpace] = useState<SpaceNode | null>(null);

  const fetchTree = useCallback(async () => {
    try {
      const res = await fetch('/api/digital-twin/tree');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: { success: boolean; data: TreeApiResponse } = await res.json();
      if (!json.success) throw new Error('API 오류');
      setTreeData(json.data);
      setError(null);
      if (!selectedSiteId && json.data.sites.length > 0) {
        setSelectedSiteId(json.data.sites[0]?.id ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '데이터 로드 실패');
    } finally {
      setIsLoading(false);
    }
  }, [selectedSiteId]);

  useEffect(() => {
    fetchTree();
    const id = setInterval(fetchTree, 30_000);
    return () => clearInterval(id);
  }, [fetchTree]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchTree();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          <p className="text-sm">디지털 트윈 데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  const sites = treeData?.sites ?? [];
  const summary = treeData?.summary;
  const currentSite = sites.find((s) => s.id === selectedSiteId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      {/* KPI 바 */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiChip label="사이트" value={String(summary.totalSites)} sub="등록 현장" color="text-cyan-400" />
          <KpiChip
            label="총 설비"
            value={String(summary.totalNodes)}
            sub={`온라인 ${summary.onlineNodes}개`}
            color={
              summary.totalNodes === 0
                ? 'text-slate-400'
                : summary.onlineNodes === summary.totalNodes
                ? 'text-emerald-400'
                : 'text-yellow-400'
            }
          />
          <KpiChip label="총 전력" value={`${summary.totalPowerKw} kW`} sub="현재 소비" color="text-yellow-400" />
          <KpiChip
            label="가동률"
            value={
              summary.totalNodes > 0
                ? `${Math.round((summary.onlineNodes / summary.totalNodes) * 1000) / 10}%`
                : '-'
            }
            sub="온라인 비율"
            color={
              summary.totalNodes === 0
                ? 'text-slate-400'
                : summary.onlineNodes === summary.totalNodes
                ? 'text-emerald-400'
                : 'text-yellow-400'
            }
          />
        </div>
      )}

      {/* 3-패널 레이아웃 */}
      <div className="flex gap-4" style={{ minHeight: 600 }}>
        {/* 좌측: 공간 트리 */}
        <div className="w-56 lg:w-64 flex-shrink-0 bg-slate-900/60 border border-slate-700/60 rounded-xl overflow-hidden">
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

        {/* 중앙: 선택 공간 or 사이트 전체 */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-slate-900/40 border border-slate-700/60 rounded-xl p-5">
          <div className="flex justify-end mb-4">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-slate-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
              <span>새로고침</span>
              <span className="text-slate-500 ml-1">· 30초 자동</span>
            </button>
          </div>

          {selectedSpace ? (
            <SelectedSpaceView space={selectedSpace} />
          ) : currentSite ? (
            <SiteOverview site={currentSite} />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-2">
              <Server className="w-10 h-10 opacity-40" />
              <p className="text-sm">좌측 패널에서 공간을 선택하세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
