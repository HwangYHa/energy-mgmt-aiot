/**
 * GET /api/super-admin/dashboard
 *
 * Super Admin 리텐션 대시보드 종합 KPI
 *
 * 반환 구조:
 *   platform     - 플랫폼 전체 지표
 *   churn        - 이탈 위험 분포
 *   onboarding   - 온보딩 현황
 *   revenue      - 수익 지표 (MRR, ARR)
 *   retention    - 최근 리텐션 액션 이력
 *   topRisk      - 이탈 위험 TOP 테넌트
 *   activityTrend- 30일 이벤트 트렌드
 */

import { NextRequest } from 'next/server';
import { verifyAuth, isSuperAdmin } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
} from '@/lib/api/response';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!isSuperAdmin(auth)) return forbiddenResponse();

    const now      = new Date();
    const ago30d   = new Date(now.getTime() - 30 * 86400_000);
    const today    = now.toISOString().slice(0, 10);

    // ── 플랫폼 전체 지표 ─────────────────────────────────────
    const [
      totalTenants,
      activeTenants,
      totalUsers,
      totalDevices,
    ] = await Promise.all([
      prisma.tenant.count({ where: { deletedAt: null } }),
      prisma.tenant.count({ where: { deletedAt: null, status: 'active' } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.device.count({ where: { deletedAt: null } }),
    ]);

    const measurementsToday = await prisma.measurement.count({
      where: { time: { gte: new Date(today) } },
    }).catch(() => 0);

    // ── 이탈 위험 분포 ───────────────────────────────────────
    const churnModel = (prisma as any).tenantChurnScore;
    let churnDist = { normal: 0, warning: 0, critical: 0 };
    let avgChurnScore = 0;

    if (churnModel) {
      const latestScores = await churnModel.findMany({
        where: { period: today },
        select: { riskLevel: true, churnScore: true },
      }).catch(() => []);

      for (const s of latestScores) {
        if (s.riskLevel === 'critical') churnDist.critical++;
        else if (s.riskLevel === 'warning') churnDist.warning++;
        else churnDist.normal++;
      }
      if (latestScores.length > 0) {
        avgChurnScore = Math.round(
          latestScores.reduce((sum: number, s: any) => sum + s.churnScore, 0) / latestScores.length,
        );
      }
    }

    // ── 이탈 위험 TOP 10 테넌트 ─────────────────────────────
    let topRisk: Array<{
      tenantId: string;
      tenantName: string;
      churnScore: number;
      riskLevel: string;
      reasons: string[];
      onboardingPct: number;
    }> = [];

    if (churnModel) {
      const riskRows = await churnModel.findMany({
        where: {
          period:    today,
          riskLevel: { in: ['critical', 'warning'] },
        },
        orderBy: { churnScore: 'desc' },
        take: 10,
        select: {
          tenantId:     true,
          churnScore:   true,
          riskLevel:    true,
          scoreReasons: true,
        },
      }).catch(() => []);

      if (riskRows.length > 0) {
        const tenantIds = riskRows.map((r: any) => r.tenantId);
        const tenants   = await prisma.tenant.findMany({
          where: { id: { in: tenantIds } },
          select: { id: true, name: true },
        });
        const tenantMap = new Map(tenants.map((t) => [t.id, t.name]));

        const milestoneModel = (prisma as any).onboardingMilestone;
        const milestones = milestoneModel ? await milestoneModel.findMany({
          where: { tenantId: { in: tenantIds } },
          select: { tenantId: true, completionPct: true },
        }).catch(() => []) : [];
        const milestoneMap = new Map(milestones.map((m: any) => [m.tenantId, m.completionPct]));

        topRisk = riskRows.map((r: any) => ({
          tenantId:      r.tenantId,
          tenantName:    tenantMap.get(r.tenantId) ?? r.tenantId,
          churnScore:    r.churnScore,
          riskLevel:     r.riskLevel,
          reasons:       ((r.scoreReasons as any)?.reasons ?? []) as string[],
          onboardingPct: milestoneMap.get(r.tenantId) ?? 0,
        }));
      }
    }

    // ── 온보딩 현황 ─────────────────────────────────────────
    let onboarding = {
      totalTenants:       activeTenants,
      withIoT:            0,
      withFirstData:      0,
      withAiRun:          0,
      withReport:         0,
      avgCompletionPct:   0,
      avgTtfvSeconds:     0,
    };

    const milestoneModel = (prisma as any).onboardingMilestone;
    if (milestoneModel) {
      const milestones = await milestoneModel.findMany({
        select: {
          iotConnectedAt:    true,
          firstDataAt:       true,
          firstAiAnalysisAt: true,
          firstReportAt:     true,
          completionPct:     true,
          ttfvSeconds:       true,
        },
      }).catch(() => []);

      const ttfvList = milestones.filter((m: any) => m.ttfvSeconds != null).map((m: any) => m.ttfvSeconds);
      onboarding = {
        totalTenants:     activeTenants,
        withIoT:          milestones.filter((m: any) => m.iotConnectedAt).length,
        withFirstData:    milestones.filter((m: any) => m.firstDataAt).length,
        withAiRun:        milestones.filter((m: any) => m.firstAiAnalysisAt).length,
        withReport:       milestones.filter((m: any) => m.firstReportAt).length,
        avgCompletionPct: milestones.length > 0
          ? Math.round(milestones.reduce((s: number, m: any) => s + (m.completionPct ?? 0), 0) / milestones.length)
          : 0,
        avgTtfvSeconds: ttfvList.length > 0
          ? Math.round(ttfvList.reduce((s: number, v: number) => s + v, 0) / ttfvList.length)
          : 0,
      };
    }

    // ── 수익 지표 ───────────────────────────────────────────
    const activeSubs = await prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      select: { plan: { select: { monthlyPrice: true } } },
    }).catch(() => []);
    const mrr = activeSubs.reduce((sum, s) => sum + Number(s.plan.monthlyPrice), 0);

    // 30일간 신규 테넌트 수
    const newTenants30d = await prisma.tenant.count({
      where: { createdAt: { gte: ago30d }, deletedAt: null },
    });

    // 구독 만료 예정 (14일 내)
    const expiringSoon = await prisma.subscription.count({
      where: {
        status:  'ACTIVE',
        endDate: { lte: new Date(now.getTime() + 14 * 86400_000) },
      },
    }).catch(() => 0);

    // ── 최근 리텐션 액션 이력 ────────────────────────────────
    let recentActions: Array<{
      id: string;
      tenantId: string;
      tenantName: string;
      trigger: string;
      channel: string;
      status: string;
      churnScore: number;
      sentAt: string;
    }> = [];

    const actionModel = (prisma as any).retentionAction;
    if (actionModel) {
      const actions = await actionModel.findMany({
        where:   { sentAt: { gte: ago30d } },
        orderBy: { sentAt: 'desc' },
        take:    20,
        select: {
          id: true, tenantId: true, trigger: true,
          channel: true, status: true, churnScore: true, sentAt: true,
        },
      }).catch(() => []);

      if (actions.length > 0) {
        const tIdsSet: Set<string> = new Set(actions.map((a: any) => a.tenantId as string));
        const tIds: string[] = Array.from(tIdsSet);
        const tenants = await prisma.tenant.findMany({
          where: { id: { in: tIds } },
          select: { id: true, name: true },
        });
        const tMap = new Map(tenants.map((t) => [t.id, t.name]));
        recentActions = actions.map((a: any) => ({
          ...a,
          tenantName: tMap.get(a.tenantId) ?? a.tenantId,
          sentAt: new Date(a.sentAt).toISOString(),
        }));
      }
    }

    // ── 30일 이벤트 트렌드 ──────────────────────────────────
    let activityTrend: Array<{ date: string; logins: number; events: number }> = [];
    const eventModel = (prisma as any).retentionEvent;
    if (eventModel) {
      // 최근 30일 일별 집계
      const events = await eventModel.findMany({
        where:  { occurredAt: { gte: ago30d } },
        select: { eventType: true, occurredAt: true },
      }).catch(() => []);

      const dayMap: Record<string, { logins: number; events: number }> = {};
      for (const e of events) {
        const day = new Date(e.occurredAt).toISOString().slice(0, 10);
        if (!dayMap[day]) dayMap[day] = { logins: 0, events: 0 };
        if (e.eventType === 'login') dayMap[day].logins++;
        dayMap[day].events++;
      }
      activityTrend = Object.entries(dayMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date, ...v }));
    }

    return successResponse({
      platform: {
        totalTenants,
        activeTenants,
        totalUsers,
        totalDevices,
        measurementsToday,
        newTenants30d,
        expiringSoon,
        mrr,
        arr: mrr * 12,
      },
      churn: {
        distribution: churnDist,
        avgScore:      avgChurnScore,
        riskCount:     churnDist.critical + churnDist.warning,
      },
      onboarding,
      topRisk,
      recentActions,
      activityTrend,
    });
  } catch (error) {
    console.error('[SuperAdmin/Dashboard]', error);
    return serverErrorResponse();
  }
}
