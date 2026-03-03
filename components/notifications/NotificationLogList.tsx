'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  Mail,
  MessageCircle,
  Smartphone,
  Globe,
  Loader2,
  InboxIcon,
} from 'lucide-react';
import { apiGet } from '@/lib/api/client';

interface NotificationLog {
  id: string;
  channel: string;
  recipient: string;
  subject: string;
  status: string;
  errorMsg: string | null;
  sentAt: string | null;
  createdAt: string;
  rule: {
    name: string;
    category: string;
    severity: string;
  };
}

const STATUS_CONFIG = {
  sent: { icon: CheckCircle, label: '전송됨', color: 'text-emerald-400' },
  failed: { icon: XCircle, label: '실패', color: 'text-red-400' },
  pending: { icon: Clock, label: '대기중', color: 'text-amber-400' },
};

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  email:   Mail,
  kakao:   MessageCircle,
  sms:     MessageCircle, // 구 데이터 호환
  push:    Smartphone,
  webhook: Globe,
};

const SEVERITY_COLORS: Record<string, string> = {
  info: 'text-blue-400 bg-blue-500/10',
  warning: 'text-amber-400 bg-amber-500/10',
  critical: 'text-red-400 bg-red-500/10',
};

export function NotificationLogList() {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    setError(null);
    try {
      const res = await apiGet<NotificationLog[]>('/api/notifications/logs?take=30');
      if (res.success && res.data) {
        setLogs(res.data);
      }
    } catch {
      setError('알림 로그를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <XCircle className="w-10 h-10 text-red-500/50 mx-auto mb-3" />
        <p className="text-sm text-red-400 mb-2">{error}</p>
        <button onClick={() => { setLoading(true); fetchLogs(); }} className="text-xs text-cyan-400 hover:text-cyan-300 transition">
          재시도
        </button>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8">
        <InboxIcon className="w-10 h-10 text-slate-600 mx-auto mb-3" />
        <p className="text-sm text-slate-500">최근 알림 기록이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => {
        const statusConf = STATUS_CONFIG[log.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
        const StatusIcon = statusConf.icon;
        const ChannelIcon = CHANNEL_ICONS[log.channel] || Mail;
        const severityClass = SEVERITY_COLORS[log.rule.severity] || SEVERITY_COLORS.info;

        return (
          <div
            key={log.id}
            className="flex items-start gap-3 p-3 bg-slate-800/30 border border-slate-700/30 rounded-lg"
          >
            {/* 상태 아이콘 */}
            <StatusIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${statusConf.color}`} />

            {/* 내용 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm text-white truncate">{log.subject}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${severityClass}`}>
                  {log.rule.severity}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <ChannelIcon className="w-3 h-3" />
                <span className="truncate">{log.recipient}</span>
                <span>·</span>
                <span>{log.rule.name}</span>
              </div>
              {log.status === 'failed' && log.errorMsg && (
                <p className="text-xs text-red-400/80 mt-1">{log.errorMsg}</p>
              )}
            </div>

            {/* 시간 */}
            <span className="text-[11px] text-slate-500 flex-shrink-0">
              {formatRelativeTime(log.sentAt || log.createdAt)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;

  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}
