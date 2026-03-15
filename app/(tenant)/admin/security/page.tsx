'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield, AlertTriangle, XCircle, Ban, RefreshCw,
  Eye, Lock, Wifi, ChevronDown, Activity, Globe,
} from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api/client';

// ────────────────────────────────────────────────────────────
// 타입
// ────────────────────────────────────────────────────────────
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
  ip: string;
  blockedAt: number;
  expiresAt: number;
  reason: string;
}

// ────────────────────────────────────────────────────────────
// 심각도 뱃지
// ────────────────────────────────────────────────────────────
const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: 'bg-red-900/50 text-red-300 border border-red-700',
  HIGH:     'bg-orange-900/50 text-orange-300 border border-orange-700',
  MEDIUM:   'bg-yellow-900/50 text-yellow-300 border border-yellow-700',
  LOW:      'bg-blue-900/50 text-blue-300 border border-blue-700',
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

// ────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ────────────────────────────────────────────────────────────
export default function SecurityMonitoringPage() {
  const [stats, setStats]     = useState<SecurityStats | null>(null);
  const [events, setEvents]   = useState<SecurityEvent[]>([]);
  const [blocked, setBlocked] = useState<BlockedIp[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'events' | 'blocked'>('events');
  const [hours, setHours]     = useState(24);
  const [typeFilter, setTypeFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [blockIpInput, setBlockIpInput] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [toast, setToast]   = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, eventsRes, blockedRes] = await Promise.all([
        apiGet<SecurityStats>(`/api/security/events?view=stats`),
        apiGet<{ events: SecurityEvent[]; pagination: { total: number } }>(`/api/security/events?view=events&hours=${hours}${typeFilter ? `&type=${typeFilter}` : ''}&limit=100`),
        apiGet<BlockedIp[]>(`/api/security/events?view=blocked`),
      ]);
      if (statsRes.data)               setStats(statsRes.data);
      if (eventsRes.data?.events)      { setEvents(eventsRes.data.events); setTotal(eventsRes.data.pagination.total); }
      if (blockedRes.data)             setBlocked(blockedRes.data);
    } catch {
      showToast('데이터 로드 실패', false);
    } finally {
      setLoading(false);
    }
  }, [hours, typeFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleBlockIp = async () => {
    if (!blockIpInput.trim()) return;
    try {
      await apiPost('/api/security/events', {
        action: 'block_ip',
        ip: blockIpInput.trim(),
        reason: blockReason || '관리자 수동 차단',
        durationMinutes: 60,
      });
      showToast(`${blockIpInput} 차단 완료`);
      setBlockIpInput('');
      setBlockReason('');
      await loadData();
    } catch {
      showToast('IP 차단 실패', false);
    }
  };

  const handleUnblockIp = async (ip: string) => {
    try {
      await apiPost('/api/security/events', { action: 'unblock_ip', ip });
      showToast(`${ip} 차단 해제`);
      await loadData();
    } catch {
      showToast('차단 해제 실패', false);
    }
  };

  const getEventType = (action: string) =>
    action.replace('security:', '') as keyof typeof EVENT_TYPE_LABEL;

  const getSeverity = (event: SecurityEvent): string =>
    (event.metadata?.severity as string) ?? 'LOW';

  // ────────────────────────────────────────────────────────
  // 렌더
  // ────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-7 h-7 text-cyan-400" />
          <div>
            <h1 className="text-xl font-bold text-white">보안 모니터링</h1>
            <p className="text-sm text-slate-400">보안 이벤트 추적 · IP 차단 · 사고 대응</p>
          </div>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      {/* 토스트 */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${
          toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* KPI 카드 */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: '24시간 이벤트', value: stats.last24h, icon: Activity, color: 'text-cyan-400' },
            { label: '7일 이벤트', value: stats.last7d, icon: Eye, color: 'text-blue-400' },
            { label: '브루트포스(24h)', value: stats.bruteForce24h, icon: Lock, color: 'text-orange-400' },
            { label: '차단된 IP', value: stats.blockedIps, icon: Ban, color: 'text-red-400' },
            { label: '의심 IP', value: stats.topSuspiciousIps.length, icon: Globe, color: 'text-yellow-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-[#0a1929] border border-slate-700/50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="text-xs text-slate-400">{label}</span>
              </div>
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* 상위 의심 IP */}
      {stats?.topSuspiciousIps && stats.topSuspiciousIps.length > 0 && (
        <div className="bg-[#0a1929] border border-slate-700/50 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" /> 상위 의심 IP (24시간)
          </h3>
          <div className="flex flex-wrap gap-2">
            {stats.topSuspiciousIps.map(({ ip, count, isBlocked }) => (
              <div
                key={ip}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono ${
                  isBlocked ? 'bg-red-900/40 text-red-300 border border-red-700' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {ip} <span className="opacity-60">({count}회)</span>
                {isBlocked && <span className="text-red-400 ml-1">차단중</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 이벤트/차단 탭 */}
        <div className="lg:col-span-2 space-y-4">
          {/* 탭 + 필터 */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
              {(['events', 'blocked'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
                    activeTab === tab ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab === 'events' ? `이벤트 (${total})` : `차단 IP (${blocked.length})`}
                </button>
              ))}
            </div>

            {activeTab === 'events' && (
              <div className="flex gap-2">
                <select
                  value={hours}
                  onChange={e => setHours(Number(e.target.value))}
                  className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1.5"
                >
                  <option value={6}>최근 6시간</option>
                  <option value={24}>최근 24시간</option>
                  <option value={72}>최근 3일</option>
                  <option value={168}>최근 7일</option>
                </select>
                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1.5"
                >
                  <option value="">전체 유형</option>
                  {Object.entries(EVENT_TYPE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 이벤트 목록 */}
          {activeTab === 'events' && (
            <div className="bg-[#0a1929] border border-slate-700/50 rounded-xl overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-slate-500">로딩 중...</div>
              ) : events.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <Shield className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-50" />
                  이 기간에 보안 이벤트가 없습니다
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {events.map(ev => {
                    const type = getEventType(ev.action);
                    const sev = getSeverity(ev);
                    const isOpen = expanded === ev.id;
                    return (
                      <div key={ev.id} className="hover:bg-slate-800/30 transition-colors">
                        <div
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                          onClick={() => setExpanded(isOpen ? null : ev.id)}
                        >
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${SEVERITY_STYLE[sev] ?? SEVERITY_STYLE.LOW}`}>
                            {sev}
                          </span>
                          <span className="text-sm text-slate-300 flex-1">
                            {EVENT_TYPE_LABEL[type] ?? type}
                          </span>
                          <span className="font-mono text-xs text-slate-500">{ev.ipAddress ?? '-'}</span>
                          <span className="text-xs text-slate-600">
                            {new Date(ev.createdAt).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                          </span>
                          <ChevronDown className={`w-3.5 h-3.5 text-slate-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </div>
                        {isOpen && (
                          <div className="px-4 pb-3 bg-slate-900/60 rounded-b text-xs font-mono text-slate-400 space-y-1">
                            <div>IP: {ev.ipAddress ?? '-'}</div>
                            <div>User: {ev.userId ?? '-'}</div>
                            <div>UA: {ev.userAgent?.slice(0, 80) ?? '-'}</div>
                            {ev.metadata && (
                              <pre className="mt-1 p-2 bg-slate-800 rounded text-xs overflow-auto max-h-40">
                                {JSON.stringify(ev.metadata, null, 2)}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 차단 IP 목록 */}
          {activeTab === 'blocked' && (
            <div className="bg-[#0a1929] border border-slate-700/50 rounded-xl overflow-hidden">
              {blocked.length === 0 ? (
                <div className="p-8 text-center text-slate-500">차단된 IP 없음</div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {blocked.map(b => (
                    <div key={b.ip} className="flex items-center justify-between px-4 py-3 hover:bg-slate-800/30">
                      <div>
                        <div className="font-mono text-sm text-red-300">{b.ip}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{b.reason}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-xs text-slate-500">해제까지</div>
                          <div className="text-xs text-orange-400">
                            {Math.max(0, Math.floor((b.expiresAt - Date.now()) / 60000))}분
                          </div>
                        </div>
                        <button
                          onClick={() => handleUnblockIp(b.ip)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-900/20 transition-colors"
                          title="차단 해제"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 오른쪽: IP 수동 차단 */}
        <div className="space-y-4">
          <div className="bg-[#0a1929] border border-slate-700/50 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Ban className="w-4 h-4 text-red-400" /> IP 수동 차단
            </h3>
            <div className="space-y-3">
              <input
                type="text"
                value={blockIpInput}
                onChange={e => setBlockIpInput(e.target.value)}
                placeholder="IP 주소 (예: 1.2.3.4)"
                className="w-full bg-slate-800 border border-slate-700 text-sm text-white rounded-lg px-3 py-2 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <input
                type="text"
                value={blockReason}
                onChange={e => setBlockReason(e.target.value)}
                placeholder="차단 사유"
                className="w-full bg-slate-800 border border-slate-700 text-sm text-white rounded-lg px-3 py-2 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={handleBlockIp}
                disabled={!blockIpInput.trim()}
                className="w-full py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                60분 차단
              </button>
            </div>
          </div>

          {/* 보안 정책 안내 */}
          <div className="bg-[#0a1929] border border-slate-700/50 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Wifi className="w-4 h-4 text-cyan-400" /> 자동 대응 정책
            </h3>
            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex justify-between">
                <span>브루트포스 (15분 내 20회)</span>
                <span className="text-red-400">→ 30분 자동 차단</span>
              </div>
              <div className="flex justify-between">
                <span>CSRF 위반 감지</span>
                <span className="text-orange-400">→ 10분 차단</span>
              </div>
              <div className="flex justify-between">
                <span>Rate Limit 3회 초과</span>
                <span className="text-yellow-400">→ 30분 차단</span>
              </div>
              <div className="flex justify-between">
                <span>HIGH/CRITICAL 이벤트</span>
                <span className="text-cyan-400">→ 이메일 알림</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
