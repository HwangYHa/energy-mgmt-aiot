/**
 * /api/admin/traffic
 *
 * 트래픽 통계 및 Rate Limit 관리
 *
 * GET  ?period=24h|7d|30d&tenantId=  → 트래픽 통계 (AuditLog 집계)
 * PUT  (super_admin)                 → 테넌트별 Rate Limit 수정
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
  serverErrorResponse,
  formatZodErrors,
} from '@/lib/api/response';
import { UserRole } from '@/lib/constants/roles';

export const dynamic = 'force-dynamic';

// 기간별 lookback
const PERIOD_MAP: Record<string, number> = {
  '1h':  1 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d':  7  * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

// ──────────────────────────────────────────────────────────────
// GET — 트래픽 통계
// ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'tenant_admin' as UserRole)) {
      return forbiddenResponse();
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') ?? '24h';
    const targetTenantId = searchParams.get('tenantId');

    const periodMs = PERIOD_MAP[period] ?? PERIOD_MAP['24h']!;
    const since = new Date(Date.now() - periodMs);

    // super_admin은 전체 / tenant_admin은 자기 테넌트만
    const isSuperAdmin = requireRoleOrHigher(auth, 'super_admin' as UserRole);
    const tenantFilter = isSuperAdmin
      ? (targetTenantId ? { tenantId: targetTenantId } : {})
      : { tenantId: auth.tenantId };

    // 1. 전체 요청 수 + 결과별 집계
    const [totalRequests, resultBreakdown] = await Promise.all([
      prisma.auditLog.count({
        where: { ...tenantFilter, createdAt: { gte: since } },
      }),
      prisma.auditLog.groupBy({
        by: ['result'],
        where: { ...tenantFilter, createdAt: { gte: since } },
        _count: { id: true },
      }),
    ]);

    const successCount = resultBreakdown.find(r => r.result === 'success')?._count.id ?? 0;
    const failureCount = resultBreakdown.find(r => r.result === 'failure')?._count.id ?? 0;
    const partialCount = resultBreakdown.find(r => r.result === 'partial')?._count.id ?? 0;
    const noResultCount = totalRequests - successCount - failureCount - partialCount;

    // 2. Top 10 액션(엔드포인트)
    const topActions = await prisma.auditLog.groupBy({
      by: ['action'],
      where: { ...tenantFilter, createdAt: { gte: since } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // 3. 시간대별 요청 분포 (기간에 따라 단위 결정)
    const bucketHours = period === '30d' ? 24 : period === '7d' ? 6 : period === '24h' ? 1 : 1;
    const bucketMs = bucketHours * 60 * 60 * 1000;
    const buckets: { time: string; count: number; errors: number }[] = [];
    const now = Date.now();
    const bucketCount = Math.floor((periodMs as number) / bucketMs);

    // DB raw 집계를 위해 직접 쿼리 (MySQL DATE_FORMAT 사용)
    type RawBucket = { bucket: string; total: bigint; errors: bigint };
    const bucketFormat = bucketHours >= 24 ? '%Y-%m-%d' : '%Y-%m-%d %H:00';

    const rawBuckets = await prisma.$queryRaw<RawBucket[]>(
      Prisma.sql`
        SELECT
          DATE_FORMAT(created_at, ${bucketFormat}) AS bucket,
          COUNT(*) AS total,
          SUM(CASE WHEN result = 'failure' THEN 1 ELSE 0 END) AS errors
        FROM audit_log
        WHERE created_at >= ${since}
          ${isSuperAdmin && !targetTenantId
            ? Prisma.empty
            : Prisma.sql`AND tenant_id = ${isSuperAdmin ? targetTenantId : auth.tenantId}`}
        GROUP BY bucket
        ORDER BY bucket ASC
        LIMIT 200
      `
    );

    const bucketMap = new Map(rawBuckets.map(b => [b.bucket, b]));
    for (let i = bucketCount - 1; i >= 0; i--) {
      const t = new Date(now - i * bucketMs);
      const key = bucketHours >= 24
        ? t.toISOString().split('T')[0]!
        : `${t.toISOString().split('T')[0]!} ${String(t.getUTCHours()).padStart(2, '0')}:00`;
      const b = bucketMap.get(key);
      buckets.push({
        time: key,
        count: b ? Number(b.total) : 0,
        errors: b ? Number(b.errors) : 0,
      });
    }

    // 4. 테넌트별 사용량 (super_admin only)
    let tenantBreakdown: { tenantId: string; tenantName: string; count: number }[] = [];
    if (isSuperAdmin && !targetTenantId) {
      const tenantStats = await prisma.auditLog.groupBy({
        by: ['tenantId'],
        where: { tenantId: { not: null }, createdAt: { gte: since } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 20,
      });

      const tenantIds = tenantStats
        .map(t => t.tenantId)
        .filter((id): id is string => id !== null);

      const tenants = tenantIds.length > 0
        ? await prisma.tenant.findMany({
            where: { id: { in: tenantIds } },
            select: { id: true, name: true },
          })
        : [];

      // 구독 플랜에서 Rate Limit 조회
      const activeSubs = tenantIds.length > 0
        ? await prisma.subscription.findMany({
            where: { tenantId: { in: tenantIds }, status: 'ACTIVE' as never },
            select: { tenantId: true, plan: { select: { apiRateLimit: true } } },
            orderBy: { startDate: 'desc' },
          })
        : [];
      const subMap = new Map(activeSubs.map(s => [s.tenantId, s.plan?.apiRateLimit ?? 1000]));

      const tenantMap = new Map(tenants.map(t => [t.id, t]));
      tenantBreakdown = tenantStats.map(ts => ({
        tenantId: ts.tenantId ?? '',
        tenantName: tenantMap.get(ts.tenantId ?? '')?.name ?? '(알 수 없음)',
        apiRateLimit: subMap.get(ts.tenantId ?? '') ?? 1000,
        count: ts._count.id,
      }));
    }

    // 5. 현재 테넌트 Rate Limit 정보
    const targetId = isSuperAdmin && targetTenantId ? targetTenantId : auth.tenantId;
    const [tenantInfo, tenantActiveSub] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: targetId },
        select: { id: true, name: true },
      }),
      prisma.subscription.findFirst({
        where: { tenantId: targetId, status: 'ACTIVE' as never },
        orderBy: { startDate: 'desc' },
        select: { plan: { select: { name: true, tier: true, apiRateLimit: true } } },
      }),
    ]);

    // 6. 최근 에러 로그 (최신 10건)
    const recentErrors = await prisma.auditLog.findMany({
      where: {
        ...tenantFilter,
        result: 'failure',
        createdAt: { gte: since },
      },
      select: {
        id: true,
        action: true,
        resourceType: true,
        errorMessage: true,
        ipAddress: true,
        createdAt: true,
        user: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return successResponse({
      summary: {
        period,
        since: since.toISOString(),
        total: totalRequests,
        success: successCount,
        failure: failureCount,
        partial: partialCount,
        unknown: noResultCount,
        errorRate: totalRequests > 0 ? Math.round((failureCount / totalRequests) * 1000) / 10 : 0,
      },
      timeSeries: buckets,
      topActions: topActions.map(a => ({ action: a.action, count: a._count.id })),
      tenantBreakdown,
      rateLimitInfo: tenantInfo
        ? {
            tenantId: tenantInfo.id,
            tenantName: tenantInfo.name,
            apiRateLimit: tenantActiveSub?.plan?.apiRateLimit ?? 1000,
            plan: tenantActiveSub?.plan?.tier ?? 'free',
          }
        : null,
      recentErrors,
    });
  } catch (error) {
    console.error('[API] 트래픽 통계 오류:', error);
    return serverErrorResponse();
  }
}

// ──────────────────────────────────────────────────────────────
// PUT — Rate Limit 수정 (super_admin만)
// ──────────────────────────────────────────────────────────────

const rateLimitSchema = z.object({
  tenantId: z.string().min(1),
  apiRateLimit: z.number().int().min(10).max(100000),
});

export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'super_admin' as UserRole)) {
      return forbiddenResponse();
    }

    const body = await request.json();
    const parsed = rateLimitSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse({ fields: formatZodErrors(parsed.error) });
    }

    // 테넌트의 활성 구독 플랜을 찾아 Rate Limit 업데이트
    const tenant = await prisma.tenant.findUnique({
      where: { id: parsed.data.tenantId },
      select: { id: true, name: true },
    });
    if (!tenant) return errorResponse('RESOURCE_NOT_FOUND');

    const activeSub = await prisma.subscription.findFirst({
      where: { tenantId: parsed.data.tenantId, status: 'ACTIVE' as never },
      orderBy: { startDate: 'desc' },
      select: { id: true, planId: true },
    });
    if (!activeSub?.planId) {
      return errorResponse('RESOURCE_NOT_FOUND');
    }

    const updatedPlan = await prisma.plan.update({
      where: { id: activeSub.planId },
      data: { apiRateLimit: parsed.data.apiRateLimit },
      select: { id: true, name: true, tier: true, apiRateLimit: true },
    });

    return successResponse({ tenant: { id: tenant.id, name: tenant.name }, plan: updatedPlan });
  } catch (error) {
    console.error('[API] Rate Limit 수정 오류:', error);
    return serverErrorResponse();
  }
}
