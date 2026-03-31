'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield, AlertTriangle, XCircle, Ban, RefreshCw,
  Eye, Lock, Wifi, ChevronDown, Activity, Globe,
  Clock, TrendingUp, CheckCircle,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { apiGet, apiPost } from '@/lib/api/client';

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

export default function SecurityMonitoringPage() {
  const [stats,       setStats]       = useState<SecurityStats | null>(null);
  const [events,      setEvents]      = useState<SecurityEvent[]>([]);
  const [blocked,     setBlocked]     = useState<BlockedIp[]>([]);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState<'events' | 'blocked' | 'analytics'>('events');
  const [hours,       setHours]       = useState(24);
  const [typeFilter,  setTypeFilter]  = useState('');
  const [expanded,    setExpanded]    = useState<string | null>(null);
  const [blockInput,  setBlockInput]  = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [blockDur,    setBlockDur]    = useState(60);
  const [toast,       setToast]       = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
    }
  }, [hours, typeFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  // 자동 새로고침 30초
  useEffect(() => {
    const timer = setInterval(() => { loadData(); }, 30_000);
    return () => clearInterval(timer);
  }, [loadData]);

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

  // 분석 데이터 계산
  const getEventType  = (action: string) => action.replace('security:', '');
  const getSeverity   = (ev: SecurityEvent): string => (ev.metadata?.severity as string) ?? 'LOW';

  const severityCount = events.reduce<Record<string, number>>((acc, ev) => {
    const s = getSeverity(ev);
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});
  const severityData = Object.entries(severityCount).map(([k, v]) => ({ name: k, value: v }));

  const typeCount = events.reduce<Record<string, number>>((acc, ev) => {
    const t = getEventType(ev.action);
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});
  const typeData = Object.entries(typeCount)
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([k, v]) => ({ name: EVENT_TYPE_LABEL[k] ?? k, count: v }));

  // 시간대별 이벤트 수 (24h 기준)
  const hourlyData = Array.from({ length: 24 }, (_, i) => {
    const cnt = events.filter((ev) => {
      const h = new Date(ev.createdAt).getHours();
      return h === i;
    }).length;
    return { hour: `${String(i).padStart(2, '0')}시`, count: cnt };
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
            <p className="text-sm text-gray-400">보안 이벤트 추적 · IP 차단 · 실시간 위협 분석</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
            30초 자동 갱신
          </span>
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />새로고침
          </button>
        </div>
      </div>

      {/* 토스트 */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${toast.ok ? 'bg-emerald-600' : 'bg-red-600'} text-white`}>
          {toast.msg}
        </div>
      )}

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: '24h 이벤트',     value: stats?.last24h ?? '-',                     icon: Activity,       color: 'text-cyan-400',   border: 'border-cyan-900/50' },
          { label: '7일 이벤트',     value: stats?.last7d ?? '-',                       icon: Eye,            color: 'text-blue-400',   border: 'border-blue-900/50' },
          { label: '브루트포스 24h', value: stats?.bruteForce24h ?? '-',               icon: Lock,           color: 'text-orange-400', border: 'border-orange-900/50' },
          { label: '차단 IP',        value: stats?.blockedIps ?? '-',                  icon: Ban,            color: 'text-red-400',    border: 'border-red-900/50' },
          { label: '의심 IP',        value: stats?.topSuspiciousIps.length ?? '-',     icon: Globe,          color: 'text-yellow-400', border: 'border-yellow-900/50' },
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

      {/* 탭 + 콘텐츠 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          {/* 탭 바 */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
              {([
                { id: 'events',    label: `이벤트 (${total})` },
                { id: 'blocked',   label: `차단 IP (${blocked.length})` },
                { id: 'analytics', label: '분석' },
              ] as const).map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${activeTab === tab.id ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                  {tab.label}
                </button>
              ))}
            </div>
            {activeTab === 'events' && (
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
          {activeTab === 'events' && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              {loading ? (
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
                    const type = getEventType(ev.action);
                    const sev  = getSeverity(ev);
                    const isOpen = expanded === ev.id;
                    return (
                      <div key={ev.id} className="hover:bg-gray-800/30 transition-colors">
                        <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer"
                          onClick={() => setExpanded(isOpen ? null : ev.id)}>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap ${SEVERITY_STYLE[sev] ?? SEVERITY_STYLE.LOW}`}>
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
          {activeTab === 'blocked' && (
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

          {/* 분석 탭 */}
          {activeTab === 'analytics' && (
            <div className="space-y-4">
              {/* 시간대별 이벤트 */}
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

              {/* 유형별 이벤트 */}
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

              {/* 심각도 분포 */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-400" />심각도 분포
                </h4>
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie data={severityData} cx="50%" cy="50%" outerRadius={55} dataKey="value" label={false}>
                        {severityData.map((entry) => (
                          <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] ?? '#64748b'} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {severityData.map((d) => (
                      <div key={d.name} className="flex items-center gap-2 text-sm">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: SEVERITY_COLORS[d.name] }}></span>
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
          {/* IP 수동 차단 */}
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

          {/* 자동 대응 정책 */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <Wifi className="w-4 h-4 text-cyan-400" /> 자동 대응 정책
            </h3>
            <div className="space-y-2 text-xs">
              {[
                { label: '브루트포스 15분 내 20회',   action: '30분 자동 차단',  color: 'text-red-400' },
                { label: 'CSRF 위반 감지',            action: '10분 차단',       color: 'text-orange-400' },
                { label: 'Rate Limit 3회 초과',       action: '30분 차단',       color: 'text-yellow-400' },
                { label: '대량 삭제 (500행/분)',       action: '사용자 자동 차단', color: 'text-red-400' },
                { label: 'HIGH/CRITICAL 이벤트',      action: '이메일 즉시 알림', color: 'text-cyan-400' },
              ].map(({ label, action, color }) => (
                <div key={label} className="flex justify-between gap-2 py-1.5 border-b border-gray-800/50 last:border-0">
                  <span className="text-gray-400">{label}</span>
                  <span className={`${color} whitespace-nowrap font-medium`}>→ {action}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 빠른 통계 */}
          {stats && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" /> 빠른 현황
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">총 이벤트 (7일)</span>
                  <span className="font-bold text-white">{stats.last7d.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">브루트포스 시도</span>
                  <span className={`font-bold ${stats.bruteForce24h > 0 ? 'text-orange-400' : 'text-green-400'}`}>{stats.bruteForce24h}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">현재 차단 IP</span>
                  <span className={`font-bold ${stats.blockedIps > 0 ? 'text-red-400' : 'text-gray-400'}`}>{stats.blockedIps}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">CRITICAL 이벤트</span>
                  <span className={`font-bold ${(severityCount['CRITICAL'] ?? 0) > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                    {severityCount['CRITICAL'] ?? 0}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
