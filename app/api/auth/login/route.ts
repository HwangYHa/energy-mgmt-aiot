/**
 * POST /api/auth/login - 사용자 로그인 검증
 * 
 * 주의: NextAuth를 사용하므로, 이 엔드포인트는 정보 제공용입니다.
 * 실제 로그인은 클라이언트에서 signIn('credentials', {...}) 호출
 * 
 * 레이트 제한: IP당 10회/15분, 이메일당 5회/15분
 */

import { NextRequest, NextResponse } from 'next/server';
import { loginSchema } from '@/lib/validation/schemas';
import { rateLimitMiddleware, getAuthRateLimit, getLoginRateLimit } from '@/lib/middleware/rate-limit';
import { logHttpRequest, logHttpResponse, logSecurityEvent } from '@/lib/logger';
import { z } from 'zod';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const ipAddress = request.headers.get('x-forwarded-for') || 'unknown';

  try {
    // 요청 로깅
    logHttpRequest({
      requestId,
      method: 'POST',
      path: '/api/auth/login',
      ipAddress,
    });

    // ✅ IP 기반 레이트 제한 확인
    const ipRateLimitResult = await rateLimitMiddleware(request, getAuthRateLimit(ipAddress));
    if (ipRateLimitResult) {
      logHttpResponse({
        requestId,
        method: 'POST',
        path: '/api/auth/login',
        statusCode: 429,
        duration: 5,
      });
      return ipRateLimitResult;
    }

    const body = await request.json();

    // ✅ 입력 검증
    const validated = loginSchema.parse(body);

    // ✅ 이메일 기반 레이트 제한 확인
    const emailRateLimitResult = await rateLimitMiddleware(
      request,
      getLoginRateLimit(validated.email)
    );
    if (emailRateLimitResult) {
      logSecurityEvent({
        type: 'RATE_LIMIT',
        severity: 'medium',
        reason: `Login attempts exceeded for email: ${validated.email}`,
        ipAddress,
      });

      logHttpResponse({
        requestId,
        method: 'POST',
        path: '/api/auth/login',
        statusCode: 429,
        duration: 10,
      });
      return emailRateLimitResult;
    }

    // 실제 로그인은 클라이언트에서:
    // import { signIn } from 'next-auth/react';
    // const result = await signIn('credentials', {
    //   email: body.email,
    //   password: body.password,
    //   redirect: false,
    // });

    logHttpResponse({
      requestId,
      method: 'POST',
      path: '/api/auth/login',
      statusCode: 200,
      duration: 15,
    });

    return NextResponse.json(
      {
        message: 'Use signIn from next-auth/react on client. This is a validation endpoint only.',
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      logHttpResponse({
        requestId,
        method: 'POST',
        path: '/api/auth/login',
        statusCode: 400,
        duration: 10,
      });

      return NextResponse.json(
        {
          error: 'Validation failed',
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
      path: '/api/auth/login',
      statusCode: 500,
      duration: 20,
    });

    return NextResponse.json(
      { error: 'Login validation failed' },
      { status: 500 }
    );
  }
}
