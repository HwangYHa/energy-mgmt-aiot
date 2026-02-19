/**
 * GET /api/twin/tree
 *
 * 디지털 트윈 공간 트리 반환
 * 쿼리: ?siteId=xxx&depth=3&includeState=true
 *
 * 응답 구조:
 * {
 *   success: true,
 *   data: {
 *     siteId: string | null,
 *     spaces: SpaceNode[],      // PhysicalSpace 계층 트리 (roots)
 *     unbound: TwinNodeItem[],  // 공간 미배정 TwinNode
 *     totalSpaces: number,
 *     totalTwinNodes: number,
 *   }
 * }
 */

import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, unauthorizedResponse, serverErrorResponse } from '@/lib/api/response';

// ─── 응답 타입 ────────────────────────────────────────────────────────────────

interface MetricPoint {
  metricKey: string;
  unit: string | null;
  value: number;
  time: string;
  quality: string;
}

interface TwinState {
  dataAge: number | null; // seconds since last measurement
  operational: 'running' | 'standby' | 'stopped' | 'fault' | 'unknown';
  metrics: MetricPoint[];
}

interface TwinNodeItem {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  systemType: string;
  equipClass: string;
  feedsIds: string[];
  fedByIds: string[];
  state: TwinState | null;
}

interface SpaceNode {
  id: string;
  name: string;
  code: string | null;
  type: string;
  level: number;
  children: SpaceNode[];
  twinNodes: TwinNodeItem[];
}

// ─── DB row 타입 ──────────────────────────────────────────────────────────────

type SpaceRow = {
  id: string;
  name: string;
  code: string | null;
  type: string;
  level: number;
  parent_id: string | null;
  site_id: string;
};

type TwinRow = {
  id: string;
  device_id: string;
  space_id: string;
  system_type: string;
  equip_class: string;
  feeds_ids: string | null;
  fed_by_ids: string | null;
  device_name: string;
  device_type: string;
  device_status: string;
  last_seen_at: Date | null;
};

type MeasurementRow = {
  device_id: string;
  metric_key: string;
  unit: string | null;
  value: number;
  time: Date;
  quality: string;
};

