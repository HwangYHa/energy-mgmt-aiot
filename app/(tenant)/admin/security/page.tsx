'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, AlertTriangle, XCircle, Ban, RefreshCw,
  Eye, Lock, Wifi, ChevronDown, Activity, Globe,
  Clock, TrendingUp, CheckCircle, HardDrive, Server,
  TrendingDown,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { apiGet, apiPost, apiPatch } from '@/lib/api/client';

// ── 타입 ─────────────────────────────────────────────────────
interface SecurityEvent {
  id: string;
  action: string;
  ipAddress: string | null;
  userId: string | null;
  tenantId: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
interface SecurityStats {
  last24h: number;
  last7d: number;
  bruteForce24h: number;
  blockedIps: number;
  topSuspiciousIps: { ip: string | null; count: number; isBlocked: boolean }[];
}
interface BlockedIp {
  ip: string; blockedAt: number; expiresAt: number; reason: string;
}
interface RansomwareAlert {
  id: string;
  alertType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  sourceIp: string | null;
  userId: string | null;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  metadata: Record<string, unknown> | null;
}
interface BackupRecord {
  id: string; backupType: string; status: string;
  sizeBytes: number | null; storagePath: string; completedAt: string | null;
}

// ── 상수 ─────────────────────────────────────────────────────
const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: 'bg-red-900/50 text-red-300 border border-red-700',
  HIGH:     'bg-orange-900/50 text-orange-300 border border-orange-700',
  MEDIUM:   'bg-yellow-900/50 text-yellow-300 border border-yellow-700',
  LOW:      'bg-blue-900/50 text-blue-300 border border-blue-700',
};
const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#3b82f6',
};
const EVENT_TYPE_LABEL: Record<string, string> = {
  BRUTE_FORCE:         '브루트포스',
  ACCOUNT_LOCKED:      '계정 잠금',
  SUSPICIOUS_LOGIN:    '의심 로그인',
  CSRF_VIOLATION:      'CSRF 위반',
  CSP_VIOLATION:       'CSP 위반',
  RATE_LIMIT_EXCEEDED: 'Rate Limit 초과',
  UNAUTHORIZED_ACCESS: '무단 접근',
  TOKEN_INVALID:       '토큰 위변조',
  IP_BLOCKED:          'IP 차단',
  SESSION_HIJACK:      '세션 탈취 의심',
  PASSWORD_CHANGED:    '비밀번호 변경',
  FORCE_LOGOUT:        '강제 로그아웃',
};
const ALERT_TYPE_KO: Record<string, string> = {
  MASS_DELETE:      '대량 삭제',
  MASS_UPDATE:      '대량 업데이트',
  UNUSUAL_EXPORT:   '비정상 내보내기',
  CRYPTO_PATTERN:   '암호화 패턴',
  SUSPICIOUS_QUERY: '의심 쿼리',
  BULK_DOWNLOAD:    '대용량 다운로드',
};
const RANSOM_STATUS_STYLE: Record<string, string> = {
  open:           'text-red-400',
  investigating:  'text-yellow-400',
  contained:      'text-orange-400',
  resolved:       'text-green-400',
  false_positive: 'text-gray-400',
};
const RANSOM_STATUS_KO: Record<string, string> = {
  open: '미해결', investigating: '조사 중', contained: '차단됨',
  resolved: '해결됨', false_positive: '오탐',
};

