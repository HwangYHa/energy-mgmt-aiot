'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Shield,
  Search,
  RefreshCw,
  Loader2,
  User,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Filter,
} from 'lucide-react';

interface AuditLogItem {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  result: string | null;
  changes: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string; role: string } | null;
}

const RESULT_CONFIG = {
  success: { icon: CheckCircle2, color: 'text-emerald-400' },
  failure: { icon: XCircle, color: 'text-red-400' },
  partial: { icon: AlertTriangle, color: 'text-amber-400' },
} as const satisfies Record<string, { icon: typeof CheckCircle2; color: string }>;

export default function AuditTrailPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [resourceTypes, setResourceTypes] = useState<{ type: string; count: number }[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ take: '50' });
      if (search) params.set('action', search);
      if (filterType) params.set('resourceType', filterType);

      const res = await fetch(`/api/compliance/audit-trail?${params}`);
      const json = await res.json();
      if (json.success) {
        setLogs(json.data);
        setTotal(json.pagination?.total || 0);
        setTodayCount(json.meta?.todayCount || 0);
        setResourceTypes(json.meta?.resourceTypes || []);
      }
    } catch { /* silent */ } finally {
      setIsLoading(false);
    }
  }, [search, filterType]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <Shield className="w-6 h-6 text-cyan-400" />
            </div>
            감사 추적 (Audit Trail)
          </h1>
          <p className="text-slate-400 text-sm mt-1">데이터 변경 이력 및 사용자 활동 추적</p>
        </div>
        <button onClick={fetchLogs} className="p-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 text-slate-400">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-xs text-slate-400">전체 로그</div>
          <div className="text-2xl font-bold text-cyan-400">{total.toLocaleString()}</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-xs text-slate-400">오늘 활동</div>
          <div className="text-2xl font-bold text-emerald-400">{todayCount}</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="text-xs text-slate-400">리소스 유형</div>
          <div className="text-2xl font-bold text-blue-400">{resourceTypes.length}</div>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="액션 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="">모든 리소스</option>
            {resourceTypes.map((rt) => (
              <option key={rt.type} value={rt.type || ''}>{rt.type || '(없음)'} ({rt.count})</option>
            ))}
          </select>
        </div>
      </div>

      {/* 로그 목록 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>감사 로그가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const resultKey = (log.result || 'success') as keyof typeof RESULT_CONFIG;
            const result = RESULT_CONFIG[resultKey] || RESULT_CONFIG.success;
            const ResultIcon = result.icon;
            const isExpanded = expandedId === log.id;

            return (
              <div
                key={log.id}
                className="bg-slate-800/50 border border-slate-700/50 rounded-xl transition hover:border-slate-600 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : log.id)}
              >
                <div className="flex items-center gap-4 p-4">
                  <ResultIcon className={`w-5 h-5 flex-shrink-0 ${result.color}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-white">{log.action}</span>
                      {log.resourceType && (
                        <span className="text-[10px] px-2 py-0.5 bg-slate-700/50 text-slate-400 rounded-full">{log.resourceType}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      {log.user && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" /> {log.user.name} ({log.user.role})
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(log.createdAt).toLocaleString('ko-KR')}
                      </span>
                      {log.ipAddress && <span>{log.ipAddress}</span>}
                    </div>
                  </div>
                </div>

                {isExpanded && log.changes && (
                  <div className="px-4 pb-4 border-t border-slate-700/30 pt-3">
                    <p className="text-xs text-slate-500 mb-2">변경 내역</p>
                    <pre className="text-xs text-slate-300 bg-slate-900/50 rounded-lg p-3 overflow-x-auto max-h-40">
                      {JSON.stringify(log.changes, null, 2)}
                    </pre>
                    {log.resourceId && (
                      <p className="text-xs text-slate-500 mt-2">리소스 ID: <span className="text-slate-400 font-mono">{log.resourceId}</span></p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