// ─── 핸들러 ───────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { tenantId } = auth;
    const { searchParams } = new URL(request.url);

    const siteId = searchParams.get('siteId');
    const maxDepth = Math.min(Number(searchParams.get('depth') ?? '10'), 10);
    const includeState = searchParams.get('includeState') !== 'false';

    // 1. PhysicalSpace 전체 조회
    const spaces: SpaceRow[] = siteId
      ? await prisma.$queryRaw<SpaceRow[]>`
          SELECT id, name, code, type, level, parent_id, site_id
          FROM physical_space
          WHERE tenant_id = ${tenantId} AND site_id = ${siteId}
          ORDER BY level ASC, name ASC
        `
      : await prisma.$queryRaw<SpaceRow[]>`
          SELECT id, name, code, type, level, parent_id, site_id
          FROM physical_space
          WHERE tenant_id = ${tenantId}
          ORDER BY level ASC, name ASC
        `;

    // 2. TwinNode 전체 조회 (device 정보 포함)
    const twinNodes: TwinRow[] = siteId
      ? await prisma.$queryRaw<TwinRow[]>`
          SELECT
            tn.id, tn.device_id, tn.space_id,
            tn.system_type, tn.equip_class,
            tn.feeds_ids, tn.fed_by_ids,
            d.name as device_name, d.device_type, d.status as device_status,
            d.last_seen_at
          FROM twin_node tn
          JOIN device d ON d.id = tn.device_id
          WHERE tn.tenant_id = ${tenantId} AND d.site_id = ${siteId}
        `
      : await prisma.$queryRaw<TwinRow[]>`
          SELECT
            tn.id, tn.device_id, tn.space_id,
            tn.system_type, tn.equip_class,
            tn.feeds_ids, tn.fed_by_ids,
            d.name as device_name, d.device_type, d.status as device_status,
            d.last_seen_at
          FROM twin_node tn
          JOIN device d ON d.id = tn.device_id
          WHERE tn.tenant_id = ${tenantId}
        `;

    // 3. TwinState 조회 (includeState=true, TwinNode 존재 시)
    const stateMap = new Map<string, TwinState>();

    if (includeState && twinNodes.length > 0) {
      const deviceIds = twinNodes.map((n) => n.device_id);
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

      const measurements = await prisma.$queryRaw<MeasurementRow[]>`
        SELECT
          mt.device_id,
          mt.\`key\` as metric_key,
          mt.unit,
          m.value,
          m.time,
          m.quality
        FROM measurement m
        JOIN metric mt ON m.metric_id = mt.id
        WHERE mt.device_id IN (${Prisma.join(deviceIds)})
          AND m.time >= ${thirtyMinAgo}
        ORDER BY m.time DESC
      `;

      // device_id → metric_key → 최신 1개 (DESC 정렬 → 첫 번째가 최신)
      const byDevice = new Map<string, Map<string, MeasurementRow>>();
      for (const row of measurements) {
        if (!byDevice.has(row.device_id)) byDevice.set(row.device_id, new Map());
        const metricMap = byDevice.get(row.device_id)!;
        if (!metricMap.has(row.metric_key)) metricMap.set(row.metric_key, row);
      }

      for (const tn of twinNodes) {
        const metricMap = byDevice.get(tn.device_id);
        const points: MetricPoint[] = metricMap
          ? [...metricMap.values()].map((r) => ({
              metricKey: r.metric_key,
              unit: r.unit,
              value: Number(r.value),
              time: r.time.toISOString(),
              quality: r.quality,
            }))
          : [];

        const latestMs = points.length > 0
          ? Math.max(...points.map((p) => new Date(p.time).getTime()))
          : null;
        const dataAge = latestMs !== null
          ? Math.round((Date.now() - latestMs) / 1000)
          : null;

        let operational: TwinState['operational'] = 'unknown';
        if (tn.device_status === 'error') operational = 'fault';
        else if (tn.device_status === 'offline') operational = 'stopped';
        else if (tn.device_status === 'maintenance') operational = 'standby';
        else if (tn.device_status === 'online')
          operational = dataAge !== null && dataAge < 300 ? 'running' : 'standby';

        stateMap.set(tn.id, { dataAge, operational, metrics: points });
      }
    }

    // 4. SpaceNode 맵 생성 + TwinNode 부착
    const spaceMap = new Map<string, SpaceNode>();
    for (const s of spaces) {
      spaceMap.set(s.id, {
        id: s.id, name: s.name, code: s.code,
        type: s.type, level: s.level,
        children: [], twinNodes: [],
      });
    }

    for (const tn of twinNodes) {
      const spaceNode = spaceMap.get(tn.space_id);
      if (!spaceNode) continue;
      spaceNode.twinNodes.push({
        id: tn.id,
        deviceId: tn.device_id,
        deviceName: tn.device_name,
        deviceType: tn.device_type,
        systemType: tn.system_type,
        equipClass: tn.equip_class,
        feedsIds: parseJsonArray(tn.feeds_ids),
        fedByIds: parseJsonArray(tn.fed_by_ids),
        state: includeState ? (stateMap.get(tn.id) ?? null) : null,
      });
    }

    // 부모-자식 트리 조립
    const roots: SpaceNode[] = [];
    for (const s of spaces) {
      const node = spaceMap.get(s.id)!;
      if (s.parent_id && spaceMap.has(s.parent_id)) {
        spaceMap.get(s.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    if (maxDepth < 10) pruneDepth(roots, maxDepth);

    // 5. 공간 미배정 TwinNode
    const spaceIds = new Set(spaces.map((s) => s.id));
    const unbound: TwinNodeItem[] = twinNodes
      .filter((tn) => !spaceIds.has(tn.space_id))
      .map((tn) => ({
        id: tn.id,
        deviceId: tn.device_id,
        deviceName: tn.device_name,
        deviceType: tn.device_type,
        systemType: tn.system_type,
        equipClass: tn.equip_class,
        feedsIds: parseJsonArray(tn.feeds_ids),
        fedByIds: parseJsonArray(tn.fed_by_ids),
        state: includeState ? (stateMap.get(tn.id) ?? null) : null,
      }));

    return successResponse({
      siteId: siteId ?? null,
      spaces: roots,
      unbound,
      totalSpaces: spaces.length,
      totalTwinNodes: twinNodes.length,
    });
  } catch (error) {
    console.error('[twin/tree] Error:', error);
    return serverErrorResponse({ message: '트윈 트리 조회 실패' });
  }
}

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function pruneDepth(nodes: SpaceNode[], remaining: number): void {
  if (remaining <= 0) {
    for (const node of nodes) node.children = [];
    return;
  }
  for (const node of nodes) pruneDepth(node.children, remaining - 1);
}
