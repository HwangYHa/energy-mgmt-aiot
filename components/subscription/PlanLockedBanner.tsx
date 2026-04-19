'use client';

import { Lock, ArrowRight, Sparkles, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

// 코드레벨 planTier → 표시명
const PLAN_DISPLAY: Record<string, string> = {
  STARTER:      'Starter',
  BASIC:        'Starter',
  PROFESSIONAL: 'Business',
  PRO:          'Business',
  ENTERPRISE:   'Enterprise',
};

interface PlanLockedBannerProps {
  /** 서버에서 전달된 에러 메시지 (402 응답의 error 필드) */
  message: string;
  /** 이 기능을 사용하기 위한 최소 플랜 (예: 'PROFESSIONAL', 'STARTER') */
  requiredPlan?: string;
  /** 재시도 버튼 클릭 시 콜백 (없으면 버튼 미표시) */
  onRetry?: () => void;
  className?: string;
}

/**
 * 상위 플랜 필요 시 표시하는 앰버/골드 테마 배너.
 * 빨간 에러박스(일반 오류)와 시각적으로 구분되도록 설계.
 */
export function PlanLockedBanner({
  message,
  requiredPlan,
  onRetry,
  className,
}: PlanLockedBannerProps) {
  const planName = requiredPlan
    ? PLAN_DISPLAY[requiredPlan.toUpperCase()] ?? requiredPlan
    : null;

  return (
    <div
      className={cn(
        'rounded-xl border border-amber-500/30 bg-amber-500/5 p-6',
        className
      )}
    >
      <div className="flex items-start gap-4">
        {/* 아이콘 박스 */}
        <div className="p-3 bg-amber-500/15 rounded-xl flex-shrink-0">
          <Lock className="w-6 h-6 text-amber-400" />
        </div>

        {/* 본문 */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-amber-300">상위 플랜 필요</h3>

          <p className="text-sm text-slate-400 mt-2 leading-relaxed">{message}</p>

          {planName && (
            <p className="flex items-center gap-1.5 text-xs text-amber-500/70 mt-2">
              <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{planName} 플랜에서 사용 가능합니다</span>
            </p>
          )}

          {/* 버튼 영역 */}
          <div className="flex items-center gap-3 mt-5">
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-2 px-4 py-2 text-sm
                           border border-slate-700 text-slate-400 rounded-lg
                           hover:border-slate-600 hover:text-slate-300 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                재시도
              </button>
            )}
            <button
              onClick={() => { window.location.href = '/settings/subscription'; }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold
                         bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg
                         transition-colors"
            >
              플랜 업그레이드
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
