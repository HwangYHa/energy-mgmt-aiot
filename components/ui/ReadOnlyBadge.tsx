/**
 * 읽기 전용 배지 - Viewer 역할 안내
 * HMI 다크 테마 스타일
 */

import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReadOnlyBadgeProps {
  className?: string;
  message?: string;
}

export function ReadOnlyBadge({
  className,
  message = '이 페이지는 읽기 전용입니다. 수정 권한이 필요한 경우 관리자에게 문의하세요.',
}: ReadOnlyBadgeProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg',
        'bg-amber-500/10 border border-amber-500/20',
        className
      )}
    >
      <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
      <p className="text-sm text-amber-300">{message}</p>
    </div>
  );
}
