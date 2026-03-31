/**
 * PATCH /api/admin/erp/invoices/[id] — 인보이스 상태 업데이트 (sent/paid/cancelled)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';
import { isSuperAdmin } from '@/lib/auth/permissions';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });
  if (!isSuperAdmin(auth.role)) return errorResponse('PERMISSION_DENIED', { status: 403 });

  const model = (prisma as any).invoice;
  if (!model) return errorResponse('SERVER_ERROR', { status: 503 });

  try {
    const body = await request.json();
    const { status, notes } = body as { status: string; notes?: string };

    const VALID = ['sent', 'paid', 'cancelled', 'draft'];
    if (!VALID.includes(status)) {
      return errorResponse('VALIDATION_INVALID_FORMAT', {
        status: 400,
        details: { status: `허용값: ${VALID.join(', ')}` },
      });
    }

    const existing = await model.findUnique({ where: { id } });
    if (!existing) return errorResponse('RESOURCE_NOT_FOUND', { status: 404 });

    const updated = await model.update({
      where: { id },
      data: {
        status,
        ...(notes !== undefined && { notes }),
        ...(status === 'paid' && { paidAt: new Date() }),
      },
      include: { lineItems: true },
    });

    return successResponse(updated);
  } catch (err) {
    console.error('[ERP Invoice PATCH]', err);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}
