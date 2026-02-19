/**
 * /api/api-keys - API 키 관리
 *
 * 보안:
 * ✅ 인증 필수
 * ✅ 테넌트 검증
 */

import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/api/response';
import { randomBytes, createHash } from 'crypto';
import logger from '@/lib/logger';

// API 키 생성: ea_live_ + 32자 랜덤
function generateApiKey(): string {
  const random = randomBytes(24).toString('base64url');
  return `ea_live_${random}`;
}

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

// GET /api/api-keys - 내 API 키 목록 조회
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const keys = await prisma.apiKey.findMany({
      where: {
        tenantId: auth.tenantId,
        userId: auth.userId,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(keys);
  } catch (error) {
    logger.error('API keys fetch error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return serverErrorResponse();
  }
}

// POST /api/api-keys - 새 API 키 생성
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const body = await request.json();
    const { name, scopes, expiresInDays } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return validationErrorResponse({ name: 'API 키 이름을 입력해주세요.' });
    }

    if (name.length > 200) {
      return validationErrorResponse({ name: 'API 키 이름은 200자 이내로 입력해주세요.' });
    }

    // 기존 키 개수 제한 (최대 10개)
    const existingCount = await prisma.apiKey.count({
      where: {
        tenantId: auth.tenantId,
        userId: auth.userId,
        isActive: true,
      },
    });

    if (existingCount >= 10) {
      return validationErrorResponse({ limit: 'API 키는 최대 10개까지 생성할 수 있습니다.' });
    }

    // 키 생성
    const rawKey = generateApiKey();
    const keyHash = hashApiKey(rawKey);
    const keyPrefix = rawKey.substring(0, 16) + '...';

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const apiKey = await prisma.apiKey.create({
      data: {
        tenantId: auth.tenantId,
        userId: auth.userId,
        name: name.trim(),
        keyHash,
        keyPrefix,
        scopes: scopes || ['read:sites', 'read:devices'],
        expiresAt,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    // 감사 로그
    await prisma.auditLog.create({
      data: {
        tenantId: auth.tenantId,
        userId: auth.userId,
        action: 'API_KEY_CREATE',
        resourceType: 'API_KEY',
        resourceId: apiKey.id,
        result: 'success',
      },
    });

    logger.info('API key created', {
      keyId: apiKey.id,
      tenantId: auth.tenantId,
      userId: auth.userId,
    });

    // 원본 키는 생성 시에만 반환 (이후 조회 불가)
    return successResponse({
      ...apiKey,
      apiKey: rawKey,
      message: 'API 키가 생성되었습니다. 이 키는 다시 표시되지 않으므로 안전한 곳에 저장하세요.',
    }, { status: 201 });
  } catch (error) {
    logger.error('API key create error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return serverErrorResponse();
  }
}
