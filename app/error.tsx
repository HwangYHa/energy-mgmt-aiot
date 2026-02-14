'use client';

/**
 * Global Error Boundary
 * - 500 / Runtime Error Page
 * - SaaS / Dashboard UX 최적화
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, Home, RefreshCw, LifeBuoy } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDev = process.env.NODE_ENV === 'development';

  useEffect(() => {
    // 🔐 실제 운영에서는 Sentry / OTEL 연동 지점
    console.error('[Global Error]', error);
  }, [error]);

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 px-6"
      role="alert"
      aria-live="assertive"
    >
      <section className="w-full max-w-2xl text-center">
        {/* 아이콘 */}
        <AlertTriangle className="mx-auto mb-6 h-24 w-24 text-red-400" />

        {/* 메시지 */}
        <h1 className="text-4xl font-bold text-white mb-4">
          시스템 오류가 발생했습니다
        </h1>

        <p className="text-lg text-slate-300 mb-10 leading-relaxed">
          일시적인 서버 문제로 요청을 처리하지 못했습니다.
          <br />
          잠시 후 다시 시도해 주세요.
        </p>

        {/* 개발 환경 전용 정보 */}
        {isDev && (
          <div className="mb-8 rounded-lg border border-red-700 bg-slate-800 p-4 text-left">
            <p className="mb-2 break-all font-mono text-sm text-red-300">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-slate-400">
                Error ID: <code className="text-red-400">{error.digest}</code>
              </p>
            )}
          </div>
        )}

        {/* 운영 환경 식별자 */}
        {!isDev && error.digest && (
          <div className="mb-8 rounded-lg border border-slate-700 bg-slate-800 p-4">
            <p className="text-sm text-slate-400">
              오류 코드:&nbsp;
              <code className="text-red-400">{error.digest}</code>
            </p>
          </div>
        )}

        {/* 주요 액션 */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          <Button
            size="lg"
            onClick={reset}
            className="bg-emerald-500 hover:bg-emerald-600"
          >
            <RefreshCw className="mr-2 h-5 w-5" />
            다시 시도
          </Button>

          <Link href="/">
            <Button size="lg" variant="outline">
              <Home className="mr-2 h-5 w-5" />
              홈으로 이동
            </Button>
          </Link>
        </div>

        {/* 도움 영역 */}
        <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-6">
          <h2 className="mb-3 text-lg font-semibold text-white">
            문제가 계속 발생하나요?
          </h2>
          <p className="mb-4 text-slate-300">
            동일한 오류가 반복되면 고객센터로 문의해 주세요.
          </p>

          <Link
            href="/support"
            className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300"
          >
            <LifeBuoy className="h-4 w-4" />
            고객센터 문의
          </Link>
        </div>
      </section>
    </div>
  );
}
