import Link from 'next/link';
import { CheckCircle, ArrowRight, Settings } from 'lucide-react';
import { requireServerRole } from '@/lib/auth/server-auth';
import { UserRole } from '@prisma/client';

/**
 * 결제 성공 페이지
 * - 구독 완료 후 온보딩 위저드로 안내
 */
export const metadata = {
  title: '결제 완료 - 탄소이음',
  description: '결제가 성공적으로 완료되었습니다.',
};

interface PageProps {
  searchParams: Promise<{ session_id?: string }>;
}

export default async function PaymentSuccessPage({ searchParams }: PageProps) {
  await requireServerRole('viewer' as UserRole);
  const params = await searchParams;
  const sessionId = params.session_id;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#040e1c] via-[#051225] to-[#040e1c] flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-8 md:p-10 text-center shadow-xl">

          {/* 성공 아이콘 */}
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

          {/* 기대치 관리 안내 */}
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-left">
            <p className="text-sm font-semibold text-amber-400 mb-2">⚡ 시작 전 안내</p>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>• 고지서 업로드 — 지금 즉시 탄소 계산 시작 가능</li>
              <li>• IoT 센서/PLC 연동 — 게이트웨이 장치 설치 필요</li>
              <li>• 데이터 연동 방식은 시작 설정에서 선택합니다</li>
            </ul>
          </div>

          {sessionId && (
            <div className="mb-6 p-3 bg-slate-800 border border-slate-700 rounded-lg">
              <p className="text-xs text-slate-500">
                결제 ID: <code className="text-emerald-400 text-xs">{sessionId}</code>
              </p>
            </div>
          )}

          {/* 주요 CTA — 온보딩 */}
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
              문의사항:{' '}
              <a href="mailto:support@carboneum.kr" className="text-cyan-400 hover:underline">
                support@carboneum.kr
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
