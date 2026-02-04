// app/web/components/layout/Header.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Bell, User, LogOut, Settings, ChevronDown } from 'lucide-react';

export default function Header() {
  const router = useRouter();
  const { data: session } = useSession();
  const [showDropdown, setShowDropdown] = useState(false);
  const [notificationCount, _setNotificationCount] = useState(0);

  const user = session?.user;

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/login');
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      super_admin: '슈퍼 관리자',
      tenant_admin: '테넌트 관리자',
      site_manager: '사이트 관리자',
      operator: '운영자',
      viewer: '조회자',
    };
    return labels[role] || role;
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between">
      {/* 왼쪽: 테넌트 정보 */}
      <div>
        {user && (
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              Energy Management
            </h2>
            <p className="text-sm text-gray-500">
              Energy Management System
            </p>
          </div>
        )}
      </div>

      {/* 오른쪽: 알림 & 사용자 */}
      <div className="flex items-center gap-4">
        {/* 알림 */}
        <button className="relative p-2 rounded-full hover:bg-gray-100 transition-colors">
          <Bell className="w-5 h-5 text-gray-600" />
          {notificationCount > 0 && (
            <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {notificationCount}
            </span>
          )}
        </button>

        {/* 사용자 드롭다운 */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="text-left">
              <div className="text-sm font-medium text-gray-800">
                {user?.name}
              </div>
              <div className="text-xs text-gray-500">
                {user && getRoleLabel(user.role)}
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-600" />
          </button>

          {/* 드롭다운 메뉴 */}
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
              {/* 사용자 정보 */}
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-800">
                  {user?.name}
                </p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>

              {/* 메뉴 */}
              <button
                onClick={() => {
                  router.push('/settings/account');
                  setShowDropdown(false);
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <User className="w-4 h-4" />
                <span>계정 설정</span>
              </button>

              <button
                onClick={() => {
                  router.push('/settings');
                  setShowDropdown(false);
                }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Settings className="w-4 h-4" />
                <span>환경 설정</span>
              </button>

              <div className="border-t border-gray-100 mt-1"></div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" />
                <span>로그아웃</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 드롭다운 닫기 (외부 클릭) */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </header>
  );
}