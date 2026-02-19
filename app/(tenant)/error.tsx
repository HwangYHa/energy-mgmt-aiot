'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function TenantError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[TenantError]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#051225] flex items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="p-4 bg-red-500/10 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
          <AlertTriangle className="w-10 h-10 text-red-400" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white">오류가 발생했습니다</h2>
          <p className="text-slate-400 text-sm">
            {error.message || '알 수 없는 오류가 발생했습니다.'}
          </p>
          {error.digest && (
            <p className="text-slate-600 text-xs font-mono">오류 코드: {error.digest}</p>
          )}
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            다시 시도
          </button>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition text-sm"
          >
            <Home className="w-4 h-4" />
            대시보드
          </Link>
        </div>
      </div>
    </div>
  );
}
