/**
 * /api/sites - 사이트 관리 API
 *
 * 보안:
 * ✅ 인증 필수
 * ✅ 테넌트 검증
 * ✅ 입력 검증
 * ✅ 권한 검증
 */

import { NextRequest } from 'next/server';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { siteCreateSchema, formatValidationError } from '@/lib/validation/schemas';
import { z } from 'zod';
import logger from '@/lib/logger';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/api/response';

export async function GET(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof verifyAuth>> | undefined;
  try {
    // ✅ 인증 검증
    auth = await verifyAuth(request);
    if (!auth) {
      return unauthorizedResponse();
    }

    // 쿼리 파라미터 처리
    const { searchParams } = new URL(request.url);
    const take = Math.min(Number(searchParams.get('take') || 20), 100);
    const skip = Number(searchParams.get('skip') || 0);
    const siteType = searchParams.get('siteType');

    // ✅ 사이트 조회 (tenantId 필터 자동 포함)
    const where: Record<string, unknown> = {
      tenantId: auth.tenantId,
      deletedAt: null,
    };

    if (siteType) {
      where.siteType = siteType;
    }

    const sites = await prisma.site.findMany({
      where,
      select: {
        id: true,
        name: true,
        code: true,
        siteType: true,
        city: true,
        country: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    // ✅ 총 개수 조회
    const total = await prisma.site.count({
      where,
    });

    return successResponse(sites, {
      pagination: { skip, take, total, hasMore: skip + take < total },
    });
  } catch (error) {
    logger.error('사이트 조회 오류', {
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return serverErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  let auth: Awaited<ReturnType<typeof verifyAuth>> | undefined;
  try {
    // ✅ 인증 검증
    auth = await verifyAuth(request);
    if (!auth) {
      return unauthorizedResponse();
    }

    // ✅ 권한 검증 (사이트 생성은 operator 이상)
    if (!requireRoleOrHigher(auth, 'operator' as UserRole)) {
      return forbiddenResponse({ requiredRoles: ['operator', 'site_manager', 'tenant_admin'] });
    }

    const body = await request.json();

    // ✅ 입력 검증
    let validated;
    try {
      validated = siteCreateSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return validationErrorResponse({ fields: formatValidationError(error) });
      }
      throw error;
    }

    // ✅ 트랜잭션으로 원자성 보장
    const result = await prisma.$transaction(async (tx) => {
      // 1. 사이트 생성
      const site = await tx.site.create({
        data: {
          ...validated,
          tenantId: auth!.tenantId, // ✅ 검증된 tenantId만 사용
        },
        select: {
          id: true,
          name: true,
          code: true,
          siteType: true,
          address: true,
          city: true,
          country: true,
          createdAt: true,
        },
      });

      // 2. 감사 로그 기록
      await tx.auditLog.create({
        data: {
          tenantId: auth!.tenantId,
          userId: auth!.userId,
          action: 'SITE_CREATE',
          resourceType: 'SITE',
          resourceId: site.id,
          result: 'success',
        },
      });

      return site;
    });

    logger.info('사이트 생성 완료', {
      siteId: result.id,
      tenantId: auth!.tenantId,
      userId: auth!.userId,
    });

    return successResponse(result, { status: 201 });
  } catch (error) {
    logger.error('사이트 생성 오류', {
      error: error instanceof Error ? error.message : '알 수 없는 오류',
      stack: error instanceof Error ? error.stack : undefined,
      tenantId: auth?.tenantId,
      userId: auth?.userId,
    });

    return serverErrorResponse();
  }
}
