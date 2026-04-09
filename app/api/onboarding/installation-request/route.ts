/**
 * POST /api/onboarding/installation-request
 *
 * 설치 예약 접수:
 * 1. 요청 내용을 AuditLog + Tenant settings에 저장
 * 2. 관리자 이메일 알림 발송
 * 3. 고객 확인 이메일 발송 (이메일 제공 시)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';
import { sendInstallationRequestEmail } from '@/lib/services/email.service';
import { Prisma } from '@prisma/client';

const bodySchema = z.object({
  contactName:   z.string().min(1, '담당자명을 입력해주세요'),
  phone:         z.string().min(9, '연락처를 정확히 입력해주세요'),
  email:         z.string().email().optional().or(z.literal('')),
  preferredDate: z.string().min(1, '희망 방문일을 선택해주세요'),
  address:       z.string().optional(),
  planTier:      z.enum(['basic', 'pro', 'enterprise']).optional(),
  notes:         z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED');

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (e) {
    if (e instanceof z.ZodError) {
      return errorResponse('VALIDATION_ERROR', {
        status: 400,
        details: Object.fromEntries(e.errors.map(err => [err.path.join('.'), err.message])),
      });
    }
    return errorResponse('VALIDATION_ERROR', { status: 400 });
  }

  // 테넌트 이름 조회
  const tenant = await prisma.tenant.findUnique({
    where:  { id: auth.tenantId },
    select: { name: true, settings: true },
  });

  // Tenant settings에 설치 예약 상태 저장
  const currentSettings = (tenant?.settings as Record<string, Prisma.InputJsonValue>) ?? {};
  await prisma.tenant.update({
    where: { id: auth.tenantId },
    data: {
      settings: {
        ...currentSettings,
        installationRequest: {
          status:        'PENDING',
          submittedAt:   new Date().toISOString(),
          contactName:   body.contactName,
          phone:         body.phone,
          email:         body.email || null,
          preferredDate: body.preferredDate,
          address:       body.address || null,
          planTier:      body.planTier || null,
          notes:         body.notes || null,
        } as Prisma.InputJsonValue,
      } as Prisma.InputJsonValue,
    },
  }).catch(() => null);

  // AuditLog 기록
  await prisma.auditLog.create({
    data: {
      tenantId:     auth.tenantId,
      userId:       auth.userId,
      action:       'INSTALLATION_REQUEST',
      resourceType: 'tenant',
      resourceId:   auth.tenantId,
      changes:      body as unknown as Prisma.InputJsonValue,
    },
  }).catch(() => null);

  // 이메일 발송 (fire-and-forget)
  sendInstallationRequestEmail({
    contactName:   body.contactName,
    phone:         body.phone,
    email:         body.email || undefined,
    preferredDate: body.preferredDate,
    address:       body.address,
    planTier:      body.planTier,
    tenantName:    tenant?.name ?? undefined,
    notes:         body.notes,
  }).catch(e => console.error('[InstallRequest] 이메일 발송 실패:', e));

  return successResponse({
    message: '설치 예약이 접수되었습니다. 영업일 1~2일 내 담당자가 연락드립니다.',
  });
}
