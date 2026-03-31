/**
 * 알림 규칙 API
 *
 * GET    /api/notifications/rules - 현재 사용자의 알림 규칙 목록
 * POST   /api/notifications/rules - 알림 규칙 생성
 * PATCH  /api/notifications/rules - 알림 규칙 수정
 * DELETE /api/notifications/rules?id=xxx - 알림 규칙 삭제
 */

import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import { sendNotificationEmail } from '@/lib/services/email.service';
// [SMS_DISABLED] import { sendKakao } from '@/lib/services/kakao.service';
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  validationErrorResponse,
  serverErrorResponse,
  formatZodErrors,
} from '@/lib/api/response';
import { generateSeqNo } from '@/lib/utils/sequence';

const createRuleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  category: z.enum(['system', 'energy', 'device', 'security', 'dr', 'carbon', 'cost']),
  severity: z.enum(['info', 'warning', 'critical']),
  emailEnabled: z.boolean().default(true),
  smsEnabled: z.boolean().default(false),
  pushEnabled: z.boolean().default(false),
  webhookUrl: z.string().url().max(500).optional().nullable(),
  enabled: z.boolean().default(true),
});

const updateRuleSchema = z.object({
  id: z.string().uuid(),
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  webhookUrl: z.string().url().max(500).optional().nullable(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  enabled: z.boolean().optional(),
  threshold: z.number().optional().nullable(),
  thresholdUnit: z.string().max(20).optional().nullable(),
  thresholdOp: z.enum(['gt', 'gte', 'lt', 'lte', 'eq']).optional().nullable(),
  testSend: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const rules = await prisma.notificationRule.findMany({
      where: {
        tenantId: auth.tenantId,
        userId: auth.userId,
      },
      orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
    });

    return successResponse(rules);
  } catch (error) {
    console.error('[Notification Rules] GET Error:', error);
    return serverErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const body = await request.json();
    const parsed = createRuleSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(formatZodErrors(parsed.error));
    }

    // 알림 규칙 코드 자동 채번: NR-YYYYMMDD-NNNN
    const code = await generateSeqNo('NOTIFICATION_RULE');

    const rule = await (prisma as any).notificationRule.create({
      data: {
        tenantId: auth.tenantId,
        userId: auth.userId,
        code,
        ...parsed.data,
      },
    });

    return successResponse(rule, { status: 201 });
  } catch (error) {
    console.error('[Notification Rules] POST Error:', error);
    return serverErrorResponse();
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const body = await request.json();
    const parsed = updateRuleSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(formatZodErrors(parsed.error));
    }

    const { id, testSend, ...updateData } = parsed.data;

    // 본인 규칙만 수정 가능
    const existing = await prisma.notificationRule.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
        userId: auth.userId,
      },
    });

    if (!existing) {
      return notFoundResponse('알림 규칙');
    }

    // 테스트 발송 처리
    if (testSend) {
      const user = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { email: true, name: true, phone: true },
      });

      const subject = `[테스트] ${existing.name} 알림 테스트`;
      const body    = `이 알림은 "${existing.name}" 규칙의 테스트 발송입니다.\n카테고리: ${existing.category}\n심각도: ${existing.severity}`;
      const logs: {
        ruleId: string; channel: string; recipient: string;
        subject: string; body: string; status: string;
        errorMsg: string | null; sentAt: Date | null;
      }[] = [];

      // 이메일 테스트
      let emailSent = false;
      if (existing.emailEnabled && user?.email) {
        let emailStatus: 'sent' | 'failed' = 'sent';
        let emailError: string | null = null;
        try {
          await sendNotificationEmail({
            to: user.email, ruleName: existing.name,
            category: existing.category, severity: existing.severity,
            message: body, isTest: true,
          });
          emailSent = true;
        } catch (err) {
          emailStatus = 'failed';
          emailError = err instanceof Error ? err.message : String(err);
          console.error('[Notification] 테스트 이메일 발송 오류:', emailError);
        }
        logs.push({
          ruleId: existing.id, channel: 'email', recipient: user.email,
          subject, body, status: emailStatus, errorMsg: emailError,
          sentAt: emailStatus === 'sent' ? new Date() : null,
        });
      }

      // [SMS_DISABLED] 카카오 알림톡/SMS 테스트 발송 일시 비활성화
      // 재활성화: 아래 주석 블록을 해제하고 위 let kakaoSent = false; 도 주석 해제
      const kakaoSent = false;
      /*
      if (existing.smsEnabled && user?.phone) {
        let kakaoStatus: 'sent' | 'failed' = 'sent';
        let kakaoError: string | null = null;
        const kakaoText = `[탄소이음 테스트] ${existing.name}\n${body.substring(0, 60)}`;
        try {
          await sendKakao({ to: user.phone, message: kakaoText });
          kakaoSent = true;
        } catch (err) {
          kakaoStatus = 'failed';
          kakaoError = err instanceof Error ? err.message : String(err);
          console.error('[Notification] 테스트 카카오 발송 오류:', kakaoError);
        }
        logs.push({
          ruleId: existing.id, channel: 'kakao', recipient: user.phone,
          subject, body, status: kakaoStatus, errorMsg: kakaoError,
          sentAt: kakaoStatus === 'sent' ? new Date() : null,
        });
      }
      */

      if (logs.length > 0) {
        await prisma.notificationLog.createMany({ data: logs });
      }

      return successResponse({
        testSent: true,
        emailSent,
        kakaoSent,
        recipient: user?.email ?? 'unknown',
        phone: user?.phone ?? null,
      });
    }

    const updated = await prisma.notificationRule.update({
      where: { id },
      data: updateData,
    });

    return successResponse(updated);
  } catch (error) {
    console.error('[Notification Rules] PATCH Error:', error);
    return serverErrorResponse();
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return validationErrorResponse({ id: '삭제할 규칙 ID가 필요합니다.' });
    }

    // 본인 규칙만 삭제 가능
    const existing = await prisma.notificationRule.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
        userId: auth.userId,
      },
    });

    if (!existing) {
      return notFoundResponse('알림 규칙');
    }

    // 관련 로그도 함께 삭제 (cascade)
    await prisma.notificationRule.delete({ where: { id } });

    return successResponse({ deleted: true });
  } catch (error) {
    console.error('[Notification Rules] DELETE Error:', error);
    return serverErrorResponse();
  }
}
