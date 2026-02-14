/**
 * 구독 관리 페이지
 * tenant_admin 이상만 접근 가능
 */

import { UserRole } from '@prisma/client';
import { requireServerRole } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/db/prisma';
import { SubscriptionOverview } from '@/components/subscription/SubscriptionOverview';
import { UsageStats } from '@/components/subscription/UsageStats';
import { PaymentTimeline } from '@/components/subscription/PaymentTimeline';
import { PlanComparison } from '@/components/subscription/PlanComparison';
import { CreditCard } from 'lucide-react';

export default async function SubscriptionPage() {
  const auth = await requireServerRole('tenant_admin' as UserRole);

  // 현재 활성 구독 조회
  const subscription = await prisma.subscription.findFirst({
    where: {
      tenantId: auth.tenantId,
      status: { in: ['ACTIVE', 'EXPIRE_SOON', 'PAID', 'PRE_PAYMENT'] },
    },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });

  // 사용량 조회
  const [sitesCount, devicesCount, usersCount] = await Promise.all([
    prisma.site.count({ where: { tenantId: auth.tenantId, deletedAt: null } }),
    prisma.device.count({ where: { tenantId: auth.tenantId, deletedAt: null } }),
    prisma.user.count({ where: { tenantId: auth.tenantId, isActive: true } }),
  ]);

  const currentTier = subscription?.plan.tier || null;

  return (
    <div className="min-h-screen bg-[#051225] p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-cyan-500/10 rounded-lg">
          <CreditCard className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">구독 관리</h1>
          <p className="text-slate-400 text-sm">플랜 및 결제를 관리합니다</p>
        </div>
      </div>

      {subscription ? (
        <>
          <SubscriptionOverview
            subscription={{
              id: subscription.id,
              status: subscription.status,
              billingCycle: subscription.billingCycle,
              startDate: subscription.startDate.toISOString(),
              endDate: subscription.endDate.toISOString(),
              autoRenew: subscription.autoRenew,
              plan: {
                name: subscription.plan.name,
                tier: subscription.plan.tier,
                monthlyPrice: subscription.plan.monthlyPrice?.toString() ?? null,
                yearlyPrice: subscription.plan.yearlyPrice?.toString() ?? null,
              },
            }}
          />

          <UsageStats
            usage={{
              sites: { current: sitesCount, limit: subscription.plan.maxSites },
              devices: { current: devicesCount, limit: subscription.plan.maxDevices },
              users: { current: usersCount, limit: subscription.plan.maxUsers },
            }}
          />

          <PaymentTimeline />
        </>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-8 text-center mb-8">
          <CreditCard className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 mb-2">활성 구독이 없습니다.</p>
          <p className="text-sm text-slate-500">
            아래에서 플랜을 선택하여 에너지 관리 서비스를 시작하세요.
          </p>
        </div>
      )}

      {/* 플랜 비교 */}
      <PlanComparison currentTier={currentTier} />
    </div>
  );
}
