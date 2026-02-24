'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Server,
  Edit3,
  Save,
  X,
  Loader2,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { apiGet, apiPut } from '@/lib/api/client';
import { toast } from '@/lib/toast';

type Period = '1h' | '24h' | '7d' | '30d';

interface TrafficSummary {
  period: string;
  since: string;
  total: number;
  success: number;
  failure: number;
  partial: number;
  unknown: number;
  errorRate: number;
}

interface TimeSeries {
  time: string;
  count: number;
  errors: number;
}

interface TopAction {
  action: string;
  count: number;
}

interface TenantBreakdown {
  tenantId: string;
  tenantName: string;
  apiRateLimit: number;
  count: number;
}

interface RateLimitInfo {
  tenantId: string;
  tenantName: string;
  apiRateLimit: number;
  plan: string;
}

interface RecentError {
  id: string;
  action: string;
  resourceType: string | null;
  errorMessage: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { email: string } | null;
}

interface TrafficData {
  summary: TrafficSummary;
  timeSeries: TimeSeries[];
  topActions: TopAction[];
  tenantBreakdown: TenantBreakdown[];
  rateLimitInfo: RateLimitInfo | null;
  recentErrors: RecentError[];
}

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '1h', label: '1시간' },
  { value: '24h', label: '24시간' },
  { value: '7d', label: '7일' },
  { value: '30d', label: '30일' },
];


function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color = 'text-white',
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400 mb-1">{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
        <Icon className="w-5 h-5 text-gray-500" />
      </div>
    </div>
  );
}

