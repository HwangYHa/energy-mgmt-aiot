/**
 * /api/control - 수동 제어 명령 API
 *
 * 보안:
 * ✅ 인증 필수 (operator 이상)
 * ✅ 테넌트 격리
 * ✅ 설비 제어 가능 여부 검증
 * ✅ 온라인 상태 검증
 * ✅ ControlLog + AuditLog 기록
 */

import { NextRequest } from 'next/server';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import { UserRole, Prisma } from '@prisma/client';
import {
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  successResponse,
  serverErrorResponse,
} from '@/lib/api/response';

const controlCommandSchema = z.object({
  deviceId: z.string().min(1, '설비 ID가 필요합니다'),
  action: z.enum(['start', 'stop', 'setpoint'], {
    errorMap: () => ({ message: 'action은 start, stop, setpoint 중 하나여야 합니다' }),
  }),
  executionMode: z.literal('manual'),
  requiresApproval: z.boolean().default(false),
  targetValue: z.number().optional(),
  reason: z.string().max(1000).optional(),
  parameters: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // 1. 인증 검증
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    // 2. 권한 검증 (operator 이상)
    if (!requireRoleOrHigher(auth, 'operator' as UserRole)) {
      return forbiddenResponse();
    }

    // 3. 입력 검증
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return validationErrorResponse({ body: '올바른 JSON 형식이어야 합니다' });
    }

    const parseResult = controlCommandSchema.safeParse(body);
    if (!parseResult.success) {
      const errors: Record<string, string> = {};
      parseResult.error.issues.forEach((issue) => {
        const path = issue.path.join('.') || 'input';
        errors[path] = issue.message;
      });
      return validationErrorResponse(errors);
    }

    const { deviceId, action, requiresApproval, targetValue, reason, parameters } =
      parseResult.data;

    console.log("parseResult.data : ", parseResult.data)
    // 4. 설비 조회 및 테넌트 검증
    const device = await prisma.device.findFirst({
      where: {
        id: deviceId,
        tenantId: auth.tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        controlCapable: true,
        status: true,
        site: {
          select: { id: true, name: true },
        },
      },
    });

    if (!device) return notFoundResponse('설비');

    // 5. 제어 가능 여부 확인
    if (!device.controlCapable) {
      return validationErrorResponse({
        deviceId: '이 설비는 제어를 지원하지 않습니다',
      });
    }

    if (device.status === 'offline') {
      return validationErrorResponse({
        deviceId: '오프라인 상태의 설비는 제어할 수 없습니다',
      });
    }

    // 6. setpoint 명령은 targetValue 필수
    if (action === 'setpoint' && targetValue === undefined) {
      return validationErrorResponse({
        targetValue: 'setpoint 명령에는 설정값이 필요합니다',
      });
    }

    // 7. IP 주소 추출
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null;

    // 8. ControlLog 생성
    // parameters에 reason도 병기 (기존 호환성 유지)
    const mergedParams = reason
      ? { ...(parameters ?? {}), reason }
      : parameters ?? undefined;

      console.log("reason >>> ", reason);
    const controlLog = await prisma.controlLog.create({
      data: {
        tenantId: auth.tenantId,
        deviceId,
        action,
        parameters: mergedParams as Prisma.InputJsonValue | undefined,
        targetValue: targetValue ?? undefined,
        reason: reason ?? undefined,
        executionMode: 'manual',
        requiresApproval,
        executedBy: auth.userId,
        status: requiresApproval ? 'pending' : 'sent',
        ipAddress,
      },
    });

    // 9. 감사 로그 (실패해도 제어는 계속)
    await prisma.auditLog
      .create({
        data: {
          tenantId: auth.tenantId,
          userId: auth.userId,
          action: 'DEVICE_CONTROL',
          resourceType: 'DEVICE',
          resourceId: deviceId,
          changes: {
            controlLogId: controlLog.id,
            command: action,
            requiresApproval,
            targetValue: targetValue ?? null,
          },
          result: 'success',
          ipAddress,
        },
      })
      .catch((err) => console.error('[Control] 감사 로그 기록 실패:', err));

    return successResponse({
      controlLogId: controlLog.id,
      status: controlLog.status,
      message: requiresApproval
        ? '승인 요청이 전송되었습니다. 관리자 승인 후 실행됩니다.'
        : `${device.name}에 ${action} 명령이 전송되었습니다.`,
    });
  } catch (error) {
    console.error('[API] 제어 명령 처리 오류:', error);
    return serverErrorResponse({ message: '제어 명령 처리 중 오류가 발생했습니다' });
  }
}
