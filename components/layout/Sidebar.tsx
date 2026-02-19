/**
 * HMI Style Sidebar Component
 *
 * 산업용 HMI + 현대적 SaaS UI/UX 결합
 * - 논리적 메뉴 그룹화
 * - 아이콘 + 텍스트 병행
 * - 접힘/펼침 상태에서도 기능 인지 가능
 * - 현재 위치가 명확히 드러나는 강조 처리
 */
'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { UserRole } from '@prisma/client';
import {
  Zap,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Lock,
  Shield,
  User,
  Crown,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { iconMap } from './icon-map';
import { cn } from '@/lib/utils';
import { hasRoleOrHigher } from '@/lib/constants/roles';

interface MenuItem {
  id: string;
  code: string;
  name: string;
  icon: string | null;
  path: string | null;
  displayOrder: number;
  minRole: UserRole;
  badgeType?: string;
  badgeColor?: string | null;
}

interface MenuGroup {
  id: string;
  code: string;
  name: string;
  icon: string | null;
  displayOrder: number;
  minRole: UserRole;
  items: MenuItem[];
}

interface SidebarProps {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
}

// 역할별 스타일 설정
const roleStyles: Record<
  string,
  { label: string; icon: typeof Lock; bg: string; text: string }
> = {
  viewer: {
    label: '조회자',
    icon: Lock,
    bg: 'bg-slate-600/20',
    text: 'text-slate-400',
  },
  operator: {
    label: '운영자',
    icon: User,
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
  },
  site_manager: {
    label: '사이트 관리자',
    icon: Shield,
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-400',
  },
  tenant_admin: {
    label: '테넌트 관리자',
    icon: Crown,
    bg: 'bg-purple-500/20',
    text: 'text-purple-400',
  },
  super_admin: {
    label: '슈퍼 관리자',
    icon: Crown,
    bg: 'bg-red-500/20',
    text: 'text-red-400',
  },
};

export default function Sidebar({
  collapsed = false,
  onCollapsedChange,
  className,
}: SidebarProps) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['대시보드'])
  );
  const [menuGroups, setMenuGroups] = useState<MenuGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // hover-to-expand: 접힌 상태에서 마우스 올리면 일시 확장
  const [isHovering, setIsHovering] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 실제 표시 상태: 외부 collapsed이지만 hover 중이면 펼친 것처럼 동작
  const effectiveCollapsed = collapsed && !isHovering;

  const userRole = (session?.user?.role as UserRole) || ('viewer' as UserRole);
  const roleStyle = roleStyles[userRole] ?? roleStyles.viewer;
  const RoleIcon = roleStyle?.icon ?? Lock;

  // RBAC: 역할 기반 메뉴 필터링
  const filteredGroups = menuGroups
    .filter((g) => hasRoleOrHigher(userRole, g.minRole))
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => hasRoleOrHigher(userRole, i.minRole)),
    }))
    .filter((g) => g.items.length > 0);

  // API에서 메뉴 조회
  useEffect(() => {
    async function fetchMenus() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/menus');

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('인증이 필요합니다.');
          }
          throw new Error(`메뉴를 불러올 수 없습니다`);
        }

        const data = await response.json();

        if (!data.success || !data.data) {
          throw new Error('잘못된 응답 형식입니다.');
        }

        setMenuGroups(data.data);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : '메뉴를 불러올 수 없습니다.'
        );
      } finally {
        setIsLoading(false);
      }
    }

    if (status === 'loading') {
      setIsLoading(true);
      return;
    }

    if (status === 'unauthenticated' || !session || !session.user) {
      setIsLoading(false);
      setError('로그인이 필요합니다.');
      return;
    }

    if (status === 'authenticated' && session && session.user) {
      fetchMenus();
    }
  // session 객체 참조 대신 안정적인 원시값(email)을 의존성으로 사용 → 무한 리렌더 방지
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.email, status]);

  // 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  // hover 핸들러: 약간의 딜레이로 의도치 않은 열림 방지
  const handleMouseEnter = () => {
    if (!collapsed) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setIsHovering(true), 150);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setIsHovering(false);
  };

  const toggleGroup = (groupName: string) => {
    if (effectiveCollapsed) return;
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupName)) {
        newSet.delete(groupName);
      } else {
        newSet.add(groupName);
      }
      return newSet;
    });
  };

  const getIcon = (iconName: string) => {
    return iconMap[iconName] || iconMap.Activity;
  };

  return (
    <aside
      className={cn(
        'h-screen bg-slate-900 border-r border-slate-700/50 flex flex-col transition-all duration-300',
        effectiveCollapsed ? 'w-16' : 'w-64',
        // 마우스 hover로 일시 확장된 경우 그림자 추가 (오버레이 느낌)
        collapsed && isHovering ? 'shadow-2xl shadow-black/60 z-50' : '',
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* 로고 영역 */}
      <div
        className={cn(
          'h-16 border-b border-slate-700/50 flex items-center',
          effectiveCollapsed ? 'justify-center px-2' : 'px-4'
        )}
      >
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Zap className="w-6 h-6 text-white" />
          </div>
          {!effectiveCollapsed && (
            <div>
              <h1 className="text-lg font-bold text-white">EMS</h1>
              <p className="text-[10px] text-slate-500 -mt-0.5">
                Energy Management
              </p>
            </div>
          )}
        </Link>
      </div>

      {/* 역할 뱃지 */}
      {!effectiveCollapsed && roleStyle && (
        <div className="px-4 py-3 border-b border-slate-700/50">
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg',
              roleStyle.bg
            )}
          >
            <RoleIcon className={cn('w-4 h-4', roleStyle.text)} />
            <span className={cn('text-sm font-medium', roleStyle.text)}>
              {roleStyle.label}
            </span>
          </div>
        </div>
      )}

      {/* 메뉴 영역 */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            {!effectiveCollapsed && <span className="text-sm">로딩 중...</span>}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-500 px-4">
            <AlertCircle className="w-6 h-6 text-red-400 mb-2" />
            {!effectiveCollapsed && (
              <>
                <p className="text-xs text-center text-red-400 mb-2">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                >
                  <RefreshCw className="w-3 h-3" />
                  새로고침
                </button>
              </>
            )}
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-500">
            {!effectiveCollapsed && <p className="text-sm">메뉴가 없습니다.</p>}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredGroups.map((group, index) => {
              const isExpanded = expandedGroups.has(group.name);
              const GroupIcon = getIcon(group.icon || 'Activity');
              const hasActiveItem = group.items.some(
                (item) => pathname === item.path
              );

              // 모니터링 / 관리 섹션 구분
              const monitoringCodes = ['dashboard', 'monitoring', 'analytics', 'carbon'];
              const isMonitoring = monitoringCodes.includes(group.code);
              const prevGroup = index > 0 ? filteredGroups[index - 1] : null;
              const prevIsMonitoring = prevGroup ? monitoringCodes.includes(prevGroup.code) : true;
              const showSectionDivider = !isMonitoring && prevIsMonitoring && index > 0;
              const showMonitoringLabel = isMonitoring && index === 0;

              return (
                <div key={group.id}>
                  {/* 모니터링 섹션 라벨 */}
                  {showMonitoringLabel && !effectiveCollapsed && (
                    <div className="mb-2 mx-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-px bg-slate-700/50" />
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">모니터링</span>
                        <div className="flex-1 h-px bg-slate-700/50" />
                      </div>
                    </div>
                  )}

                  {/* 섹션 구분선: 모니터링 → 관리 */}
                  {showSectionDivider && !effectiveCollapsed && (
                    <div className="my-3 mx-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-px bg-slate-700/50" />
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">관리</span>
                        <div className="flex-1 h-px bg-slate-700/50" />
                      </div>
                    </div>
                  )}
                  {showSectionDivider && effectiveCollapsed && (
                    <div className="my-2 mx-2 h-px bg-slate-700/50" />
                  )}

                  <div className="mb-2">
                  {/* 그룹 헤더 */}
                  <button
                    onClick={() => {
                      if (collapsed && !isHovering) {
                        // 완전히 접힌 상태(hover 없음)에서 클릭: 영구 확장
                        onCollapsedChange?.(false);
                      } else if (collapsed && isHovering) {
                        // hover로 일시 확장된 상태에서 클릭: 영구 확장 + 그룹 토글
                        onCollapsedChange?.(false);
                        setIsHovering(false);
                        toggleGroup(group.name);
                      } else {
                        // 일반 확장 상태: 그룹 토글
                        toggleGroup(group.name);
                      }
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all',
                      effectiveCollapsed ? 'justify-center' : 'justify-between',
                      hasActiveItem
                        ? 'bg-cyan-500/10 text-cyan-400'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    )}
                    title={effectiveCollapsed ? group.name : undefined}
                  >
                    <div className="flex items-center gap-3">
                      <GroupIcon
                        className={cn(
                          'w-5 h-5 flex-shrink-0',
                          hasActiveItem ? 'text-cyan-400' : ''
                        )}
                      />
                      {!effectiveCollapsed && (
                        <span className="font-medium text-sm">{group.name}</span>
                      )}
                    </div>
                    {!effectiveCollapsed && (
                      <ChevronDown
                        className={cn(
                          'w-4 h-4 transition-transform',
                          isExpanded ? 'rotate-180' : ''
                        )}
                      />
                    )}
                  </button>

                  {/* 메뉴 아이템 */}
                  {!effectiveCollapsed && isExpanded && (
                    <div className="mt-1 ml-3 pl-3 border-l border-slate-700/50 space-y-0.5">
                      {group.items.map((item) => {
                        const isActive = pathname === item.path;
                        const ItemIcon = getIcon(item.icon || 'Activity');

                        return (
                          <Link
                            key={item.id}
                            href={item.path || '#'}
                            className={cn(
                              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group',
                              isActive
                                ? 'bg-cyan-500/20 text-cyan-400 font-medium'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                            )}
                          >
                            <ItemIcon
                              className={cn(
                                'w-4 h-4 flex-shrink-0',
                                isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-400'
                              )}
                            />
                            <span className="truncate">{item.name}</span>
                            {item.badgeType && item.badgeType !== 'none' && (
                              <span
                                className={cn(
                                  'ml-auto px-1.5 py-0.5 text-[10px] rounded font-medium',
                                  item.badgeColor === 'red'
                                    ? 'bg-red-500/20 text-red-400'
                                    : item.badgeColor === 'yellow'
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'bg-emerald-500/20 text-emerald-400'
                                )}
                              >
                                {item.badgeType}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </nav>

      {/* 하단: 접기/펴기 버튼 */}
      <div className="border-t border-slate-700/50 p-2">
        <button
          onClick={() => {
            // hover로 일시 확장 중이면 hover 해제 후 영구 상태 토글
            setIsHovering(false);
            onCollapsedChange?.(!collapsed);
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          title={effectiveCollapsed ? '펼치기' : '접기'}
        >
          {effectiveCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              {!collapsed && <span className="text-sm">접기</span>}
              {collapsed && isHovering && <span className="text-sm">고정</span>}
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
