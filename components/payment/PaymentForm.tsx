'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { Check, CreditCard } from 'lucide-react';
import { toast } from '@/lib/toast';
import { apiPost, ApiError } from '@/lib/api/client';

interface Plan {
  id: string;
  name: string;
  description?: string | null;
  monthlyPrice?: number | null;
  yearlyPrice?: number | null;
  maxSites?: number | null;
  maxDevices?: number | null;
  maxUsers?: number | null;
  features?: any;
  stripePriceId?: string | null;
}

interface PaymentFormProps {
  plans: Plan[];
  userId: string;
}

type PaymentMethod = 'iamport' | 'stripe';

// Iamport 타입 정의
declare global {
  interface Window {
    IMP?: {
      init: (impCode: string) => void;
      request_pay: (
        params: {
          pg: string;
          pay_method: string;
          merchant_uid: string;
          name: string;
          amount: number;
          buyer_email: string;
          buyer_name: string;
          buyer_tel: string;
        },
        callback: (response: {
          success: boolean;
          error_msg?: string;
          imp_uid?: string;
          merchant_uid?: string;
          paid_amount?: number;
        }) => void
      ) => void;
    };
  }
}

export function PaymentForm({ plans, userId }: PaymentFormProps) {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('stripe');
  const [isLoading, setIsLoading] = useState(false);
  const [iamportLoaded, setIamportLoaded] = useState(false);
  const [iamportError, setIamportError] = useState(false);

  const handleStripePayment = async () => {
    if (!selectedPlan) return;

    setIsLoading(true);

    try {
      const res = await apiPost<{ url: string }>('/api/payment/stripe/checkout', {
        planId: selectedPlan.id,
        priceId: selectedPlan.stripePriceId || 'price_default',
      });

      const url = res.data?.url;
      if (!url) throw new Error('Stripe URL을 받지 못했습니다');

      // Stripe Checkout으로 리다이렉트
      window.location.href = url;
    } catch (error) {
      console.error('Stripe checkout error:', error);
      toast.error(`결제 오류: ${error instanceof ApiError ? error.message : error instanceof Error ? error.message : '알 수 없는 오류'}`);
      setIsLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedPlan) {
      toast.warn('플랜을 선택해주세요');
      return;
    }

    const amount =
      selectedPlan.monthlyPrice ||
      selectedPlan.yearlyPrice ||
      0;

    if (amount === 0) {
      // 무료 플랜인 경우 직접 API 호출
      await handleFreePlan();
      return;
    }

    // 결제 방법에 따라 처리
    if (paymentMethod === 'stripe') {
      await handleStripePayment();
      return;
    }

    // Iamport 결제
    if (iamportError) {
      toast.error('결제 모듈을 로드할 수 없습니다. 페이지를 새로고침하거나 나중에 다시 시도해주세요.');
      return;
    }
    if (iamportError) {
      toast.error('결제 모듈 로드에 실패했습니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    if (!iamportLoaded || !window.IMP) {
      toast.warn('결제 모듈을 로딩 중입니다. 잠시 후 다시 시도해주세요');
      return;
    }

    setIsLoading(true);

    // Iamport 가맹점 식별코드
    const impCode = process.env.NEXT_PUBLIC_IAMPORT_IMP_CODE;

    if (!impCode) {
      toast.warn('결제 설정이 올바르지 않습니다');
      setIsLoading(false);
      return;
    }

    // Iamport 초기화
    window.IMP!.init(impCode);

    // 주문번호 생성 (userId_planId_timestamp)
    const merchantUid = `${userId}_${selectedPlan.id}_${Date.now()}`;

    // 결제 요청
    window.IMP!.request_pay(
      {
        pg: 'html5_inicis', // PG사 (테스트: html5_inicis, 실서비스에서 변경)
        pay_method: 'card',
        merchant_uid: merchantUid,
        name: `${selectedPlan.name} 구독`,
        amount: amount,
        buyer_email: 'user@example.com', // 실제로는 사용자 정보 사용
        buyer_name: '사용자', // 실제로는 사용자 이름 사용
        buyer_tel: '010-0000-0000', // 실제로는 사용자 전화번호 사용
      },
      async (response) => {
        setIsLoading(false);

        if (response.success) {
          // 결제 성공 - 서버에서 검증
          try {
            await apiPost('/api/payment/complete', {
              imp_uid: response.imp_uid,
              merchant_uid: response.merchant_uid,
              paid_amount: response.paid_amount,
            });
            toast.success('결제가 완료되었습니다!');
            router.push('/settings/subscription');
          } catch (error) {
            console.error('결제 검증 에러:', error);
            toast.error(`결제 검증 실패: ${error instanceof ApiError ? error.message : '오류가 발생했습니다'}`);
          }
        } else {
          // 결제 실패
          toast.error(`결제 실패: ${response.error_msg}`);
        }
      }
    );
  };

  const handleFreePlan = async () => {
    // 무료 플랜은 API를 통해 직접 구독 생성
    setIsLoading(true);
    try {
      await apiPost('/api/subscriptions', {
        planId: selectedPlan!.id,
        billingCycle: 'monthly',
        autoRenew: true,
      });
      toast.success('무료 플랜 구독이 완료되었습니다!');
      router.push('/settings/subscription');
    } catch (error) {
      console.error('구독 생성 에러:', error);
      toast.error(`구독 생성 실패: ${error instanceof ApiError ? error.message : '오류가 발생했습니다'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getPlanPrice = (plan: Plan) => {
    if (plan.yearlyPrice) {
      return plan.yearlyPrice === 0
        ? '무료'
        : `₩${plan.yearlyPrice.toLocaleString()} / 년`;
    }
    if (plan.monthlyPrice) {
      return plan.monthlyPrice === 0
        ? '무료'
        : `₩${plan.monthlyPrice.toLocaleString()} / 월`;
    }
    return '무료';
  };

  const getFeatures = (plan: Plan) => {
    const features: string[] = [];

    if (plan.maxSites) {
      features.push(`사이트 ${plan.maxSites}개`);
    }
    if (plan.maxDevices) {
      features.push(`디바이스 ${plan.maxDevices}개`);
    }
    if (plan.maxUsers) {
      features.push(`사용자 ${plan.maxUsers}명`);
    }

    if (plan.features) {
      Object.entries(plan.features).forEach(([key, value]) => {
        if (value === true) {
          features.push(key);
        }
      });
    }

    return features;
  };

  return (
    <>
      {/* Iamport SDK 로드 */}
      <Script
        src="https://cdn.iamport.kr/v1/iamport.js"
        strategy="lazyOnload"
        onLoad={() => setIamportLoaded(true)}
        onError={() => {
          setIamportError(true);
          toast.error('결제 모듈 로드에 실패했습니다. 네트워크를 확인해주세요.');
        }}
      />

      {/* 결제 방법 선택 */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-white mb-4">결제 방법 선택</h3>
        <div className="grid grid-cols-2 gap-4 max-w-2xl">
          <button
            onClick={() => setPaymentMethod('stripe')}
            className={`p-4 rounded-lg border-2 transition-all ${
              paymentMethod === 'stripe'
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-slate-700 bg-slate-800 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <CreditCard className="w-6 h-6 text-blue-400" />
              <div className="text-left">
                <div className="font-semibold text-white">Stripe</div>
                <div className="text-sm text-slate-400">국제 카드 결제</div>
              </div>
            </div>
          </button>

          <button
            onClick={() => setPaymentMethod('iamport')}
            className={`p-4 rounded-lg border-2 transition-all ${
              paymentMethod === 'iamport'
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-slate-700 bg-slate-800 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center gap-3">
              <CreditCard className="w-6 h-6 text-emerald-400" />
              <div className="text-left">
                <div className="font-semibold text-white">아임포트</div>
                <div className="text-sm text-slate-400">국내 간편 결제</div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* 플랜 선택 */}
      <h3 className="text-xl font-semibold text-white mb-4">구독 플랜 선택</h3>
      <div className="grid md:grid-cols-3 gap-8">
        {plans.map((plan) => {
          const isSelected = selectedPlan?.id === plan.id;
          const features = getFeatures(plan);

          return (
            <div
              key={plan.id}
              className={`bg-slate-900 border rounded-lg p-8 cursor-pointer transition-all ${
                isSelected
                  ? 'border-blue-500 ring-2 ring-blue-500/50'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
              onClick={() => setSelectedPlan(plan)}
            >
              <h3 className="text-2xl font-bold text-white mb-2">
                {plan.name}
              </h3>
              {plan.description && (
                <p className="text-slate-400 text-sm mb-6">
                  {plan.description}
                </p>
              )}

              <div className="text-3xl font-bold text-white mb-6">
                {getPlanPrice(plan)}
              </div>

              <ul className="space-y-3 mb-8">
                {features.map((feature, index) => (
                  <li
                    key={index}
                    className="flex items-center gap-2 text-slate-300"
                  >
                    <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {isSelected && (
                <div className="text-center text-sm text-blue-400 font-medium">
                  선택됨
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedPlan && (
        <div className="mt-12 text-center">
          <button
            onClick={handlePayment}
            disabled={isLoading}
            className="px-12 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading
              ? '처리 중...'
              : paymentMethod === 'stripe'
              ? 'Stripe로 결제하기'
              : '아임포트로 결제하기'}
          </button>
          <p className="text-slate-400 text-sm mt-4">
            결제 시 자동으로 관리자 권한이 부여됩니다
          </p>
          {paymentMethod === 'stripe' && (
            <p className="text-slate-500 text-xs mt-2">
              Stripe Checkout 페이지로 이동합니다
            </p>
          )}
        </div>
      )}
    </>
  );
}
