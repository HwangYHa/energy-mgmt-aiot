'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  PLAN_FEATURES,
  PLAN_DISPLAY,
  FEATURE_LABELS,
  type PlanFeatureSet,
} from '@/lib/constants/plans';
import {
  Check,
  X,
  Sparkles,
  Building2,
  Cpu,
  Users,
  Database,
  Zap,
  Loader2,
  ExternalLink,
  Info,
} from 'lucide-react';

interface PlanComparisonProps {
  currentTier: string | null;
}

const PLAN_ORDER = ['trial', 'basic', 'pro', 'enterprise'] as const;

/**
 * Stripe 결제 시작
 * - 서버에 tier + billingCycle 전달 → Stripe Checkout URL 수신 → 리다이렉트
 */
async function initiateCheckout(tier: string, billingCycle: 'monthly' | 'yearly'): Promise<void> {
  const res = await fetch('/api/payment/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier, billingCycle }),
  });

  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: '결제 세션 생성 실패' }));
    throw new Error(error || '결제 세션 생성 실패');
  }

  const { url } = await res.json();
  if (!url) throw new Error('Stripe URL을 받지 못했습니다');

  // Stripe Hosted Checkout으로 리다이렉트
  window.location.href = url;
}

// 기능 카테고리별 그룹
const FEATURE_GROUPS = [
  {
    label: '모니터링 & 분석',
    features: ['realtimeMonitoring', 'historicalAnalytics', 'aiForecast', 'anomalyDetection'],
  },
  {
    label: '제어 & 최적화',
    features: ['manualControl', 'scheduleControl', 'optimizationControl', 'drEventManagement'],
  },
  {
    label: '리포트 & 규정',
    features: ['reportGeneration', 'reportExcel', 'reportPdf', 'complianceTracking', 'carbonAccounting'],
  },
  {
    label: '알림 & 연동',
    features: ['customAlertRules', 'emailNotifications', 'smsNotifications', 'webhookIntegration', 'apiAccess'],
  },
  {
    label: '관리 & 지원',
    features: ['multiSite', 'ssoIntegration', 'auditLog', 'prioritySupport', 'dedicatedManager', 'customDevelopment', 'slaGuarantee'],
  },
];

