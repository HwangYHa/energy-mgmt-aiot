import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Check, ArrowRight } from 'lucide-react';

/**
 * 무료 평가판 페이지
 */
export const metadata = {
  title: '14일 무료 체험 - 탄소이음',
  description:
    '신용카드 없이 14일간 탄소이음의 모든 기능을 무료로 체험하세요. AI 부하 예측, 이상 탐지, 에너지 최적화를 직접 경험.',
  openGraph: {
    title: '14일 무료 체험 시작 - 탄소이음',
    description: '신용카드 불필요. AI 에너지 관리 플랫폼 14일 무료 체험',
  },
};

export default function TrialPage() {
  return (
    <div className="py-20 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            14일 무료 체험
          </h1>
          <p className="text-xl text-slate-300">
            신용카드 등록 없이 모든 기능을 체험하세요
          </p>
        </div>

        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-emerald-500/50 rounded-2xl p-8 md:p-12 mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">
            무료 체험에 포함된 기능
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {[
              'AI 기반 부하 예측',
              '실시간 이상 탐지',
              '에너지 최적화 추천',
              '수요반응 (DR) 참여',
              '탄소 배출 추적',
              '실시간 대시보드',
              '모바일 앱 지원',
              '이메일 알림',
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <span className="text-slate-200">{feature}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button
                size="lg"
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-6 text-lg"
              >
                지금 시작하기
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link href="/demo">
              <Button
                size="lg"
                variant="outline"
                className="px-8 py-6 text-lg"
              >
                데모 먼저 보기
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-6">
            <div className="text-4xl font-bold text-emerald-400 mb-2">
              신용카드 불필요
            </div>
            <p className="text-slate-300">
              결제 정보 없이 바로 시작할 수 있습니다
            </p>
          </div>
          <div className="text-center p-6">
            <div className="text-4xl font-bold text-emerald-400 mb-2">
              언제든 취소
            </div>
            <p className="text-slate-300">
              체험 기간 중 언제든 취소 가능합니다
            </p>
          </div>
          <div className="text-center p-6">
            <div className="text-4xl font-bold text-emerald-400 mb-2">
              전문가 지원
            </div>
            <p className="text-slate-300">
              체험 기간 동안 이메일 지원을 제공합니다
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
