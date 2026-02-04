'use client';

/**
 * 404 Not Found 페이지 (최적화)
 */

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Home, ArrowLeft, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="text-center max-w-2xl">
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-emerald-400 mb-4">404</h1>
          <h2 className="text-3xl font-bold text-white mb-4">
            페이지를 찾을 수 없습니다
          </h2>
          <p className="text-xl text-slate-300">
            요청하신 페이지가 존재하지 않거나 이동되었습니다.
          </p>
        </div>

        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/">
            <Button size="lg" className="bg-emerald-500 hover:bg-emerald-600">
              <Home className="mr-2 w-5 h-5" />
              홈으로
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

        <div className="mt-12 p-6 bg-slate-800 border border-slate-700 rounded-lg">
          <Search className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-3">
            찾으시는 페이지가 없나요?
          </h3>
          <p className="text-slate-300 mb-4">
            FAQ나 문서를 확인하시거나 고객센터로 문의해주세요.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/faq"
              className="text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              FAQ 보기
            </Link>
            <Link
              href="/support"
              className="text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              고객센터
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
