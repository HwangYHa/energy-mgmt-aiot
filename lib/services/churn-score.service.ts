/**
 * lib/services/churn-score.service.ts
 *
 * 이탈 예측 점수 계산 엔진 (Churn Prediction Engine)
 *
 * ─ 점수 공식 ─────────────────────────────────────────────────
 * ChurnScore(0~100) =
 *   onboarding_score   × 0.20   (온보딩 완성도 역값 — 미완료일수록 위험)
 *   engagement_score   × 0.25   (접속/사용 빈도 역값)
 *   organization_score × 0.15   (조직 확산도 역값)
 *   roi_score          × 0.20   (ROI 체감 역값)
 *   support_score      × 0.10   (CS 부하 — 티켓 多 = 위험)
 *   payment_score      × 0.10   (결제 이상 — 실패/다운그레이드)
 *
 * ─ 위험 등급 ────────────────────────────────────────────────
 *   normal   : 0 ~ 39
 *   warning  : 40 ~ 69
 *   critical : 70 ~ 100
 * ─────────────────────────────────────────────────────────────
 */

import { prisma } from '@/lib/db/prisma';

// ── 타입 ─────────────────────────────────────────────────────

export interface ChurnSignals {
  // 온보딩
  iotConnected:      boolean;
  firstDataReceived: boolean;
  firstAiRun:        boolean;
  firstReportMade:   boolean;
  onboardingDays:    number; // 가입 후 경과일
  // 참여도
  loginCount7d:      number;
  loginCount30d:     number;
  featureUsed7d:     number; // 지난 7일 사용한 기능 수
  daysInactiveLast:  number; // 최근 비활성 일수
  // 조직
  totalUsers:        number;
  activeUsers30d:    number;
  // ROI
  roiPercent:        number | null; // null = 데이터 없음
  savedCostKrwLast:  number;        // 최근 1개월 절감액
  // CS
  openTickets:       number;
  resolvedTickets7d: number;
  avgResolveHours:   number;
  // 결제
  paymentFails30d:   number;
  planDowngraded:    boolean;
  subscriptionActive: boolean;
}

export interface ChurnScoreResult {
  churnScore:       number; // 0~100
  riskLevel:        'normal' | 'warning' | 'critical';
  onboardingScore:  number;
  engagementScore:  number;
  organizationScore:number;
  roiScore:         number;
  supportScore:     number;
  paymentScore:     number;
  reasons:          string[];
  signals:          Partial<ChurnSignals>;
}

// ── 점수 계산 (순수 함수) ─────────────────────────────────────

