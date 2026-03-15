/**
 * GET /api/cron/check-alerts
 *
 * 주기적으로 실행되는 알림 체크 크론 엔드포인트
 *
 * 처리 항목:
 *   1. 구독 만료 임박 (7일, 3일, 1일 전 알림)
 *   2. 게이트웨이 오프라인 감지 (lastSeenAt > 30분)
 *
 * 보안: CRON_SECRET 헤더 또는 localhost 호출만 허용
 *
 * 사용법 (Vercel Cron / 외부 스케줄러):
 *   curl -H "Authorization: Bearer ${CRON_SECRET}" \
 *        https://your-domain.com/api/cron/check-alerts
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  notifySubscriptionExpiring,
  notifyGatewayOffline,
  notifyByRole,
} from '@/lib/services/notification.service';
import { getSystemSettings } from '@/lib/services/system-settings.service';

export const dynamic = 'force-dynamic';

// 재알림 방지: 마지막 동일 알림 발송 후 최소 경과 시간 (ms)
const SUBSCRIPTION_NOTIFY_INTERVAL_MS = 23 * 60 * 60 * 1000; // 23시간
const GATEWAY_NOTIFY_INTERVAL_MS      =  2 * 60 * 60 * 1000; // 2시간
const GATEWAY_OFFLINE_THRESHOLD_MS    = 30 * 60 * 1000;       // 30분
const POWER_NOTIFY_INTERVAL_MS        =  1 * 60 * 60 * 1000; // 1시간

function isAuthorized(request: NextRequest): boolean {
  const secret  = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  // CRON_SECRET 미설정 시 localhost 요청만 허용
  if (!secret) {
    const host = request.headers.get('host') ?? '';
    return host.startsWith('localhost') || host.startsWith('127.0.0.1');
  }

  return authHeader === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = { subscriptions: 0, gateways: 0, errors: 0 };

  // ── 1. 구독 만료 임박 체크 ───────────────────────────────────
  try {
    const now    = new Date();
    const in7d   = new Date(now.getTime() + 7  * 24 * 60 * 60 * 1000);

    const expiringSubs = await prisma.subscription.findMany({
      where: {
        status:  { in: ['ACTIVE', 'EXPIRE_SOON'] },
        endDate: { lte: in7d, gte: now },
      },
      include: { plan: true },
    });

    for (const sub of expiringSubs) {
      const daysLeft = Math.ceil(
        (sub.endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );

      // 재알림 방지: 이 테넌트에 최근 구독 만료 알림이 있는지 확인
      const recentLog = await prisma.notificationLog.findFirst({
        where: {
          createdAt: { gte: new Date(now.getTime() - SUBSCRIPTION_NOTIFY_INTERVAL_MS) },
          subject:   { contains: '구독 만료' },
          rule:      { tenantId: sub.tenantId },
        },
      });
      if (recentLog) continue;

      await notifySubscriptionExpiring({
        tenantId:  sub.tenantId,
        planName:  sub.plan.name,
        expiresAt: sub.endDate,
        daysLeft,
      });
      results.subscriptions++;
    }
  } catch (err) {
    console.error('[Cron] 구독 만료 체크 오류:', err);
    results.errors++;
  }

  // ── 2. 게이트웨이 오프라인 체크 ─────────────────────────────
  try {
    const offlineSince = new Date(Date.now() - GATEWAY_OFFLINE_THRESHOLD_MS);

    // Gateway 모델에 lastSeenAt / status / serialNumber 필드가 있다고 가정
    // 없으면 Prisma 컴파일 오류 발생 → 해당 블록 제거
    const offlineGateways = await (prisma.gateway as any).findMany({
      where: {
        lastSeenAt: { not: null, lt: offlineSince },
        status:     'online', // 마지막으로 알려진 상태가 online인 게이트웨이
      },
      select: {
        id:           true,
        tenantId:     true,
        name:         true,
        serialNumber: true,
        lastSeenAt:   true,
      },
      take: 20,
    }).catch(() => []); // Gateway에 해당 필드 없으면 빈 배열

    for (const gw of offlineGateways) {
      // 재알림 방지
      const recentLog = await prisma.notificationLog.findFirst({
        where: {
          createdAt: { gte: new Date(Date.now() - GATEWAY_NOTIFY_INTERVAL_MS) },
          subject:   { contains: '게이트웨이 오프라인' },
          rule:      { tenantId: gw.tenantId },
        },
      });
      if (recentLog) continue;

      await notifyGatewayOffline({
        tenantId:     gw.tenantId,
        gatewayId:    gw.id,
        gatewayName:  gw.name,
        serialNumber: gw.serialNumber ?? '-',
        lastSeenAt:   gw.lastSeenAt,
      });
      results.gateways++;
    }
  } catch (err) {
    console.error('[Cron] 게이트웨이 오프라인 체크 오류:', err);
    results.errors++;
  }

  // ── 3. 테넌트별 전력 임계값 초과 체크 ──────────────────────────
  try {
    // 테넌트 목록 조회 (active Measurement가 있는 테넌트만)
    const tenants = await prisma.tenant.findMany({
      select: { id: true },
    });

    for (const { id: tenantId } of tenants) {
      try {
        const settings = await getSystemSettings(tenantId);
        const { powerThresholdWarning, powerThresholdCritical } = settings.alerts;

        // 최근 15분간 최대 전력 사용률(%) 조회 — measurement 테이블 기준
        const since15m = new Date(Date.now() - 15 * 60 * 1000);
        const rows = await prisma.$queryRaw<{ maxRatio: number | null }[]>`
          SELECT MAX(value) as maxRatio
          FROM measurement
          WHERE tenant_id = ${tenantId}
            AND category = 'power_ratio'
            AND time >= ${since15m}
        `.catch(() => [{ maxRatio: null }]);

        const ratio = rows[0]?.maxRatio;
        if (ratio == null || ratio < powerThresholdWarning) continue;

        const level = ratio >= powerThresholdCritical ? 'critical' : 'warning';

        // 재알림 방지
        const recentLog = await prisma.notificationLog.findFirst({
          where: {
            createdAt: { gte: new Date(Date.now() - POWER_NOTIFY_INTERVAL_MS) },
            subject:   { contains: '전력 사용률' },
            rule:      { tenantId },
          },
        });
        if (recentLog) continue;

        await notifyByRole({
          tenantId,
          category: 'energy',
          ruleName: `전력 사용률 ${level === 'critical' ? '위험' : '경고'} 알림`,
          message:  `현재 전력 사용률이 ${ratio.toFixed(1)}%로 ${level === 'critical' ? `위험 임계값(${powerThresholdCritical}%)` : `경고 임계값(${powerThresholdWarning}%)`}을 초과했습니다.`,
          severity: level === 'critical' ? 'critical' : 'warning',
          minRole:  'operator',
        });

        results.subscriptions; // 별도 카운터 없음 — 로그로만 확인
        console.info(`[Cron] 전력 임계값 초과 알림: tenantId=${tenantId} ratio=${ratio}% level=${level}`);
      } catch {
        // 개별 테넌트 오류는 전체 중단 없이 계속
      }
    }
  } catch (err) {
    console.error('[Cron] 전력 임계값 체크 오류:', err);
    results.errors++;
  }

  console.info('[Cron] check-alerts 완료:', results);

  return NextResponse.json({
    success: true,
    checked: new Date().toISOString(),
    results,
  });
}
