/**
 * GET  /api/onboarding        - 온보딩 상태 조회
 * PUT  /api/onboarding        - 온보딩 단계 갱신 / 완료 처리
 */
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED');

  const tenant = await prisma.tenant.findUnique({
    where: { id: auth.tenantId },
    select: {
      onboardingStep: true,
      onboardingCompletedAt: true,
      _count: { select: { sites: true } },
    },
  });

  if (!tenant) return errorResponse('RESOURCE_NOT_FOUND');

  return successResponse({
    step: tenant.onboardingStep,
    completedAt: tenant.onboardingCompletedAt,
    isCompleted: !!tenant.onboardingCompletedAt,
    hasSites: tenant._count.sites > 0,
  });
}

export async function PUT(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED');

  let body: { step?: number; complete?: boolean; dataMethod?: string };
  try { body = await request.json(); } catch { return errorResponse('VALIDATION_ERROR', { details: { message: 'JSON 파싱 오류' } }); }

  const { step, complete, dataMethod } = body;

  const updateData: {
    onboardingStep?: number;
    onboardingCompletedAt?: Date;
    settings?: Prisma.InputJsonValue;
  } = {};

  if (typeof step === 'number') {
    updateData.onboardingStep = step;
  }

  if (complete) {
    updateData.onboardingCompletedAt = new Date();
    updateData.onboardingStep = 3;
  }

  // 데이터 연결 방식을 settings에 저장
  if (dataMethod) {
    const current = await prisma.tenant.findUnique({
      where: { id: auth.tenantId },
      select: { settings: true },
    });
    const currentSettings = (current?.settings as Record<string, unknown>) ?? {};
    updateData.settings = { ...currentSettings, dataMethod };
  }

  const updated = await prisma.tenant.update({
    where: { id: auth.tenantId },
    data: updateData,
    select: {
      onboardingStep: true,
      onboardingCompletedAt: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: auth.tenantId,
      userId: auth.userId,
      action: complete ? 'ONBOARDING_COMPLETED' : 'ONBOARDING_STEP_UPDATED',
      resourceType: 'tenant',
      resourceId: auth.tenantId,
      changes: { step, complete, dataMethod },
    },
  }).catch(() => null);

  return successResponse({
    step: updated.onboardingStep,
    completedAt: updated.onboardingCompletedAt,
    isCompleted: !!updated.onboardingCompletedAt,
  });
}
