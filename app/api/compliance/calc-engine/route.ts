/**
 * /api/compliance/calc-engine - 계산 엔진 버전 관리 API
 *
 * GET: 계산 엔진 버전 목록 (viewer 이상)
 */

import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/api/response';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const versions = await prisma.calcEngineVersion.findMany({
      orderBy: { releasedAt: 'desc' },
    });

    return successResponse(versions);
  } catch (error) {
    console.error('[API] 계산 엔진 버전 조회 오류:', error);
    return serverErrorResponse();
  }
}
