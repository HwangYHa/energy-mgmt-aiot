import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { XCircle, ArrowLeft, RefreshCw } from 'lucide-react';

/**
 * 결제 취소 페이지
 */
export const metadata = {
  title: '결제 취소 - 탄소이음',
  description: '결제가 취소되었습니다.',
};

export default function PaymentCancelPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 md:p-12 text-center">
          <XCircle className="w-24 h-24 text-slate-400 mx-auto mb-6" />

          <h1 className="text-4xl font-bold text-white mb-4">
            결제가 취소되었습니다
          </h1>

          <p className="text-xl text-slate-300 mb-8">
            결제 과정에서 문제가 발생했거나 취소하셨습니다.
            <br />
            다시 시도하시거나 다른 결제 수단을 선택해주세요.
          </p>

          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">
              결제 취소 사유
            </h3>
            <ul className="text-left space-y-2 text-slate-400 text-sm">
              <li>• 결제 정보 입력 중 취소 버튼을 클릭하신 경우</li>
              <li>• 카드 승인이 거부된 경우</li>
              <li>• 네트워크 연결 문제가 발생한 경우</li>
              <li>• 결제 한도를 초과한 경우</li>
            </ul>
          </div>

          <div className="flex gap-4 justify-center flex-wrap mb-8">
            <Link href="/payment">
              <Button
                size="lg"
                className="bg-emerald-500 hover:bg-emerald-600"
              >
                <RefreshCw className="mr-2 w-5 h-5" />
                다시 시도
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline">
                <ArrowLeft className="mr-2 w-5 h-5" />
                플랜 다시 선택
              </Button>
            </Link>
          </div>

          <div className="p-4 bg-slate-900/50 border border-slate-700 rounded-lg">
            <p className="text-sm text-slate-400">
              결제에 문제가 있으시면{' '}
              <Link
                href="/support"
                className="text-emerald-400 hover:text-emerald-300"
              >
                고객센터
              </Link>
              로 문의해주세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
