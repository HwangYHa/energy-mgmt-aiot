import { Loader2 } from 'lucide-react';

/**
 * 테넌트 영역 기본 로딩 상태
 * Next.js App Router의 Suspense 경계로 자동 적용
 */
export default function TenantLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-slate-700" />
          <Loader2 className="w-12 h-12 text-cyan-400 animate-spin absolute inset-0" />
        </div>
        <p className="text-sm text-slate-400">로딩 중...</p>
      </div>
    </div>
  );
}