export function calculateChurnScore(s: ChurnSignals): ChurnScoreResult {
  const reasons: string[] = [];

  // ① 온보딩 점수 (0~100, 높을수록 위험)
  let onboardingRaw = 0;
  const milestones = [s.iotConnected, s.firstDataReceived, s.firstAiRun, s.firstReportMade];
  const incomplete = milestones.filter((m) => !m).length;
  onboardingRaw += incomplete * 20; // 미완료 1개당 +20
  if (!s.iotConnected && s.onboardingDays > 7)  { onboardingRaw += 20; reasons.push('IoT 미연결 (7일 초과)'); }
  if (!s.firstAiRun   && s.onboardingDays > 14) { onboardingRaw += 10; reasons.push('AI 분석 미실행 (14일 초과)'); }
  const onboardingScore = Math.min(100, onboardingRaw);

  // ② 참여도 점수 (0~100, 높을수록 위험)
  let engagementRaw = 0;
  if (s.loginCount7d  === 0)  { engagementRaw += 40; reasons.push('7일간 로그인 없음'); }
  else if (s.loginCount7d < 2){ engagementRaw += 20; reasons.push('7일간 로그인 2회 미만'); }
  if (s.loginCount30d  < 5)   { engagementRaw += 20; reasons.push('30일 로그인 5회 미만'); }
  if (s.featureUsed7d  === 0) { engagementRaw += 20; reasons.push('7일간 기능 미사용'); }
  if (s.daysInactiveLast > 14){ engagementRaw += 20; reasons.push(`${s.daysInactiveLast}일 연속 비활성`); }
  const engagementScore = Math.min(100, engagementRaw);

  // ③ 조직 확산 점수 (0~100)
  let orgRaw = 0;
  if (s.totalUsers <= 1)       { orgRaw += 50; reasons.push('단독 사용자 (미확산)'); }
  else if (s.totalUsers <= 2)  { orgRaw += 25; }
  if (s.totalUsers > 0) {
    const activeRate = s.activeUsers30d / s.totalUsers;
    if (activeRate < 0.3)      { orgRaw += 30; reasons.push(`조직 활성률 ${Math.round(activeRate * 100)}%`); }
    else if (activeRate < 0.6) { orgRaw += 15; }
  }
  const organizationScore = Math.min(100, orgRaw);

  // ④ ROI 점수 (0~100)
  let roiRaw = 0;
  if (s.roiPercent === null)    { roiRaw += 60; reasons.push('ROI 데이터 없음'); }
  else if (s.roiPercent <  0)   { roiRaw += 80; reasons.push(`ROI 마이너스 (${s.roiPercent.toFixed(0)}%)`); }
  else if (s.roiPercent < 10)   { roiRaw += 40; reasons.push(`ROI 낮음 (${s.roiPercent.toFixed(0)}%)`); }
  else if (s.roiPercent < 50)   { roiRaw += 20; }
  if (s.savedCostKrwLast === 0) { roiRaw += 20; reasons.push('절감 실적 없음'); }
  const roiScore = Math.min(100, roiRaw);

  // ⑤ CS 부하 점수 (0~100)
  let supportRaw = 0;
  if (s.openTickets     > 3)   { supportRaw += 40; reasons.push(`미해결 티켓 ${s.openTickets}건`); }
  else if (s.openTickets > 0)  { supportRaw += 20; }
  if (s.avgResolveHours > 48)  { supportRaw += 30; reasons.push(`평균 해결 ${s.avgResolveHours.toFixed(0)}시간`); }
  else if (s.avgResolveHours > 24) { supportRaw += 15; }
  const supportScore = Math.min(100, supportRaw);

  // ⑥ 결제 이상 점수 (0~100)
  let paymentRaw = 0;
  if (!s.subscriptionActive)   { paymentRaw += 80; reasons.push('구독 비활성'); }
  if (s.planDowngraded)        { paymentRaw += 40; reasons.push('플랜 다운그레이드'); }
  if (s.paymentFails30d > 0)   { paymentRaw += s.paymentFails30d * 20; reasons.push(`결제 실패 ${s.paymentFails30d}회`); }
  const paymentScore = Math.min(100, paymentRaw);

  // 최종 가중 합산
  const churnScore = Math.round(
    onboardingScore   * 0.20 +
    engagementScore   * 0.25 +
    organizationScore * 0.15 +
    roiScore          * 0.20 +
    supportScore      * 0.10 +
    paymentScore      * 0.10,
  );

  const riskLevel: 'normal' | 'warning' | 'critical' =
    churnScore >= 70 ? 'critical' :
    churnScore >= 40 ? 'warning'  : 'normal';

  return {
    churnScore,
    riskLevel,
    onboardingScore,
    engagementScore,
    organizationScore,
    roiScore,
    supportScore,
    paymentScore,
    reasons: [...new Set(reasons)], // 중복 제거
    signals: s as Partial<ChurnSignals>,
  };
}

// ── DB에서 시그널 수집 ────────────────────────────────────────

