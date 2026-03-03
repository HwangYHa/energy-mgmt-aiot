/**
 * /api/activity-log - 사용자 활동 이력 조회 API
 *
 * GET: 활동 이력 목록 조회 (필터 + 페이지네이션)
 *   쿼리 파라미터:
 *   - menuCode    : 메뉴 코드 필터 (예: SITE_MGMT, CARBON_FUEL)
 *   - actionType  : 액션 타입 필터 (예: CREATE, DELETE)
 *   - userId      : 사용자 ID 필터
 *   - status      : 처리 결과 필터 (success | failed)
 *   - start       : 시작 날짜 (ISO 8601)
 *   - end         : 종료 날짜 (ISO 8601)
 *   - search      : resourceName / actionLabel 검색
 *   - page        : 페이지 번호 (기본값: 1)
 *   - pageSize    : 페이지 크기 (기본값: 50, 최대: 200)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/api/response';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { tenantId } = auth;
    const { searchParams } = new URL(request.url);

    const menuCode   = searchParams.get('menuCode');
    const actionType = searchParams.get('actionType');
    const userId     = searchParams.get('userId');
    const status     = searchParams.get('status');
    const start      = searchParams.get('start');
    const end        = searchParams.get('end');
    const search     = searchParams.get('search');
    const page       = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize   = Math.min(parseInt(searchParams.get('pageSize') || '50', 10), 200);
    const skip       = (page - 1) * pageSize;

    // 날짜 범위
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    if (start) {
      startDate = new Date(start);
      if (isNaN(startDate.getTime())) startDate = undefined;
    }
    if (end) {
      endDate = new Date(end + 'T23:59:59');
      if (isNaN(endDate.getTime())) endDate = undefined;
    }

    // WHERE 조건
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      tenantId,
      ...(menuCode   ? { menuCode }   : {}),
      ...(actionType ? { actionType } : {}),
      ...(userId     ? { userId }     : {}),
      ...(status     ? { status }     : {}),
      ...(startDate || endDate ? {
        createdAt: {
          ...(startDate ? { gte: startDate } : {}),
          ...(endDate   ? { lte: endDate }   : {}),
        },
      } : {}),
      // logNo 채번으로도 검색 가능 (예: ST-20260301-0001)
      // NOTE: Prisma 클라이언트 재생성 전까지 any 타입 사용 (npx prisma generate 필요)
      ...(search ? {
        OR: [
          { logNo: { contains: search } },
          { actionLabel: { contains: search } },
          { resourceName: { contains: search } },
          { userEmail: { contains: search } },
          { userName: { contains: search } },
        ],
      } : {}),
    };

    // 병렬 조회
    // NOTE: select에 logNo 포함 — Prisma 클라이언트 재생성 전까지 any 타입 사용
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selectFields: any = {
      id: true,
      logNo: true,
      menuCode: true,
      actionType: true,
      actionLabel: true,
      resourceType: true,
      resourceId: true,
      resourceName: true,
      afterData: true,
      beforeData: true,
      metadata: true,
      status: true,
      errorMessage: true,
      userId: true,
      userName: true,
      userEmail: true,
      userRole: true,
      ipAddress: true,
      createdAt: true,
    };

    const [total, logs] = await Promise.all([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: selectFields,
      }),
    ]);

    return successResponse(logs, {
      pagination: {
        skip,
        take: pageSize,
        total,
        hasMore: skip + logs.length < total,
      },
    });
  } catch (error) {
    console.error('[/api/activity-log] GET error:', error);
    return serverErrorResponse({ message: '활동 이력을 조회할 수 없습니다.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 통계 집계용 엔드포인트 (같은 route의 POST)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/activity-log/stats
 * 별도 route 없이 POST body로 집계 요청
 * body: { groupBy: 'menuCode' | 'actionType' | 'user', start?, end? }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { tenantId } = auth;
    const body = await request.json() as {
      groupBy?: 'menuCode' | 'actionType' | 'user';
      start?: string;
      end?: string;
    };

    const startDate = body.start ? new Date(body.start) : undefined;
    const endDate   = body.end   ? new Date(body.end + 'T23:59:59') : undefined;

    const dateFilter: Prisma.ActivityLogWhereInput = startDate || endDate ? {
      createdAt: {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate   ? { lte: endDate }   : {}),
      },
    } : {};

    const groupBy = body.groupBy ?? 'menuCode';

    // 그룹별 집계
    let stats: Record<string, unknown>[] = [];

    if (groupBy === 'menuCode') {
      const rows = await prisma.activityLog.groupBy({
        by: ['menuCode', 'status'],
        where: { tenantId, ...dateFilter },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      });
      // 집계 결과를 menuCode별로 합산
      const map = new Map<string, { menuCode: string; total: number; success: number; failed: number }>();
      for (const r of rows) {
        const existing = map.get(r.menuCode) ?? { menuCode: r.menuCode, total: 0, success: 0, failed: 0 };
        existing.total += r._count.id;
        if (r.status === 'success') existing.success += r._count.id;
        if (r.status === 'failed')  existing.failed  += r._count.id;
        map.set(r.menuCode, existing);
      }
      stats = Array.from(map.values()).sort((a, b) => b.total - a.total);

    } else if (groupBy === 'actionType') {
      const rows = await prisma.activityLog.groupBy({
        by: ['actionType', 'status'],
        where: { tenantId, ...dateFilter },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      });
      const map = new Map<string, { actionType: string; total: number; success: number; failed: number }>();
      for (const r of rows) {
        const existing = map.get(r.actionType) ?? { actionType: r.actionType, total: 0, success: 0, failed: 0 };
        existing.total += r._count.id;
        if (r.status === 'success') existing.success += r._count.id;
        if (r.status === 'failed')  existing.failed  += r._count.id;
        map.set(r.actionType, existing);
      }
      stats = Array.from(map.values()).sort((a, b) => b.total - a.total);

    } else if (groupBy === 'user') {
      const rows = await prisma.activityLog.groupBy({
        by: ['userId', 'userEmail', 'userName'],
        where: { tenantId, ...dateFilter },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      });
      stats = rows.map((r) => ({
        userId:    r.userId,
        userEmail: r.userEmail,
        userName:  r.userName,
        total:     r._count.id,
      }));
    }

    return successResponse(stats);
  } catch (error) {
    console.error('[/api/activity-log] POST error:', error);
    return serverErrorResponse({ message: '활동 통계를 집계할 수 없습니다.' });
  }
}
