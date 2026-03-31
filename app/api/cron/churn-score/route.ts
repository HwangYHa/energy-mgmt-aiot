/**
 * GET /api/cron/churn-score
 *
 * 이탈 예측 점수 일별 배치 계산 크론 잡
 *
 * 처리 흐름:
 *   1. 활성 테넌트 전체 이탈 점수 계산 (배치)
 *   2. critical 등급 테넌트 → 카카오 알림톡 자동 발송
 *   3. ROI KPI 스냅샷 갱신 (선택, ?updateKpi=true)
 *
 * 보안: Authorization: Bearer ${CRON_SECRET} 헤더 필수
 *
 * Vercel Cron 설정 (vercel.json):
 *   { "crons": [{ "path": "/api/cron/churn-score", "schedule": "0 2 * * *" }] }
 *
 * 권장 실행 시간: 매일 새벽 2시 (트래픽 최저 시간대)
 */

import { NextRequest, NextResponse } from 'next/server';
import { runBatchScoring } from '@/lib/services/churn-score.service';
import { runRetentionPipeline } from '@/lib/services/kakao-alimtalk.service';
import { prisma } from '@/lib/db/prisma';

export const maxDuration = 300; // 5분 (Vercel Pro 기준)

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${secret}`) return true;

  const ip = request.headers.get('x-forwarded-for') ?? '';
  return ip.startsWith('127.') || ip === '::1';
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const updateKpi = searchParams.get('updateKpi') === 'true';

  const startTime = Date.now();
  console.info('[ChurnCron] 배치 시작');

  try {
    // ── 1. 이탈 점수 일괄 계산 ────────────────────────────────
    const { processed, critical, warning } = await runBatchScoring();
    console.info(`[ChurnCron] 완료: total=${processed}, critical=${critical}, warning=${warning}`);

    // ── 2. critical 테넌트 자동 리텐션 액션 ──────────────────
    const churnModel = (prisma as any).tenantChurnScore;
    if (churnModel && critical > 0) {
      const today  = new Date().toISOString().slice(0, 10);
      const criticals = await churnModel.findMany({
        where:  { period: today, riskLevel: 'critical', actionTaken: false },
        select: { tenantId: true, churnScore: true },
        take:   20, // 하루 최대 20개 테넌트 처리
      }).catch(() => []);

      for (const row of criticals) {
        try {
          await runRetentionPipeline(row.tenantId, row.churnScore, 'critical');
          // 액션 완료 플래그 갱신
          await churnModel.update({
            where: { tenantId_period: { tenantId: row.tenantId, period: today } },
            data:  { actionTaken: true, actionTakenAt: new Date() },
          }).catch(() => {});
        } catch (e) {
          console.error(`[ChurnCron] retention 실패 (${row.tenantId}):`, e);
        }
      }
    }

    // ── 3. ROI KPI 스냅샷 갱신 (선택) ─────────────────────────
    if (updateKpi) {
      const { upsertKpiSnapshot } = await import('@/lib/services/roi-calculator.service');
      const tenants = await prisma.tenant.findMany({
        where:  { deletedAt: null, status: 'active' },
        select: { id: true },
      });
      const period = new Date().toISOString().slice(0, 7); // YYYY-MM
      let kpiUpdated = 0;
      for (const { id } of tenants) {
        await upsertKpiSnapshot(id, period).catch(() => {});
        kpiUpdated++;
      }
      console.info(`[ChurnCron] KPI 스냅샷 갱신: ${kpiUpdated}개`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    return NextResponse.json({
      success: true,
      elapsed: `${elapsed}s`,
      processed,
      critical,
      warning,
      kpiUpdated: updateKpi,
    });
  } catch (error: any) {
    console.error('[ChurnCron] 오류:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