export async function collectSignals(tenantId: string): Promise<ChurnSignals> {
  const now        = new Date();
  const ago7d      = new Date(now.getTime() - 7  * 86400_000);
  const ago30d     = new Date(now.getTime() - 30 * 86400_000);

  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, deletedAt: null },
    select: {
      createdAt: true,
      subscriptions: {
        where: { status: 'ACTIVE' },
        take: 1,
        select: { status: true },
      },
    },
  });

  const onboardingDays = tenant
    ? Math.floor((now.getTime() - tenant.createdAt.getTime()) / 86400_000)
    : 0;

  // 온보딩 마일스톤
  const milestone = await (prisma as any).onboardingMilestone?.findUnique?.({
    where: { tenantId },
  }).catch(() => null) ?? null;

  // 참여도: 로그인 이벤트
  const re = (prisma as any).retentionEvent;
  const [login7d, login30d, features7d, lastLogin] = await Promise.all([
    re ? re.count({ where: { tenantId, eventType: 'login', occurredAt: { gte: ago7d  } } }).catch(() => 0) : 0,
    re ? re.count({ where: { tenantId, eventType: 'login', occurredAt: { gte: ago30d } } }).catch(() => 0) : 0,
    re ? re.findMany({ where: { tenantId, eventType: 'feature_used', occurredAt: { gte: ago7d } }, select: { properties: true }, distinct: ['properties'] }).catch(() => []) : [],
    re ? re.findFirst({ where: { tenantId, eventType: 'login' }, orderBy: { occurredAt: 'desc' }, select: { occurredAt: true } }).catch(() => null) : null,
  ]);

  const daysInactiveLast = lastLogin?.occurredAt
    ? Math.floor((now.getTime() - new Date(lastLogin.occurredAt).getTime()) / 86400_000)
    : onboardingDays;

  // 조직 확산
  const [totalUsers, activeUsers30d] = await Promise.all([
    prisma.user.count({ where: { tenantId, isActive: true } }),
    prisma.user.count({ where: { tenantId, isActive: true, lastLoginAt: { gte: ago30d } } }),
  ]);

  // ROI
  const kpiModel = (prisma as any).kpiSnapshot;
  const kpi = kpiModel ? await kpiModel.findFirst({
    where: { tenantId },
    orderBy: { period: 'desc' },
    select: { roiPercent: true, savedCostKrw: true },
  }).catch(() => null) : null;

  // CS 티켓 — support 테이블
  let openTickets = 0;
  let resolvedTickets7d = 0;
  let avgResolveHours = 0;
  try {
    const tickets = await (prisma as any).supportInquiry?.findMany?.({
      where: { tenantId },
      select: { status: true, createdAt: true, updatedAt: true },
    }) ?? [];
    openTickets    = tickets.filter((t: any) => t.status === 'open' || t.status === 'in_progress').length;
    const resolved = tickets.filter((t: any) => t.status === 'resolved' && new Date(t.updatedAt) >= ago7d);
    resolvedTickets7d = resolved.length;
    if (resolved.length > 0) {
      const totalHrs = resolved.reduce((acc: number, t: any) => {
        return acc + (new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime()) / 3_600_000;
      }, 0);
      avgResolveHours = totalHrs / resolved.length;
    }
  } catch { /* 무시 */ }

  // 결제 실패
  let paymentFails30d = 0;
  let planDowngraded  = false;
  try {
    const payEvents = re ? await re.findMany({
      where: { tenantId, eventType: { in: ['payment_failed', 'plan_changed'] }, occurredAt: { gte: ago30d } },
      select: { eventType: true, properties: true },
    }).catch(() => []) : [];
    paymentFails30d = payEvents.filter((e: any) => e.eventType === 'payment_failed').length;
    planDowngraded  = payEvents.some((e: any) =>
      e.eventType === 'plan_changed' && (e.properties as any)?.direction === 'downgrade',
    );
  } catch { /* 무시 */ }

  return {
    iotConnected:       !!milestone?.iotConnectedAt,
    firstDataReceived:  !!milestone?.firstDataAt,
    firstAiRun:         !!milestone?.firstAiAnalysisAt,
    firstReportMade:    !!milestone?.firstReportAt,
    onboardingDays,
    loginCount7d:       Number(login7d),
    loginCount30d:      Number(login30d),
    featureUsed7d:      Array.isArray(features7d) ? features7d.length : 0,
    daysInactiveLast,
    totalUsers:         Number(totalUsers),
    activeUsers30d:     Number(activeUsers30d),
    roiPercent:         kpi?.roiPercent != null ? Number(kpi.roiPercent) : null,
    savedCostKrwLast:   kpi?.savedCostKrw != null ? Number(kpi.savedCostKrw) : 0,
    openTickets,
    resolvedTickets7d,
    avgResolveHours,
    paymentFails30d,
    planDowngraded,
    subscriptionActive: (tenant?.subscriptions?.length ?? 0) > 0,
  };
}

