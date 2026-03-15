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
import { CreditCard, AlertCircle, CheckCircle, Clock, Wifi, Upload, FileText, Settings } from 'lucide-react';
import Link from 'next/link';

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
    <div className="h-full bg-[#051225] p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-cyan-500/10 rounded-lg">
          <CreditCard className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">구독 관리</h1>
          <p className="text-slate-400 text-sm">플랜 및 결제를 관리합니다</p>
        </div>
      </div>

      {/* ─── 서비스 특성 안내 (기대치 관리) ─── */}
      <div className="mb-6 bg-slate-800/50 border border-amber-500/20 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <h2 className="text-sm font-semibold text-amber-400">탄소이음은 설정형 SaaS입니다</h2>
        </div>
        <p className="text-sm text-slate-400 mb-4">
          구독 즉시 사용 가능한 기능과 별도 설정이 필요한 기능이 구분됩니다.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <p className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> 구독 즉시 사용 가능
            </p>
            <ul className="text-xs text-slate-400 space-y-1">
              <li className="flex items-center gap-1.5"><FileText className="w-3 h-3 text-emerald-400" /> 고지서 업로드 → 탄소 배출량 계산</li>
              <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-emerald-400" /> K-ETS 탄소 거래소 포트폴리오</li>
              <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-emerald-400" /> 탄소 감축 로드맵 설정</li>
              <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-emerald-400" /> 온실가스 명세서 (수동 데이터)</li>
            </ul>
          </div>
          <div className="p-3 bg-slate-700/30 border border-slate-600/30 rounded-lg">
            <p className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> 별도 설정 후 활성화
            </p>
            <ul className="text-xs text-slate-400 space-y-1">
              <li className="flex items-center gap-1.5"><Wifi className="w-3 h-3 text-slate-500" /> 실시간 에너지 모니터링 (센서·게이트웨이 설치)</li>
              <li className="flex items-center gap-1.5"><Wifi className="w-3 h-3 text-slate-500" /> AI 부하 예측 · 이상 탐지 (데이터 연동)</li>
              <li className="flex items-center gap-1.5"><Wifi className="w-3 h-3 text-slate-500" /> 자동 배출량 계산 (IoT/PLC 연동)</li>
              <li className="flex items-center gap-1.5"><Upload className="w-3 h-3 text-slate-500" /> 디지털 트윈 (시설 매핑)</li>
            </ul>
            <div className="mt-2 pt-2 border-t border-slate-600/30">
              <p className="text-[10px] text-amber-400/80 flex items-start gap-1">
                <span className="mt-0.5">⚠</span>
                IoT 기능 활성화를 위한 초기 설치(공사)비가 플랜별 별도 부과됩니다. 아래 플랜 비교에서 확인하세요.
              </p>
            </div>
          </div>
        </div>
        {!subscription && (
          <div className="mt-3">
            <Link href="/onboarding">
              <button className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition">
                <Settings className="w-4 h-4" /> 서비스 시작 설정 가이드 →
              </button>
            </Link>
          </div>
        )}
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
