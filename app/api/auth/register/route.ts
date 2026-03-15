/**
 * POST /api/auth/register - 사용자 회원가입
 *
 * 요청:
 * {
 *   "email": "user@company.com",
 *   "password": "SecurePass123",
 *   "name": "홍길동",
 *   "organizationName": "ABC 에너지",
 *   "industryType": "manufacturing"
 * }
 *
 * 응답: 201 Created
 * {
 *   "success": true,
 *   "data": {
 *     "id": "user-uuid",
 *     "email": "user@company.com",
 *     "name": "홍길동",
 *     "role": "tenant_admin",
 *     "tenantId": "tenant-uuid"
 *   }
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

// ✅ 한국어 검증 메시지를 포함한 회원가입 스키마
const registerSchema = z.object({
  email: z
    .string()
    .email('올바른 이메일 형식이 아닙니다')
    .max(255, '이메일이 너무 깁니다'),
  password: z
    .string()
    .min(8, '비밀번호는 8자 이상이어야 합니다')
    .max(72, '비밀번호는 72자 이하여야 합니다')
    .regex(/[A-Z]/, '비밀번호에 대문자를 포함해야 합니다')
    .regex(/[a-z]/, '비밀번호에 소문자를 포함해야 합니다')
    .regex(/[0-9]/, '비밀번호에 숫자를 포함해야 합니다')
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/, '비밀번호에 특수문자를 포함해야 합니다'),
  name: z
    .string()
    .min(1, '이름을 입력해주세요')
    .max(100, '이름이 너무 깁니다'),
  organizationName: z
    .string()
    .min(1, '조직명을 입력해주세요')
    .max(200, '조직명이 너무 깁니다')
    .optional(),
  industryType: z
    .enum([
      'manufacturing',
      'building',
      'industrial_complex',
      'datacenter',
      'other',
    ])
    .optional()
    .default('manufacturing'),
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
        reason: '회원가입 시도 횟수 초과',
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
        reason: `중복 이메일 회원가입 시도: ${validated.email}`,
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
        {
          success: false,
          error: '이미 등록된 이메일 주소입니다',
          code: 'RESOURCE_ALREADY_EXISTS',
          message: '이 이메일 주소로 이미 가입된 계정이 있습니다. 로그인을 시도해주세요.',
        },
        { status: 409 }
      );
    }

    // ✅ 조직명 결정
    const orgName = validated.organizationName || `${validated.name}의 조직`;

    // ✅ 트랜잭션으로 Tenant와 User 동시 생성
    const result = await prisma.$transaction(async (tx) => {
      // 1. Tenant 생성
      const tenant = await tx.tenant.create({
        data: {
          name: orgName,
          industryType: validated.industryType || 'manufacturing',
          status: 'active',
          settings: {
            // 기본 메뉴 설정 (전체 허용)
            menu: {},
            locale: 'ko',
            timezone: 'Asia/Seoul',
          },
        },
      });

      // 2. 비밀번호 해싱
      const bcryptRounds = process.env.NODE_ENV === 'production' ? 12 : 10;
      const passwordHash = await bcrypt.hash(validated.password, bcryptRounds);

      // 3. User 생성 (첫 사용자 → tenant_admin)
      const user = await tx.user.create({
        data: {
          email: validated.email,
          name: validated.name,
          tenantId: tenant.id,
          passwordHash,
          role: 'tenant_admin',
          isActive: true,
          isEmailVerified: false,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          tenantId: true,
        },
      });

      // 4. 기본 Site 생성
      await tx.site.create({
        data: {
          tenantId: tenant.id,
          name: '본사',
          code: 'HQ',
          siteType: 'factory',
          isActive: true,
        },
      });

      // 5. Trial 구독 자동 생성 (plan_trial이 DB에 존재하는 경우)
      const trialPlan = await tx.plan.findUnique({ where: { id: 'plan_trial' }, select: { id: true } });
      if (trialPlan) {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 30); // 30일 체험
        await tx.subscription.create({
          data: {
            tenantId: tenant.id,
            planId: 'plan_trial',
            status: 'ACTIVE',
            billingCycle: 'monthly',
            startDate: new Date(),
            endDate: trialEnd,
          },
        });
      }

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

    return NextResponse.json(
      {
        success: true,
        data: result.user,
        message: '회원가입이 완료되었습니다.',
      },
      { status: 201 }
    );
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
          success: false,
          error: '입력값 검증 오류',
          code: 'VALIDATION_ERROR',
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
      {
        success: false,
        error: '서버 오류',
        code: 'SERVER_ERROR',
        message: '회원가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      },
      { status: 500 }
    );
  }
}
