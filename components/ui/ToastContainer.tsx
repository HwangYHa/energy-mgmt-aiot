'use client';

/**
 * components/ui/ToastContainer.tsx
 *
 * 전역 Toast 컨테이너 — app/(tenant)/layout.tsx에 한 번만 추가
 * lib/toast의 CustomEvent를 수신해 토스트를 렌더링합니다.
 *
 * 스타일: HMI 다크 테마 (slate-900 배경 기준)
 */

import { useEffect, useRef, useState } from 'react';
import { type ToastPayload, type ToastType, EVENT_NAME } from '@/lib/toast';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 flex-shrink-0" />,
  error:   <XCircle    className="w-5 h-5 flex-shrink-0" />,
  warn:    <AlertTriangle className="w-5 h-5 flex-shrink-0" />,
  info:    <Info       className="w-5 h-5 flex-shrink-0" />,
};

const STYLES: Record<ToastType, string> = {
  success: 'bg-emerald-900/90 border-emerald-600 text-emerald-100',
  error:   'bg-red-900/90    border-red-600    text-red-100',
  warn:    'bg-amber-900/90  border-amber-600  text-amber-100',
  info:    'bg-sky-900/90    border-sky-600    text-sky-100',
};

const ICON_STYLES: Record<ToastType, string> = {
  success: 'text-emerald-400',
  error:   'text-red-400',
  warn:    'text-amber-400',
  info:    'text-sky-400',
};

interface ToastItemState extends ToastPayload {
  exiting: boolean;
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItemState[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = (id: string) => {
    // 먼저 exiting 애니메이션 실행
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t))
    );
    // 애니메이션 후 제거 (300ms)
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const payload = (e as CustomEvent<ToastPayload>).detail;
      setToasts((prev) => [...prev.slice(-4), { ...payload, exiting: false }]);

      // 자동 제거 타이머
      const timer = setTimeout(() => dismiss(payload.id), payload.duration);
      timers.current.set(payload.id, timer);
    };

    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      for (const t of timers.current.values()) clearTimeout(t);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="알림"
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          className={[
            'flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm',
            'pointer-events-auto max-w-sm w-full text-sm',
            STYLES[toast.type],
            toast.exiting
              ? 'animate-fade-out-down opacity-0 translate-y-2'
              : 'animate-slide-in-up',
          ].join(' ')}
        >
          <span className={ICON_STYLES[toast.type]}>{ICONS[toast.type]}</span>
          <span className="flex-1 leading-snug">{toast.message}</span>
          <button
            onClick={() => {
              clearTimeout(timers.current.get(toast.id));
              timers.current.delete(toast.id);
              dismiss(toast.id);
            }}
            className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
