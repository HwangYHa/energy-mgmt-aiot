/**
 * GET  /api/super-admin/erp/invoices  — 인보이스 목록
 * POST /api/super-admin/erp/invoices  — 인보이스 생성
 * super_admin 전용
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { ERPService } from '@/lib/services/erp.service';

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });
  if (!isSuperAdmin(auth.role)) return errorResponse('PERMISSION_DENIED', { status: 403 });

  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') || undefined;
  const status   = searchParams.get('status')   || undefined;
  const page     = Math.max(1, Number(searchParams.get('page')  || 1));
  const limit    = Math.min(100, Number(searchParams.get('limit') || 20));
  const skip     = (page - 1) * limit;

  try {
    const where = {
      ...(tenantId && { tenantId }),
      ...(status   && { status }),
    };

    const [invoices, total] = await Promise.all([
      (prisma as any).invoice.findMany({
        where,
        include: { lineItems: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      (prisma as any).invoice.count({ where }),
    ]);

    return successResponse(invoices, {
      pagination: { skip, take: limit, total, hasMore: skip + limit < total },
    });
  } catch (err) {
    console.error('[ERP Invoices GET]', err);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });
  if (!isSuperAdmin(auth.role)) return errorResponse('PERMISSION_DENIED', { status: 403 });

  try {
    const { tenantId, period } = await request.json();
    if (!tenantId || !period) {
      return errorResponse('VALIDATION_REQUIRED_FIELD', { status: 400 });
    }
    const result = await ERPService.generateInvoice(tenantId, period);
    return successResponse(result, { status: 201 });
  } catch (err) {
    console.error('[ERP Invoices POST]', err);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}