// ── 단일 테넌트 점수 계산 및 DB 저장 ─────────────────────────

export async function scoreAndSave(tenantId: string): Promise<ChurnScoreResult> {
  const signals = await collectSignals(tenantId);
  const result  = calculateChurnScore(signals);
  const period  = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const model = (prisma as any).tenantChurnScore;
  if (model) {
    await model.upsert({
      where: { tenantId_period: { tenantId, period } },
      create: {
        tenantId,
        period,
        churnScore:        result.churnScore,
        riskLevel:         result.riskLevel,
        onboardingScore:   result.onboardingScore,
        engagementScore:   result.engagementScore,
        organizationScore: result.organizationScore,
        roiScore:          result.roiScore,
        supportScore:      result.supportScore,
        paymentScore:      result.paymentScore,
        scoreReasons: { reasons: result.reasons, signals: result.signals },
      },
      update: {
        churnScore:        result.churnScore,
        riskLevel:         result.riskLevel,
        onboardingScore:   result.onboardingScore,
        engagementScore:   result.engagementScore,
        organizationScore: result.organizationScore,
        roiScore:          result.roiScore,
        supportScore:      result.supportScore,
        paymentScore:      result.paymentScore,
        scoreReasons: { reasons: result.reasons, signals: result.signals },
      },
    }).catch((e: Error) => console.warn('[ChurnScore] upsert 실패:', e.message));
  }

  return result;
}

// ── 전체 테넌트 배치 처리 ─────────────────────────────────────

export async function runBatchScoring(): Promise<{
  processed: number;
  critical: number;
  warning: number;
}> {
  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null, status: 'active' },
    select: { id: true },
  });

  let critical = 0;
  let warning  = 0;

  // 순차 처리 (DB 부하 제한)
  for (const { id } of tenants) {
    try {
      const result = await scoreAndSave(id);
      if (result.riskLevel === 'critical') critical++;
      else if (result.riskLevel === 'warning') warning++;
    } catch (e) {
      console.error(`[ChurnScore] 테넌트 ${id} 실패:`, e);
    }
  }

  return { processed: tenants.length, critical, warning };
}

// ── 온보딩 마일스톤 갱신 헬퍼 ────────────────────────────────

export async function markMilestone(
  tenantId: string,
  milestone: 'iotConnectedAt' | 'firstDataAt' | 'firstAiAnalysisAt' | 'firstReportAt' | 'firstAlertAt',
): Promise<void> {
  const model = (prisma as any).onboardingMilestone;
  if (!model) return;

  const existing = await model.findUnique({ where: { tenantId } }).catch(() => null);

  const milestoneFields = ['iotConnectedAt', 'firstDataAt', 'firstAiAnalysisAt', 'firstReportAt', 'firstAlertAt'];
  const data: Record<string, unknown> = { [milestone]: existing?.[milestone] ?? new Date() };

  // 완료율 계산
  const completed = milestoneFields.filter(
    (f) => (f === milestone) ? true : !!existing?.[f],
  ).length;
  data['completionPct'] = Math.round((completed / milestoneFields.length) * 100);

  // TTFV: IoT 연결 → 첫 데이터 수신까지의 시간(초)
  if (milestone === 'firstDataAt' && existing?.iotConnectedAt) {
    data['ttfvSeconds'] = Math.round(
      (Date.now() - new Date(existing.iotConnectedAt).getTime()) / 1000,
    );
  }

  await model.upsert({
    where:  { tenantId },
    create: { tenantId, ...data },
    update: data,
  }).catch((e: Error) => console.warn('[Milestone] 갱신 실패:', e.message));
}
