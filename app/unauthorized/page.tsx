/**
 * 403 Unauthorized Page
 * 권한이 없는 페이지/기능 접근 시 표시
 */

import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-900 to-gray-900">
      <div className="text-center px-6 max-w-2xl">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-yellow-500/20 mb-6">
            <svg
              className="w-12 h-12 text-yellow-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>

          <h1 className="text-5xl font-bold text-white mb-4">
            접근 권한이 없습니다
          </h1>
        </div>

        <p className="text-gray-300 mb-8">
          요청하신 페이지나 기능에 접근할 권한이 없습니다.
          <br />
          권한이 필요한 경우 관리자에게 문의하세요.
        </p>

        <div className="flex gap-4 justify-center">
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
          >
            대시보드로 이동
          </Link>
          <Link
            href="/"
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            홈으로 이동
          </Link>
        </div>
      </div>
    </div>
  );
}
