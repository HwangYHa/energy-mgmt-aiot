/**
 * SidebarRoleBadge.tsx
 *
 * SessionProvider가 서버→클라이언트로 동일한 session 스냅샷을 주입하므로
 * useSession()은 SSR과 클라이언트 첫 렌더에서 동일한 값을 반환한다.
 * 따라서 별도 guard 없이 useSession()을 직접 사용해도 hydration mismatch 없음.
 *
 * DOM 구조 일관성:
 *  - collapsed → null (구조 자체 없음)
 *  - 인증 전/role 없음 → 플레이스홀더 구조 (투명 텍스트)
 *  - 인증 완료 → 실제 역할 배지
 */
'use client';

import { useSession } from 'next-auth/react';
import { Lock, User, Shield, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

const ROLE_STYLES: Record<
  string,
  { label: string; icon: typeof Lock; bg: string; text: string }
> = {
  viewer:       { label: '조회자',        icon: Lock,   bg: 'bg-slate-600/20',  text: 'text-slate-400'   },
  operator:     { label: '운영자',        icon: User,   bg: 'bg-blue-500/20',   text: 'text-blue-400'    },
  site_manager: { label: '사이트 관리자', icon: Shield, bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  tenant_admin: { label: '테넌트 관리자', icon: Crown,  bg: 'bg-purple-500/20', text: 'text-purple-400'  },
  super_admin:  { label: '슈퍼 관리자',   icon: Crown,  bg: 'bg-red-500/20',    text: 'text-red-400'     },
};

interface SidebarRoleBadgeProps {
  effectiveCollapsed: boolean;
}

export default function SidebarRoleBadge({ effectiveCollapsed }: SidebarRoleBadgeProps) {
  const { data: session, status } = useSession();

  // 렌더링 안정성: 서버/클라이언트 모두 동일한 DOM 구조를 반환합니다.
  // - collapsed인 경우에는 아무 것도 표시하지 않음
  // - role 정보가 없거나 인증 전에는 플레이스홀더(투명 텍스트/아이콘)를 보여주어
  //   하이드레이션 시 DOM 불일치가 발생하지 않도록 합니다.
  if (effectiveCollapsed) return null;

  const role = status === 'authenticated' && session?.user?.role ? (session.user.role as string) : null;
  const roleStyle = role ? ROLE_STYLES[role] : null;
  const RoleIcon = roleStyle?.icon ?? Lock;

  return (
    <div className="px-4 py-3 border-b border-slate-700/50">
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
          // 실제 roleStyle이 있으면 그 색상 사용, 없으면 서버에서 보일 플레이스홀더 배경
          roleStyle ? roleStyle.bg : 'bg-slate-600/20'
        )}
      >
        <RoleIcon className={cn('w-4 h-4', roleStyle ? roleStyle.text : 'text-transparent')} />
        <span className={cn('text-sm font-medium', roleStyle ? roleStyle.text : 'text-transparent')}>
          {roleStyle ? roleStyle.label : '\u00A0'}
        </span>
      </div>
    </div>
  );
}
