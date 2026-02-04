/**
 * 결제 페이지
 *
 * Iamport를 통한 결제 처리
 */

import { requireServerRole } from '@/lib/auth/server-auth';
import { UserRole } from '@prisma/client';
import { PaymentForm } from '@/components/payment/PaymentForm';
import { prisma } from '@/lib/db/prisma';

export default async function PaymentPage() {
  // 로그인 필수 (모든 역할 접근 가능)
  const auth = await requireServerRole('viewer' as UserRole);

  // 활성 플랜 조회
  const plansData = await prisma.plan.findMany({
    where: {
      isActive: true,
      isPublic: true,
    },
    orderBy: {
      monthlyPrice: 'asc',
    },
  });

  // Decimal을 number로 변환
  const plans = plansData.map((plan) => ({
    ...plan,
    monthlyPrice: plan.monthlyPrice ? Number(plan.monthlyPrice) : null,
    yearlyPrice: plan.yearlyPrice ? Number(plan.yearlyPrice) : null,
  }));

  // 현재 구독 확인
  const currentSubscription = await prisma.subscription.findFirst({
    where: {
      tenantId: auth.tenantId,
      status: { in: ['ACTIVE', 'PAID', 'EXPIRE_SOON'] },
    },
    include: {
      plan: true,
    },
  });

  return (
    <div className="min-h-screen bg-slate-950 py-12">
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">플랜 선택</h1>
          <p className="text-slate-400">
            귀하의 비즈니스에 맞는 최적의 플랜을 선택하세요
          </p>
        </div>

        {currentSubscription && (
          <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-blue-300 mb-2">
              현재 구독 중
            </h3>
            <p className="text-blue-200">
              {currentSubscription.plan.name} 플랜 •{' '}
              {new Date(currentSubscription.endDate).toLocaleDateString('ko-KR')}{' '}
              까지
            </p>
          </div>
        )}

        <PaymentForm plans={plans} userId={auth.userId} />
      </div>
    </div>
  );
}
