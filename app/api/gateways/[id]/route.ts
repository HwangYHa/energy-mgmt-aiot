/**
 * /api/gateways/[id]
 *
 * 개별 게이트웨이 조회 / 수정 / 삭제
 *
 * GET    → 상세 조회
 * PUT    → 설정 수정
 * DELETE → 삭제 (연결된 Device의 gatewayId를 null로)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
  serverErrorResponse,
  formatZodErrors,
} from '@/lib/api/response';
import { UserRole } from '@/lib/constants/roles';

// ──────────────────────────────────────────────────────────────
// Validation Schema
// ──────────────────────────────────────────────────────────────

const updateGatewaySchema = z.object({
  name: z.string().max(100).optional(),
  model: z.string().max(50).optional(),
  firmwareVersion: z.string().max(20).optional(),
  ipAddress: z.string().max(45).optional().nullable(),
  macAddress: z.string().max(17).optional().nullable(),
  vpnAddress: z.string().max(45).optional().nullable(),
  primaryConnection: z.enum(['ethernet', 'lte', 'wifi']).optional(),
  fallbackConnection: z.enum(['lte', 'wifi', 'none']).optional(),
  bufferSizeMb: z.number().int().min(1).max(10240).optional(),
  ownership: z.enum(['company', 'customer']).optional(),
  installationDate: z.string().optional().nullable(),
  config: z.record(z.unknown()).optional().nullable(),
});

// ──────────────────────────────────────────────────────────────
// 공통: 게이트웨이 소유권 검증
// ──────────────────────────────────────────────────────────────

async function findGateway(id: string, tenantId: string) {
  return prisma.gateway.findFirst({
    where: { id, tenantId },
  });
}

// ──────────────────────────────────────────────────────────────
// GET — 상세 조회
// ──────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { id } = await params;
    const gateway = await prisma.gateway.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: {
        site: { select: { id: true, name: true, city: true, address: true } },
        devices: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            deviceType: true,
            status: true,
            lastSeenAt: true,
          },
          orderBy: { name: 'asc' },
        },
        _count: { select: { devices: true, measurements: true } },
      },
    });

    if (!gateway) return errorResponse('RESOURCE_NOT_FOUND');

    return successResponse({ gateway });
  } catch (error) {
    console.error('[API] 게이트웨이 상세 조회 오류:', error);
    return serverErrorResponse();
  }
}

// ──────────────────────────────────────────────────────────────
// PUT — 수정
// ──────────────────────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'site_manager' as UserRole)) {
      return forbiddenResponse();
    }

    const { id } = await params;
    const gateway = await findGateway(id, auth.tenantId);
    if (!gateway) return errorResponse('RESOURCE_NOT_FOUND');

    const body = await request.json();
    const parsed = updateGatewaySchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse({ fields: formatZodErrors(parsed.error) });
    }

    const d = parsed.data;

    const updated = await prisma.gateway.update({
      where: { id },
      data: {
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.model !== undefined ? { model: d.model } : {}),
        ...(d.firmwareVersion !== undefined ? { firmwareVersion: d.firmwareVersion } : {}),
        ...(d.ipAddress !== undefined ? { ipAddress: d.ipAddress } : {}),
        ...(d.macAddress !== undefined ? { macAddress: d.macAddress } : {}),
        ...(d.vpnAddress !== undefined ? { vpnAddress: d.vpnAddress } : {}),
        ...(d.primaryConnection !== undefined
          ? { primaryConnection: d.primaryConnection as never }
          : {}),
        ...(d.fallbackConnection !== undefined
          ? { fallbackConnection: d.fallbackConnection as never }
          : {}),
        ...(d.bufferSizeMb !== undefined ? { bufferSizeMb: d.bufferSizeMb } : {}),
        ...(d.ownership !== undefined ? { ownership: d.ownership as never } : {}),
        ...(d.installationDate !== undefined
          ? { installationDate: d.installationDate ? new Date(d.installationDate) : null }
          : {}),
        ...(d.config !== undefined
          ? { config: d.config ? (d.config as Prisma.InputJsonValue) : Prisma.DbNull }
          : {}),
      },
      include: {
        site: { select: { id: true, name: true, city: true } },
      },
    });

    return successResponse({ gateway: updated });
  } catch (error) {
    console.error('[API] 게이트웨이 수정 오류:', error);
    return serverErrorResponse();
  }
}

// ──────────────────────────────────────────────────────────────
// DELETE — 삭제
// ──────────────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'site_manager' as UserRole)) {
      return forbiddenResponse();
    }

    const { id } = await params;
    const gateway = await findGateway(id, auth.tenantId);
    if (!gateway) return errorResponse('RESOURCE_NOT_FOUND');

    // 연결된 Device의 gatewayId를 null로 설정 후 삭제
    await prisma.$transaction([
      prisma.device.updateMany({
        where: { gatewayId: id },
        data: { gatewayId: null },
      }),
      prisma.gateway.delete({ where: { id } }),
    ]);

    return successResponse({ deleted: id });
  } catch (error) {
    console.error('[API] 게이트웨이 삭제 오류:', error);
    return serverErrorResponse();
  }
}
