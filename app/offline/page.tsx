'use client';

import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#040e1c] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* 아이콘 */}
        <div className="flex justify-center mb-8">
          <div className="w-24 h-24 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center">
            <WifiOff className="w-12 h-12 text-slate-400" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-white mb-3">오프라인 상태</h1>
        <p className="text-slate-400 mb-2">
          인터넷 연결이 끊겼습니다.
        </p>
        <p className="text-slate-500 text-sm mb-8">
          연결이 복구되면 자동으로 동기화됩니다.
        </p>

        {/* 연결 상태 표시기 */}
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-8 text-sm ${
          isOnline
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-slate-800 border-slate-700 text-slate-400'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
          {isOnline ? '인터넷 연결됨 — 새로고침해 주세요' : '연결 없음'}
        </div>

        {/* 버튼 */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-xl transition"
          >
            <RefreshCw className="w-4 h-4" />
            새로고침
          </button>
          <Link href="/dashboard">
            <button className="flex items-center justify-center gap-2 px-6 py-3 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-semibold rounded-xl transition w-full">
              <Home className="w-4 h-4" />
              대시보드로 이동
            </button>
          </Link>
        </div>

        {/* 브랜드 */}
        <p className="mt-12 text-xs text-slate-600">
          탄소이음 — 에너지 데이터로 세상을 잇다
        </p>
      </div>
    </div>
  );
}
