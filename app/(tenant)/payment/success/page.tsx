import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { CheckCircle, ArrowRight, Home } from 'lucide-react';
import { requireServerRole } from '@/lib/auth/server-auth';
import { UserRole } from '@prisma/client';

/**
 * 결제 성공 페이지
 */
export const metadata = {
  title: '결제 완료 - EnergyAI',
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
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        <div className="bg-slate-800 border border-emerald-500/50 rounded-2xl p-8 md:p-12 text-center">
          <CheckCircle className="w-24 h-24 text-emerald-400 mx-auto mb-6" />

          <h1 className="text-4xl font-bold text-white mb-4">
            결제가 완료되었습니다!
          </h1>

          <p className="text-xl text-slate-300 mb-8">
            EnergyAI를 이용해주셔서 감사합니다.
            <br />
            이제 모든 기능을 사용하실 수 있습니다.
          </p>

          {sessionId && (
            <div className="mb-8 p-4 bg-slate-900 border border-slate-700 rounded-lg">
              <p className="text-sm text-slate-400">
                결제 ID: <code className="text-emerald-400">{sessionId}</code>
              </p>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">
              다음 단계
            </h3>
            <ul className="text-left space-y-3 mb-8">
              <li className="flex items-start gap-3 text-slate-300">
                <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>대시보드 설정:</strong> 첫 사이트와 디바이스를
                  추가하세요
                </span>
              </li>
              <li className="flex items-start gap-3 text-slate-300">
                <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>AI 기능 활성화:</strong> 부하 예측과 이상 탐지를
                  시작하세요
                </span>
              </li>
              <li className="flex items-start gap-3 text-slate-300">
                <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>팀 초대:</strong> 팀원을 초대하고 역할을 설정하세요
                </span>
              </li>
            </ul>
          </div>

          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/dashboard">
              <Button
                size="lg"
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                <Home className="mr-2 w-5 h-5" />
                대시보드로 이동
              </Button>
            </Link>
            <Link href="/docs">
              <Button size="lg" variant="outline">
                시작 가이드 보기
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>

          <div className="mt-8 p-4 bg-slate-900/50 border border-slate-700 rounded-lg">
            <p className="text-sm text-slate-400">
              문의사항이 있으시면{' '}
              <Link
                href="/support"
                className="text-emerald-400 hover:text-emerald-300"
              >
                고객센터
              </Link>
              로 연락주세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
