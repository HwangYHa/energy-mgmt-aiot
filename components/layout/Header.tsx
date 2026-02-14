/**
 * HMI Style Header Component
 *
 * 산업용 HMI + 현대적 SaaS UI/UX 결합
 * - 시스템 상태 즉시 확인
 * - 빠른 알림 접근
 * - 직관적인 사용자 메뉴
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  Bell,
  User,
  LogOut,
  Settings,
  ChevronDown,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SystemStatus {
  power: { value: number; unit: string; status: string };
  alerts: { critical: number; warning: number; info: number };
  devices: { online: number; offline: number };
}

interface HeaderProps {
  onMenuToggle?: () => void;
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    power: { value: 0, unit: 'kW', status: 'normal' },
    alerts: { critical: 0, warning: 0, info: 0 },
    devices: { online: 0, offline: 0 },
  });

  const fetchSystemStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/stats');
      if (!res.ok) return;
      const json = await res.json();
      const data = json.data;
      if (!data) return;

      setSystemStatus({
        power: {
          value: data.realtime?.currentPower ?? 0,
          unit: 'kW',
          status: (data.realtime?.peakRatio ?? 0) > 90 ? 'warning' : 'normal',
        },
        alerts: {
          critical: data.kpis?.equipmentRate < 80 ? 1 : 0,
          warning: data.devices?.error ?? 0,
          info: data.devices?.offline ?? 0,
        },
        devices: {
          online: data.devices?.online ?? 0,
          offline: (data.devices?.offline ?? 0) + (data.devices?.error ?? 0),
        },
      });
    } catch {
      // 네트워크 오류 시 기존 값 유지
    }
  }, []);

  useEffect(() => {
    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 30000); // 30초마다 갱신
    return () => clearInterval(interval);
  }, [fetchSystemStatus]);

  const user = session?.user;

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(
        new Date().toLocaleString('ko-KR', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

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

  const totalAlerts = systemStatus.alerts.critical + systemStatus.alerts.warning;

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-700/50 px-4 flex items-center justify-between relative z-50">
      {/* 좌측: 메뉴 토글 + 시스템 상태 */}
      <div className="flex items-center gap-4">
        {/* 메뉴 토글 버튼 */}
        <button
          onClick={onMenuToggle}
          className="p-2 rounded-lg hover:bg-slate-800 transition-colors lg:hidden"
          aria-label="메뉴 토글"
        >
          <Menu className="w-5 h-5 text-slate-400" />
        </button>

        {/* 시스템 상태 표시 */}
        <div className="hidden md:flex items-center gap-6">
          {/* 현재 전력 */}
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-cyan-500/10 rounded">
              <Zap className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">현재 전력</p>
              <p className="text-sm font-semibold text-white">
                {systemStatus.power.value}
                <span className="text-xs text-slate-400 ml-1">
                  {systemStatus.power.unit}
                </span>
              </p>
            </div>
          </div>

          {/* 구분선 */}
          <div className="h-8 w-px bg-slate-700" />

          {/* 장비 상태 */}
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500/10 rounded">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">장비 상태</p>
              <p className="text-sm font-semibold text-white">
                <span className="text-emerald-400">{systemStatus.devices.online}</span>
                <span className="text-slate-500 mx-1">/</span>
                <span className="text-slate-400">
                  {systemStatus.devices.online + systemStatus.devices.offline}
                </span>
                <span className="text-xs text-slate-500 ml-1">대</span>
              </p>
            </div>
          </div>

          {/* 구분선 */}
          <div className="h-8 w-px bg-slate-700" />

          {/* 현재 시간 */}
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-700/50 rounded">
              <Clock className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">현재 시간</p>
              <p
                className="text-sm font-mono text-slate-300"
                suppressHydrationWarning
              >
                {currentTime}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 우측: 알림 + 사용자 */}
      <div className="flex items-center gap-2">
        {/* 알림 버튼 */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowDropdown(false);
            }}
            className={cn(
              'relative p-2 rounded-lg transition-colors',
              showNotifications
                ? 'bg-slate-700'
                : 'hover:bg-slate-800'
            )}
            aria-label="알림"
          >
            <Bell className="w-5 h-5 text-slate-400" />
            {totalAlerts > 0 && (
              <span
                className={cn(
                  'absolute -top-1 -right-1 min-w-[18px] h-[18px] text-[10px] font-bold rounded-full flex items-center justify-center',
                  systemStatus.alerts.critical > 0
                    ? 'bg-red-500 text-white'
                    : 'bg-amber-500 text-white'
                )}
              >
                {totalAlerts}
              </span>
            )}
          </button>

          {/* 알림 드롭다운 */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                <h3 className="font-semibold text-white">알림</h3>
                <button className="text-xs text-cyan-400 hover:text-cyan-300">
                  모두 읽음
                </button>
              </div>

              {/* 알림 요약 */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-850 border-b border-slate-700">
                <div className="text-center p-2 bg-red-500/10 rounded border border-red-500/20">
                  <p className="text-lg font-bold text-red-400">
                    {systemStatus.alerts.critical}
                  </p>
                  <p className="text-[10px] text-red-300">긴급</p>
                </div>
                <div className="text-center p-2 bg-amber-500/10 rounded border border-amber-500/20">
                  <p className="text-lg font-bold text-amber-400">
                    {systemStatus.alerts.warning}
                  </p>
                  <p className="text-[10px] text-amber-300">주의</p>
                </div>
                <div className="text-center p-2 bg-cyan-500/10 rounded border border-cyan-500/20">
                  <p className="text-lg font-bold text-cyan-400">
                    {systemStatus.alerts.info}
                  </p>
                  <p className="text-[10px] text-cyan-300">정보</p>
                </div>
              </div>

              {/* 최근 알림 목록 */}
              <div className="max-h-64 overflow-y-auto">
                <div className="p-3 hover:bg-slate-700/50 border-l-2 border-red-500 cursor-pointer">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-white">생산 장비 오류</p>
                      <p className="text-xs text-slate-400">2분 전</p>
                    </div>
                  </div>
                </div>
                <div className="p-3 hover:bg-slate-700/50 border-l-2 border-amber-500 cursor-pointer">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-white">피크 시간 접근</p>
                      <p className="text-xs text-slate-400">15분 전</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 전체 보기 */}
              <div className="p-3 border-t border-slate-700">
                <button
                  onClick={() => {
                    router.push('/alerts');
                    setShowNotifications(false);
                  }}
                  className="w-full py-2 text-sm text-center text-cyan-400 hover:text-cyan-300 hover:bg-slate-700/50 rounded transition-colors"
                >
                  전체 알림 보기
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 구분선 */}
        <div className="h-8 w-px bg-slate-700 mx-1" />

        {/* 사용자 드롭다운 */}
        <div className="relative">
          <button
            onClick={() => {
              setShowDropdown(!showDropdown);
              setShowNotifications(false);
            }}
            className={cn(
              'flex items-center gap-2 p-2 rounded-lg transition-colors',
              showDropdown ? 'bg-slate-700' : 'hover:bg-slate-800'
            )}
          >
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-semibold text-sm">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-white leading-tight">
                {user?.name || '사용자'}
              </p>
              <p className="text-[10px] text-slate-400">
                {user && getRoleLabel(user.role)}
              </p>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
          </button>

          {/* 드롭다운 메뉴 */}
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden z-50">
              {/* 사용자 정보 */}
              <div className="px-4 py-3 bg-slate-850 border-b border-slate-700">
                <p className="font-medium text-white">{user?.name}</p>
                <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              </div>

              {/* 메뉴 */}
              <div className="py-1">
                <button
                  onClick={() => {
                    router.push('/settings/account');
                    setShowDropdown(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700/50 transition-colors"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  <span>계정 설정</span>
                </button>

                <button
                  onClick={() => {
                    router.push('/settings');
                    setShowDropdown(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700/50 transition-colors"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span>환경 설정</span>
                </button>
              </div>

              <div className="border-t border-slate-700" />

              <div className="py-1">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>로그아웃</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 드롭다운 닫기 (외부 클릭) */}
      {(showDropdown || showNotifications) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowDropdown(false);
            setShowNotifications(false);
          }}
        />
      )}
    </header>
  );
}
