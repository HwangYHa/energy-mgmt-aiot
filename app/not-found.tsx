'use client';
/**
 * 404 Not Found Page
 * - App Router Server Component
 * - SaaS / Dashboard UX 최적화
 */

import Link from 'next/link';
import { Home, ArrowLeft, Search, LifeBuoy} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 px-6">
      <section
        aria-labelledby="not-found-title"
        className="w-full max-w-3xl text-center"
      >
        {/* 상태 표시 */}
        <div className="mb-10">
          <h1 className="text-9xl font-bold text-emerald-400 mb-4">404</h1>
          <h2 className="text-3xl font-bold text-white mb-4">
            페이지를 찾을 수 없습니다
          </h2>
          <p className="mt-6 text-lg text-slate-300 leading-relaxed">
            요청하신 주소가 존재하지 않거나,
            <br />
            접근 권한이 없는 페이지일 수 있습니다.
          </p>
        </div>

        {/* 주요 액션 */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          <Link href="/">
            <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600">
              <Home className="mr-2 h-5 w-5" />
              홈으로 이동
            </Button>
          </Link>

          <Button
            size="lg"
            variant="outline"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="mr-2 w-5 h-5" />
            이전 페이지
          </Button>
        </div>

        {/* 도움 영역 */}
        <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-8">
          <Search className="mx-auto mb-4 h-10 w-10 text-slate-400" />
          <h2 className="text-lg font-semibold text-white mb-2">
            찾으시는 정보가 없나요?
          </h2>
          <p className="text-slate-300 mb-6">
            아래 메뉴를 통해 도움을 받을 수 있습니다.
          </p>

          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <Link
              href="/faq"
              className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300"
            >
              <Search className="h-4 w-4" />
              FAQ
            </Link>
            <Link
              href="/support"
              className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300"
            >
              <LifeBuoy className="h-4 w-4" />
              고객센터
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
