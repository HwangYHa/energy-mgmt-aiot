/**
 * GET /api/cron/subscription-sync
 *
 * 구독 라이프사이클 상태 머신 동기화 (Cron Job)
 *
 * 권장 실행 주기: 매일 00:00 (자정)
 *
 * 처리 내용:
 *   1. ACTIVE 구독 중 endDate가 7일 이내 → EXPIRE_SOON
 *   2. EXPIRE_SOON 구독 중 endDate 경과 → EXPIRED
 *   3. EXPIRED 구독 → Free 플랜 자동 다운그레이드 (trial 플랜)
 *
 * 보안:
 *   CRON_SECRET 헤더 검증 (Vercel Cron, GitHub Actions, 직접 호출 모두 지원)
 *   또는 super_admin 인증 허용
 *
 * 환경변수:
 *   CRON_SECRET — cron 실행 시크릿 (Authorization: Bearer {CRON_SECRET})
 *
 * Vercel Cron 설정 (vercel.json):
 *   { "crons": [{ "path": "/api/cron/subscription-sync", "schedule": "0 0 * * *" }] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { invalidateCacheByPrefix } from '@/lib/cache/redis';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────────────────────
// 인증
// ──────────────────────────────────────────────────────────────

function isCronAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // Vercel Cron 자동 요청 (헤더로 검증)
  if (request.headers.get('x-vercel-cron-signature')) return true;

  // Bearer 시크릿 검증
  const authHeader = request.headers.get('authorization');
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  // 개발 환경 로컬 실행 허용
  if (process.env.NODE_ENV === 'development') return true;

  return false;
}

// ──────────────────────────────────────────────────────────────
// 라이프사이클 처리 함수
// ──────────────────────────────────────────────────────────────

interface SyncResult {
  toExpireSoon:  number;
  toExpired:     number;
  downgraded:    number;
  errors:        string[];
  processedAt:   string;
}

async function runSubscriptionSync(): Promise<SyncResult> {
  const now           = new Date();
  const sevenDaysOut  = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const result: SyncResult = {
    toExpireSoon: 0,
    toExpired:    0,
    downgraded:   0,
    errors:       [],
    processedAt:  now.toISOString(),
  };

  // ── 1. ACTIVE → EXPIRE_SOON (7일 이내 만료 예정) ─────────
  try {
    const expireSoonUpdate = await prisma.subscription.updateMany({
      where: {
        status: 'ACTIVE',
        endDate: { lte: sevenDaysOut, gt: now },
        autoRenew: false, // 자동 갱신 중이면 Stripe가 처리
      },
      data: { status: 'EXPIRE_SOON' },
    });
    result.toExpireSoon = expireSoonUpdate.count;
    if (expireSoonUpdate.count > 0) {
      console.log(`[CronSync] ACTIVE → EXPIRE_SOON: ${expireSoonUpdate.count}건`);
    }
  } catch (e) {
    result.errors.push(`EXPIRE_SOON 전환 오류: ${String(e)}`);
  }

  // ── 2. EXPIRE_SOON → EXPIRED (만료일 경과) ───────────────
  let expiredSubs: { id: string; tenantId: string }[] = [];
  try {
    expiredSubs = await prisma.subscription.findMany({
      where: {
        status: { in: ['EXPIRE_SOON', 'ACTIVE'] },
        endDate: { lt: now },
      },
      select: { id: true, tenantId: true },
    });

    if (expiredSubs.length > 0) {
      await prisma.subscription.updateMany({
        where: { id: { in: expiredSubs.map((s) => s.id) } },
        data: { status: 'EXPIRED' },
      });
      result.toExpired = expiredSubs.length;
      console.log(`[CronSync] EXPIRE_SOON → EXPIRED: ${expiredSubs.length}건`);
    }
  } catch (e) {
    result.errors.push(`EXPIRED 전환 오류: ${String(e)}`);
  }

  // ── 3. EXPIRED 테넌트 → Free(trial) 플랜 다운그레이드 ──
  if (expiredSubs.length > 0) {
    const trialPlan = await prisma.plan.findFirst({
      where: { tier: 'trial', isActive: true },
      select: { id: true },
    });

    if (trialPlan) {
      for (const sub of expiredSubs) {
        try {
          // 해당 테넌트에 trial 구독이 이미 있으면 생략
          const hasTrial = await prisma.subscription.findFirst({
            where: {
              tenantId: sub.tenantId,
              planId: trialPlan.id,
              status: { not: 'TERMINATED' },
            },
          });

          if (!hasTrial) {
            await prisma.subscription.create({
              data: {
                tenantId: sub.tenantId,
                planId:   trialPlan.id,
                status:   'ACTIVE',
                startDate: now,
                endDate:   new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000), // Free 1년
                autoRenew: false,
                billingCycle: 'yearly',
                metadata: { downgraded: true, fromSubscriptionId: sub.id },
              },
            });

            await prisma.auditLog.create({
              data: {
                tenantId: sub.tenantId,
                action: 'SUBSCRIPTION_DOWNGRADED',
                resourceType: 'subscription',
                resourceId: sub.id,
                changes: { reason: 'expired', downgradedTo: 'trial', processedAt: now.toISOString() },
              },
            }).catch(() => null);

            result.downgraded++;
          }

          // 구독 캐시 무효화 (fire-and-forget, void 반환)
          invalidateCacheByPrefix(`sub:${sub.tenantId}`);
        } catch (e) {
          result.errors.push(`다운그레이드 오류 (${sub.tenantId}): ${String(e)}`);
        }
      }
    }
  }

  // ── 4. ACTIVE 구독이 없는 테넌트 중 trial도 없는 테넌트 확인 ──
  // (이미 위 로직에서 처리됨, 추가 정리 불필요)

  return result;
}

// ──────────────────────────────────────────────────────────────
// GET 핸들러
// ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 });
  }

  try {
    console.log('[CronSync] 구독 라이프사이클 동기화 시작');
    const result = await runSubscriptionSync();

    console.log('[CronSync] 완료:', result);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[CronSync] 오류:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
