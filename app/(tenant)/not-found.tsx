'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home, ArrowLeft } from 'lucide-react';

export default function TenantNotFound() {
  const router = useRouter();

  return (
    <div className="h-full bg-[#051225] flex items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-md">
        <p className="text-8xl font-bold text-slate-700 leading-none">404</p>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white">페이지를 찾을 수 없습니다</h2>
          <p className="text-slate-400 text-sm">
            요청하신 페이지가 존재하지 않거나 이동되었습니다.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition text-sm"
          >
            <Home className="w-4 h-4" />
            대시보드로 이동
          </Link>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            이전 페이지
          </button>
        </div>
      </div>
    </div>
  );
}
