'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { apiPost } from '@/lib/api/client';
import {
  PLAN_FEATURES,
  PLAN_DISPLAY,
  FEATURE_LABELS,
  type PlanFeatureSet,
} from '@/lib/constants/plans';

// 토스페이먼츠 JS SDK 타입 (CDN 로드)
declare global {
  interface Window {
    TossPayments?: (clientKey: string) => {
      requestPayment(
        method: string,
        params: {
          amount: number;
          orderId: string;
          orderName: string;
          customerName?: string;
          customerEmail?: string;
          successUrl: string;
          failUrl: string;
        }
      ): Promise<never>;
    };
  }
}
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
  Wrench,
  CreditCard,
  Receipt,
  Monitor,
} from 'lucide-react';

type PaymentProvider = 'toss' | 'stripe';

interface PlanComparisonProps {
  currentTier: string | null;
}

const PLAN_ORDER = ['trial', 'basic', 'pro', 'enterprise'] as const;

// ── 토스페이먼츠 SDK 동적 로더 (클릭 시 로드, 캐시 싱글톤) ──
let _tossSDKPromise: Promise<void> | null = null;
function loadTossSDK(): Promise<void> {
  if (typeof window !== 'undefined' && window.TossPayments) return Promise.resolve();
  if (!_tossSDKPromise) {
    _tossSDKPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://js.tosspayments.com/v1/payment';
      s.onload  = () => resolve();
      s.onerror = () => {
        _tossSDKPromise = null; // 실패 시 재시도 가능하도록 초기화
        reject(new Error('토스페이먼츠 SDK 로드 실패. 네트워크 연결을 확인해주세요.'));
      };
      document.head.appendChild(s);
    });
  }
  return _tossSDKPromise;
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
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>('toss');

  const formatPrice = (price: number | null) => {
    if (price === null) return '문의';
    if (price === 0) return '무료';
    return `₩${price.toLocaleString('ko-KR')}`;
  };

  async function handleSelectPlan(tier: string) {
    setCheckoutError(null);
    if (tier === 'enterprise') { router.push('/support'); return; }
    if (tier === 'trial') return;

    const display = PLAN_DISPLAY[tier];
    if (!display) return;
    const price = billingCycle === 'monthly' ? display.monthlyPrice : display.yearlyPrice;
    if (!price) return;

    setLoadingTier(tier);

    try {
      // ── Stripe Checkout ────────────────────────────────
      if (paymentProvider === 'stripe') {
        const res = await apiPost<{ url: string }>(
          '/api/payment/stripe/checkout',
          { tier, billingCycle }
        );
        if (!res.success || !res.data?.url) {
          throw new Error(res.error || 'Stripe 결제 세션 생성 실패');
        }
        window.location.href = res.data.url;
        return;
      }

      // ── 토스페이먼츠 Checkout ────────────────────────
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!clientKey) {
        setCheckoutError('결제 설정이 완료되지 않았습니다. 관리자에게 문의해주세요.');
        setLoadingTier(null);
        return;
      }

      await loadTossSDK();

      const orderId   = `TOSS-${tier.toUpperCase()}-${billingCycle === 'monthly' ? 'M' : 'Y'}-${Date.now()}`;
      const orderName = `탄소이음 ${display.name} (${billingCycle === 'monthly' ? '월간' : '연간'})`;
      const baseUrl   = window.location.origin;

      const tossPayments = window.TossPayments!(clientKey);
      await tossPayments.requestPayment('카드', {
        amount: price,
        orderId,
        orderName,
        successUrl: `${baseUrl}/payment/toss/success?tier=${tier}&billingCycle=${billingCycle}`,
        failUrl:    `${baseUrl}/payment/toss/fail`,
      });
      // requestPayment는 리다이렉트 → 이 이후 코드 실행되지 않음
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err?.code !== 'USER_CANCEL') {
        setCheckoutError(err?.message || '결제 중 오류가 발생했습니다.');
      }
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
            {paymentProvider === 'toss'
              ? '부가세(VAT 10%) 별도 · 토스페이먼츠 결제창에서 최종 금액 확인.'
              : '부가세(VAT 10%) 별도 · Stripe 해외 카드 결제 · KRW 청구.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* 결제 수단 선택 토글 */}
          <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700/50">
            <button
              onClick={() => setPaymentProvider('toss')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1',
                paymentProvider === 'toss'
                  ? 'bg-cyan-600 text-white'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              🇰🇷 토스페이
            </button>
            <button
              onClick={() => setPaymentProvider('stripe')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1',
                paymentProvider === 'stripe'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <CreditCard className="w-3 h-3" /> Stripe
            </button>
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

              {/* 초기 설치(공사)비 */}
              <div className="mb-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Wrench className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px] font-medium text-amber-400">초기 설치(공사)비</span>
                </div>
                <div className="text-sm font-bold text-white mb-0.5">
                  {display.installationFee === null
                    ? '별도 견적'
                    : display.installationFee === 0
                    ? '없음'
                    : `₩${display.installationFee.toLocaleString('ko-KR')}`}
                  {display.installationFee !== null && display.installationFee > 0 && (
                    <span className="text-[10px] text-slate-500 font-normal ml-1">1회 · VAT 별도</span>
                  )}
                </div>
                {display.installationFee !== null && display.installationFee > 0 && (
                  <div className="flex items-center gap-1 mb-1.5">
                    <Receipt className="w-3 h-3 text-blue-400" />
                    <span className="text-[10px] text-blue-400">세금계산서 발행 · 계좌이체</span>
                  </div>
                )}
                <ul className="space-y-0.5">
                  {display.installationIncludes.map((item, i) => (
                    <li key={i} className={`flex items-start gap-1 text-[10px] ${item.startsWith('※') ? 'text-amber-600/80 font-medium' : 'text-slate-400'}`}>
                      <span className={`mt-0.5 ${item.startsWith('※') ? 'text-amber-600' : 'text-amber-500'}`}>
                        {item.startsWith('※') ? '!' : '•'}
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Starter: 소프트웨어 전용 배지 */}
              {tier === 'trial' && (
                <div className="mb-4 flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-700/50 border border-slate-600/50 rounded-lg">
                  <Monitor className="w-3 h-3 text-slate-400" />
                  <span className="text-[10px] text-slate-400">소프트웨어 전용 — IoT 하드웨어 미지원</span>
                </div>
              )}

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
                  ) : paymentProvider === 'stripe' ? (
                    <><CreditCard className="w-3.5 h-3.5" /> Stripe로 결제</>
                  ) : (
                    '🇰🇷 토스페이로 결제 →'
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

      {/* 설치비 결제 안내 */}
      <div className="mb-6 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
        <div className="flex items-start gap-3">
          <Receipt className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-blue-300">초기 설치(공사)비 결제 안내</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              구독료는 토스페이먼츠 또는 Stripe로 즉시 결제됩니다.
              <br />
              설치(공사)비는 <span className="text-white font-medium">현장 방문 일정 확정 후 세금계산서 발행 → 계좌이체</span>로 별도 청구됩니다.
            </p>
            <div className="flex flex-wrap gap-3 pt-0.5">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">1</span>
                구독 결제 (온라인 즉시)
              </div>
              <span className="text-slate-600 text-xs">→</span>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">2</span>
                설치 일정 조율 (담당자 연락)
              </div>
              <span className="text-slate-600 text-xs">→</span>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">3</span>
                설치비 세금계산서 → 계좌이체
              </div>
              <span className="text-slate-600 text-xs">→</span>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px] font-bold">✓</span>
                현장 설치 완료 → 서비스 개시
              </div>
            </div>
            <p className="text-[11px] text-amber-500/80 pt-0.5">
              ※ 게이트웨이·센서 등 하드웨어 구매 비용은 설치비와 별개로 추가됩니다.
            </p>
          </div>
        </div>
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
