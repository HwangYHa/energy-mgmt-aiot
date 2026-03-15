import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { verifyAuth } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import {
  successResponse,
  unauthorizedResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/api/response';
import { validatePassword } from '@/lib/validation/password';
import { logSecurityEvent } from '@/lib/services/security-event.service';

/**
 * POST /api/auth/change-password - 비밀번호 변경
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return errorResponse('VALIDATION_REQUIRED_FIELD');
    }

    // 패스워드 정책 검증 (강화된 규칙)
    const pwCheck = validatePassword(newPassword);
    if (!pwCheck.valid) {
      return errorResponse('VALIDATION_ERROR', {
        details: { message: pwCheck.errors[0] ?? '비밀번호 정책에 맞지 않습니다.' },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) return unauthorizedResponse();

    // 현재 비밀번호 확인
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return errorResponse('AUTH_INVALID_CREDENTIALS', {
        details: { message: '현재 비밀번호가 올바르지 않습니다.' },
      });
    }

    // 새 비밀번호 해시
    const bcryptRounds = process.env.NODE_ENV === 'production' ? 12 : 10;
    const passwordHash = await bcrypt.hash(newPassword, bcryptRounds);

    await prisma.user.update({
      where: { id: auth.userId },
      data: { passwordHash },
    });

    // 보안 이벤트 기록 (fire-and-forget)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
              ?? request.headers.get('x-real-ip')
              ?? undefined;
    logSecurityEvent({
      type: 'PASSWORD_CHANGED',
      severity: 'LOW',
      ip,
      userId: auth.userId,
      tenantId: auth.tenantId,
    }).catch(() => {});

    return successResponse({ message: '비밀번호가 변경되었습니다.' });
  } catch {
    return serverErrorResponse();
  }
}
