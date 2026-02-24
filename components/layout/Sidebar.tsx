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

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { UserRole } from '@prisma/client';
import {
  Link2,
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
  BookOpen,
  Star,
  X,
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

interface FavoriteItem {
  menuItemId: string;
  displayOrder: number;
  menuItem: {
    id: string;
    code: string;
    name: string;
    icon: string | null;
    path: string | null;
  };
}

interface SidebarProps {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
}

// 5-섹션 분류: 그룹 code → 섹션 레이블
const SIDEBAR_SECTIONS: Record<string, string> = {
  dashboard:  '운영 현황',
  monitoring: '운영 현황',
  analytics:  '분석 & 예측',
  control:    '설비 제어',
  alerts:     '운영 관리',
  management: '운영 관리',
  compliance: '운영 관리',
  settings:   '운영 관리',
  admin:      '시스템',
};

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
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
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

  // 즐겨찾기 조회
  const fetchFavorites = useCallback(async () => {
    try {
      const res = await fetch('/api/favorites');
      const json = await res.json();
      if (json.success) setFavorites(json.data.favorites ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') fetchFavorites();
  }, [status, fetchFavorites]);

  const toggleFavorite = async (item: MenuItem) => {
    const isFav = favorites.some((f) => f.menuItemId === item.id);
    if (isFav) {
      // 즐겨찾기 삭제
      setFavorites((prev) => prev.filter((f) => f.menuItemId !== item.id));
      try {
        const csrfToken = document.cookie.match(/csrf-token=([^;]+)/)?.[1] ?? '';
        await fetch(`/api/favorites?menuItemId=${item.id}`, {
          method: 'DELETE',
          headers: { 'x-csrf-token': csrfToken },
        });
      } catch { /* ignore */ }
    } else {
      // 즐겨찾기 추가 (낙관적 업데이트)
      const newFav: FavoriteItem = {
        menuItemId: item.id,
        displayOrder: favorites.length,
        menuItem: { id: item.id, code: item.code, name: item.name, icon: item.icon, path: item.path },
      };
      setFavorites((prev) => [...prev, newFav]);
      try {
        const csrfToken = document.cookie.match(/csrf-token=([^;]+)/)?.[1] ?? '';
        const res = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
          body: JSON.stringify({ menuItemId: item.id }),
        });
        const json = await res.json();
        if (!json.success) {
          // 롤백
          setFavorites((prev) => prev.filter((f) => f.menuItemId !== item.id));
        }
      } catch {
        setFavorites((prev) => prev.filter((f) => f.menuItemId !== item.id));
      }
    }
  };

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
        // hover로 일시 확장 시: absolute 오버레이로 콘텐츠를 밀지 않음
        collapsed && isHovering
          ? 'absolute left-0 top-0 z-50 shadow-2xl shadow-black/70'
          : 'relative',
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
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 flex-shrink-0">
            <Link2 className="w-6 h-6 text-white" />
          </div>
          {!effectiveCollapsed && (
            <div>
              <h1 className="text-base font-bold text-white leading-tight">탄소이음</h1>
              <p className="text-[10px] text-slate-500 leading-tight">
                에너지 데이터로 세상을 잇다
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
        {/* 즐겨찾기 섹션 */}
        {!effectiveCollapsed && favorites.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-2 mx-2 mb-2">
              <div className="flex-1 h-px bg-slate-700/50" />
              <span className="text-[10px] text-amber-500/70 uppercase tracking-wider font-medium whitespace-nowrap flex items-center gap-1">
                <Star className="w-3 h-3" />
                즐겨찾기
              </span>
              <div className="flex-1 h-px bg-slate-700/50" />
            </div>
            <div className="space-y-0.5">
              {favorites.map((fav) => {
                const isActive = pathname === fav.menuItem.path;
                const FavIcon = getIcon(fav.menuItem.icon || 'Activity');
                return (
                  <div
                    key={fav.menuItemId}
                    className="flex items-center group"
                    onMouseEnter={() => setHoveredItemId(fav.menuItemId)}
                    onMouseLeave={() => setHoveredItemId(null)}
                  >
                    <Link
                      href={fav.menuItem.path || '#'}
                      className={cn(
                        'flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all',
                        isActive
                          ? 'bg-amber-500/15 text-amber-400 font-medium'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      )}
                    >
                      <FavIcon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-400')} />
                      <span className="truncate">{fav.menuItem.name}</span>
                    </Link>
                    {hoveredItemId === fav.menuItemId && (
                      <button
                        onClick={() => toggleFavorite({
                          id: fav.menuItemId,
                          code: fav.menuItem.code,
                          name: fav.menuItem.name,
                          icon: fav.menuItem.icon,
                          path: fav.menuItem.path,
                          displayOrder: fav.displayOrder,
                          minRole: 'viewer' as UserRole,
                        })}
                        className="p-1.5 mr-1 text-amber-400/60 hover:text-amber-400 transition"
                        title="즐겨찾기 해제"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

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

              // 5-섹션 구분
              const currentSection = SIDEBAR_SECTIONS[group.code] ?? '운영 관리';
              const prevSection = index > 0
                ? (SIDEBAR_SECTIONS[filteredGroups[index - 1]!.code] ?? '운영 관리')
                : null;
              const showSectionLabel = prevSection !== currentSection;

              return (
                <div key={group.id}>
                  {/* 섹션 레이블 / 구분선 */}
                  {showSectionLabel && !effectiveCollapsed && (
                    <div className={cn('mx-2', index === 0 ? 'mb-2' : 'my-3')}>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-px bg-slate-700/50" />
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium whitespace-nowrap">
                          {currentSection}
                        </span>
                        <div className="flex-1 h-px bg-slate-700/50" />
                      </div>
                    </div>
                  )}
                  {showSectionLabel && effectiveCollapsed && index > 0 && (
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
                        const isFav = favorites.some((f) => f.menuItemId === item.id);

                        return (
                          <div
                            key={item.id}
                            className="flex items-center group"
                            onMouseEnter={() => setHoveredItemId(item.id)}
                            onMouseLeave={() => setHoveredItemId(null)}
                          >
                            <Link
                              href={item.path || '#'}
                              className={cn(
                                'flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all',
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
                            {/* 즐겨찾기 버튼 (hover 시 표시) */}
                            {(hoveredItemId === item.id || isFav) && (
                              <button
                                onClick={() => toggleFavorite(item)}
                                className={cn(
                                  'p-1.5 mr-0.5 transition opacity-0 group-hover:opacity-100',
                                  isFav
                                    ? 'text-amber-400 opacity-100'
                                    : 'text-slate-500 hover:text-amber-400'
                                )}
                                title={isFav ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                              >
                                <Star className={cn('w-3.5 h-3.5', isFav ? 'fill-amber-400' : '')} />
                              </button>
                            )}
                          </div>
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

      {/* 하단 고정: 매뉴얼 링크 */}
      <div className="border-t border-slate-700/50 px-2 pt-2">
        <Link
          href="/manual"
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
            pathname === '/manual'
              ? 'bg-cyan-500/10 text-cyan-400'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
            effectiveCollapsed ? 'justify-center' : ''
          )}
          title={effectiveCollapsed ? '사용자 매뉴얼' : undefined}
        >
          <BookOpen className="w-4 h-4 flex-shrink-0" />
          {!effectiveCollapsed && <span>사용자 매뉴얼</span>}
        </Link>
      </div>

      {/* 하단: 접기/펴기 버튼 */}
      <div className="p-2">
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
