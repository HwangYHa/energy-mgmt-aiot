/**
 * POST /api/auth/register - 사용자 회원가입
 * 
 * 요청:
 * {
 *   "email": "user@example.com",
 *   "password": "SecurePass123",
 *   "name": "John Doe"
 * }
 * 
 * 응답: 201 Created
 * {
 *   "id": "user-uuid",
 *   "email": "user@example.com",
 *   "name": "John Doe",
 *   "role": "tenant_admin",
 *   "tenantId": "tenant-uuid"
 * }
 * 
 * 레이트 제한: IP당 3회/시간
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { rateLimitMiddleware, getSignupRateLimit } from '@/lib/middleware/rate-limit';
import { logHttpRequest, logHttpResponse, logBusinessEvent, logSecurityEvent, logError } from '@/lib/logger';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import crypto from 'crypto';

// ⭐ 간단한 회원가입 스키마 (tenantId 제거)
const registerSchema = z.object({
  email: z.string().email('Invalid email format').max(255, 'Email too long'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[a-z]/, 'Password must contain lowercase letter')
    .regex(/[0-9]/, 'Password must contain number'),
  name: z.string().min(1, 'Name required').max(100, 'Name too long'),
});

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
        { error: '이메일 주소가 이미 등록되었습니다.' },
        { status: 409 }
      );
    }

    // ✅ 트랜잭션으로 Tenant와 User 동시 생성
    const result = await prisma.$transaction(async (tx) => {
      // 1. Tenant 생성 (회사명은 사용자 이름 기반)
      const tenant = await tx.tenant.create({
        data: {
          name: `${validated.name}'s Organization`,
          industryType: 'other',
          status: 'active',
        },
      });

      // 2. 비밀번호 해싱 (개발 환경에서는 라운드 수를 낮춤)
      const bcryptRounds = process.env.NODE_ENV === 'production' ? 12 : 10;
      const passwordHash = await bcrypt.hash(validated.password, bcryptRounds);

      // 3. User 생성
      // First user (tenant creator) is admin, consistent with OAuth logic
      const isFirstUser = true; // Creating new tenant, so this is the first user
      const user = await tx.user.create({
        data: {
          email: validated.email,
          name: validated.name,
          tenantId: tenant.id,
          passwordHash,
          role: isFirstUser ? 'tenant_admin' : 'viewer',
          isActive: true,
          isEmailVerified: false, // 이메일 인증은 나중에
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          tenantId: true,
        },
      });

      // 4. 기본 Site 생성 (선택사항)
      await tx.site.create({
        data: {
          tenantId: tenant.id,
          name: 'Main Site',
          code: 'MAIN',
          siteType: 'factory',
          isActive: true,
        },
      });

      return { user, tenant };
    });

    // ✅ 감사 로그
    logBusinessEvent({
      action: 'USER_REGISTERED',
      resourceType: 'USER',
      resourceId: result.user.id,
      userId: result.user.id,
      tenantId: result.user.tenantId,
      result: 'success',
      ipAddress,
      requestId,
    });

    logBusinessEvent({
      action: 'TENANT_CREATED',
      resourceType: 'TENANT',
      resourceId: result.tenant.id,
      userId: result.user.id,
      tenantId: result.tenant.id,
      result: 'success',
      ipAddress,
      requestId,
    });

    logHttpResponse({
      requestId,
      method: 'POST',
      path: '/api/auth/register',
      statusCode: 201,
      duration: 150,
      userId: result.user.id,
    });

    return NextResponse.json(result.user, { status: 201 });
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
      { error: '등록 실패' },
      { status: 500 }
    );
  }
}