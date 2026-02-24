/**
 * GET /api/admin/tenants/{tenantId}/export
 *
 * 테넌트 전체 데이터 JSON 내보내기 (GDPR / 계약 해지 시 데이터 반환)
 *
 * 쿼리 파라미터:
 *   scope: 'all' | 'user_data' | 'measurements' (기본: 'user_data')
 *
 * 권한:
 *   - super_admin: 모든 테넌트 내보내기 가능
 *   - tenant_admin: 자신의 테넌트만 가능
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { hasMinRole } from '@/lib/auth/permissions';
import { generateDownloadFilename } from '@/lib/utils/filename';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });
  }

  const { tenantId } = await params;
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get('scope') ?? 'user_data';

  // 권한 체크: super_admin이거나 자신의 테넌트 tenant_admin
  const isSuperAdmin = auth.role === 'super_admin';
  const isSelfTenantAdmin = auth.tenantId === tenantId && hasMinRole(auth.role, 'tenant_admin');

  if (!isSuperAdmin && !isSelfTenantAdmin) {
    return NextResponse.json({ success: false, error: '권한 없음' }, { status: 403 });
  }

  // 테넌트 정보
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, industryType: true, createdAt: true },
  });
  if (!tenant) {
    return NextResponse.json({ success: false, error: '테넌트 없음' }, { status: 404 });
  }

  // 감사 로그
  await prisma.auditLog.create({
    data: {
      tenantId: auth.tenantId,
      userId: auth.userId,
      action: 'TENANT_DATA_EXPORT',
      resourceType: 'tenant',
      resourceId: tenantId,
      changes: { scope, requestedBy: auth.userId },
    },
  }).catch(() => null);

  // ── 데이터 수집 ─────────────────────────────────────────
  const exportData: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    exportScope: scope,
    tenant: {
      id: tenant.id,
      name: tenant.name,
      industryType: tenant.industryType,
      createdAt: tenant.createdAt,
    },
  };

  // 항상 포함: 사용자, 사업장, 구독
  const [users, sites, subscriptions] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true, email: true, name: true, role: true,
        isActive: true, createdAt: true, lastLoginAt: true,
      },
    }),
    prisma.site.findMany({
      where: { tenantId },
      select: {
        id: true, name: true, address: true, createdAt: true,
      },
    }),
    prisma.subscription.findMany({
      where: { tenantId },
      select: {
        id: true, status: true, startDate: true, endDate: true,
        billingCycle: true, autoRenew: true, createdAt: true,
        plan: { select: { name: true, tier: true } },
      },
    }),
  ]);

  exportData.users        = users;
  exportData.sites        = sites;
  exportData.subscriptions = subscriptions;

  if (scope === 'all' || scope === 'user_data') {
    // 알림, 보고서, 감사 로그 (최근 1000건)
    const [alertRules, reports, auditLogs] = await Promise.all([
      prisma.alertRule.findMany({ where: { tenantId } }),
      prisma.report.findMany({
        where: { tenantId },
        select: { id: true, type: true, period: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.auditLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      }),
    ]);
    exportData.alertRules = alertRules;
    exportData.reports    = reports;
    exportData.auditLogs  = auditLogs;
  }

  if (scope === 'all' || scope === 'measurements') {
    // 최근 30일 측정 데이터 (용량 제한)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const measurements = await prisma.measurement.findMany({
      where: { tenantId, time: { gte: thirtyDaysAgo } },
      select: { metricId: true, time: true, value: true },
      orderBy: { time: 'desc' },
      take: 50000,
    });
    exportData.measurements = measurements;
    exportData.measurementNote = '최근 30일 데이터 최대 50,000건만 포함됩니다.';
  }

  // 파일명 생성
  const filename = generateDownloadFilename(`${tenant.name}_데이터내보내기`, tenantId, 'json');

  return new Response(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
