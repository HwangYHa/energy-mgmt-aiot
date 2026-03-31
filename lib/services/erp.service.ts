/**
 * lib/services/erp.service.ts
 *
 * 슈퍼 관리자 ERP 서비스
 * - 플랫폼 수익 집계 (MRR / ARR)
 * - 테넌트 ROI 계산
 * - 인보이스 자동 생성
 * - 플랫폼 전체 KPI
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export interface RevenueSummary {
  period:           string;
  totalRevenue:     number;
  mrr:              number;
  arr:              number;
  newSubscriptions: number;
  churned:          number;
  netRevenue:       number;
}

export interface TenantROI {
  tenantId:      string;
  period:        string;
  savedCostKrw:  number;
  investmentKrw: number;
  roiPercent:    number;
  paybackMonths: number;
}

export interface PlatformKPIs {
  totalTenants:  number;
  activeTenants: number;
  totalDevices:  number;
  totalSites:    number;
  mqttMsgToday:  number;
  alertsOpen:    number;
}

export interface InvoiceResult {
  invoiceId: string;
  invoiceNo: string;
  total:     number;
  status:    string;
}

// ── 인보이스 번호 채번: INV-YYYYMM-NNNN ─────────────────────
async function generateInvoiceNo(period: string): Promise<string> {
  const ym    = period.replace('-', '');
  const count = await (prisma as any).invoice?.count({
    where: { invoiceNo: { startsWith: `INV-${ym}-` } },
  }).catch(() => 0) as number;
  return `INV-${ym}-${String(count + 1).padStart(4, '0')}`;
}

export class ERPService {
  /**
   * 플랫폼 수익 집계
   */
  static async getPlatformRevenueSummary(period: string): Promise<RevenueSummary> {
    const parts = period.split('-');
    const year  = parseInt(parts[0] ?? '2026', 10);
    const month = parseInt(parts[1] ?? '1', 10);
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd   = new Date(year, month, 1);

    const newSubs = await prisma.subscription.count({
      where: { createdAt: { gte: periodStart, lt: periodEnd }, status: 'ACTIVE' },
    }).catch(() => 0);

    const churnedSubs = await prisma.subscription.count({
      where: {
        status:    'TERMINATED',
        updatedAt: { gte: periodStart, lt: periodEnd },
      },
    }).catch(() => 0);

    // MRR: 현재 ACTIVE 구독 합계
    const activeSubs = await prisma.subscription.findMany({
      where:  { status: 'ACTIVE' },
      select: { planId: true },
    }).catch(() => []);

    // planId로 plan 가격 조회
    const planIds = [...new Set(activeSubs.map((s) => s.planId))];
    const plans   = await prisma.plan.findMany({
      where:  { id: { in: planIds } },
      select: { id: true, monthlyPrice: true },
    }).catch(() => []);

    const planPriceMap = new Map(plans.map((p) => [p.id, Number(p.monthlyPrice ?? 0)]));
    const mrr = activeSubs.reduce((sum, s) => sum + (planPriceMap.get(s.planId) ?? 0), 0);

    // 해당 기간 결제 내역
    const payments = await (prisma as any).paymentRecord?.findMany({
      where:  { paidAt: { gte: periodStart, lt: periodEnd }, status: 'DONE' },
      select: { amount: true },
    }).catch(() => []) as { amount: unknown }[] ?? [];

    const totalRevenue = payments.reduce(
      (sum: number, p: { amount: unknown }) => sum + Number(p.amount), 0,
    );

    return {
      period, totalRevenue, mrr, arr: mrr * 12,
      newSubscriptions: newSubs, churned: churnedSubs, netRevenue: totalRevenue,
    };
  }

  /**
   * 테넌트 ROI 계산 — KpiSnapshot 기반
   */
  static async getTenantROI(tenantId: string, period: string): Promise<TenantROI | null> {
    const snapshot = await (prisma as any).kpiSnapshot?.findUnique({
      where: { tenantId_period: { tenantId, period } },
    }).catch(() => null);

    if (!snapshot) return null;

    const saved         = Number(snapshot.savedCostKrw  ?? 0);
    const invested      = Number(snapshot.investmentKrw ?? 0);
    const roiPercent    = invested > 0 ? ((saved - invested) / invested) * 100 : 0;
    const paybackMonths = saved > 0 ? invested / saved : 0;

    return {
      tenantId, period, savedCostKrw: saved, investmentKrw: invested,
      roiPercent:    Math.round(roiPercent * 100) / 100,
      paybackMonths: Math.round(paybackMonths * 10) / 10,
    };
  }

  /**
   * 인보이스 자동 생성 — 구독 + plan 정보 기반, 부가세 10%
   */
  static async generateInvoice(tenantId: string, period: string): Promise<InvoiceResult> {
    const subscription = await prisma.subscription.findFirst({
      where:   { tenantId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    if (!subscription) throw new Error(`테넌트 ${tenantId}의 활성 구독이 없습니다.`);

    const plan = await prisma.plan.findUnique({
      where:  { id: subscription.planId },
      select: { name: true, monthlyPrice: true },
    });

    const planPrice = Number(plan?.monthlyPrice ?? 0);
    const invoiceNo = await generateInvoiceNo(period);

    const parts  = period.split('-');
    const year   = parseInt(parts[0] ?? '2026', 10);
    const month  = parseInt(parts[1] ?? '1', 10);
    const mm     = String(month).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();

    const subtotal  = new Prisma.Decimal(planPrice);
    const taxRate   = new Prisma.Decimal('0.10');
    const taxAmount = subtotal.mul(taxRate);
    const total     = subtotal.add(taxAmount);
    const dueDate   = new Date(year, month, 10);  // 익월 10일

    const invoice = await (prisma as any).invoice.create({
      data: {
        invoiceNo,
        tenantId,
        subscriptionId: subscription.id,
        periodStart:    `${year}-${mm}-01`,
        periodEnd:      `${year}-${mm}-${lastDay}`,
        subtotal,
        taxRate,
        taxAmount,
        total,
        currency: 'KRW',
        status:   'issued',
        dueDate,
        lineItems: {
          create: [{
            description: `${plan?.name ?? '구독'} 이용료 (${period})`,
            quantity:    1,
            unitPrice:   planPrice,
            amount:      planPrice,
          }],
        },
      },
    });

    return { invoiceId: invoice.id, invoiceNo, total: Number(total), status: 'issued' };
  }

  /**
   * 플랫폼 전체 KPI
   */
  static async getPlatformKPIs(): Promise<PlatformKPIs> {
    const today      = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const [totalTenants, activeTenants, totalDevices, totalSites, alertsOpen] =
      await Promise.all([
        prisma.tenant.count().catch(() => 0),
        prisma.tenant.count({ where: { status: 'active' } }).catch(() => 0),
        prisma.device.count().catch(() => 0),
        prisma.site.count().catch(() => 0),
        Promise.resolve(
          (prisma as any).ransomwareAlert?.count({ where: { status: 'open' } }) ?? 0,
        ).catch(() => 0),
      ]);

    const mqttMsgToday = await prisma.measurement
      .count({ where: { time: { gte: todayStart } } })
      .catch(() => 0);

    return { totalTenants, activeTenants, totalDevices, totalSites, mqttMsgToday, alertsOpen };
  }
}
