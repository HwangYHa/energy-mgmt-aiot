'use client';

import { useRouter } from 'next/navigation';
import { XCircle } from 'lucide-react';

/** Stripe Checkout 취소 시 리다이렉트 페이지 */
export default function StripeCancelPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-10 max-w-md w-full text-center shadow-2xl">
        <XCircle className="w-14 h-14 text-slate-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">결제가 취소되었습니다</h1>
        <p className="text-slate-400 text-sm mb-6">
          결제를 취소하셨습니다. 언제든지 다시 구독을 시작할 수 있습니다.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => router.back()}
            className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition"
          >
            돌아가기
          </button>
          <button
            onClick={() => router.push('/settings/subscription')}
            className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition"
          >
            구독 페이지
          </button>
        </div>
      </div>
    </div>
  );
}
