/**
 * /api/digital-twin/nodes
 *
 * TwinNode CRUD — Device ↔ PhysicalSpace 바인딩 관리
 *
 * GET  ?spaceId=xxx  → 특정 공간의 TwinNode 목록 (없으면 전체)
 * POST              → TwinNode 생성 (Device를 공간에 등록)
 * DELETE ?nodeId=   → TwinNode 삭제 (바인딩 해제, Device는 유지)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { requireFeature } from '@/lib/auth/subscription';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
} from '@/lib/api/response';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────────────────────
// GET
// ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();

  const [, subErr] = await requireFeature(auth.tenantId, 'digital_twin');
  if (subErr) return subErr;

  const { searchParams } = new URL(request.url);
  const spaceId = searchParams.get('spaceId');

  const nodes = await prisma.twinNode.findMany({
    where: {
      tenantId: auth.tenantId,
      ...(spaceId ? { spaceId } : {}),
    },
    include: {
      device: {
        select: {
          id: true,
          name: true,
          deviceType: true,
          status: true,
          lastSeenAt: true,
          controlCapable: true,
        },
      },
      space: {
        select: {
          id: true,
          name: true,
          type: true,
          level: true,
          parentId: true,
        },
      },
    },
    orderBy: [{ space: { level: 'asc' } }, { device: { name: 'asc' } }],
  });

  return successResponse({ nodes, total: nodes.length });
}

// ──────────────────────────────────────────────────────────────
// POST — TwinNode 생성
// ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();

  let body: {
    deviceId: string;
    spaceId: string;
    systemType: string;
    equipClass: string;
    feedsIds?: string[];
    fedByIds?: string[];
    computedMetrics?: Record<string, unknown>;
  };

  try {
    body = await request.json();
  } catch {
    return errorResponse('VALIDATION_ERROR');
  }

  const { deviceId, spaceId, systemType, equipClass } = body;

  if (!deviceId || !spaceId || !systemType || !equipClass) {
    return errorResponse('VALIDATION_REQUIRED_FIELD');
  }

  // 테넌트 격리 검증
  const [device, space] = await Promise.all([
    prisma.device.findFirst({
      where: { id: deviceId, tenantId: auth.tenantId, deletedAt: null },
      select: { id: true },
    }),
    prisma.physicalSpace.findFirst({
      where: { id: spaceId, tenantId: auth.tenantId },
      select: { id: true },
    }),
  ]);

  if (!device) return errorResponse('RESOURCE_NOT_FOUND');
  if (!space) return errorResponse('RESOURCE_NOT_FOUND');

  const computedMetrics = body.computedMetrics
    ? (body.computedMetrics as Prisma.InputJsonValue)
    : undefined;

  // 이미 바인딩된 경우 upsert
  const node = await prisma.twinNode.upsert({
    where: { deviceId },
    create: {
      tenantId: auth.tenantId,
      deviceId,
      spaceId,
      systemType: systemType as never,
      equipClass: equipClass as never,
      feedsIds: body.feedsIds ?? [],
      fedByIds: body.fedByIds ?? [],
      computedMetrics,
    },
    update: {
      spaceId,
      systemType: systemType as never,
      equipClass: equipClass as never,
      feedsIds: body.feedsIds ?? [],
      fedByIds: body.fedByIds ?? [],
      computedMetrics,
    },
  });

  return NextResponse.json({ success: true, data: { node } }, { status: 201 });
}

// ──────────────────────────────────────────────────────────────
// DELETE — TwinNode 삭제 (바인딩 해제)
// ──────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const nodeId = searchParams.get('nodeId');

  if (!nodeId) return errorResponse('VALIDATION_REQUIRED_FIELD');

  const node = await prisma.twinNode.findFirst({
    where: { id: nodeId, tenantId: auth.tenantId },
    select: { id: true },
  });

  if (!node) return errorResponse('RESOURCE_NOT_FOUND');

  await prisma.twinNode.delete({ where: { id: nodeId } });

  return successResponse({ deleted: nodeId });
}
