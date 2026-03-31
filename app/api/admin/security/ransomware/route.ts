/**
 * GET  /api/admin/security/ransomware  — 알림 목록
 * POST /api/admin/security/ransomware  — 수동 알림 생성
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';
import { hasMinRole } from '@/lib/auth/permissions';

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });
  if (!hasMinRole(auth.role, 'tenant_admin')) return errorResponse('PERMISSION_DENIED', { status: 403 });

  const { searchParams } = new URL(request.url);
  const status   = searchParams.get('status')   || undefined;
  const severity = searchParams.get('severity') || undefined;
  const dateFrom = searchParams.get('dateFrom') || undefined;
  const dateTo   = searchParams.get('dateTo')   || undefined;
  const page     = Math.max(1, Number(searchParams.get('page')  || 1));
  const limit    = Math.min(100, Number(searchParams.get('limit') || 20));
  const skip     = (page - 1) * limit;

  try {
    // super_admin은 전체, tenant_admin은 자기 테넌트만
    const isSA         = auth.role === 'super_admin';
    const tenantFilter = isSA ? {} : { tenantId: auth.tenantId };

    const where = {
      ...tenantFilter,
      ...(status   && { status }),
      ...(severity && { severity }),
      ...(dateFrom || dateTo ? {
        createdAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo   && { lte: new Date(dateTo) }),
        },
      } : {}),
    };

    const model = (prisma as any).ransomwareAlert;
    if (!model) {
      return successResponse([], { pagination: { skip, take: limit, total: 0, hasMore: false } });
    }

    const [alerts, total] = await Promise.all([
      model.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      model.count({ where }),
    ]);

    return successResponse(alerts, {
      pagination: { skip, take: limit, total, hasMore: skip + limit < total },
    });
  } catch (err) {
    console.error('[RansomwareAlert GET]', err);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });
  if (!hasMinRole(auth.role, 'tenant_admin')) return errorResponse('PERMISSION_DENIED', { status: 403 });

  try {
    const body = await request.json();
    const { alertType, severity, description, metadata } = body;

    if (!alertType || !severity || !description) {
      return errorResponse('VALIDATION_REQUIRED_FIELD', { status: 400 });
    }

    const model = (prisma as any).ransomwareAlert;
    if (!model) return errorResponse('SERVER_ERROR', { status: 503 });

    const alert = await model.create({
      data: {
        tenantId:    auth.tenantId,
        userId:      auth.userId,
        alertType,
        severity,
        description,
        metadata:    metadata ? JSON.parse(JSON.stringify(metadata)) : null,
        status:      'open',
      },
    });

    return successResponse(alert, { status: 201 });
  } catch (err) {
    console.error('[RansomwareAlert POST]', err);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}
