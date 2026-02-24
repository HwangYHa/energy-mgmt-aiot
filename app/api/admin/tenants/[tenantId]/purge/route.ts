/**
 * DELETE /api/admin/tenants/{tenantId}/purge
 *
 * 테넌트 데이터 완전 삭제 (Hard Delete) — Super Admin 전용
 *
 * 처리 순서 (외래키 의존성 역순):
 *   1. Measurement (원시 데이터)
 *   2. EmissionsData, ForecastResult
 *   3. CarbonTrade, CarbonCredit
 *   4. AlertRule, NotificationRule
 *   5. AuditLog, Report, PaymentHistory
 *   6. ApiKey
 *   7. TwinNode, PhysicalSpace
 *   8. Sensor → Metric → Device → Gateway → Site
 *   9. Subscription
 *  10. User
 *  11. Tenant (마지막)
 *
 * ⚠️  되돌릴 수 없습니다. confirm 파라미터 필수.
 * ⚠️  Super Admin만 호출 가능.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { requireSuperAdmin } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });
  }

  // Super Admin 전용
  const permErr = requireSuperAdmin(auth.role);
  if (permErr) return permErr;

  const { tenantId } = await params;

  // confirm 파라미터 필수 (실수 방지)
  const { searchParams } = new URL(request.url);
  if (searchParams.get('confirm') !== 'PURGE') {
    return NextResponse.json(
      {
        success: false,
        error: '?confirm=PURGE 파라미터를 추가해야 실행됩니다.',
      },
      { status: 400 }
    );
  }

  // 테넌트 존재 확인
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, status: true },
  });

  if (!tenant) {
    return NextResponse.json({ success: false, error: '테넌트 없음' }, { status: 404 });
  }

  // 활성 테넌트는 먼저 비활성화 필요
  if (tenant.status === 'active') {
    return NextResponse.json(
      {
        success: false,
        error: '활성 테넌트는 삭제할 수 없습니다. 먼저 suspended 상태로 변경하세요.',
      },
      { status: 409 }
    );
  }

  const stats: Record<string, number> = {};

  try {
    // 삭제 전 감사 로그 기록
    await prisma.auditLog.create({
      data: {
        tenantId: auth.tenantId,  // 요청자 테넌트 (Super Admin)
        userId: auth.userId,
        action: 'TENANT_PURGE_INITIATED',
        resourceType: 'tenant',
        resourceId: tenantId,
        changes: {
          targetTenantId: tenantId,
          targetTenantName: tenant.name,
          initiatedBy: auth.userId,
          initiatedAt: new Date().toISOString(),
        },
      },
    });

    // ── 1. 원시 측정 데이터 ────────────────────────────
    const measurements = await prisma.measurement.deleteMany({ where: { tenantId } });
    stats.measurements = measurements.count;

    // ── 2. 분석 데이터 ────────────────────────────────
    const [forecasts, emissions] = await Promise.all([
      prisma.forecastResult.deleteMany({ where: { tenantId } }),
      prisma.emissionsData.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 })),
    ]);
    stats.forecastResults = forecasts.count;
    stats.emissionsData = emissions.count;

    // ── 3. 탄소 거래 데이터 ───────────────────────────
    const [trades, credits] = await Promise.all([
      prisma.carbonTrade.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 })),
      prisma.carbonCredit.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 })),
    ]);
    stats.carbonTrades = trades.count;
    stats.carbonCredits = credits.count;

    // ── 4. 알림/규칙 ─────────────────────────────────
    const [alertRules, notifRules] = await Promise.all([
      prisma.alertRule.deleteMany({ where: { tenantId } }),
      prisma.notificationRule.deleteMany({ where: { tenantId } }),
    ]);
    stats.alertRules = alertRules.count;
    stats.notificationRules = notifRules.count;

    // ── 5. 보고서/결제/감사 로그 ──────────────────────
    const [reports, payments, auditLogs] = await Promise.all([
      prisma.report.deleteMany({ where: { tenantId } }),
      prisma.paymentHistory.deleteMany({ where: { tenantId } }),
      prisma.auditLog.deleteMany({ where: { tenantId } }),
    ]);
    stats.reports = reports.count;
    stats.paymentHistories = payments.count;
    stats.auditLogs = auditLogs.count;

    // ── 6. API 키 ─────────────────────────────────────
    const apiKeys = await prisma.apiKey.deleteMany({ where: { tenantId } });
    stats.apiKeys = apiKeys.count;

    // ── 7. 디지털 트윈 ────────────────────────────────
    const [twinNodes, spaces] = await Promise.all([
      prisma.twinNode.deleteMany({ where: { tenantId } }),
      prisma.physicalSpace.deleteMany({ where: { tenantId } }),
    ]);
    stats.twinNodes = twinNodes.count;
    stats.physicalSpaces = spaces.count;

    // ── 8. 센서 → 메트릭 → 장치 → 게이트웨이 → 사업장 ──
    const sensors = await prisma.sensor.deleteMany({ where: { tenantId } });
    stats.sensors = sensors.count;

    const metrics = await prisma.metric.deleteMany({ where: { tenantId } });
    stats.metrics = metrics.count;

    const devices = await prisma.device.deleteMany({ where: { tenantId } });
    stats.devices = devices.count;

    const gateways = await prisma.gateway.deleteMany({ where: { tenantId } });
    stats.gateways = gateways.count;

    const sites = await prisma.site.deleteMany({ where: { tenantId } });
    stats.sites = sites.count;

    // ── 9. 구독 ───────────────────────────────────────
    const subscriptions = await prisma.subscription.deleteMany({ where: { tenantId } });
    stats.subscriptions = subscriptions.count;

    // ── 10. 사용자 ────────────────────────────────────
    const users = await prisma.user.deleteMany({ where: { tenantId } });
    stats.users = users.count;

    // ── 11. 테넌트 본체 ───────────────────────────────
    await prisma.tenant.delete({ where: { id: tenantId } });
    stats.tenant = 1;

    console.log('[PurgeAPI] 테넌트 완전 삭제 완료:', tenantId, stats);

    return NextResponse.json({
      success: true,
      purgedTenantId: tenantId,
      purgedTenantName: tenant.name,
      stats,
      purgedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[PurgeAPI] 삭제 중 오류:', tenantId, error);
    return NextResponse.json(
      {
        success: false,
        error: '데이터 삭제 중 오류가 발생했습니다. 부분 삭제되었을 수 있습니다.',
        stats,
      },
      { status: 500 }
    );
  }
}
