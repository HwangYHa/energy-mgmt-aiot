/**
 * POST /api/auth/forgot-password - 비밀번호 재설정 요청
 * 
 * 요청:
 * {
 *   "email": "user@example.com"
 * }
 * 
 * 응답: 200 OK
 * {
 *   "message": "비밀번호 재설정 링크가 이메일로 전송되었습니다."
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import crypto from 'crypto';
import { logHttpRequest, logHttpResponse } from '@/lib/logger';

const emailSchema = z.object({
  email: z.string().email('올바른 이메일 주소를 입력해주세요.'),
});

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';

  try {
    logHttpRequest({
      requestId,
      method: 'POST',
      path: '/api/auth/forgot-password',
      ipAddress,
    });

    const body = await request.json();
    const validated = emailSchema.parse(body);

    // 사용자 확인
    const user = await prisma.user.findUnique({
      where: { email: validated.email },
      select: { id: true, name: true, isActive: true },
    });

    // 보안: 사용자가 존재하지 않아도 동일한 응답 반환 (정보 유출 방지)
    if (user && user.isActive) {
      // 재설정 토큰 생성
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1시간 후 만료

      // 토큰 저장
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetTokenExpiresAt,
        },
      });

      // TODO: 실제 이메일 전송 구현
      // 예: await sendPasswordResetEmail(validated.email, resetToken);

      // Note: Password reset requests are logged but not as security events
      // as they are expected user actions
    }

    logHttpResponse({
      requestId,
      method: 'POST',
      path: '/api/auth/forgot-password',
      statusCode: 200,
      duration: 50,
    });

    // 보안: 항상 성공 메시지 반환 (사용자 존재 여부 정보 유출 방지)
    return NextResponse.json(
      {
        message: '비밀번호 재설정 링크가 이메일로 전송되었습니다. 이메일을 확인해주세요.',
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      logHttpResponse({
        requestId,
        method: 'POST',
        path: '/api/auth/forgot-password',
        statusCode: 400,
        duration: 10,
      });

      return NextResponse.json(
        {
          error: '유효하지 않은 이메일 주소입니다.',
          details: error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    logHttpResponse({
      requestId,
      method: 'POST',
      path: '/api/auth/forgot-password',
      statusCode: 500,
      duration: 20,
    });

    return NextResponse.json(
      { error: '비밀번호 재설정 요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
