'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { apiGet, ApiError } from '@/lib/api/client';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Bell,
  Settings,
  Loader2,
  Clock,
  Shield,
} from 'lucide-react';

interface AlertItem {
  id: string;
  channel: string;
  subject: string;
  body: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
  rule: {
    name: string;
    category: string;
    severity: string;
  };
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const fetchAlerts = useCallback(async () => {
    setError(null);
    try {
      const res = await apiGet<AlertItem[]>('/api/alerts?days=30&take=100');
      setAlerts(res.data ?? []);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : '네트워크 오류가 발생했습니다.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // 통계 계산
  const stats = {
    total: alerts.length,
    critical: alerts.filter((a) => a.rule?.severity === 'critical').length,
    warning: alerts.filter((a) => a.rule?.severity === 'warning').length,
    info: alerts.filter((a) => a.rule?.severity === 'info').length,
  };

  const filteredAlerts =
    filter === 'all'
      ? alerts
      : alerts.filter((a) => a.rule?.severity === filter);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-400" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-amber-400" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-400" />;
      default:
        return <Bell className="w-5 h-5 text-slate-400" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const styles: Record<string, string> = {
      critical: 'bg-red-500/10 text-red-400 border-red-500/30',
      warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      info: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    };
    const labels: Record<string, string> = {
      critical: '긴급',
      warning: '경고',
      info: '정보',
    };

    return (
      <span
        className={`px-2 py-0.5 rounded border text-xs font-medium ${
          styles[severity] || 'bg-slate-500/10 text-slate-400 border-slate-500/30'
        }`}
      >
        {labels[severity] || severity}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      sent: 'text-emerald-400',
      failed: 'text-red-400',
      pending: 'text-amber-400',
    };
    const labels: Record<string, string> = {
      sent: '전송됨',
      failed: '실패',
      pending: '대기',
    };

    return (
      <span className={`text-xs ${styles[status] || 'text-slate-400'}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full bg-[#051225] text-white p-4 md:p-6">
      {/* 에러 배너 */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 flex items-center justify-between">
          <p className="text-sm text-red-300">알림 로드 실패: {error}</p>
          <button
            onClick={fetchAlerts}
            className="px-3 py-1.5 bg-red-500/20 text-red-300 rounded-lg text-sm hover:bg-red-500/30 transition"
          >
            재시도
          </button>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Bell className="w-6 h-6 text-amber-400" />
            </div>
            알림 현황
          </h1>
          <p className="text-slate-400 mt-1">시스템 알림 및 알람 로그</p>
        </div>
        <Link href="/settings/notifications">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 border border-slate-700 hover:border-cyan-500/30 rounded-lg text-sm transition">
            <Settings className="w-4 h-4 text-cyan-400" />
            알림 설정
          </button>
        </Link>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="전체"
          value={stats.total}
          icon={<Bell className="w-5 h-5 text-slate-400" />}
          bgColor="bg-slate-500/10"
          borderColor="border-slate-700/50"
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        <StatCard
          label="긴급"
          value={stats.critical}
          icon={<AlertTriangle className="w-5 h-5 text-red-400" />}
          bgColor="bg-red-500/10"
          borderColor="border-red-500/30"
          valueColor="text-red-400"
          active={filter === 'critical'}
          onClick={() => setFilter(filter === 'critical' ? 'all' : 'critical')}
        />
        <StatCard
          label="경고"
          value={stats.warning}
          icon={<AlertCircle className="w-5 h-5 text-amber-400" />}
          bgColor="bg-amber-500/10"
          borderColor="border-amber-500/30"
          valueColor="text-amber-400"
          active={filter === 'warning'}
          onClick={() => setFilter(filter === 'warning' ? 'all' : 'warning')}
        />
        <StatCard
          label="정보"
          value={stats.info}
          icon={<Info className="w-5 h-5 text-blue-400" />}
          bgColor="bg-blue-500/10"
          borderColor="border-blue-500/30"
          valueColor="text-blue-400"
          active={filter === 'info'}
          onClick={() => setFilter(filter === 'info' ? 'all' : 'info')}
        />
      </div>

      {/* 알림 목록 */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            최근 알림
            {filter !== 'all' && (
              <span className="text-xs text-slate-400 ml-2">
                ({filteredAlerts.length}건)
              </span>
            )}
          </h2>
        </div>

        {filteredAlerts.length > 0 ? (
          <div className="divide-y divide-slate-700/30">
            {filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className="px-6 py-4 hover:bg-slate-700/20 transition"
              >
                <div className="flex items-start gap-4">
                  <div className="mt-0.5">
                    {getSeverityIcon(alert.rule?.severity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {getSeverityBadge(alert.rule?.severity)}
                      <span className="text-xs text-slate-500">
                        {alert.rule?.name}
                      </span>
                      <span className="text-xs text-slate-600">|</span>
                      <span className="text-xs text-slate-500">
                        {alert.createdAt
                          ? new Date(alert.createdAt).toLocaleString('ko-KR')
                          : '-'}
                      </span>
                    </div>
                    <p className="text-sm text-white font-medium">
                      {alert.subject}
                    </p>
                    {alert.body && (
                      <p className="text-sm text-slate-400 mt-1 line-clamp-2">
                        {alert.body}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-700/50 rounded">
                      {alert.channel}
                    </span>
                    {getStatusBadge(alert.status)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <Shield className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 mb-2">
              {filter === 'all'
                ? '알림 내역이 없습니다'
                : '해당 심각도의 알림이 없습니다'}
            </p>
            <p className="text-sm text-slate-500">
              알림 규칙을 설정하면 조건 충족 시 자동으로 알림이 발송됩니다
            </p>
            <Link href="/settings/notifications">
              <button className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-sm transition">
                알림 규칙 설정
              </button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  bgColor,
  borderColor,
  valueColor = 'text-white',
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  bgColor: string;
  borderColor: string;
  valueColor?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`${bgColor} border ${
        active ? 'border-cyan-500/50 ring-1 ring-cyan-500/20' : borderColor
      } rounded-xl p-4 text-left hover:border-cyan-500/30 transition-all`}
    >
      <div className="flex items-center justify-between mb-2">
        {icon}
        <CheckCircle2
          className={`w-4 h-4 transition ${
            active ? 'text-cyan-400' : 'text-transparent'
          }`}
        />
      </div>
      <div className={`text-2xl font-bold ${valueColor}`}>{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{label}</div>
    </button>
  );
}
