/**
 * SpaceTreePanel
 *
 * 디지털 트윈 좌측 패널: 공간 계층 트리 네비게이터
 *
 * Site → Building → Floor → Zone → Room
 * 각 노드: TwinNode 수 + 상태 컬러 인디케이터 + 총 전력 표시
 * 클릭 → 해당 공간 선택 → 중앙 패널에 설비 표시
 */
'use client';

import { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Building2,
  Layers,
  Grid3X3,
  Square,
  MapPin,
  Cpu,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ──────────────────────────────────────────────────────────────
// 타입 (tree API 응답과 동일한 구조)
// ──────────────────────────────────────────────────────────────

export interface TwinNodeSummary {
  id: string;
  deviceId: string;
  systemType: string;
  equipClass: string;
  feedsIds: unknown;
  fedByIds: unknown;
  computedMetrics: unknown;
  device: {
    id: string;
    name: string;
    status: string;
    deviceType: string;
    lastSeenAt: Date | null;
    controlCapable: boolean;
    controlMode: string;
  };
  sensors: { id: string; sensorType: string; lastValue: number | null; unit: string | null }[];
  currentMetrics: {
    power: number | null;
    temperature: number | null;
    flowRate: number | null;
    humidity: number | null;
    co2: number | null;
    cop: number | null;
  };
}

export interface SpaceNode {
  id: string;
  name: string;
  code: string | null;
  type: string;
  level: number;
  floorPlanX: number | null;
  floorPlanY: number | null;
  twinNodes: TwinNodeSummary[];
  children: SpaceNode[];
  totalNodes: number;
  onlineNodes: number;
  totalPowerKw: number;
}

export interface SiteWithSpaces {
  id: string;
  name: string;
  siteType: string;
  city: string | null;
  spaces: SpaceNode[];
  summary: {
    totalNodes: number;
    onlineNodes: number;
    totalPowerKw: number;
  };
}

interface SpaceTreePanelProps {
  sites: SiteWithSpaces[];
  selectedSpaceId: string | null;
  onSelectSpace: (spaceId: string, space: SpaceNode) => void;
  onSelectSite: (siteId: string, site: SiteWithSpaces) => void;
  selectedSiteId: string | null;
}

// ──────────────────────────────────────────────────────────────
// 공간 타입별 아이콘
// ──────────────────────────────────────────────────────────────

const SPACE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  building: Building2,
  floor: Layers,
  zone: Grid3X3,
  room: Square,
  shaft: MapPin,
};

function SpaceIcon({ type, className }: { type: string; className?: string }) {
  const Icon = SPACE_ICONS[type] ?? Square;
  return <Icon className={className} />;
}

// ──────────────────────────────────────────────────────────────
// 상태 컬러 헬퍼
// ──────────────────────────────────────────────────────────────

function statusColor(onlineNodes: number, totalNodes: number): string {
  if (totalNodes === 0) return 'bg-slate-600';
  const ratio = onlineNodes / totalNodes;
  if (ratio === 1) return 'bg-emerald-500';
  if (ratio >= 0.5) return 'bg-yellow-500';
  return 'bg-red-500';
}

// ──────────────────────────────────────────────────────────────
// SpaceTreeNode — 재귀 컴포넌트
// ──────────────────────────────────────────────────────────────

interface SpaceTreeNodeProps {
  space: SpaceNode;
  depth: number;
  selectedId: string | null;
  onSelect: (spaceId: string, space: SpaceNode) => void;
  defaultExpanded?: boolean;
}

function SpaceTreeNode({
  space,
  depth,
  selectedId,
  onSelect,
  defaultExpanded = false,
}: SpaceTreeNodeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded || depth < 2);

  const hasChildren = space.children.length > 0;
  const isSelected = selectedId === space.id;

  return (
    <div>
      <button
        className={cn(
          'w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left transition-colors group',
          isSelected
            ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-600/40'
            : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => {
          if (hasChildren) setExpanded(!expanded);
          onSelect(space.id, space);
        }}
      >
        {/* 확장 토글 */}
        <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 opacity-60" />
            )
          ) : null}
        </span>

        {/* 공간 아이콘 */}
        <SpaceIcon type={space.type} className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />

        {/* 공간 이름 */}
        <span className="flex-1 text-sm font-medium truncate">{space.name}</span>

        {/* 상태 인디케이터 */}
        {space.totalNodes > 0 && (
          <div className="flex items-center gap-1.5 ml-1 flex-shrink-0">
            <div
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                statusColor(space.onlineNodes, space.totalNodes)
              )}
            />
            <span className="text-[10px] text-slate-500 group-hover:text-slate-400">
              {space.onlineNodes}/{space.totalNodes}
            </span>
          </div>
        )}
      </button>

      {/* 하위 공간 */}
      {hasChildren && expanded && (
        <div>
          {space.children.map((child) => (
            <SpaceTreeNode
              key={child.id}
              space={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 메인 패널
// ──────────────────────────────────────────────────────────────

export function SpaceTreePanel({
  sites,
  selectedSpaceId,
  onSelectSpace,
  onSelectSite,
  selectedSiteId,
}: SpaceTreePanelProps) {
  const [expandedSites, setExpandedSites] = useState<Set<string>>(
    new Set(sites.map((s) => s.id))
  );

  const toggleSite = (siteId: string) => {
    setExpandedSites((prev) => {
      const next = new Set(prev);
      if (next.has(siteId)) {
        next.delete(siteId);
      } else {
        next.add(siteId);
      }
      return next;
    });
  };

  if (sites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 text-sm gap-2 px-4 text-center">
        <Building2 className="w-8 h-8" />
        <p>등록된 사이트가 없습니다.</p>
        <p className="text-xs">디바이스 설정에서 사이트를 먼저 등록하세요.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-3 py-3 border-b border-slate-700/60">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          공간 계층
        </p>
      </div>

      {/* 트리 */}
      <div className="flex-1 overflow-y-auto py-2 px-1 space-y-1">
        {sites.map((site) => {
          const isExpanded = expandedSites.has(site.id);
          const isSelected = selectedSiteId === site.id && !selectedSpaceId;

          return (
            <div key={site.id}>
              {/* 사이트 노드 */}
              <button
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors',
                  isSelected
                    ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-600/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                )}
                onClick={() => {
                  toggleSite(site.id);
                  onSelectSite(site.id, site);
                }}
              >
                <MapPin className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{site.name}</p>
                  {site.city && (
                    <p className="text-[10px] text-slate-500 truncate">{site.city}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                  {site.summary.totalPowerKw > 0 && (
                    <div className="flex items-center gap-0.5 text-[10px] text-yellow-500">
                      <Zap className="w-2.5 h-2.5" />
                      <span>{site.summary.totalPowerKw} kW</span>
                    </div>
                  )}
                  <div className="flex items-center gap-0.5 text-[10px] text-slate-500">
                    <Cpu className="w-2.5 h-2.5" />
                    <span>
                      {site.summary.onlineNodes}/{site.summary.totalNodes}
                    </span>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                )}
              </button>

              {/* 공간 트리 */}
              {isExpanded && (
                <div className="mt-1 ml-2">
                  {site.spaces.length === 0 ? (
                    <p className="text-[11px] text-slate-600 px-4 py-2">
                      등록된 공간 없음
                    </p>
                  ) : (
                    site.spaces.map((space) => (
                      <SpaceTreeNode
                        key={space.id}
                        space={space}
                        depth={0}
                        selectedId={selectedSpaceId}
                        onSelect={onSelectSpace}
                        defaultExpanded
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