export default function TrafficPage() {
  const [period, setPeriod] = useState<Period>('24h');
  const [data, setData] = useState<TrafficData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Rate limit edit
  const [editingTenant, setEditingTenant] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(1000);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<TrafficData>(`/api/admin/traffic?period=${period}`);
      if (res.data) {
        setData(res.data);
        // super_admin 여부는 tenantBreakdown 존재 여부로 판단
        setIsSuperAdmin(Array.isArray(res.data.tenantBreakdown));
      }
    } catch {
      toast.error('트래픽 데이터를 불러오는 데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSaveRateLimit = async (tenantId: string) => {
    setSaving(true);
    try {
      await apiPut('/api/admin/traffic', { tenantId, apiRateLimit: editValue });
      toast.success('Rate Limit이 업데이트되었습니다.');
      setEditingTenant(null);
      fetchData();
    } catch {
      toast.error('Rate Limit 업데이트에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (t: string) => {
    if (t.length === 10) return t.slice(5); // YYYY-MM-DD → MM-DD
    const parts = t.split(' ');
    return parts[1]?.substring(0, 5) ?? t; // HH:MM
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  const { summary, timeSeries, topActions, tenantBreakdown, rateLimitInfo, recentErrors } =
    data ?? {};

  const successRate =
    summary && summary.total > 0
      ? Math.round((summary.success / summary.total) * 1000) / 10
      : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            트래픽 관리
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            API 요청 통계 및 Rate Limit 관리
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <div className="flex bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  period === opt.value
                    ? 'bg-cyan-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="총 요청 수"
            value={summary.total.toLocaleString()}
            sub={`기준: ${new Date(summary.since).toLocaleString('ko-KR')}`}
            icon={Activity}
          />
          <StatCard
            label="성공률"
            value={`${successRate}%`}
            sub={`${summary.success.toLocaleString()}건 성공`}
            icon={CheckCircle2}
            color="text-green-400"
          />
          <StatCard
            label="오류율"
            value={`${summary.errorRate}%`}
            sub={`${summary.failure.toLocaleString()}건 실패`}
            icon={AlertTriangle}
            color={summary.errorRate > 5 ? 'text-red-400' : 'text-amber-400'}
          />
          <StatCard
            label="평균 요청/시간"
            value={Math.round(
              summary.total /
                (period === '1h' ? 1 : period === '24h' ? 24 : period === '7d' ? 168 : 720)
            ).toLocaleString()}
            sub="요청/시간"
            icon={Zap}
            color="text-cyan-400"
          />
        </div>
      )}

      {/* Time Series Chart */}
      {timeSeries && timeSeries.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-white mb-4">시간대별 요청 분포</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={timeSeries} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0891b2" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0891b2" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorErrors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="time"
                tickFormatter={formatTime}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '6px' }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#d1d5db' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }} />
              <Area
                type="monotone"
                dataKey="count"
                name="요청"
                stroke="#0891b2"
                fill="url(#colorCount)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="errors"
                name="오류"
                stroke="#ef4444"
                fill="url(#colorErrors)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Actions */}
        {topActions && topActions.length > 0 && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-white mb-4">상위 API 액션 (Top 10)</h2>
            <div className="space-y-2">
              {topActions.map((item, idx) => {
                const maxCount = topActions[0]?.count ?? 1;
                const pct = Math.round((item.count / maxCount) * 100);
                return (
                  <div key={idx} className="text-sm">
                    <div className="flex justify-between text-gray-300 mb-1">
                      <span className="truncate max-w-[70%] font-mono text-xs">{item.action}</span>
                      <span className="text-gray-400 shrink-0 ml-2">{item.count.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5">
                      <div
                        className="bg-cyan-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Rate Limit Info */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-400" />
            Rate Limit 현황
          </h2>
          {rateLimitInfo ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                <span className="text-gray-400 text-sm">테넌트</span>
                <span className="text-white text-sm font-medium">{rateLimitInfo.tenantName}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-700">
                <span className="text-gray-400 text-sm">플랜</span>
                <span className="text-cyan-400 text-sm font-medium uppercase">{rateLimitInfo.plan}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-400 text-sm">API Rate Limit</span>
                {editingTenant === rateLimitInfo.tenantId ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(Number(e.target.value))}
                      min={10}
                      max={100000}
                      className="w-24 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm text-right"
                    />
                    <button
                      onClick={() => handleSaveRateLimit(rateLimitInfo.tenantId)}
                      disabled={saving}
                      className="p-1.5 bg-green-600 hover:bg-green-500 rounded text-white"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => setEditingTenant(null)}
                      className="p-1.5 bg-gray-600 hover:bg-gray-500 rounded text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold">
                      {rateLimitInfo.apiRateLimit.toLocaleString()}
                      <span className="text-gray-400 font-normal text-xs ml-1">req/일</span>
                    </span>
                    {isSuperAdmin && (
                      <button
                        onClick={() => {
                          setEditingTenant(rateLimitInfo.tenantId);
                          setEditValue(rateLimitInfo.apiRateLimit);
                        }}
                        className="p-1 text-gray-400 hover:text-white rounded"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              {summary && (
                <>
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                      <span>기간 내 사용량</span>
                      <span>
                        {summary.total.toLocaleString()} / {rateLimitInfo.apiRateLimit.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          summary.total / rateLimitInfo.apiRateLimit > 0.8
                            ? 'bg-red-500'
                            : summary.total / rateLimitInfo.apiRateLimit > 0.5
                            ? 'bg-amber-500'
                            : 'bg-green-500'
                        }`}
                        style={{
                          width: `${Math.min(100, (summary.total / rateLimitInfo.apiRateLimit) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Rate Limit 정보를 불러올 수 없습니다.</p>
          )}
        </div>
      </div>

      {/* Tenant Breakdown (super_admin) */}
      {isSuperAdmin && tenantBreakdown && tenantBreakdown.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-white mb-4">테넌트별 API 사용량 (Top 20)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left pb-2 font-medium">테넌트</th>
                  <th className="text-right pb-2 font-medium">요청 수</th>
                  <th className="text-right pb-2 font-medium">Rate Limit</th>
                  <th className="text-right pb-2 font-medium">사용률</th>
                  <th className="text-center pb-2 font-medium">수정</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {tenantBreakdown.map((t) => {
                  const usagePct = Math.min(100, Math.round((t.count / t.apiRateLimit) * 100));
                  return (
                    <tr key={t.tenantId} className="hover:bg-gray-700/30 transition-colors">
                      <td className="py-2.5 text-white">{t.tenantName}</td>
                      <td className="py-2.5 text-right text-gray-300">{t.count.toLocaleString()}</td>
                      <td className="py-2.5 text-right text-gray-300">
                        {editingTenant === t.tenantId ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(Number(e.target.value))}
                              min={10}
                              max={100000}
                              className="w-20 px-2 py-0.5 bg-gray-700 border border-gray-600 rounded text-white text-xs text-right"
                            />
                            <button
                              onClick={() => handleSaveRateLimit(t.tenantId)}
                              disabled={saving}
                              className="p-1 bg-green-600 hover:bg-green-500 rounded text-white"
                            >
                              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            </button>
                            <button
                              onClick={() => setEditingTenant(null)}
                              className="p-1 bg-gray-600 hover:bg-gray-500 rounded"
                            >
                              <X className="w-3 h-3 text-white" />
                            </button>
                          </div>
                        ) : (
                          t.apiRateLimit.toLocaleString()
                        )}
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-gray-700 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${
                                usagePct > 80 ? 'bg-red-500' : usagePct > 50 ? 'bg-amber-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${usagePct}%` }}
                            />
                          </div>
                          <span
                            className={`text-xs w-10 text-right ${
                              usagePct > 80
                                ? 'text-red-400'
                                : usagePct > 50
                                ? 'text-amber-400'
                                : 'text-green-400'
                            }`}
                          >
                            {usagePct}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 text-center">
                        {editingTenant !== t.tenantId && (
                          <button
                            onClick={() => {
                              setEditingTenant(t.tenantId);
                              setEditValue(t.apiRateLimit);
                            }}
                            className="p-1 text-gray-400 hover:text-white rounded"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Errors */}
      {recentErrors && recentErrors.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            최근 오류 로그 (최신 10건)
          </h2>
          <div className="space-y-2">
            {recentErrors.map((err) => (
              <div
                key={err.id}
                className="flex items-start gap-3 p-3 bg-gray-900/60 rounded-lg border border-red-900/30"
              >
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-red-300">{err.action}</span>
                    {err.resourceType && (
                      <span className="text-xs text-gray-500">({err.resourceType})</span>
                    )}
                  </div>
                  {err.errorMessage && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{err.errorMessage}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    {err.user?.email && <span>{err.user.email}</span>}
                    {err.ipAddress && <span>{err.ipAddress}</span>}
                    <span>{new Date(err.createdAt).toLocaleString('ko-KR')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && summary && summary.total === 0 && (
        <div className="text-center py-16 text-gray-500">
          <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>선택한 기간 내 트래픽 데이터가 없습니다.</p>
        </div>
      )}
    </div>
  );
}
