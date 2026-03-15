'use client';

/**
 * 토스페이먼츠 결제 실패 콜백 페이지
 *
 * URL: /payment/toss/fail?code=...&message=...&orderId=...
 */

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { XCircle, RefreshCw, ArrowLeft } from 'lucide-react';

const CANCEL_CODES = ['PAY_PROCESS_CANCELED', 'USER_CANCEL', 'REJECT_CARD_COMPANY'];

export default function TossPaymentFailPage() {
  const searchParams = useSearchParams();
  const code    = searchParams.get('code') || '';
  const message = searchParams.get('message') || '결제 처리 중 오류가 발생했습니다.';

  const isCanceled = CANCEL_CODES.includes(code);

  return (
    <div className="h-full bg-gradient-to-b from-[#040e1c] via-[#051225] to-[#040e1c] flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 md:p-10 text-center shadow-xl">

          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-slate-700/50 border border-slate-600 rounded-full flex items-center justify-center">
              <XCircle className="w-10 h-10 text-slate-400" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white mb-3">
            {isCanceled ? '결제가 취소되었습니다' : '결제에 실패했습니다'}
          </h1>

          <p className="text-slate-400 text-sm mb-2">{message}</p>
          {code && (
            <p className="text-xs text-slate-600 mb-6">오류 코드: {code}</p>
          )}

          {!isCanceled && (
            <div className="mb-6 p-4 bg-slate-800 border border-slate-700 rounded-xl text-left">
              <p className="text-xs text-slate-400 font-semibold mb-2">자주 있는 실패 원인</p>
              <ul className="text-xs text-slate-500 space-y-1">
                <li>• 카드 한도 초과 또는 잔액 부족</li>
                <li>• 해외 결제 차단 카드 (외화 결제 아님)</li>
                <li>• 네트워크 연결 문제</li>
                <li>• 카드사 시스템 점검</li>
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <Link href="/settings/subscription" className="flex-1">
              <button className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 text-sm">
                <RefreshCw className="w-4 h-4" />
                다시 결제하기
              </button>
            </Link>
            <Link href="/dashboard" className="flex-1">
              <button className="w-full py-3 border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-slate-300 font-semibold rounded-xl transition flex items-center justify-center gap-2 text-sm">
                <ArrowLeft className="w-4 h-4" />
                대시보드
              </button>
            </Link>
          </div>

          <p className="mt-6 text-xs text-slate-600">
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
