 'use client';

import { useEffect, useState } from 'react';
import { X, ArrowUpRight } from 'lucide-react';

interface UpgradeEventDetail {
  message?: string;
  upgradeUrl?: string;
}

export default function UpgradeModal() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [upgradeUrl, setUpgradeUrl] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent<UpgradeEventDetail>).detail || {};
      setMessage(d.message ?? '이 기능은 상위 플랜에서 제공됩니다. 업그레이드 하시겠습니까?');
      setUpgradeUrl(d.upgradeUrl ?? '/settings/subscription');
      setOpen(true);
    };

    window.addEventListener('ems:upgrade', handler as EventListener);
    return () => window.removeEventListener('ems:upgrade', handler as EventListener);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md z-10">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h3 className="text-lg font-semibold">업그레이드 필요</h3>
            <p className="text-sm text-slate-300 mt-2">{message}</p>
          </div>
          <button
            aria-label="닫기"
            onClick={() => setOpen(false)}
            className="text-slate-400 hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-6 flex gap-3 justify-end">
          <button
            onClick={() => setOpen(false)}
            className="px-4 py-2 rounded-md bg-slate-800 text-slate-300 border border-slate-700"
          >
            나중에
          </button>
          <button
            onClick={() => {
              if (upgradeUrl) window.location.href = upgradeUrl;
            }}
            className="px-4 py-2 rounded-md bg-cyan-500 text-white flex items-center gap-2"
          >
            업그레이드하기
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
