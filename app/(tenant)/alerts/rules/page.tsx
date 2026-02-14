'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Loader2,
  Shield,
} from 'lucide-react';

interface NotificationRule {
  id: string;
  name: string;
  description: string | null;
  category: string;
  severity: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  enabled: boolean;
  createdAt: string;
}

export default function AlertRulesPage() {
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/rules');
      const json = await res.json();
      if (json.success) {
        setRules(json.data || []);
      }
    } catch {
      // 규칙 조회 실패
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

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

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      energy: '에너지',
      equipment: '설비',
      security: '보안',
      system: '시스템',
    };
    return labels[category] || category;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#051225] text-white p-4 md:p-6">
      {/* 뒤로 가기 */}
      <Link
        href="/alerts"
        className="inline-flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        알림 현황으로 돌아가기
      </Link>

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Bell className="w-6 h-6 text-amber-400" />
            </div>
            알림 규칙
          </h1>
          <p className="text-slate-400 mt-1">알림 조건 및 채널 설정</p>
        </div>
        <Link href="/settings/notifications">
          <button className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-sm font-medium transition">
            알림 설정으로 이동
          </button>
        </Link>
      </div>

      {/* 규칙 목록 */}
      {rules.length > 0 ? (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`bg-slate-800/50 border rounded-xl p-5 transition ${
                rule.enabled
                  ? 'border-slate-700/50'
                  : 'border-slate-700/30 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-white">{rule.name}</h3>
                    {getSeverityBadge(rule.severity)}
                    <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-700/50 rounded">
                      {getCategoryLabel(rule.category)}
                    </span>
                    {!rule.enabled && (
                      <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-700/50 rounded">
                        비활성
                      </span>
                    )}
                  </div>
                  {rule.description && (
                    <p className="text-sm text-slate-400">{rule.description}</p>
                  )}
                </div>

                {/* 채널 아이콘 */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div
                    className={`p-1.5 rounded ${
                      rule.emailEnabled
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'bg-slate-700/30 text-slate-600'
                    }`}
                    title="이메일"
                  >
                    <Mail className="w-4 h-4" />
                  </div>
                  <div
                    className={`p-1.5 rounded ${
                      rule.smsEnabled
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-slate-700/30 text-slate-600'
                    }`}
                    title="SMS"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div
                    className={`p-1.5 rounded ${
                      rule.pushEnabled
                        ? 'bg-purple-500/10 text-purple-400'
                        : 'bg-slate-700/30 text-slate-600'
                    }`}
                    title="푸시"
                  >
                    <Smartphone className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl py-16 text-center">
          <Shield className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400 mb-2">등록된 알림 규칙이 없습니다</p>
          <p className="text-sm text-slate-500 mb-4">
            알림 설정에서 새로운 규칙을 추가하세요
          </p>
          <Link href="/settings/notifications">
            <button className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-sm transition">
              알림 규칙 설정
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}
