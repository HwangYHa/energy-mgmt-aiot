'use client';

/**
 * Global Error Boundary (최적화)
 * 500 Server Error 페이지
 */

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="text-center max-w-2xl">
        <AlertTriangle className="w-24 h-24 text-red-400 mx-auto mb-6" />

        <h1 className="text-4xl font-bold text-white mb-4">
          오류가 발생했습니다
        </h1>

        <p className="text-xl text-slate-300 mb-8">
          일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.
        </p>

        {isDev && error.message && (
          <div className="mb-8 p-4 bg-slate-800 border border-red-700 rounded-lg text-left">
            <p className="text-sm font-mono text-red-300 break-all mb-2">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-slate-400">
                Error ID: <code className="text-red-400">{error.digest}</code>
              </p>
            )}
          </div>
        )}

        {!isDev && error.digest && (
          <div className="mb-8 p-4 bg-slate-800 border border-slate-700 rounded-lg">
            <p className="text-sm text-slate-400">
              오류 코드: <code className="text-red-400">{error.digest}</code>
            </p>
          </div>
        )}

        <div className="flex gap-4 justify-center flex-wrap">
          <Button
            size="lg"
            onClick={reset}
            className="bg-emerald-500 hover:bg-emerald-600"
          >
            <RefreshCw className="mr-2 w-5 h-5" />
            다시 시도
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => (window.location.href = '/')}
          >
            <Home className="mr-2 w-5 h-5" />
            홈으로
          </Button>
        </div>

        <div className="mt-12 p-6 bg-slate-800 border border-slate-700 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-3">
            문제가 계속되나요?
          </h3>
          <p className="text-slate-300 mb-4">
            같은 오류가 반복되면 고객센터로 문의해주세요.
          </p>
          <a
            href="/support"
            className="text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            고객센터 문의 →
          </a>
        </div>
      </div>
    </div>
  );
}
