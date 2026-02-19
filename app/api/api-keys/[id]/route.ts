/**
 * /api/api-keys/[id] - API 키 개별 관리
 *
 * 보안:
 * ✅ 인증 필수
 * ✅ 소유자 검증
 */

import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import { successResponse, unauthorizedResponse, notFoundResponse, serverErrorResponse } from '@/lib/api/response';
import logger from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// DELETE /api/api-keys/[id] - API 키 비활성화 (소프트 삭제)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    // 소유자 확인
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
        userId: auth.userId,
      },
    });

    if (!apiKey) {
      return notFoundResponse('API_KEY');
    }

    await prisma.apiKey.update({
      where: { id },
      data: { isActive: false },
    });

    // 감사 로그
    await prisma.auditLog.create({
      data: {
        tenantId: auth.tenantId,
        userId: auth.userId,
        action: 'API_KEY_REVOKE',
        resourceType: 'API_KEY',
        resourceId: id,
        result: 'success',
      },
    });

    logger.info('API key revoked', {
      keyId: id,
      tenantId: auth.tenantId,
      userId: auth.userId,
    });

    return successResponse({ message: 'API 키가 폐기되었습니다.' });
  } catch (error) {
    logger.error('API key delete error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return serverErrorResponse();
  }
}
