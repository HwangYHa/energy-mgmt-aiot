/**
 * HMI Style Header Component
 *
 * 산업용 HMI + 현대적 SaaS UI/UX 결합
 * - 시스템 상태 즉시 확인
 * - 빠른 알림 접근 (실제 notification_log 기반 /api/alerts)
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
  AlertCircle,
  Info,
  CheckCircle,
  Clock,
  Menu,
  Loader2,
  Headset
} from 'lucide-react';
import { cn } from '@/lib/utils';
// ⭐ GET 요청에는 CSRF 불필요 — fetchWithCsrf는 POST/PUT/DELETE/PATCH 전용
//    새로고침 시 globalCsrfToken 캐시가 초기화되어 /api/security/csrf 재호출 → 지연/실패 유발

interface AlertCounts {
  critical: number;
  warning: number;
  info: number;
  total: number;
}

interface RecentAlert {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  rule: { name: string; category: string; severity: string } | null;
}

interface AlertsSummary {
  counts: AlertCounts;
  recent: RecentAlert[];
}

interface HeaderProps {
  onMenuToggle?: () => void;
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const router = useRouter();
  // status: 'loading' | 'authenticated' | 'unauthenticated'
  // ⭐ data만 구독하면 session.user.email이 undefined/''일 때 트리거가 불가능해지므로
  //    status를 함께 구독 → 세션 확인 여부를 원시값(string)으로 판별
  const { data: session, status } = useSession();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  const [power, setPower]     = useState({ value: 0, unit: 'kW', status: 'normal' });
  const [devices, setDevices] = useState({ online: 0, offline: 0 });
  const [alertsSummary, setAlertsSummary] = useState<AlertsSummary>({
    counts: { critical: 0, warning: 0, info: 0, total: 0 },
    recent: [],
  });
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsFetchedOnce, setAlertsFetchedOnce] = useState(false);

  // 전력/장비 상태 — /api/dashboard/stats
  const fetchSystemStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/stats', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      const data = json.data;
      if (!data) return;
      setPower({
        value:  data.realtime?.currentPower ?? 0,
        unit:   'kW',
        status: (data.realtime?.peakRatio ?? 0) > 90 ? 'warning' : 'normal',
      });
      setDevices({
        online:  data.devices?.online ?? 0,
        offline: (data.devices?.offline ?? 0) + (data.devices?.error ?? 0),
      });
    } catch {
      // 오류 시 기존 값 유지
    }
  }, []);

  // 알림 요약 — /api/alerts?summary=true&days=7
  // ⚠️ useCallback 의존성은 빈 배열로 안정적 참조 유지
  //    (state setter는 React가 안정성을 보장하므로 클로저에 캡처해도 안전)
  const fetchAlertsSummary = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const url = '/api/alerts?summary=true&days=7';

      // Retry logic: sometimes session cookie / auth is not immediately
      // available on first client fetch after a hard refresh. Retry a
      // couple times on 401/403 before giving up.
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          res = await fetch(url, { credentials: 'include', cache: 'no-store' });
        } catch (e) {
          console.warn('[Header] fetchAlertsSummary fetch error', e);
          res = null;
        }

        if (!res) {
          // network error, small backoff
          await new Promise((r) => setTimeout(r, 300));
          continue;
        }

        if (res.ok) break;

        if (res.status === 401 || res.status === 403) {
          // possible transient auth race after refresh — retry after short delay
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 500));
            continue;
          }
          console.warn('[Header] alerts API unauthorized', res.status);
          // fallthrough to final handling
          break;
        }

        // other non-ok status: stop retrying
        console.warn('[Header] alerts API error:', res.status);
        break;
      }

      if (!res) return;

      if (!res.ok) return;

      const json = await res.json();
      if (json.success && json.data) {
        setAlertsSummary(json.data as AlertsSummary);
      }
      setAlertsFetchedOnce(true);
    } catch (err) {
      console.error('[Header] fetchAlertsSummary error', err);
    } finally {
      setAlertsLoading(false);
    }
  }, []); // ← 빈 배열: 안정적인 참조(stable reference) 유지

  // 시스템 상태 폴링 — 세션 무관, 항상 실행
  useEffect(() => {
    fetchSystemStatus();
    const t = setInterval(fetchSystemStatus, 30_000);
    return () => clearInterval(t);
  }, [fetchSystemStatus]);

  // 알림 폴링 — status === 'authenticated' 이후에만 실행
  // ⭐ 핵심 수정: session?.user?.email 대신 status 문자열 상수를 의존성으로 사용
  //   - email은 NextAuth JWT 구성에 따라 undefined 또는 '' (빈 문자열, falsy)일 수 있음
  //   - status는 'loading' | 'authenticated' | 'unauthenticated' 중 하나로 항상 신뢰 가능
  //   - 새로고침 후 session loading → authenticated 전환 시 정확히 1회 트리거
  useEffect(() => {
    if (status !== 'authenticated') return; // 로딩 중 or 미인증 skip
    fetchAlertsSummary();
    const t = setInterval(fetchAlertsSummary, 30_000);
    return () => clearInterval(t);
  }, [status, fetchAlertsSummary]);

  const user = session?.user;

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(
        new Date().toLocaleString('ko-KR', {
          month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
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
      super_admin:   '슈퍼 관리자',
      tenant_admin:  '테넌트 관리자',
      site_manager:  '사이트 관리자',
      operator:      '운영자',
      viewer:        '조회자',
    };
    return labels[role] || role;
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />;
      case 'warning':  return <AlertCircle   className="w-4 h-4 text-amber-400 flex-shrink-0" />;
      default:         return <Info          className="w-4 h-4 text-blue-400 flex-shrink-0" />;
    }
  };

  const getSeverityBorderColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-l-red-500';
      case 'warning':  return 'border-l-amber-500';
      default:         return 'border-l-blue-500';
    }
  };

  const timeAgo = (iso: string) => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1)  return '방금 전';
    if (mins < 60) return `${mins}분 전`;
    const h = Math.floor(mins / 60);
    if (h < 24)    return `${h}시간 전`;
    return `${Math.floor(h / 24)}일 전`;
  };

  const { counts, recent } = alertsSummary;
  const totalAlerts = counts.critical + counts.warning;

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-700/50 px-4 flex items-center justify-between relative z-50">
      {/* 좌측: 메뉴 토글 + 시스템 상태 */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="p-2 rounded-lg hover:bg-slate-800 transition-colors lg:hidden"
          aria-label="메뉴 토글"
        >
          <Menu className="w-5 h-5 text-slate-400" />
        </button>

        <div className="hidden md:flex items-center gap-6">
          {/* 현재 전력 */}
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-cyan-500/10 rounded">
              <Zap className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">현재 전력</p>
              <p className="text-sm font-semibold text-white">
                {power.value}
                <span className="text-xs text-slate-400 ml-1">{power.unit}</span>
              </p>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-700" />

          {/* 장비 상태 */}
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500/10 rounded">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">장비 상태</p>
              <p className="text-sm font-semibold text-white">
                <span className="text-emerald-400">{devices.online}</span>
                <span className="text-slate-500 mx-1">/</span>
                <span className="text-slate-400">{devices.online + devices.offline}</span>
                <span className="text-xs text-slate-500 ml-1">대</span>
              </p>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-700" />

          {/* 현재 시간 */}
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-700/50 rounded">
              <Clock className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500">현재 시간</p>
              <p className="text-sm font-mono text-slate-300" suppressHydrationWarning>
                {currentTime}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 우측: 알림 + 사용자 */}
      <div className="flex items-center gap-2">
        {/* 알림 벨 버튼 */}
        <div className="relative">
          <button
            onClick={() => {
              const next = !showNotifications;
              setShowNotifications(next);
              setShowDropdown(false);
              if (next) fetchAlertsSummary(); // 열 때 최신 데이터 갱신
            }}
            className={cn(
              'relative p-2 rounded-lg transition-colors',
              showNotifications ? 'bg-slate-700' : 'hover:bg-slate-800'
            )}
            aria-label="알림"
          >
            <Bell className="w-5 h-5 text-slate-400" />
            {totalAlerts > 0 && (
              <span
                className={cn(
                  'absolute -top-1 -right-1 min-w-[18px] h-[18px] text-[10px] font-bold rounded-full flex items-center justify-center',
                  counts.critical > 0 ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
                )}
              >
                {totalAlerts > 99 ? '99+' : totalAlerts}
              </span>
            )}
          </button>

          {/* 알림 드롭다운 */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden z-50">
              {/* 드롭다운 헤더 */}
              <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                <h3 className="font-semibold text-white text-sm flex items-center">
                  알림 (최근 7일)
                  {alertsLoading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin ml-2" />}
                </h3>
                <button
                  onClick={() => { router.push('/alerts'); setShowNotifications(false); }}
                  className="text-xs text-cyan-400 hover:text-cyan-300"
                >
                  전체 보기
                </button>
              </div>

              {/* 심각도별 카운트 */}
              <div className="grid grid-cols-3 gap-2 p-3 border-b border-slate-700">
                <div className="text-center p-2 bg-red-500/10 rounded border border-red-500/20">
                  <p className="text-lg font-bold text-red-400">{counts.critical}</p>
                  <p className="text-[10px] text-red-300">긴급</p>
                </div>
                <div className="text-center p-2 bg-amber-500/10 rounded border border-amber-500/20">
                  <p className="text-lg font-bold text-amber-400">{counts.warning}</p>
                  <p className="text-[10px] text-amber-300">경고</p>
                </div>
                <div className="text-center p-2 bg-cyan-500/10 rounded border border-cyan-500/20">
                  <p className="text-lg font-bold text-cyan-400">{counts.info}</p>
                  <p className="text-[10px] text-cyan-300">정보</p>
                </div>
              </div>

              {/* 최근 알림 목록 (최대 5건) */}
              <div className="max-h-64 overflow-y-auto">
                {/* ⭐ 로딩 상태 구분:
                    - status==='loading': 세션 확인 중 (새로고침 직후) → 스피너
                    - alertsLoading: 세션 확인 완료 후 API fetch 중 → 스피너
                    - 위 두 경우 모두 "로드 중" 표시 (이전엔 "실패"로 오인 가능했음)
                */}
                {(status === 'loading' || alertsLoading) ? (
                  <div className="py-8 text-center">
                    <Loader2 className="w-6 h-6 text-slate-500 mx-auto mb-2 animate-spin" />
                    <p className="text-xs text-slate-500">알림 로드 중...</p>
                  </div>
                ) : recent.length > 0 ? (
                  recent.map((alert) => (
                    <div
                      key={alert.id}
                      onClick={() => { router.push('/alerts'); setShowNotifications(false); }}
                      className={cn(
                        'px-4 py-3 hover:bg-slate-700/50 border-l-2 cursor-pointer transition-colors',
                        getSeverityBorderColor(alert.rule?.severity ?? 'info')
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {getSeverityIcon(alert.rule?.severity ?? 'info')}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{alert.subject}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {alert.rule?.name && (
                              <span className="text-xs text-slate-500 truncate max-w-[120px]">
                                {alert.rule.name}
                              </span>
                            )}
                            <span className="text-xs text-slate-600">·</span>
                            <span className="text-xs text-slate-500">{timeAgo(alert.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center">
                    <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 mb-3">
                      {alertsFetchedOnce ? '최근 7일 알림 없음' : '알림을 불러오지 못했습니다'}
                    </p>
                    {!alertsFetchedOnce && (
                      <button
                        onClick={(e) => { e.stopPropagation(); fetchAlertsSummary(); }}
                        className="text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 px-3 py-1 rounded"
                      >
                        다시 시도
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 전체 보기 */}
              <div className="p-3 border-t border-slate-700">
                <button
                  onClick={() => { router.push('/alerts'); setShowNotifications(false); }}
                  className="w-full py-2 text-sm text-center text-cyan-400 hover:text-cyan-300 hover:bg-slate-700/50 rounded transition-colors"
                >
                  알림 현황 전체 보기 →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 문의/피드백 버튼 */}
        <button
          onClick={() => router.push('/settings/support')}
          className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="문의/피드백"
          title="문의/피드백"
        >
          <Headset className="w-5 h-5 text-slate-400" />
        </button>

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

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-slate-800 rounded-lg shadow-xl border border-slate-700 overflow-hidden z-50">
              <div className="px-4 py-3 bg-slate-850 border-b border-slate-700">
                <p className="font-medium text-white">{user?.name}</p>
                <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              </div>

              <div className="py-1">
                <button
                  onClick={() => { router.push('/settings/account'); setShowDropdown(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700/50 transition-colors"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  <span>계정 설정</span>
                </button>
                <button
                  onClick={() => { router.push('/settings'); setShowDropdown(false); }}
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

      {/* 외부 클릭으로 드롭다운 닫기 */}
      {(showDropdown || showNotifications) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => { setShowDropdown(false); setShowNotifications(false); }}
        />
      )}
    </header>
  );
}