// ── 헬퍼 ─────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}초 전`;
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}
function fmtBytes(bytes: number | null): string {
  if (!bytes) return '-';
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576)     return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function SecurityMonitoringPage() {
  // 메인 탭
  const [mainTab, setMainTab] = useState<'security' | 'ransomware'>('security');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  // ── 보안 이벤트 상태 ─────────────────────────────────────
  const [stats,       setStats]       = useState<SecurityStats | null>(null);
  const [events,      setEvents]      = useState<SecurityEvent[]>([]);
  const [blocked,     setBlocked]     = useState<BlockedIp[]>([]);
  const [total,       setTotal]       = useState(0);
  const [secLoading,  setSecLoading]  = useState(true);
  const [secTab,      setSecTab]      = useState<'events' | 'blocked' | 'analytics'>('events');
  const [hours,       setHours]       = useState(24);
  const [typeFilter,  setTypeFilter]  = useState('');
  const [expanded,    setExpanded]    = useState<string | null>(null);
  const [blockInput,  setBlockInput]  = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [blockDur,    setBlockDur]    = useState(60);

  // ── 랜섬웨어 상태 ─────────────────────────────────────────
  const [alerts,      setAlerts]      = useState<RansomwareAlert[]>([]);
  const [backups,     setBackups]     = useState<BackupRecord[]>([]);
  const [ranLoading,  setRanLoading]  = useState(false);
  const [ranUpdating, setRanUpdating] = useState<string | null>(null);
  const [ranTab,      setRanTab]      = useState<'alerts' | 'backups' | 'stats'>('alerts');
  const [ranExpanded, setRanExpanded] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [sevFilter,    setSevFilter]    = useState('');

  // ── 보안 이벤트 로드 ─────────────────────────────────────
  const loadData = useCallback(async () => {
    setSecLoading(true);
    try {
      const [statsRes, eventsRes, blockedRes] = await Promise.all([
        apiGet<SecurityStats>('/api/security/events?view=stats'),
        apiGet<{ events: SecurityEvent[]; pagination: { total: number } }>(
          `/api/security/events?view=events&hours=${hours}${typeFilter ? `&type=${typeFilter}` : ''}&limit=200`,
        ),
        apiGet<BlockedIp[]>('/api/security/events?view=blocked'),
      ]);
      if (statsRes.data) setStats(statsRes.data);
      if (eventsRes.data?.events) {
        setEvents(eventsRes.data.events);
        setTotal(eventsRes.data.pagination.total);
      }
      if (blockedRes.data) setBlocked(blockedRes.data);
    } catch {
      showToast('데이터 로드 실패', false);
    } finally {
      setSecLoading(false);
    }
  }, [hours, typeFilter]);

  // ── 랜섬웨어 데이터 로드 ─────────────────────────────────
  const fetchRansomwareData = useCallback(async () => {
    setRanLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (statusFilter) params.set('status', statusFilter);
      if (sevFilter)    params.set('severity', sevFilter);

      const [alertsRes, backupsRes] = await Promise.all([
        apiGet<RansomwareAlert[]>(`/api/admin/security/ransomware?${params}`),
        apiGet<BackupRecord[]>('/api/admin/backups?limit=10'),
      ]);
      setAlerts(alertsRes.data ?? []);
      setBackups(backupsRes.data ?? []);
    } catch {
      showToast('데이터 로드 실패', false);
    } finally {
      setRanLoading(false);
    }
  }, [statusFilter, sevFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  // 랜섬웨어 탭 진입 시 로드
  useEffect(() => {
    if (mainTab === 'ransomware') fetchRansomwareData();
  }, [mainTab, fetchRansomwareData]);

  // 보안 이벤트 30초 자동 새로고침
  useEffect(() => {
    const timer = setInterval(() => { if (mainTab === 'security') loadData(); }, 30_000);
    return () => clearInterval(timer);
  }, [loadData, mainTab]);

  // ── IP 차단 핸들러 ───────────────────────────────────────
  const handleBlockIp = async () => {
    if (!blockInput.trim()) return;
    try {
      await apiPost('/api/security/events', {
        action: 'block_ip', ip: blockInput.trim(),
        reason: blockReason || '관리자 수동 차단',
        durationMinutes: blockDur,
      });
      showToast(`${blockInput} ${blockDur}분 차단 완료`);
      setBlockInput(''); setBlockReason('');
      await loadData();
    } catch { showToast('IP 차단 실패', false); }
  };

  const handleUnblockIp = async (ip: string) => {
    try {
      await apiPost('/api/security/events', { action: 'unblock_ip', ip });
      showToast(`${ip} 차단 해제`);
      await loadData();
    } catch { showToast('차단 해제 실패', false); }
  };

  // ── 랜섬웨어 상태 변경 ───────────────────────────────────
  const updateRansomStatus = async (id: string, status: string) => {
    setRanUpdating(id);
    try {
      await apiPatch(`/api/admin/security/ransomware/${id}`, { status });
      showToast(`상태 변경: ${RANSOM_STATUS_KO[status]}`);
      await fetchRansomwareData();
    } catch {
      showToast('상태 변경 실패', false);
    } finally {
      setRanUpdating(null);
    }
  };

  // ── 보안 분석 데이터 ─────────────────────────────────────
  const getEventType = (action: string) => action.replace('security:', '');
  const getSeverity  = (ev: SecurityEvent): string => (ev.metadata?.severity as string) ?? 'LOW';

  const severityCount = events.reduce<Record<string, number>>((acc, ev) => {
    const s = getSeverity(ev); acc[s] = (acc[s] ?? 0) + 1; return acc;
  }, {});
  const severityData = Object.entries(severityCount).map(([k, v]) => ({ name: k, value: v }));
  const typeCount    = events.reduce<Record<string, number>>((acc, ev) => {
    const t = getEventType(ev.action); acc[t] = (acc[t] ?? 0) + 1; return acc;
  }, {});
  const typeData = Object.entries(typeCount).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([k, v]) => ({ name: EVENT_TYPE_LABEL[k] ?? k, count: v }));
  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, '0')}시`,
    count: events.filter(ev => new Date(ev.createdAt).getHours() === i).length,
  }));

  // ── 랜섬웨어 집계 ────────────────────────────────────────
  const openAlerts     = alerts.filter(a => a.status === 'open').length;
  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL').length;
  const latestBackup   = backups[0] ?? null;
  const lastBackupTime = latestBackup?.completedAt ? timeAgo(latestBackup.completedAt) : '없음';
  const backupOk       = latestBackup?.status === 'verified' || latestBackup?.status === 'completed';

  const ranTypeCount = alerts.reduce<Record<string, number>>((acc, a) => {
    const t = ALERT_TYPE_KO[a.alertType] ?? a.alertType;
    acc[t] = (acc[t] ?? 0) + 1; return acc;
  }, {});
  const ranTypeChartData = Object.entries(ranTypeCount)
    .map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const ranSevCount = alerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.severity] = (acc[a.severity] ?? 0) + 1; return acc;
  }, {});
  const ranTrendData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().slice(0, 10);
    return { date: dateStr.slice(5), count: alerts.filter(a => a.createdAt.startsWith(dateStr)).length };
  });

  // ── 렌더 ─────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-900/30 rounded-lg">
            <Shield className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">보안 모니터링</h1>
            <p className="text-sm text-gray-400">보안 이벤트 · 랜섬웨어 대응 · IP 차단 · 실시간 위협 분석</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mainTab === 'security' && (
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block" />
              30초 자동 갱신
            </span>
          )}
          <button
            onClick={mainTab === 'security' ? loadData : fetchRansomwareData}
            disabled={mainTab === 'security' ? secLoading : ranLoading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${(mainTab === 'security' ? secLoading : ranLoading) ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>
      </div>

      {/* 토스트 */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${toast.ok ? 'bg-emerald-600' : 'bg-red-600'} text-white`}>
          {toast.msg}
        </div>
      )}

      {/* ── 메인 탭 ────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-800/60 rounded-xl p-1 w-fit">
        {([
          { id: 'security',    label: '보안 이벤트',    icon: <Shield className="w-4 h-4" /> },
          { id: 'ransomware',  label: '랜섬웨어 대응',  icon: <HardDrive className="w-4 h-4" /> },
        ] as const).map(tab => (
          <button key={tab.id} onClick={() => setMainTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              mainTab === tab.id
                ? 'bg-gray-700 text-white shadow'
                : 'text-gray-400 hover:text-white'
            }`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════
          보안 이벤트 섹션
      ═══════════════════════════════════════════════════ */}
      {mainTab === 'security' && (
        <>
          {/* KPI 카드 */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: '24h 이벤트',     value: stats?.last24h ?? '-',              icon: Activity, color: 'text-cyan-400',   border: 'border-cyan-900/50' },
              { label: '7일 이벤트',     value: stats?.last7d ?? '-',               icon: Eye,      color: 'text-blue-400',   border: 'border-blue-900/50' },
              { label: '브루트포스 24h', value: stats?.bruteForce24h ?? '-',        icon: Lock,     color: 'text-orange-400', border: 'border-orange-900/50' },
              { label: '차단 IP',        value: stats?.blockedIps ?? '-',           icon: Ban,      color: 'text-red-400',    border: 'border-red-900/50' },
              { label: '의심 IP',        value: stats?.topSuspiciousIps.length ?? '-', icon: Globe, color: 'text-yellow-400', border: 'border-yellow-900/50' },
            ].map(({ label, value, icon: Icon, color, border }) => (
              <div key={label} className={`bg-gray-900 border ${border} rounded-xl p-4`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className="text-xs text-gray-400">{label}</span>
                </div>
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
              </div>
            ))}
          </div>

          {/* 의심 IP 바 */}
          {stats?.topSuspiciousIps && stats.topSuspiciousIps.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" /> 상위 의심 IP (24시간)
              </h3>
              <div className="flex flex-wrap gap-2">
                {stats.topSuspiciousIps.map(({ ip, count, isBlocked }) => (
                  <div key={ip}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono ${
                      isBlocked ? 'bg-red-900/40 text-red-300 border border-red-700' : 'bg-gray-800 text-gray-300 border border-gray-700'
                    }`}>
                    <Globe className="w-3 h-3" />{ip}
                    <span className="opacity-60">({count}회)</span>
                    {isBlocked && <span className="text-red-400 font-medium">차단중</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3-컬럼 레이아웃 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-4">
              {/* 서브 탭 바 */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
                  {([
                    { id: 'events',    label: `이벤트 (${total})` },
                    { id: 'blocked',   label: `차단 IP (${blocked.length})` },
                    { id: 'analytics', label: '분석' },
                  ] as const).map(tab => (
                    <button key={tab.id} onClick={() => setSecTab(tab.id)}
                      className={`px-3 py-1.5 rounded-md text-sm transition-colors ${secTab === tab.id ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                      {tab.label}
                    </button>
                  ))}
                </div>
                {secTab === 'events' && (
                  <div className="flex gap-2">
                    <select value={hours} onChange={e => setHours(Number(e.target.value))}
                      className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none">
                      <option value={6}>최근 6시간</option>
                      <option value={24}>최근 24시간</option>
                      <option value={72}>최근 3일</option>
                      <option value={168}>최근 7일</option>
                    </select>
                    <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                      className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none">
                      <option value="">전체 유형</option>
                      {Object.entries(EVENT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* 이벤트 목록 */}
              {secTab === 'events' && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  {secLoading ? (
                    <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />로딩 중...
                    </div>
                  ) : events.length === 0 ? (
                    <div className="p-10 text-center text-gray-500">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-50" />
                      이 기간에 보안 이벤트 없음
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-800">
                      {events.slice(0, 100).map(ev => {
                        const type   = getEventType(ev.action);
                        const sev    = getSeverity(ev);
                        const isOpen = expanded === ev.id;
                        return (
                          <div key={ev.id} className="hover:bg-gray-800/30 transition-colors">
                            <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer"
                              onClick={() => setExpanded(isOpen ? null : ev.id)}>
                              <span className={`text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap ${SEVERITY_STYLE[sev] ?? SEVERITY_STYLE['LOW']}`}>
                                {sev}
                              </span>
                              <span className="text-sm text-gray-300 flex-1 truncate">
                                {EVENT_TYPE_LABEL[type] ?? type}
                              </span>
                              <span className="font-mono text-xs text-gray-500 hidden sm:block">{ev.ipAddress ?? '-'}</span>
                              <span className="text-xs text-gray-600 whitespace-nowrap">
                                {new Date(ev.createdAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <ChevronDown className={`w-3.5 h-3.5 text-gray-600 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                            </div>
                            {isOpen && (
                              <div className="px-4 pb-3 bg-gray-900/60 text-xs font-mono text-gray-400 space-y-1">
                                <div>IP: {ev.ipAddress ?? '-'}</div>
                                <div>User: {ev.userId ?? '-'}</div>
                                <div>UA: {ev.userAgent?.slice(0, 100) ?? '-'}</div>
                                {ev.metadata && (
                                  <pre className="mt-1 p-2 bg-gray-800 rounded text-xs overflow-auto max-h-36">
                                    {JSON.stringify(ev.metadata, null, 2)}
                                  </pre>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {events.length > 100 && (
                        <div className="px-4 py-3 text-center text-xs text-gray-500">
                          총 {events.length}건 중 최신 100건 표시
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 차단 IP */}
              {secTab === 'blocked' && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  {blocked.length === 0 ? (
                    <div className="p-10 text-center text-gray-500">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-40" />
                      차단된 IP 없음
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-800">
                      {blocked.map(b => {
                        const remainMin = Math.max(0, Math.floor((b.expiresAt - Date.now()) / 60000));
                        return (
                          <div key={b.ip} className="flex items-center justify-between px-4 py-3 hover:bg-gray-800/20">
                            <div>
                              <div className="font-mono text-sm text-red-300">{b.ip}</div>
                              <div className="text-xs text-gray-500 mt-0.5">{b.reason}</div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <div className="text-xs text-gray-500">해제까지</div>
                                <div className={`text-xs font-medium ${remainMin < 10 ? 'text-green-400' : 'text-orange-400'}`}>
                                  <Clock className="w-3 h-3 inline mr-0.5" />{remainMin}분
                                </div>
                              </div>
                              <button onClick={() => handleUnblockIp(b.ip)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-400 hover:bg-emerald-900/20 transition-colors"
                                title="차단 해제">
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 분석 */}
              {secTab === 'analytics' && (
                <div className="space-y-4">
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-cyan-400" />시간대별 이벤트 분포
                    </h4>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={hourlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="hour" tick={{ fill: '#6b7280', fontSize: 9 }} interval={3} />
                        <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                          formatter={(v: number) => [v, '이벤트']} />
                        <Bar dataKey="count" fill="#06b6d4" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-400" />유형별 이벤트 Top 8
                    </h4>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={typeData} layout="vertical" margin={{ left: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} width={80} />
                        <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                          formatter={(v: number) => [v, '건']} />
                        <Bar dataKey="count" fill="#3b82f6" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-400" />심각도 분포
                    </h4>
                    <div className="flex items-center gap-6">
                      <ResponsiveContainer width={140} height={140}>
                        <PieChart>
                          <Pie data={severityData} cx="50%" cy="50%" outerRadius={55} dataKey="value" label={false}>
                            {severityData.map(entry => (
                              <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] ?? '#64748b'} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2">
                        {severityData.map(d => (
                          <div key={d.name} className="flex items-center gap-2 text-sm">
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: SEVERITY_COLORS[d.name] }} />
                            <span className="text-gray-300 w-20">{d.name}</span>
                            <span className="font-bold text-white">{d.value}건</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 오른쪽 패널 */}
            <div className="space-y-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <Ban className="w-4 h-4 text-red-400" /> IP 수동 차단
                </h3>
                <div className="space-y-2.5">
                  <input type="text" value={blockInput} onChange={e => setBlockInput(e.target.value)}
                    placeholder="IP 주소 (예: 1.2.3.4)"
                    className="w-full bg-gray-800 border border-gray-700 text-sm text-white rounded-lg px-3 py-2 placeholder-gray-500 focus:outline-none focus:border-cyan-500" />
                  <input type="text" value={blockReason} onChange={e => setBlockReason(e.target.value)}
                    placeholder="차단 사유"
                    className="w-full bg-gray-800 border border-gray-700 text-sm text-white rounded-lg px-3 py-2 placeholder-gray-500 focus:outline-none focus:border-cyan-500" />
                  <div className="flex gap-2">
                    {[15, 30, 60, 120].map(d => (
                      <button key={d} onClick={() => setBlockDur(d)}
                        className={`flex-1 py-1.5 text-xs rounded-lg transition-colors ${blockDur === d ? 'bg-red-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                        {d < 60 ? `${d}분` : `${d / 60}시간`}
                      </button>
                    ))}
                  </div>
                  <button onClick={handleBlockIp} disabled={!blockInput.trim()}
                    className="w-full py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-medium transition-colors">
                    {blockDur < 60 ? `${blockDur}분` : `${blockDur / 60}시간`} 차단
                  </button>
                </div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-cyan-400" /> 자동 대응 정책
                </h3>
                <div className="space-y-2 text-xs">
                  {[
                    { label: '브루트포스 15분 내 20회',  action: '30분 자동 차단',   color: 'text-red-400' },
                    { label: 'CSRF 위반 감지',           action: '10분 차단',        color: 'text-orange-400' },
                    { label: 'Rate Limit 3회 초과',      action: '30분 차단',        color: 'text-yellow-400' },
                    { label: '대량 삭제 (500행/분)',      action: '사용자 자동 차단', color: 'text-red-400' },
                    { label: 'HIGH/CRITICAL 이벤트',     action: '이메일 즉시 알림', color: 'text-cyan-400' },
                  ].map(({ label, action, color }) => (
                    <div key={label} className="flex justify-between gap-2 py-1.5 border-b border-gray-800/50 last:border-0">
                      <span className="text-gray-400">{label}</span>
                      <span className={`${color} whitespace-nowrap font-medium`}>→ {action}</span>
                    </div>
                  ))}
                </div>
              </div>
              {stats && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-400" /> 빠른 현황
                  </h3>
                  <div className="space-y-2 text-xs">
                    {[
                      { label: '총 이벤트 (7일)', value: stats.last7d.toLocaleString(), cls: 'text-white' },
                      { label: '브루트포스 시도', value: String(stats.bruteForce24h), cls: stats.bruteForce24h > 0 ? 'text-orange-400' : 'text-green-400' },
                      { label: '현재 차단 IP',   value: String(stats.blockedIps),    cls: stats.blockedIps > 0 ? 'text-red-400' : 'text-gray-400' },
                      { label: 'CRITICAL 이벤트',value: String(severityCount['CRITICAL'] ?? 0), cls: (severityCount['CRITICAL'] ?? 0) > 0 ? 'text-red-400' : 'text-gray-400' },
                    ].map(({ label, value, cls }) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-gray-400">{label}</span>
                        <span className={`font-bold ${cls}`}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════
          랜섬웨어 대응 섹션
      ═══════════════════════════════════════════════════ */}
      {mainTab === 'ransomware' && (
        <div className="space-y-5">
          {/* KPI 카드 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <RanKpiCard label="미해결 알림"  value={openAlerts}
              icon={<AlertTriangle className="w-5 h-5 text-red-400" />}
              color={openAlerts > 0 ? 'red' : 'green'}
              sub={openAlerts > 0 ? '즉시 확인 필요' : '정상'} />
            <RanKpiCard label="CRITICAL"     value={criticalAlerts}
              icon={<XCircle className="w-5 h-5 text-orange-400" />}
              color={criticalAlerts > 0 ? 'orange' : 'green'}
              sub={criticalAlerts > 0 ? '최우선 대응' : '없음'} />
            <RanKpiCard label="마지막 백업"  value={lastBackupTime}
              icon={<Clock className="w-5 h-5 text-blue-400" />}
              color="blue" sub={latestBackup ? fmtBytes(latestBackup.sizeBytes) : '-'} />
            <RanKpiCard label="백업 상태"    value={backupOk ? '정상' : latestBackup ? '이상' : '없음'}
              icon={<HardDrive className={`w-5 h-5 ${backupOk ? 'text-green-400' : 'text-red-400'}`} />}
              color={backupOk ? 'green' : 'red'}
              sub={latestBackup?.backupType ?? '-'} />
          </div>

          {/* 서브 탭 */}
          <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1 w-fit">
            {([
              { id: 'alerts',  label: `알림 목록 (${alerts.length})`, icon: <AlertTriangle className="w-3.5 h-3.5" /> },
              { id: 'backups', label: `백업 이력 (${backups.length})`, icon: <HardDrive className="w-3.5 h-3.5" /> },
              { id: 'stats',   label: '통계 분석',                     icon: <Activity className="w-3.5 h-3.5" /> },
            ] as const).map(tab => (
              <button key={tab.id} onClick={() => setRanTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm transition-colors ${ranTab === tab.id ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          {/* 알림 목록 */}
          {ranTab === 'alerts' && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none">
                  <option value="">전체 상태</option>
                  {Object.entries(RANSOM_STATUS_KO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select value={sevFilter} onChange={e => setSevFilter(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none">
                  <option value="">전체 심각도</option>
                  {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {(statusFilter || sevFilter) && (
                  <button onClick={() => { setStatusFilter(''); setSevFilter(''); }}
                    className="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 rounded-lg">
                    초기화
                  </button>
                )}
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-gray-400" />
                  <h2 className="font-semibold">보안 알림 목록</h2>
                  <span className="ml-auto text-xs text-gray-500">{alerts.length}건</span>
                </div>
                {ranLoading ? (
                  <div className="flex items-center justify-center h-32 text-gray-400">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />로딩 중...
                  </div>
                ) : alerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                    <CheckCircle className="w-8 h-8 mb-2 text-green-500 opacity-60" />
                    <p>탐지된 보안 알림 없음</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-400 border-b border-gray-800 bg-gray-900/50">
                          {['심각도', '유형', '설명', 'IP', '발생 시각', '상태', '액션'].map(h => (
                            <th key={h} className="px-4 py-3 font-medium whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {alerts.map(alert => {
                          const isExp = ranExpanded === alert.id;
                          return (
                            <React.Fragment key={alert.id}>
                              <tr
                                className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors cursor-pointer"
                                onClick={() => setRanExpanded(isExp ? null : alert.id)}>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${SEVERITY_STYLE[alert.severity] ?? ''}`}>
                                    {alert.severity}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-gray-300 text-xs whitespace-nowrap">
                                  {ALERT_TYPE_KO[alert.alertType] ?? alert.alertType}
                                </td>
                                <td className="px-4 py-3 text-gray-400 max-w-xs truncate text-xs" title={alert.description}>
                                  {alert.description}
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-gray-500">{alert.sourceIp ?? '-'}</td>
                                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                                  {timeAgo(alert.createdAt)}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`text-xs font-medium ${RANSOM_STATUS_STYLE[alert.status] ?? 'text-gray-400'}`}>
                                    {RANSOM_STATUS_KO[alert.status] ?? alert.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                    {alert.status === 'open' && (
                                      <>
                                        <RanActionBtn label="조사 중"
                                          onClick={() => updateRansomStatus(alert.id, 'investigating')}
                                          disabled={ranUpdating === alert.id} color="yellow" />
                                        {alert.severity === 'CRITICAL' && (
                                          <RanActionBtn label="차단" icon={<Ban className="w-3 h-3" />}
                                            onClick={() => updateRansomStatus(alert.id, 'contained')}
                                            disabled={ranUpdating === alert.id} color="red" />
                                        )}
                                      </>
                                    )}
                                    {['investigating', 'contained'].includes(alert.status) && (
                                      <>
                                        <RanActionBtn label="해결됨"
                                          onClick={() => updateRansomStatus(alert.id, 'resolved')}
                                          disabled={ranUpdating === alert.id} color="green" />
                                        <RanActionBtn label="오탐"
                                          onClick={() => updateRansomStatus(alert.id, 'false_positive')}
                                          disabled={ranUpdating === alert.id} color="gray" />
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                              {isExp && (
                                <tr className="border-b border-gray-800/50">
                                  <td colSpan={7} className="px-4 py-3 bg-gray-900/60">
                                    <div className="text-xs text-gray-400 space-y-1 font-mono">
                                      <div>사용자 ID: {alert.userId ?? '-'}</div>
                                      {alert.resolvedAt && <div>해결 시각: {new Date(alert.resolvedAt).toLocaleString('ko-KR')}</div>}
                                      {alert.metadata && (
                                        <pre className="mt-1 p-2 bg-gray-800 rounded text-xs overflow-auto max-h-32">
                                          {JSON.stringify(alert.metadata, null, 2)}
                                        </pre>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 백업 이력 */}
          {ranTab === 'backups' && (
            <div className="space-y-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-800 flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-blue-400" />
                  <h2 className="font-semibold">백업 이력</h2>
                  <span className="ml-auto text-xs text-gray-500">{backups.length}건</span>
                </div>
                {backups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                    <Server className="w-8 h-8 mb-2 opacity-30" />
                    백업 이력 없음 — 수동 백업을 실행하거나 자동 백업을 구성하세요
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-400 border-b border-gray-800 bg-gray-900/50">
                          {['유형', '상태', '크기', '경로', '완료 시각'].map(h => (
                            <th key={h} className="px-4 py-3 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {backups.map(b => {
                          const ok = b.status === 'completed' || b.status === 'verified';
                          return (
                            <tr key={b.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                              <td className="px-4 py-3 text-xs text-gray-300">{b.backupType}</td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-medium ${ok ? 'text-green-400' : 'text-red-400'}`}>
                                  {ok
                                    ? <CheckCircle className="w-3.5 h-3.5 inline mr-1" />
                                    : <XCircle className="w-3.5 h-3.5 inline mr-1" />}
                                  {b.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-400">{fmtBytes(b.sizeBytes)}</td>
                              <td className="px-4 py-3 text-xs text-gray-500 font-mono max-w-xs truncate" title={b.storagePath}>
                                {b.storagePath}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-400">
                                {b.completedAt ? timeAgo(b.completedAt) : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-400" />백업 불변성(Immutability) 정책
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {[
                    { title: '로컬 불변 백업',  desc: 'chattr +i 플래그로 파일 변경 불가 처리. 루트 권한도 삭제 불가.',             color: 'border-blue-700' },
                    { title: 'NCP WORM 백업',   desc: 'Object Storage Object Lock COMPLIANCE 모드 + 보존 기간 설정.',            color: 'border-orange-700' },
                    { title: '3-2-1 전략',      desc: '3개 복사본 · 2개 미디어 · 1개 오프사이트 유지. 랜섬웨어 피해 시 복구 보장.', color: 'border-emerald-700' },
                  ].map(item => (
                    <div key={item.title} className={`bg-gray-800 border ${item.color} rounded-lg p-3`}>
                      <div className="font-medium text-white mb-1">{item.title}</div>
                      <div className="text-gray-400">{item.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 통계 분석 */}
          {ranTab === 'stats' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(sev => {
                  const cnt = ranSevCount[sev] ?? 0;
                  const styleMap: Record<string, string> = {
                    CRITICAL: 'border-red-900/50 text-red-400',
                    HIGH:     'border-orange-900/50 text-orange-400',
                    MEDIUM:   'border-yellow-900/50 text-yellow-400',
                    LOW:      'border-blue-900/50 text-blue-400',
                  };
                  const [borderCls, textCls] = (styleMap[sev] ?? '').split(' ');
                  return (
                    <div key={sev} className={`bg-gray-900 border ${borderCls} rounded-xl p-4 text-center`}>
                      <div className={`text-3xl font-bold ${textCls}`}>{cnt}</div>
                      <div className="text-xs text-gray-400 mt-1">{sev}</div>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-red-400" />알림 유형 분포
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={ranTypeChartData} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} width={80} />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                        formatter={(v: number) => [v, '건']} />
                      <Bar dataKey="value" fill="#ef4444" radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-orange-400" />일자별 알림 추이 (7일)
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={ranTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} allowDecimals={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                        formatter={(v: number) => [v, '알림']} />
                      <Bar dataKey="count" fill="#f97316" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-cyan-400" />이상 탐지 임계값 정책
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { type: '대량 삭제 탐지',      threshold: '60초 내 500행 삭제',      action: 'HIGH 알림',    critical: '1,500행 → CRITICAL + 계정 차단',   color: 'border-red-800' },
                    { type: '대량 업데이트 탐지',   threshold: '60초 내 1,000행 수정',    action: 'HIGH 알림',    critical: '3,000행 → CRITICAL + 계정 차단',   color: 'border-orange-800' },
                    { type: '대용량 내보내기 탐지', threshold: '100MB 이상',              action: 'MEDIUM 알림',  critical: '500MB → HIGH + 이메일',            color: 'border-yellow-800' },
                    { type: '암호화 패턴 탐지',     threshold: 'Base64 비율 50%+, 1KB+', action: 'CRITICAL 알림',critical: '즉시 계정 차단 + 이메일',          color: 'border-purple-800' },
                    { type: '슬라이딩 윈도우',      threshold: '60초 집계 창',            action: '만료 후 자동 정리', critical: '서버 재시작 시 리셋',           color: 'border-blue-800' },
                  ].map(item => (
                    <div key={item.type} className={`bg-gray-800 border ${item.color} rounded-lg p-3 text-xs`}>
                      <div className="font-medium text-white mb-1.5">{item.type}</div>
                      <div className="text-gray-400 mb-1">임계값: {item.threshold}</div>
                      <div className="text-yellow-400 mb-1">→ {item.action}</div>
                      <div className="text-red-400">{item.critical}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 서브컴포넌트 (랜섬웨어 섹션용) ───────────────────────────
function RanKpiCard({ label, value, icon, color, sub }: {
  label: string; value: string | number; icon: React.ReactNode;
  color: 'red' | 'orange' | 'blue' | 'green'; sub?: string;
}) {
  const border = { red: 'border-red-900/50', orange: 'border-orange-900/50', blue: 'border-blue-900/50', green: 'border-green-900/50' };
  const text   = { red: 'text-red-400',      orange: 'text-orange-400',      blue: 'text-blue-400',      green: 'text-green-400' };
  return (
    <div className={`bg-gray-900 border ${border[color]} rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">{label}</span>{icon}
      </div>
      <div className={`text-2xl font-bold ${text[color]}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function RanActionBtn({ label, icon, onClick, disabled, color }: {
  label: string; icon?: React.ReactNode; onClick: () => void; disabled: boolean;
  color: 'yellow' | 'red' | 'green' | 'gray';
}) {
  const styles = {
    yellow: 'bg-yellow-900/50 hover:bg-yellow-900 text-yellow-300',
    red:    'bg-red-900/50 hover:bg-red-900 text-red-300',
    green:  'bg-green-900/50 hover:bg-green-900 text-green-300',
    gray:   'bg-gray-700 hover:bg-gray-600 text-gray-300',
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex items-center gap-1 px-2 py-1 ${styles[color]} text-xs rounded transition-colors disabled:opacity-50`}>
      {icon}{label}
    </button>
  );
}
