'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

/**
 * /payment/stripe/success?session_id=cs_...&tier=basic&billingCycle=monthly
 *
 * Stripe Checkout 완료 후 리다이렉트 도착 페이지
 * 웹훅이 비동기로 구독을 활성화하므로 여기서는 단순 안내 → 대시보드 이동
 */
export default function StripeSuccessPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('결제를 확인하고 있습니다...');

  const sessionId   = searchParams.get('session_id');
  const tier        = searchParams.get('tier');
  const billingCycle = searchParams.get('billingCycle');

  const tierLabel: Record<string, string> = { basic: '기본', pro: '전문', trial: '체험' };
  const cycleLabel: Record<string, string> = { monthly: '월간', yearly: '연간' };

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setMessage('결제 세션 정보가 없습니다.');
      return;
    }

    // 웹훅이 처리를 완료하는 데 수 초 소요 → 3초 후 대시보드 이동
    const timer = setTimeout(() => {
      setStatus('success');
      setMessage('결제가 완료되었습니다! 잠시 후 대시보드로 이동합니다.');
      setTimeout(() => router.push('/dashboard'), 2500);
    }, 2500);

    return () => clearTimeout(timer);
  }, [sessionId, router]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-10 max-w-md w-full text-center shadow-2xl">
        {status === 'loading' && (
          <>
            <Loader2 className="w-14 h-14 text-cyan-400 animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">결제 처리 중</h1>
            <p className="text-slate-400 text-sm">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">결제 완료!</h1>
            {tier && billingCycle && (
              <p className="text-slate-300 text-sm mb-2">
                <span className="font-semibold text-cyan-400">
                  {tierLabel[tier] ?? tier} ({cycleLabel[billingCycle] ?? billingCycle})
                </span>{' '}
                플랜이 활성화됩니다.
              </p>
            )}
            <p className="text-slate-500 text-xs mt-1">{message}</p>
            <div className="mt-6 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-emerald-500 animate-[progressbar_2.5s_linear]" style={{ width: '100%' }} />
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">오류 발생</h1>
            <p className="text-slate-400 text-sm mb-6">{message}</p>
            <button
              onClick={() => router.push('/settings/subscription')}
              className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition"
            >
              구독 페이지로 돌아가기
            </button>
          </>
        )}
      </div>
    </div>
  );
}
