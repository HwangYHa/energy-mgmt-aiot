/**
 * 결제 내역 API
 *
 * GET /api/payment/history - 결제 내역 목록 조회 (tenant_admin 이상)
 */

import { NextRequest } from 'next/server';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import { UserRole } from '@/lib/constants/roles';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
} from '@/lib/api/response';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    if (!requireRoleOrHigher(auth, 'tenant_admin' as UserRole)) {
      return forbiddenResponse();
    }

    const { searchParams } = new URL(request.url);
    const skip = parseInt(searchParams.get('skip') || '0', 10);
    const take = Math.min(parseInt(searchParams.get('take') || '12', 10), 50);

    const [payments, total] = await Promise.all([
      prisma.paymentHistory.findMany({
        where: { tenantId: auth.tenantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          subscription: {
            select: {
              plan: { select: { name: true, tier: true } },
            },
          },
        },
      }),
      prisma.paymentHistory.count({
        where: { tenantId: auth.tenantId },
      }),
    ]);

    const data = payments.map((p) => ({
      id: p.id,
      amount: p.amount.toString(),
      currency: p.currency,
      status: p.status,
      method: p.method,
      transactionId: p.transactionId,
      receiptUrl: p.receiptUrl,
      failReason: p.failReason,
      paidAt: p.paidAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      planName: p.subscription.plan.name,
      planTier: p.subscription.plan.tier,
    }));

    return successResponse(data, {
      pagination: {
        skip,
        take,
        total,
        hasMore: skip + take < total,
      },
    });
  } catch (error) {
    console.error('[Payment History] Error:', error);
    return serverErrorResponse();
  }
}
