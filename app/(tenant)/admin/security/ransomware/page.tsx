'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield, AlertTriangle, HardDrive, RefreshCw,
  Ban, CheckCircle, Clock, XCircle, Activity,
  Server, Lock, Eye, TrendingDown,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { apiGet, apiPatch } from '@/lib/api/client';

// ── 타입 ─────────────────────────────────────────────────────
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

const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: 'bg-red-900/60 text-red-300 border border-red-600',
  HIGH:     'bg-orange-900/60 text-orange-300 border border-orange-600',
  MEDIUM:   'bg-yellow-900/60 text-yellow-300 border border-yellow-600',
  LOW:      'bg-blue-900/60 text-blue-300 border border-blue-600',
};
const ALERT_TYPE_KO: Record<string, string> = {
  MASS_DELETE:      '대량 삭제',
  MASS_UPDATE:      '대량 업데이트',
  UNUSUAL_EXPORT:   '비정상 내보내기',
  CRYPTO_PATTERN:   '암호화 패턴',
  SUSPICIOUS_QUERY: '의심 쿼리',
  BULK_DOWNLOAD:    '대용량 다운로드',
};
const STATUS_STYLE: Record<string, string> = {
  open:           'text-red-400',
  investigating:  'text-yellow-400',
  contained:      'text-orange-400',
  resolved:       'text-green-400',
  false_positive: 'text-gray-400',
};
const STATUS_KO: Record<string, string> = {
  open: '미해결', investigating: '조사 중', contained: '차단됨',
  resolved: '해결됨', false_positive: '오탐',
};

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
export default function RansomwareDashboardPage() {
  const [alerts,    setAlerts]    = useState<RansomwareAlert[]>([]);
  const [backups,   setBackups]   = useState<BackupRecord[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [updating,  setUpdating]  = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'alerts' | 'backups' | 'stats'>('alerts');
  const [expanded,  setExpanded]  = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [sevFilter,    setSevFilter]    = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
    }
  }, [statusFilter, sevFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    try {
      await apiPatch(`/api/admin/security/ransomware/${id}`, { status });
      showToast(`상태 변경: ${STATUS_KO[status]}`);
      await fetchData();
    } catch {
      showToast('상태 변경 실패', false);
    } finally {
      setUpdating(null);
    }
  };

  // 집계
  const openAlerts     = alerts.filter(a => a.status === 'open').length;
  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL').length;
  const latestBackup   = backups[0] ?? null;
  const lastBackupTime = latestBackup?.completedAt ? timeAgo(latestBackup.completedAt) : '없음';
  const backupOk       = latestBackup?.status === 'verified' || latestBackup?.status === 'completed';

  // 통계용 데이터
  const typeCount = alerts.reduce<Record<string, number>>((acc, a) => {
    const t = ALERT_TYPE_KO[a.alertType] ?? a.alertType;
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});
  const typeChartData = Object.entries(typeCount).map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const sevCount = alerts.reduce<Record<string, number>>((acc, a) => {
    acc[a.severity] = (acc[a.severity] ?? 0) + 1;
    return acc;
  }, {});

  // 일자별 추이 (최근 7일)
  const trendData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().slice(0, 10);
    const count = alerts.filter(a => a.createdAt.startsWith(dateStr)).length;
    return { date: dateStr.slice(5), count };
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-900/30 rounded-lg">
            <Shield className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">랜섬웨어 대응 센터</h1>
            <p className="text-sm text-gray-400">이상 탐지 · 백업 상태 · 인시던트 관리</p>
          </div>
        </div>
        <button onClick={fetchData} disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />새로고침
        </button>
      </div>

      {/* 토스트 */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm shadow-lg ${toast.ok ? 'bg-emerald-700' : 'bg-red-700'} text-white`}>
          {toast.msg}
        </div>
      )}

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="미해결 알림"   value={openAlerts}
          icon={<AlertTriangle className="w-5 h-5 text-red-400" />}
          color={openAlerts > 0 ? 'red' : 'green'}
          sub={openAlerts > 0 ? '즉시 확인 필요' : '정상'} />
        <KpiCard label="CRITICAL"      value={criticalAlerts}
          icon={<XCircle className="w-5 h-5 text-orange-400" />}
          color={criticalAlerts > 0 ? 'orange' : 'green'}
          sub={criticalAlerts > 0 ? '최우선 대응' : '없음'} />
        <KpiCard label="마지막 백업"   value={lastBackupTime}
          icon={<Clock className="w-5 h-5 text-blue-400" />}
          color="blue" sub={latestBackup ? fmtBytes(latestBackup.sizeBytes) : '-'} />
        <KpiCard label="백업 상태"     value={backupOk ? '정상' : latestBackup ? '이상' : '없음'}
          icon={<HardDrive className={`w-5 h-5 ${backupOk ? 'text-green-400' : 'text-red-400'}`} />}
          color={backupOk ? 'green' : 'red'}
          sub={latestBackup?.backupType ?? '-'} />
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1 w-fit">
        {([
          { id: 'alerts',  label: `알림 목록 (${alerts.length})`, icon: <AlertTriangle className="w-3.5 h-3.5" /> },
          { id: 'backups', label: `백업 이력 (${backups.length})`, icon: <HardDrive className="w-3.5 h-3.5" /> },
          { id: 'stats',   label: '통계 분석',                     icon: <Activity className="w-3.5 h-3.5" /> },
        ] as const).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm transition-colors ${activeTab === tab.id ? 'bg-gray-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* ── 알림 목록 탭 ── */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {/* 필터 */}
          <div className="flex gap-2 flex-wrap">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none">
              <option value="">전체 상태</option>
              {Object.entries(STATUS_KO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
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

            {loading ? (
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
                      const isExp = expanded === alert.id;
                      return (
                        <>
                          <tr key={alert.id}
                            className="border-b border-gray-800/50 hover:bg-gray-800/20 transition-colors cursor-pointer"
                            onClick={() => setExpanded(isExp ? null : alert.id)}>
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
                              <span className={`text-xs font-medium ${STATUS_STYLE[alert.status] ?? 'text-gray-400'}`}>
                                {STATUS_KO[alert.status] ?? alert.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                {alert.status === 'open' && (
                                  <>
                                    <ActionBtn label="조사 중" onClick={() => updateStatus(alert.id, 'investigating')}
                                      disabled={updating === alert.id} color="yellow" />
                                    {alert.severity === 'CRITICAL' && (
                                      <ActionBtn label="차단" icon={<Ban className="w-3 h-3" />}
                                        onClick={() => updateStatus(alert.id, 'contained')}
                                        disabled={updating === alert.id} color="red" />
                                    )}
                                  </>
                                )}
                                {['investigating', 'contained'].includes(alert.status) && (
                                  <>
                                    <ActionBtn label="해결됨" onClick={() => updateStatus(alert.id, 'resolved')}
                                      disabled={updating === alert.id} color="green" />
                                    <ActionBtn label="오탐" onClick={() => updateStatus(alert.id, 'false_positive')}
                                      disabled={updating === alert.id} color="gray" />
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isExp && (
                            <tr key={`${alert.id}-exp`} className="border-b border-gray-800/50">
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
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 백업 이력 탭 ── */}
      {activeTab === 'backups' && (
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
                              {ok ? <CheckCircle className="w-3.5 h-3.5 inline mr-1" /> : <XCircle className="w-3.5 h-3.5 inline mr-1" />}
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

          {/* 백업 정책 안내 */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />백업 불변성(Immutability) 정책
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {[
                { title: '로컬 불변 백업', desc: 'chattr +i 플래그로 파일 변경 불가 처리. 루트 권한도 삭제 불가.', color: 'border-blue-700' },
                { title: 'S3 WORM 백업', desc: 'S3 Object Lock COMPLIANCE 모드 + 보존 기간 설정. AWS 계정에서도 삭제 불가.', color: 'border-orange-700' },
                { title: '3-2-1 전략', desc: '3개 복사본 · 2개 미디어 · 1개 오프사이트 유지. 랜섬웨어 피해 시 복구 보장.', color: 'border-emerald-700' },
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

      {/* ── 통계 탭 ── */}
      {activeTab === 'stats' && (
        <div className="space-y-5">
          {/* 심각도 분포 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(sev => {
              const cnt = sevCount[sev] ?? 0;
              const styleMap: Record<string, string> = {
                CRITICAL: 'border-red-900/50 text-red-400',
                HIGH:     'border-orange-900/50 text-orange-400',
                MEDIUM:   'border-yellow-900/50 text-yellow-400',
                LOW:      'border-blue-900/50 text-blue-400',
              };
              return (
                <div key={sev} className={`bg-gray-900 border ${styleMap[sev]?.split(' ')[0]} rounded-xl p-4 text-center`}>
                  <div className={`text-3xl font-bold ${styleMap[sev]?.split(' ')[1]}`}>{cnt}</div>
                  <div className="text-xs text-gray-400 mt-1">{sev}</div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* 알림 유형별 */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-red-400" />알림 유형 분포
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={typeChartData} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} width={80} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                    formatter={(v: number) => [v, '건']} />
                  <Bar dataKey="value" fill="#ef4444" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 일자별 추이 */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-orange-400" />일자별 알림 추이 (7일)
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={trendData}>
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

          {/* 탐지 임계값 정책 */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Eye className="w-4 h-4 text-cyan-400" />이상 탐지 임계값 정책
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { type: '대량 삭제 탐지', threshold: '60초 내 500행 삭제', action: 'HIGH 알림', critical: '1,500행 → CRITICAL + 계정 차단', color: 'border-red-800' },
                { type: '대량 업데이트 탐지', threshold: '60초 내 1,000행 수정', action: 'HIGH 알림', critical: '3,000행 → CRITICAL + 계정 차단', color: 'border-orange-800' },
                { type: '대용량 내보내기 탐지', threshold: '100MB 이상', action: 'MEDIUM 알림', critical: '500MB → HIGH + 이메일', color: 'border-yellow-800' },
                { type: '암호화 패턴 탐지', threshold: 'Base64 비율 50%+, 1KB 이상', action: 'CRITICAL 알림', critical: '즉시 계정 차단 + 이메일', color: 'border-purple-800' },
                { type: '슬라이딩 윈도우', threshold: '60초 집계 창', action: '만료 후 자동 정리', critical: '서버 재시작 시 리셋', color: 'border-blue-800' },
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
  );
}

// ── 서브컴포넌트 ──────────────────────────────────────────────
function KpiCard({ label, value, icon, color, sub }: {
  label: string; value: string | number; icon: React.ReactNode;
  color: 'red' | 'orange' | 'blue' | 'green'; sub?: string;
}) {
  const border = { red: 'border-red-900/50', orange: 'border-orange-900/50', blue: 'border-blue-900/50', green: 'border-green-900/50' };
  const text   = { red: 'text-red-400', orange: 'text-orange-400', blue: 'text-blue-400', green: 'text-green-400' };
  return (
    <div className={`bg-gray-900 border ${border[color]} rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">{label}</span>
        {icon}
      </div>
      <div className={`text-2xl font-bold ${text[color]}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function ActionBtn({ label, icon, onClick, disabled, color }: {
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
