'use client';

import { cn } from '@/lib/utils';
import { CreditCard, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface SubscriptionOverviewProps {
  subscription: {
    id: string;
    status: string;
    billingCycle: string | null;
    startDate: string;
    endDate: string;
    autoRenew: boolean;
    plan: {
      name: string;
      tier: string;
      monthlyPrice: string | number | null;
      yearlyPrice: string | number | null;
    };
  };
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  ACTIVE: { label: '활성', color: 'text-emerald-400', icon: CheckCircle2 },
  EXPIRE_SOON: { label: '만료 임박', color: 'text-amber-400', icon: AlertTriangle },
  EXPIRED: { label: '만료됨', color: 'text-red-400', icon: XCircle },
  PRE_PAYMENT: { label: '결제 대기', color: 'text-blue-400', icon: CreditCard },
  PAID: { label: '결제 완료', color: 'text-cyan-400', icon: CheckCircle2 },
  SUSPENDED: { label: '일시중지', color: 'text-slate-400', icon: AlertTriangle },
  TERMINATED: { label: '해지됨', color: 'text-red-400', icon: XCircle },
};

const billingLabels: Record<string, string> = {
  monthly: '월간',
  yearly: '연간',
  lifetime: '평생',
};

export function SubscriptionOverview({ subscription }: SubscriptionOverviewProps) {
  const fallback = { label: '활성', color: 'text-emerald-400', icon: CheckCircle2 };
  const { icon: StatusIcon, color, label } = statusConfig[subscription.status] || fallback;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatPrice = (price: string | number | null) => {
    if (!price) return '-';
    const num = typeof price === 'string' ? parseFloat(price) : price;
    return `₩${num.toLocaleString('ko-KR')}`;
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white">현재 구독</h2>
        <div className={cn('flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium', color)}>
          <StatusIcon className="w-4 h-4" />
          {label}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-1">플랜</p>
          <p className="text-white font-semibold text-lg">{subscription.plan.name}</p>
          <p className="text-xs text-slate-400 capitalize">{subscription.plan.tier}</p>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-1">결제 주기</p>
          <p className="text-white font-semibold text-lg">
            {subscription.billingCycle ? billingLabels[subscription.billingCycle] || subscription.billingCycle : '-'}
          </p>
          <p className="text-xs text-slate-400">
            {subscription.billingCycle === 'monthly'
              ? formatPrice(subscription.plan.monthlyPrice)
              : formatPrice(subscription.plan.yearlyPrice)}/
            {subscription.billingCycle === 'monthly' ? '월' : '년'}
          </p>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-1">시작일</p>
          <p className="text-white font-semibold">{formatDate(subscription.startDate)}</p>
        </div>

        <div className="bg-slate-900/50 rounded-lg p-4">
          <p className="text-xs text-slate-500 mb-1">만료일</p>
          <p className="text-white font-semibold">{formatDate(subscription.endDate)}</p>
          <p className="text-xs text-slate-400">
            {subscription.autoRenew ? '자동 갱신' : '수동 갱신'}
          </p>
        </div>
      </div>
    </div>
  );
}
