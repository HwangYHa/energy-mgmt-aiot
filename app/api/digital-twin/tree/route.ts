/**
 * GET /api/digital-twin/tree
 *
 * 디지털 트윈의 심장: PhysicalSpace 계층 트리 + TwinNode + 실시간 센서 값
 *
 * 응답 구조:
 *   sites[]
 *     └─ spaces[] (PhysicalSpace tree, 재귀)
 *         └─ twinNodes[] (Device + Sensor latest values)
 *
 * 이 API 하나가 "대시보드 모니터링"과 "디지털 트윈"의 차이를 만든다:
 *  - 공간 계층 (building → floor → zone → room) 을 명시적으로 표현
 *  - 설비 ↔ 공간 ↔ 센서의 1:1 매핑 보장
 *  - 에너지 토폴로지 (feedsIds, fedByIds) 포함
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, unauthorizedResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────────────────────
// 타입 정의
// ──────────────────────────────────────────────────────────────

interface SensorReading {
  id: string;
  sensorType: string;
  lastValue: number | null;
  unit: string | null;
}

interface TwinNodeResult {
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
  sensors: SensorReading[];
  currentMetrics: {
    power: number | null;
    temperature: number | null;
    flowRate: number | null;
    humidity: number | null;
    co2: number | null;
    /** COP = 냉방능력(kW) / 소비전력(kW). 냉동기 전용 */
    cop: number | null;
  };
}

interface SpaceNode {
  id: string;
  name: string;
  code: string | null;
  type: string;
  level: number;
  floorPlanX: number | null;
  floorPlanY: number | null;
  twinNodes: TwinNodeResult[];
  children: SpaceNode[];
  /** 이 공간 + 하위 공간의 TwinNode 수 */
  totalNodes: number;
  /** 이 공간 + 하위 공간의 온라인 TwinNode 수 */
  onlineNodes: number;
  /** 이 공간 + 하위 공간의 총 전력 합산 (kW) */
  totalPowerKw: number;
}

// ──────────────────────────────────────────────────────────────
// 헬퍼: 센서 배열 → 표준 메트릭 추출
// ──────────────────────────────────────────────────────────────

function extractMetrics(sensors: SensorReading[]): TwinNodeResult['currentMetrics'] {
  const get = (...types: string[]) => {
    for (const t of types) {
      const s = sensors.find((s) => s.sensorType === t);
      if (s?.lastValue !== null && s?.lastValue !== undefined) return s.lastValue;
    }
    return null;
  };

  const power = get('power_meter', 'power', 'active_power', 'kw');
  const temperature = get('temperature', 'temp', 'supply_temp', 'return_temp');
  const flowRate = get('flow_rate', 'flow', 'chw_flow');
  const humidity = get('humidity', 'rh');
  const co2 = get('co2', 'co2_ppm');

  // COP = 냉방능력(kW) / 소비전력(kW) — 냉동기 센서에 cooling_capacity 있으면 계산
  const coolingCapacity = get('cooling_capacity', 'cooling_kw');
  const cop = coolingCapacity !== null && power !== null && power > 0
    ? Math.round((coolingCapacity / power) * 100) / 100
    : null;

  return {
    power: power !== null ? Math.round(power * 10) / 10 : null,
    temperature: temperature !== null ? Math.round(temperature * 10) / 10 : null,
    flowRate: flowRate !== null ? Math.round(flowRate * 10) / 10 : null,
    humidity: humidity !== null ? Math.round(humidity * 10) / 10 : null,
    co2: co2 !== null ? Math.round(co2) : null,
    cop,
  };
}

// ──────────────────────────────────────────────────────────────
// 헬퍼: PhysicalSpace 재귀 트리 빌드
// ──────────────────────────────────────────────────────────────

type RawSpace = {
  id: string;
  name: string;
  code: string | null;
  type: string;
  level: number;
  siteId: string;
  parentId: string | null;
  floorPlanX: { toNumber: () => number } | number | null;
  floorPlanY: { toNumber: () => number } | number | null;
  twinNodes: TwinNodeResult[];
};

function toNum(v: { toNumber: () => number } | number | null): number | null {
  if (v === null) return null;
  return typeof v === 'object' ? v.toNumber() : v;
}

function buildSpaceTree(
  allSpaces: RawSpace[],
  parentId: string | null,
  siteId: string
): SpaceNode[] {
  return allSpaces
    .filter((s) => s.siteId === siteId && s.parentId === parentId)
    .map((space) => {
      const children = buildSpaceTree(allSpaces, space.id, siteId);

      // 이 공간 직접 포함 노드
      const directNodes = space.twinNodes;
      // 하위 공간 노드까지 재귀 집계
      const allChildNodes = flattenNodes(children);
      const combinedNodes = [...directNodes, ...allChildNodes];

      return {
        id: space.id,
        name: space.name,
        code: space.code,
        type: space.type,
        level: space.level,
        floorPlanX: toNum(space.floorPlanX),
        floorPlanY: toNum(space.floorPlanY),
        twinNodes: directNodes,
        children,
        totalNodes: combinedNodes.length,
        onlineNodes: combinedNodes.filter((n) => n.device.status === 'online').length,
        totalPowerKw:
          Math.round(
            combinedNodes.reduce((sum, n) => sum + (n.currentMetrics.power ?? 0), 0) * 10
          ) / 10,
      };
    });
}