export function PlanComparison({ currentTier }: PlanComparisonProps) {
  const router = useRouter();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const formatPrice = (price: number | null) => {
    if (price === null) return '문의';
    if (price === 0) return '무료';
    return `₩${price.toLocaleString('ko-KR')}`;
  };

  async function handleSelectPlan(tier: string) {
    if (tier === 'enterprise') {
      router.push('/support');
      return;
    }
    if (tier === 'trial') return; // 무료 플랜은 별도 처리 불필요

    setLoadingTier(tier);
    setCheckoutError(null);
    try {
      await initiateCheckout(tier, billingCycle);
      // initiateCheckout은 window.location.href 변경 → 이 이후 코드는 실행되지 않음
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : '결제 오류가 발생했습니다.');
      setLoadingTier(null);
    }
  }

  return (
    <div className="mt-8">
      {/* 결제 오류 메시지 */}
      {checkoutError && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          <Info className="w-4 h-4 flex-shrink-0" />
          {checkoutError}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">플랜 비교</h2>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
            <Info className="w-3 h-3" />
            표시 금액에 부가세(VAT 10%)가 별도 부과됩니다. Stripe 결제 페이지에서 최종 금액 확인.
          </p>
        </div>

        {/* 결제 주기 토글 */}
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition',
              billingCycle === 'monthly'
                ? 'bg-cyan-600 text-white'
                : 'text-slate-400 hover:text-white'
            )}
          >
            월간
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition',
              billingCycle === 'yearly'
                ? 'bg-cyan-600 text-white'
                : 'text-slate-400 hover:text-white'
            )}
          >
            연간
            <span className="ml-1 text-xs text-emerald-400">-17%</span>
          </button>
        </div>
      </div>

      {/* 플랜 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {PLAN_ORDER.map((tier) => {
          const display = PLAN_DISPLAY[tier]!;
          const features = PLAN_FEATURES[tier]!;
          const isCurrent = currentTier === tier;
          const price = billingCycle === 'monthly' ? display.monthlyPrice : display.yearlyPrice;

          const borderColor = isCurrent
            ? 'border-cyan-500'
            : display.badge
            ? 'border-cyan-500/30'
            : 'border-slate-700/50';

          return (
            <div
              key={tier}
              className={cn(
                'relative bg-slate-800/50 border rounded-xl p-5 flex flex-col',
                borderColor,
                isCurrent && 'ring-1 ring-cyan-500/50'
              )}
            >
              {/* 배지 */}
              {display.badge && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="flex items-center gap-1 px-3 py-0.5 bg-cyan-500 text-white text-xs font-semibold rounded-full">
                    <Sparkles className="w-3 h-3" />
                    {display.badge}
                  </span>
                </div>
              )}

              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-0.5 bg-emerald-500 text-white text-xs font-semibold rounded-full">
                    현재 플랜
                  </span>
                </div>
              )}

              <h3 className="text-lg font-bold text-white mt-2">{display.name}</h3>
              <p className="text-xs text-slate-400 mt-1 mb-4">{display.description}</p>

              {/* 가격 */}
              <div className="mb-1">
                <span className="text-3xl font-bold text-white">{formatPrice(price)}</span>
                {price !== null && price > 0 && (
                  <span className="text-sm text-slate-400 ml-1">
                    /{billingCycle === 'monthly' ? '월' : '년'}
                  </span>
                )}
              </div>
              {price !== null && price > 0 && (
                <p className="text-[10px] text-slate-600 mb-3">
                  부가세(10%) 별도 · 연간 결제 시 2개월 무료
                </p>
              )}
              {price === 0 && <p className="text-[10px] text-slate-600 mb-3">영구 무료 (기능 제한)</p>}
              {price === null && <p className="text-[10px] text-slate-600 mb-3">맞춤 견적 제공</p>}

              {/* 리소스 제한 */}
              <div className="space-y-2 mb-4 pb-4 border-b border-slate-700/50">
                <ResourceRow icon={Building2} label="사이트" value={features.maxSites} />
                <ResourceRow icon={Cpu} label="디바이스" value={features.maxDevices} />
                <ResourceRow icon={Users} label="사용자" value={features.maxUsers} />
                <ResourceRow icon={Database} label="데이터 보존" value={features.dataRetentionDays} suffix="일" />
                <ResourceRow icon={Zap} label="API 제한" value={features.apiRateLimit} suffix="req/min" />
              </div>

              {/* CTA */}
              {!isCurrent ? (
                <button
                  onClick={() => handleSelectPlan(tier)}
                  disabled={loadingTier === tier}
                  className={cn(
                    'w-full py-2.5 rounded-lg font-medium text-sm transition mt-auto flex items-center justify-center gap-2',
                    tier === 'enterprise'
                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20'
                      : tier === 'trial'
                      ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                      : 'bg-cyan-500 text-white hover:bg-cyan-600',
                    loadingTier === tier && 'opacity-70 cursor-not-allowed'
                  )}
                >
                  {loadingTier === tier ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : tier === 'enterprise' ? (
                    <><ExternalLink className="w-3.5 h-3.5" /> 영업팀 문의</>
                  ) : tier === 'trial' ? (
                    '무료로 시작'
                  ) : (
                    '플랜 선택 →'
                  )}
                </button>
              ) : (
                <div className="w-full py-2.5 rounded-lg font-medium text-sm text-center bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mt-auto">
                  ✓ 현재 사용 중
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 상세 기능 비교 테이블 */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-700/50">
          <h3 className="text-sm font-semibold text-white">상세 기능 비교</h3>
        </div>

        {/* 헤더 */}
        <div className="grid grid-cols-5 px-4 py-3 border-b border-slate-700/50 bg-slate-800/80">
          <div className="text-xs text-slate-400 font-medium">기능</div>
          {PLAN_ORDER.map((tier) => (
            <div key={tier} className="text-xs text-slate-300 font-medium text-center">
              {PLAN_DISPLAY[tier]?.name}
            </div>
          ))}
        </div>

        {/* 기능 그룹 */}
        {FEATURE_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="px-4 py-2 bg-slate-900/50">
              <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                {group.label}
              </span>
            </div>

            {group.features.map((featureKey) => (
              <div
                key={featureKey}
                className="grid grid-cols-5 px-4 py-2.5 border-b border-slate-700/30 hover:bg-slate-800/30 transition"
              >
                <div className="text-sm text-slate-300">
                  {FEATURE_LABELS[featureKey] || featureKey}
                </div>
                {PLAN_ORDER.map((tier) => {
                  const planFeatures = PLAN_FEATURES[tier]?.features;
                  const available = planFeatures?.[featureKey as keyof PlanFeatureSet['features']];

                  return (
                    <div key={tier} className="flex justify-center">
                      {available ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <X className="w-4 h-4 text-slate-600" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ResourceRow({
  icon: Icon,
  label,
  value,
  suffix,
}: {
  icon: typeof Building2;
  label: string;
  value: number | null;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="w-3.5 h-3.5 text-slate-500" />
      <span className="text-slate-400">{label}</span>
      <span className="ml-auto text-white font-medium">
        {value === null ? '무제한' : `${value.toLocaleString()}${suffix ? ` ${suffix}` : ''}`}
      </span>
    </div>
  );
}
