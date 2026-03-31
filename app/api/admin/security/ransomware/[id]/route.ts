/**
 * PATCH /api/admin/security/ransomware/[id]
 * 알림 상태 업데이트: investigating | contained | resolved | false_positive
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';
import { hasMinRole } from '@/lib/auth/permissions';

const VALID_STATUSES = ['investigating', 'contained', 'resolved', 'false_positive'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth   = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });
  if (!hasMinRole(auth.role, 'tenant_admin')) return errorResponse('PERMISSION_DENIED', { status: 403 });

  try {
    const body = await request.json();
    const { status } = body;

    if (!VALID_STATUSES.includes(status)) {
      return errorResponse('VALIDATION_INVALID_FORMAT', {
        status: 400,
        details: { status: `허용값: ${VALID_STATUSES.join(', ')}` },
      });
    }

    const model = (prisma as any).ransomwareAlert;
    if (!model) return errorResponse('SERVER_ERROR', { status: 503 });

    const existing = await model.findUnique({ where: { id } });
    if (!existing) return errorResponse('RESOURCE_NOT_FOUND', { status: 404 });

    // tenant_admin은 자기 테넌트 알림만 수정 가능
    const isSA = auth.role === 'super_admin';
    if (!isSA && existing.tenantId !== auth.tenantId) {
      return errorResponse('PERMISSION_DENIED', { status: 403 });
    }

    const isResolved = ['resolved', 'false_positive'].includes(status);

    const updated = await model.update({
      where: { id },
      data: {
        status,
        ...(isResolved && { resolvedBy: auth.userId, resolvedAt: new Date() }),
      },
    });

    return successResponse(updated);
  } catch (err) {
    console.error('[RansomwareAlert PATCH]', err);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}
