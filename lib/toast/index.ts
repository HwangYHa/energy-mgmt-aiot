/**
 * lib/toast/index.ts — 전역 Toast 알림 API
 *
 * CustomEvent 기반 — React Context 불필요
 * 어디서든 import하여 사용:
 *   import { toast } from '@/lib/toast';
 *   toast.success('저장되었습니다');
 *   toast.error('오류가 발생했습니다');
 */

export type ToastType = 'success' | 'error' | 'warn' | 'info';

export interface ToastPayload {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

const EVENT_NAME = 'ems:toast';

function fire(type: ToastType, message: string, duration: number): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<ToastPayload>(EVENT_NAME, {
      detail: { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, message, duration },
    })
  );
}

export const toast = {
  /** 성공 알림 (기본 3초) */
  success: (message: string, duration = 3000) => fire('success', message, duration),
  /** 오류 알림 (기본 5초) */
  error: (message: string, duration = 5000) => fire('error', message, duration),
  /** 경고 알림 (기본 4초) */
  warn: (message: string, duration = 4000) => fire('warn', message, duration),
  /** 정보 알림 (기본 3초) */
  info: (message: string, duration = 3000) => fire('info', message, duration),
};

export { EVENT_NAME };
