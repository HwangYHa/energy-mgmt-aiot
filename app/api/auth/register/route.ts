/**
 * POST /api/auth/register - 사용자 회원가입
 * 
 * 요청:
 * {
 *   "email": "user@example.com",
 *   "password": "SecurePass123",
 *   "name": "John Doe",
 *   "tenantId": "uuid"
 * }
 * 
 * 응답: 201 Created
 * {
 *   "id": "user-uuid",
 *   "email": "user@example.com",
 *   "name": "John Doe",
 *   "role": "viewer"
 * }
 * 
 * 레이트 제한: IP당 3회/시간
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { registerSchema, formatValidationError } from '@/lib/validation/schemas';
import { rateLimitMiddleware, getSignupRateLimit } from '@/lib/middleware/rate-limit';
import { logHttpRequest, logHttpResponse, logBusinessEvent, logSecurityEvent, logError } from '@/lib/logger';
import bcrypt from 'bcrypt';
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
      path: '/api/auth/register',
      ipAddress,
    });

    // ✅ IP 기반 레이트 제한 확인
    const rateLimitResult = await rateLimitMiddleware(request, getSignupRateLimit(ipAddress));
    if (rateLimitResult) {
      logSecurityEvent({
        type: 'RATE_LIMIT',
        severity: 'low',
        reason: 'Registration attempts exceeded',
        ipAddress,
      });

      logHttpResponse({
        requestId,
        method: 'POST',
        path: '/api/auth/register',
        statusCode: 429,
        duration: 5,
      });
      return rateLimitResult;
    }

    const body = await request.json();

    // ✅ 입력 검증
    const validated = registerSchema.parse(body);

    // ✅ 이미 존재하는 사용자인지 확인
    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
      select: { id: true },
    });

    if (existingUser) {
      logSecurityEvent({
        type: 'SUSPICIOUS_ACTIVITY',
        severity: 'low',
        reason: `Registration attempt with existing email: ${validated.email}`,
        ipAddress,
      });

      logHttpResponse({
        requestId,
        method: 'POST',
        path: '/api/auth/register',
        statusCode: 409,
        duration: 50,
      });

      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // ✅ 테넌트 존재 확인
    const tenant = await prisma.tenant.findUnique({
      where: { id: validated.tenantId },
      select: { id: true, status: true },
    });

    if (!tenant) {
      logHttpResponse({
        requestId,
        method: 'POST',
        path: '/api/auth/register',
        statusCode: 404,
        duration: 45,
      });

      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    if (tenant.status !== 'active') {
      logHttpResponse({
        requestId,
        method: 'POST',
        path: '/api/auth/register',
        statusCode: 403,
        duration: 45,
      });

      return NextResponse.json(
        { error: 'Tenant is not active' },
        { status: 403 }
      );
    }

    // ✅ 비밀번호 해싱
    const passwordHash = await bcrypt.hash(validated.password, 12);

    // ✅ 사용자 생성
    const user = await prisma.user.create({
      data: {
        email: validated.email,
        name: validated.name,
        tenantId: validated.tenantId,
        passwordHash,
        role: 'viewer', // 기본 역할
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    // ✅ 감사 로그
    logBusinessEvent({
      action: 'USER_REGISTERED',
      resourceType: 'USER',
      resourceId: user.id,
      userId: user.id,
      tenantId: validated.tenantId,
      result: 'success',
      ipAddress,
      requestId,
    });

    logHttpResponse({
      requestId,
      method: 'POST',
      path: '/api/auth/register',
      statusCode: 201,
      duration: 100,
      userId: user.id,
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logHttpResponse({
        requestId,
        method: 'POST',
        path: '/api/auth/register',
        statusCode: 400,
        duration: 30,
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

    logError(error instanceof Error ? error : new Error(String(error)), {
      requestId,
      method: 'POST',
      path: '/api/auth/register',
      ipAddress,
    });

    logHttpResponse({
      requestId,
      method: 'POST',
      path: '/api/auth/register',
      statusCode: 500,
      duration: 50,
    });

    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}
