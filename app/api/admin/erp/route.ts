/**
 * GET /api/admin/erp
 * ERP 대시보드 — 재무·회계·운영·인사 통합 데이터
 * super_admin 전용
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { SubscriptionStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });
  if (!isSuperAdmin(auth.role)) return errorResponse('PERMISSION_DENIED', { status: 403 });

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || new Date().toISOString().slice(0, 7); // YYYY-MM
  const module = searchParams.get('module') || 'overview';

  try {
    const [year, month] = period.split('-').map(Number);
    const periodStart = new Date(year!, month! - 1, 1);
    const periodEnd   = new Date(year!, month!, 0, 23, 59, 59);

    if (module === 'finance') {
      return successResponse(await getFinanceData(period, periodStart, periodEnd));
    }
    if (module === 'accounting') {
      return successResponse(await getAccountingData(period, periodStart, periodEnd));
    }
    if (module === 'operations') {
      return successResponse(await getOperationsData(periodStart, periodEnd));
    }
    if (module === 'hr') {
      return successResponse(await getHRData(periodStart, periodEnd));
    }
    if (module === 'tenants') {
      return successResponse(await getTenantsData(periodStart, periodEnd));
    }

    // overview (default): 전 모듈 병렬 조회
    const [finance, accounting, operations, hr, tenants] = await Promise.all([
      getFinanceData(period, periodStart, periodEnd),
      getAccountingData(period, periodStart, periodEnd),
      getOperationsData(periodStart, periodEnd),
      getHRData(periodStart, periodEnd),
      getTenantsData(periodStart, periodEnd),
    ]);
    return successResponse({ finance, accounting, operations, hr, tenants });
  } catch (err) {
    console.error('[ERP GET]', err);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}

// ── 재무 (Finance) ────────────────────────────────────────────
async function getFinanceData(period: string, periodStart: Date, periodEnd: Date) {
  const [activeSubs, allPlans, newSubs, churnedSubs] = await Promise.all([
    prisma.subscription.findMany({
      where: { status: SubscriptionStatus.ACTIVE },
      include: { plan: { select: { monthlyPrice: true, tier: true, name: true } } },
    }),
    prisma.plan.findMany({ where: { isActive: true }, select: { id: true, name: true, tier: true, monthlyPrice: true } }),
    prisma.subscription.count({
      where: { createdAt: { gte: periodStart, lte: periodEnd } },
    }),
    prisma.subscription.count({
      where: {
        status: { in: [SubscriptionStatus.TERMINATED, SubscriptionStatus.EXPIRED] },
        updatedAt: { gte: periodStart, lte: periodEnd },
      },
    }),
  ]);

  const mrr = activeSubs.reduce((sum, s) => {
    const price = Number(s.plan?.monthlyPrice ?? 0);
    return sum + price;
  }, 0);

  const arr = mrr * 12;

  // Plan distribution
  const planDist: Record<string, number> = {};
  for (const s of activeSubs) {
    const tier = s.plan?.tier ?? 'unknown';
    planDist[tier] = (planDist[tier] ?? 0) + 1;
  }

  // Monthly revenue trend (last 6 months)
  const trend = await getRevenueTrend(6);

  return {
    mrr,
    arr,
    arpu: activeSubs.length > 0 ? Math.round(mrr / activeSubs.length) : 0,
    activeSubscriptions: activeSubs.length,
    newSubscriptions: newSubs,
    churnedSubscriptions: churnedSubs,
    churnRate: activeSubs.length > 0 ? ((churnedSubs / activeSubs.length) * 100).toFixed(1) : '0.0',
    planDistribution: planDist,
    plans: allPlans,
    revenueTrend: trend,
    period,
  };
}

async function getRevenueTrend(months: number) {
  const result = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const pStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const subs = await prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        createdAt: { lte: new Date(d.getFullYear(), d.getMonth() + 1, 0) },
      },
      include: { plan: { select: { monthlyPrice: true } } },
    });
    const rev = subs.reduce((s, sub) => s + Number(sub.plan?.monthlyPrice ?? 0), 0);
    result.push({ period: pStr, revenue: rev });
  }
  return result;
}

// ── 회계 (Accounting) ─────────────────────────────────────────
async function getAccountingData(period: string, _periodStart: Date, _periodEnd: Date) {
  const invoiceModel = (prisma as any).invoice;
  if (!invoiceModel) {
    return { invoices: [], summary: { total: 0, draft: 0, sent: 0, paid: 0, overdue: 0, totalAmount: 0, paidAmount: 0 }, period };
  }

  const invoices = await invoiceModel.findMany({
    where: { periodStart: { contains: period.slice(0, 7) } },
    include: { lineItems: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const now = new Date();
  const summary = {
    total: invoices.length,
    draft: invoices.filter((i: any) => i.status === 'draft').length,
    sent: invoices.filter((i: any) => i.status === 'sent').length,
    paid: invoices.filter((i: any) => i.status === 'paid').length,
    overdue: invoices.filter((i: any) => i.status === 'sent' && new Date(i.dueDate) < now).length,
    totalAmount: invoices.reduce((s: number, i: any) => s + Number(i.total), 0),
    paidAmount: invoices.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + Number(i.total), 0),
  };

  return { invoices, summary, period };
}

// ── 운영 (Operations) ─────────────────────────────────────────
async function getOperationsData(periodStart: Date, periodEnd: Date) {
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const [totalDevices, onlineDevices, totalGateways, onlineGateways,
         totalSites, mqttToday, alertsOpen, recentAlerts] = await Promise.all([
    prisma.device.count(),
    prisma.device.count({ where: { status: 'online' } }),
    prisma.gateway.count(),
    prisma.gateway.count({ where: { status: 'online' } }),
    prisma.site.count(),
    prisma.measurement.count({ where: { time: { gte: todayStart } } }).catch(() => 0),
    Promise.resolve((prisma as any).ransomwareAlert?.count({ where: { status: 'open' } }) ?? 0).catch(() => 0),
    prisma.auditLog.count({
      where: { action: { startsWith: 'security:' }, createdAt: { gte: periodStart, lte: periodEnd } },
    }).catch(() => 0),
  ]);

  // Gateway online rate trend (last 7 days)
  const gwTrend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayEnd   = new Date(dayStart.getTime() + 86400000);
    const cnt = await prisma.measurement.count({ where: { time: { gte: dayStart, lt: dayEnd } } }).catch(() => 0);
    gwTrend.push({ date: dayStart.toISOString().slice(0, 10), messages: cnt });
  }

  return {
    devices:  { total: totalDevices, online: onlineDevices, offline: totalDevices - onlineDevices },
    gateways: { total: totalGateways, online: onlineGateways, offline: totalGateways - onlineGateways },
    sites:    { total: totalSites },
    mqtt:     { today: mqttToday, trend: gwTrend },
    security: { openAlerts: alertsOpen, periodEvents: recentAlerts },
  };
}

// ── 인사 (HR) ─────────────────────────────────────────────────
async function getHRData(periodStart: Date, periodEnd: Date) {
  const [totalUsers, activeUsers, newUsers, adminUsers,
         recentLogins, roleDistRaw] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { createdAt: { gte: periodStart, lte: periodEnd } } }),
    prisma.user.count({ where: { role: { in: ['tenant_admin', 'super_admin'] } } }),
    prisma.user.count({ where: { lastLoginAt: { gte: periodStart, lte: periodEnd } } }).catch(() => 0),
    prisma.user.groupBy({ by: ['role'], _count: { id: true } }),
  ]);

  const roleDist = Object.fromEntries(roleDistRaw.map((r) => [r.role, r._count.id]));

  // Recent signups per day (last 14 days)
  const today = new Date();
  const signupTrend = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayEnd   = new Date(dayStart.getTime() + 86400000);
    const cnt = await prisma.user.count({ where: { createdAt: { gte: dayStart, lt: dayEnd } } });
    signupTrend.push({ date: dayStart.toISOString().slice(0, 10), count: cnt });
  }

  return {
    totalUsers,
    activeUsers,
    inactiveUsers: totalUsers - activeUsers,
    newUsers,
    adminUsers,
    recentLogins,
    roleDistribution: roleDist,
    signupTrend,
  };
}

// ── 테넌트/CRM ────────────────────────────────────────────────
async function getTenantsData(periodStart: Date, periodEnd: Date) {
  const [total, active, suspended, newTenants, industryRaw, tenantList] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { status: 'active' } }),
    prisma.tenant.count({ where: { status: 'suspended' } }),
    prisma.tenant.count({ where: { createdAt: { gte: periodStart, lte: periodEnd } } }),
    prisma.tenant.groupBy({ by: ['industryType'], _count: { id: true } }),
    prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, name: true, status: true, industryType: true, createdAt: true,
        _count: { select: { sites: true, devices: true, users: true } },
        subscriptions: {
          where: { status: SubscriptionStatus.ACTIVE },
          take: 1,
          include: { plan: { select: { name: true, tier: true, monthlyPrice: true } } },
        },
      },
    }),
  ]);

  const industryDist = Object.fromEntries(industryRaw.map((r) => [r.industryType, r._count.id]));

  return {
    total,
    active,
    suspended,
    terminated: total - active - suspended,
    newTenants,
    industryDistribution: industryDist,
    tenantList: tenantList.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      industryType: t.industryType,
      createdAt: t.createdAt.toISOString(),
      sites: t._count.sites,
      devices: t._count.devices,
      users: t._count.users,
      plan: t.subscriptions[0]?.plan?.name ?? '없음',
      planTier: t.subscriptions[0]?.plan?.tier ?? null,
      mrr: Number(t.subscriptions[0]?.plan?.monthlyPrice ?? 0),
    })),
  };
}
