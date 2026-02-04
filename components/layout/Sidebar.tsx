// app/web/components/layout/Sidebar.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { UserRole } from '@prisma/client';
import { Zap, ChevronDown, Lock } from 'lucide-react';
import { iconMap } from './icon-map';

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

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['대시보드'])
  );
  const [menuGroups, setMenuGroups] = useState<MenuGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userRole = (session?.user?.role as UserRole) || ('viewer' as UserRole);

  // API에서 메뉴 조회
  useEffect(() => {
    console.log('[Sidebar] useEffect triggered:', {
      status,
      hasSession: !!session,
      hasUser: !!session?.user,
      userRole: session?.user?.role,
    });

    async function fetchMenus() {
      console.log('[Sidebar] fetchMenus called');
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/menus');
        console.log('[Sidebar] API response:', response.status);

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('인증이 필요합니다. 다시 로그인해주세요.');
          }
          throw new Error(`메뉴를 불러올 수 없습니다 (${response.status})`);
        }

        const data = await response.json();
        console.log('[Sidebar] API data:', data);

        if (!data.success || !data.data) {
          throw new Error('잘못된 응답 형식입니다.');
        }

        setMenuGroups(data.data);
        console.log('[Sidebar] Menus set successfully');
      } catch (error) {
        console.error('[Sidebar] Failed to fetch menus:', error);
        setError(error instanceof Error ? error.message : '메뉴를 불러올 수 없습니다.');
      } finally {
        setIsLoading(false);
      }
    }

    // 세션 로딩 중
    if (status === 'loading') {
      console.log('[Sidebar] Status is loading, waiting...');
      setIsLoading(true);
      return;
    }

    // 세션 없음 또는 미인증
    if (status === 'unauthenticated' || !session || !session.user) {
      console.log('[Sidebar] Not authenticated or no session/user');
      setIsLoading(false);
      setError('로그인이 필요합니다.');
      return;
    }

    // 인증됨 - 메뉴 조회
    if (status === 'authenticated' && session && session.user) {
      console.log('[Sidebar] Authenticated, fetching menus...');
      fetchMenus();
    }
  }, [session, status]);

  const toggleGroup = (groupName: string) => {
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
    <div className="w-64 bg-gray-900 text-white h-screen overflow-y-auto">
      {/* 로고 */}
      <div className="p-4 border-b border-gray-700">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Zap className="w-8 h-8 text-blue-500" />
          <span className="text-xl font-bold">EMS</span>
        </Link>
      </div>

      {/* 역할 뱃지 */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-2 text-sm">
          {userRole === 'viewer' && (
            <>
              <Lock className="w-4 h-4 text-gray-400" />
              <span className="text-gray-400">읽기 전용</span>
            </>
          )}
          {userRole === 'operator' && (
            <span className="px-2 py-1 bg-blue-600 rounded text-xs">운영자</span>
          )}
          {userRole === 'site_manager' && (
            <span className="px-2 py-1 bg-green-600 rounded text-xs">
              사이트 관리자
            </span>
          )}
          {userRole === 'tenant_admin' && (
            <span className="px-2 py-1 bg-purple-600 rounded text-xs">
              테넌트 관리자
            </span>
          )}
          {userRole === 'super_admin' && (
            <span className="px-2 py-1 bg-red-600 rounded text-xs">
              슈퍼 관리자
            </span>
          )}
        </div>
      </div>

      {/* 메뉴 그룹 */}
      <div className="p-4 space-y-2">
        {isLoading ? (
          <div className="text-center text-gray-400 py-8">메뉴 로딩 중...</div>
        ) : error ? (
          <div className="text-center text-red-400 py-8 px-4">
            <p className="text-sm mb-2">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-xs text-blue-400 hover:text-blue-300 underline"
            >
              새로고침
            </button>
          </div>
        ) : menuGroups.length === 0 ? (
          <div className="text-center text-gray-400 py-8 px-4">
            <p className="text-sm">메뉴가 없습니다.</p>
          </div>
        ) : (
          menuGroups.map((group) => {
            const isExpanded = expandedGroups.has(group.name);
            const GroupIcon = getIcon(group.icon || 'Activity');

            return (
              <div key={group.id}>
                {/* 그룹 헤더 */}
                <button
                  onClick={() => toggleGroup(group.name)}
                  className="w-full flex items-center justify-between p-2 rounded hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <GroupIcon className="w-5 h-5" />
                    <span className="font-medium">{group.name}</span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* 메뉴 아이템 */}
                {isExpanded && (
                  <div className="ml-4 mt-1 space-y-1">
                    {group.items.map((item) => {
                      const isActive = pathname === item.path;
                      const ItemIcon = getIcon(item.icon || 'Activity');

                      return (
                        <Link
                          key={item.id}
                          href={item.path || '#'}
                          className={`flex items-center gap-2 p-2 rounded text-sm transition-colors ${
                            isActive
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-300 hover:bg-gray-800'
                          }`}
                        >
                          <ItemIcon className="w-4 h-4" />
                          <span>{item.name}</span>
                          {item.badgeType && item.badgeType !== 'none' && (
                            <span className="ml-auto px-1.5 py-0.5 bg-green-500 text-xs rounded">
                              {item.badgeType}
                            </span>
                          )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
        )}
      </div>
    </div>
  );
}