function flattenNodes(spaces: SpaceNode[]): TwinNodeResult[] {
  return spaces.flatMap((s) => [...s.twinNodes, ...flattenNodes(s.children)]);
}

// ──────────────────────────────────────────────────────────────
// GET handler
// ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();

  // 1. 이 테넌트의 모든 사이트
  const sites = await prisma.site.findMany({
    where: { tenantId: auth.tenantId, isActive: true, deletedAt: null },
    select: {
      id: true,
      name: true,
      siteType: true,
      city: true,
      address: true,
      peakPowerKw: true,
    },
    orderBy: { name: 'asc' },
  });

  if (sites.length === 0) {
    return successResponse({
      sites: [],
      summary: { totalSites: 0, totalNodes: 0, onlineNodes: 0, totalPowerKw: 0 },
    });
  }

  // 2. 이 테넌트의 모든 PhysicalSpace + TwinNode + Device
  const allSpaces = await prisma.physicalSpace.findMany({
    where: { tenantId: auth.tenantId },
    include: {
      twinNodes: {
        include: {
          device: {
            select: {
              id: true,
              name: true,
              status: true,
              deviceType: true,
              lastSeenAt: true,
              controlCapable: true,
              controlMode: true,
            },
          },
        },
      },
    },
    orderBy: [{ level: 'asc' }, { name: 'asc' }],
  });

  // 3. TwinNode에 연결된 Device의 최신 센서값 일괄 조회
  const deviceIds = allSpaces.flatMap((s) => s.twinNodes.map((n) => n.deviceId));

  const sensors =
    deviceIds.length > 0
      ? await prisma.sensor.findMany({
          where: { deviceId: { in: deviceIds } },
          select: {
            id: true,
            deviceId: true,
            sensorType: true,
            lastValue: true,
            unit: true,
          },
        })
      : [];

  // deviceId → SensorReading[] 맵
  const sensorMap = new Map<string, SensorReading[]>();
  for (const s of sensors) {
    const list = sensorMap.get(s.deviceId) ?? [];
    list.push({
      id: s.id,
      sensorType: s.sensorType,
      lastValue: s.lastValue !== null ? Number(s.lastValue) : null,
      unit: s.unit ?? null,
    });
    sensorMap.set(s.deviceId, list);
  }

  // 4. TwinNode에 currentMetrics 붙이기
  const spacesWithMetrics: RawSpace[] = allSpaces.map((space) => ({
    ...space,
    type: space.type as string,
    twinNodes: space.twinNodes.map((node) => {
      const nodeSensors = sensorMap.get(node.deviceId) ?? [];
      return {
        id: node.id,
        deviceId: node.deviceId,
        systemType: node.systemType as string,
        equipClass: node.equipClass as string,
        feedsIds: node.feedsIds,
        fedByIds: node.fedByIds,
        computedMetrics: node.computedMetrics,
        device: {
          id: node.device.id,
          name: node.device.name,
          status: node.device.status as string,
          deviceType: node.device.deviceType,
          lastSeenAt: node.device.lastSeenAt,
          controlCapable: node.device.controlCapable,
          controlMode: node.device.controlMode as string,
        },
        sensors: nodeSensors,
        currentMetrics: extractMetrics(nodeSensors),
      };
    }),
  }));

  // 5. 사이트별 트리 구성
  const result = sites.map((site) => {
    const siteSpaces = spacesWithMetrics.filter((s) => s.siteId === site.id);
    const tree = buildSpaceTree(siteSpaces, null, site.id);

    const allNodes = siteSpaces.flatMap((s) => s.twinNodes);
    const onlineNodes = allNodes.filter((n) => n.device.status === 'online').length;
    const totalPowerKw =
      Math.round(
        allNodes.reduce((sum, n) => sum + (n.currentMetrics.power ?? 0), 0) * 10
      ) / 10;

    return {
      id: site.id,
      name: site.name,
      siteType: site.siteType as string,
      city: site.city,
      address: site.address,
      peakPowerKw: site.peakPowerKw !== null ? Number(site.peakPowerKw) : null,
      spaces: tree,
      summary: {
        totalNodes: allNodes.length,
        onlineNodes,
        totalPowerKw,
        /** 피크 대비 사용률 (%) */
        peakUsagePercent:
          site.peakPowerKw !== null && Number(site.peakPowerKw) > 0
            ? Math.round((totalPowerKw / Number(site.peakPowerKw)) * 1000) / 10
            : null,
      },
    };
  });

  const summary = {
    totalSites: result.length,
    totalNodes: result.reduce((s, site) => s + site.summary.totalNodes, 0),
    onlineNodes: result.reduce((s, site) => s + site.summary.onlineNodes, 0),
    totalPowerKw:
      Math.round(result.reduce((s, site) => s + site.summary.totalPowerKw, 0) * 10) / 10,
  };

  return successResponse({ sites: result, summary });
}
