'use client';

/**
 * 토스페이먼츠 결제 성공 콜백 페이지
 *
 * URL: /payment/toss/success?paymentKey=...&orderId=...&amount=...&tier=...&billingCycle=...
 * 1. URL 파라미터 추출
 * 2. POST /api/payment/toss/confirm 호출 (결제 승인 + 구독 활성화)
 * 3. 성공 시 온보딩 안내 / 오류 시 재시도 안내
 */

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle, XCircle, Loader2, Settings, ArrowRight, RefreshCw,
} from 'lucide-react';
import { apiPost, ApiError } from '@/lib/api/client';

type Status = 'loading' | 'success' | 'error';

export default function TossPaymentSuccessPage() {
  const searchParams  = useSearchParams();
  const [status, setStatus]   = useState<Status>('loading');
  const [errMsg, setErrMsg]   = useState('');
  const confirmedRef  = useRef(false);

  useEffect(() => {
    // React Strict Mode 이중 실행 방지
    if (confirmedRef.current) return;
    confirmedRef.current = true;

    const paymentKey   = searchParams.get('paymentKey');
    const orderId      = searchParams.get('orderId');
    const amountStr    = searchParams.get('amount');
    const tier         = searchParams.get('tier');
    const billingCycle = searchParams.get('billingCycle');

    if (!paymentKey || !orderId || !amountStr || !tier || !billingCycle) {
      setStatus('error');
      setErrMsg('결제 정보가 올바르지 않습니다. 결제 내역을 확인해주세요.');
      return;
    }

    const amount = Number(amountStr);
    if (Number.isNaN(amount) || amount <= 0) {
      setStatus('error');
      setErrMsg('결제 금액 정보가 올바르지 않습니다.');
      return;
    }

    apiPost('/api/payment/toss/confirm', {
      paymentKey, orderId, amount, tier, billingCycle,
    })
      .then(() => setStatus('success'))
      .catch((e) => {
        setStatus('error');
        setErrMsg(
          e instanceof ApiError ? e.message
          : e instanceof Error  ? e.message
          : '결제 확인 중 오류가 발생했습니다.'
        );
      });
  }, [searchParams]);

  /* ─── 로딩 ─── */
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#040e1c] via-[#051225] to-[#040e1c] flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mx-auto" />
          <p className="text-white font-semibold text-lg">결제를 확인하는 중입니다...</p>
          <p className="text-slate-400 text-sm">잠시만 기다려주세요</p>
        </div>
      </div>
    );
  }

  /* ─── 오류 ─── */
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#040e1c] via-[#051225] to-[#040e1c] flex items-center justify-center px-4">
        <div className="max-w-lg w-full">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-8 text-center shadow-xl">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-red-500/20 border border-red-500/50 rounded-full flex items-center justify-center">
                <XCircle className="w-10 h-10 text-red-400" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-white mb-3">결제 확인에 실패했습니다</h1>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">{errMsg}</p>

            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-left mb-6">
              <p className="text-xs text-amber-400 font-semibold mb-1">안내</p>
              <p className="text-xs text-slate-400">
                실제 결제가 완료되었다면 카드사 청구 취소가 자동으로 처리됩니다.
                24시간 내 반영되지 않을 경우 고객센터로 문의해주세요.
              </p>
            </div>

            <div className="flex gap-3">
              <Link href="/settings/subscription" className="flex-1">
                <button className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 text-sm">
                  <RefreshCw className="w-4 h-4" />
                  다시 시도
                </button>
              </Link>
              <Link href="/dashboard" className="flex-1">
                <button className="w-full py-3 border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-slate-300 font-semibold rounded-xl transition text-sm">
                  대시보드
                </button>
              </Link>
            </div>

            <p className="mt-4 text-xs text-slate-600">
              문의:{' '}
              <a href="mailto:carbonieum.official@gmail.com" className="text-cyan-400 hover:underline">
                carbonieum.official@gmail.com
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ─── 성공 ─── */
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#040e1c] via-[#051225] to-[#040e1c] flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-8 md:p-10 text-center shadow-xl">

          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-emerald-500/20 border border-emerald-500/50 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white mb-3">
            구독이 활성화되었습니다!
          </h1>

          <p className="text-slate-300 mb-4 leading-relaxed">
            탄소이음 서비스를 이용해 주셔서 감사합니다.
            <br />
            <span className="text-emerald-400 font-semibold">서비스 시작 설정</span>을 완료하면
            탄소 배출량 계산을 즉시 시작할 수 있습니다.
          </p>

          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-left">
            <p className="text-sm font-semibold text-amber-400 mb-2">⚡ 시작 전 안내</p>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>• 고지서 업로드 — 지금 즉시 탄소 계산 시작 가능</li>
              <li>• 수동 입력 — 알고 있는 사용량 직접 입력</li>
              <li>• IoT 센서/PLC 연동 — 게이트웨이 장치 설치 후 실시간 자동 수집</li>
            </ul>
          </div>

          <Link href="/onboarding">
            <button className="w-full py-4 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 text-lg mb-3">
              <Settings className="w-5 h-5" />
              서비스 시작 설정하기
              <ArrowRight className="w-5 h-5" />
            </button>
          </Link>

          <Link href="/dashboard">
            <button className="w-full py-3 border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-slate-300 font-semibold rounded-xl transition text-sm">
              나중에 설정하고 대시보드로 이동
            </button>
          </Link>

          <div className="mt-6 pt-4 border-t border-slate-800">
            <p className="text-xs text-slate-500">
              문의:{' '}
              <a href="mailto:carbonieum.official@gmail.com" className="text-cyan-400 hover:underline">
                carbonieum.official@gmail.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
