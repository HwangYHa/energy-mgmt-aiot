/**
 * GET  /api/admin/erp/invoices — 인보이스 목록
 * POST /api/admin/erp/invoices — 인보이스 생성
 * super_admin 전용
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { SubscriptionStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });
  if (!isSuperAdmin(auth.role)) return errorResponse('PERMISSION_DENIED', { status: 403 });

  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId') || undefined;
  const status   = searchParams.get('status') || undefined;
  const period   = searchParams.get('period') || undefined;
  const page     = Math.max(1, Number(searchParams.get('page') || 1));
  const limit    = Math.min(100, Number(searchParams.get('limit') || 20));
  const skip     = (page - 1) * limit;

  const model = (prisma as any).invoice;
  if (!model) return successResponse([], { pagination: { skip: 0, take: limit, total: 0, hasMore: false } });

  try {
    const where: Record<string, unknown> = {};
    if (tenantId) where.tenantId = tenantId;
    if (status)   where.status = status;
    if (period)   where.periodStart = { contains: period };

    const [invoices, total] = await Promise.all([
      model.findMany({ where, include: { lineItems: true }, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      model.count({ where }),
    ]);

    return successResponse(invoices, { pagination: { skip, take: limit, total, hasMore: skip + limit < total } });
  } catch (err) {
    console.error('[ERP Invoices GET]', err);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });
  if (!isSuperAdmin(auth.role)) return errorResponse('PERMISSION_DENIED', { status: 403 });

  const model = (prisma as any).invoice;
  if (!model) return errorResponse('SERVER_ERROR', { status: 503 });

  try {
    const body = await request.json();
    const { tenantId, period } = body as { tenantId: string; period: string };

    if (!tenantId || !period) return errorResponse('VALIDATION_REQUIRED_FIELD', { status: 400 });

    const [year, month] = period.split('-').map(Number);
    if (!year || !month) return errorResponse('VALIDATION_INVALID_FORMAT', { status: 400 });

    // 이미 해당 기간 인보이스가 있으면 반환
    const existing = await model.findFirst({ where: { tenantId, periodStart: { contains: period } } });
    if (existing) return successResponse(existing, { meta: { message: '이미 해당 기간 인보이스가 존재합니다.' } });

    // 구독 금액 조회
    const sub = await prisma.subscription.findFirst({
      where: { tenantId, status: SubscriptionStatus.ACTIVE },
      include: { plan: { select: { name: true, monthlyPrice: true } } },
    });

    const basePrice = Number(sub?.plan?.monthlyPrice ?? 0);
    const planName  = sub?.plan?.name ?? '기본 구독';

    // 인보이스 채번 INV-YYYYMM-NNNN
    const seq      = await model.count({ where: { periodStart: { contains: period } } });
    const invoiceNo = `INV-${period.replace('-', '')}-${String(seq + 1).padStart(4, '0')}`;

    const subtotal   = basePrice;
    const taxRate    = 0.1;
    const taxAmount  = Math.round(subtotal * taxRate);
    const total      = subtotal + taxAmount;

    const periodStart = `${period}-01`;
    const periodEnd   = `${period}-${new Date(year, month, 0).getDate()}`;
    const dueDate     = new Date(year, month, 10); // 다음달 10일

    const invoice = await model.create({
      data: {
        invoiceNo,
        tenantId,
        periodStart,
        periodEnd,
        subtotal,
        taxRate,
        taxAmount,
        total,
        currency: 'KRW',
        status: 'draft',
        dueDate,
        lineItems: {
          create: [
            { description: `${planName} 월정액 (${period})`, quantity: 1, unitPrice: basePrice, amount: basePrice },
          ],
        },
      },
      include: { lineItems: true },
    });

    return successResponse(invoice, { status: 201, meta: { message: `인보이스 ${invoiceNo} 생성 완료` } });
  } catch (err) {
    console.error('[ERP Invoices POST]', err);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}
