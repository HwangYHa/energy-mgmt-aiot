/**
 * /api/admin/tenants/[id] - Super Admin 테넌트 상세 관리 API
 *
 * GET: 테넌트 상세 조회 (super_admin 전용)
 * PATCH: 테넌트 상태 변경 (super_admin 전용)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyAuth, isSuperAdmin } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  serverErrorResponse,
  formatZodErrors,
} from '@/lib/api/response';

const updateTenantSchema = z.object({
  status: z.enum(['active', 'suspended', 'terminated']).optional(),
  name: z.string().min(1).max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!isSuperAdmin(auth)) return forbiddenResponse();

    const { id } = await params;

    const tenant = await prisma.tenant.findFirst({
      where: { id, deletedAt: null },
      include: {
        users: {
          where: { isActive: true },
          select: { id: true, name: true, email: true, role: true, lastLoginAt: true },
        },
        sites: {
          where: { deletedAt: null },
          select: { id: true, name: true, isActive: true, _count: { select: { devices: true } } },
        },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
            plan: { select: { name: true, tier: true, monthlyPrice: true } },
          },
        },
        _count: {
          select: { devices: true, sensors: true, measurements: true, auditLogs: true },
        },
      },
    });

    if (!tenant) return notFoundResponse('테넌트');

    return successResponse(tenant);
  } catch (error) {
    console.error('[API] 테넌트 상세 조회 오류:', error);
    return serverErrorResponse();
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!isSuperAdmin(auth)) return forbiddenResponse();

    const { id } = await params;

    const existing = await prisma.tenant.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) return notFoundResponse('테넌트');

    const body = await request.json();
    const parsed = updateTenantSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse({ fields: formatZodErrors(parsed.error) });
    }

    const data = parsed.data;
    const updateData: Record<string, unknown> = {};
    if (data.status) updateData.status = data.status;
    if (data.name) updateData.name = data.name;
    if (data.metadata) updateData.metadata = data.metadata;

    const updated = await prisma.tenant.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, status: true, updatedAt: true },
    });

    // 감사 로그
    await prisma.auditLog.create({
      data: {
        tenantId: id,
        userId: auth.userId,
        action: 'TENANT_STATUS_CHANGE',
        resourceType: 'TENANT',
        resourceId: id,
        result: 'success',
        changes: JSON.stringify({ before: existing.status, after: data.status }),
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
      },
    });

    return successResponse(updated);
  } catch (error) {
    console.error('[API] 테넌트 상태 변경 오류:', error);
    return serverErrorResponse();
  }
}
