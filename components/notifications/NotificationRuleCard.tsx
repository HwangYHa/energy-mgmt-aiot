'use client';

import { useState } from 'react';
import {
  Bell,
  Mail,
  MessageCircle,
  Smartphone,
  Globe,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
  AlertCircle,
} from 'lucide-react';
import { apiPatch } from '@/lib/api/client';

interface NotificationRule {
  id: string;
  name: string;
  description: string | null;
  category: string;
  severity: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  webhookUrl: string | null;
  enabled: boolean;
  threshold: number | null;
  thresholdUnit: string | null;
  thresholdOp: string | null;
}

interface Props {
  rule: NotificationRule;
  hasPhone: boolean;
  onUpdate: (rule: NotificationRule) => void;
}

const SEVERITY_CONFIG = {
  info: {
    label: '정보',
    icon: Info,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
  warning: {
    label: '경고',
    icon: AlertTriangle,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
  critical: {
    label: '위험',
    icon: AlertCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  system: '시스템',
  energy: '에너지',
  device: '설비',
  security: '보안',
  dr: 'DR/수요반응',
  carbon: '탄소',
  cost: '비용',
};

export function NotificationRuleCard({ rule, hasPhone, onUpdate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const severity = SEVERITY_CONFIG[rule.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.info;
  const SeverityIcon = severity.icon;

  function showFeedback(type: 'error' | 'success', msg: string) {
    if (type === 'error') {
      setErrorMsg(msg);
      setSuccessMsg(null);
    } else {
      setSuccessMsg(msg);
      setErrorMsg(null);
    }
    setTimeout(() => { setErrorMsg(null); setSuccessMsg(null); }, 3000);
  }

  async function toggleChannel(field: 'emailEnabled' | 'smsEnabled' | 'pushEnabled') {
    setUpdating(true);
    try {
      const res = await apiPatch('/api/notifications/rules', {
        id: rule.id,
        [field]: !rule[field],
      });
      if (res.success && res.data) {
        onUpdate(res.data as NotificationRule);
      }
    } catch (error) {
      console.error('알림 채널 업데이트 실패:', error);
      showFeedback('error', '채널 변경에 실패했습니다.');
    } finally {
      setUpdating(false);
    }
  }

  async function toggleEnabled() {
    setUpdating(true);
    try {
      const res = await apiPatch('/api/notifications/rules', {
        id: rule.id,
        enabled: !rule.enabled,
      });
      if (res.success && res.data) {
        onUpdate(res.data as NotificationRule);
      }
    } catch (error) {
      console.error('알림 규칙 상태 변경 실패:', error);
      showFeedback('error', '상태 변경에 실패했습니다.');
    } finally {
      setUpdating(false);
    }
  }

  async function changeSeverity(newSeverity: string) {
    setUpdating(true);
    try {
      const res = await apiPatch('/api/notifications/rules', {
        id: rule.id,
        severity: newSeverity,
      });
      if (res.success && res.data) {
        onUpdate(res.data as NotificationRule);
      }
    } catch (error) {
      console.error('심각도 변경 실패:', error);
      showFeedback('error', '심각도 변경에 실패했습니다.');
    } finally {
      setUpdating(false);
    }
  }

  async function updateThreshold(op: string | null, value: number | null, unit: string | null) {
    setUpdating(true);
    try {
      const res = await apiPatch('/api/notifications/rules', {
        id: rule.id,
        thresholdOp: op,
        threshold: value,
        thresholdUnit: unit,
      });
      if (res.success && res.data) {
        onUpdate(res.data as NotificationRule);
      }
    } catch (error) {
      console.error('임계값 업데이트 실패:', error);
      showFeedback('error', '임계값 변경에 실패했습니다.');
    } finally {
      setUpdating(false);
    }
  }

  async function sendTestNotification() {
    setUpdating(true);
    try {
      const res = await apiPatch('/api/notifications/rules', {
        id: rule.id,
        testSend: true,
      });
      if (res.success) {
        showFeedback('success', '테스트 알림이 발송되었습니다.');
      }
    } catch (error) {
      console.error('테스트 알림 발송 실패:', error);
      showFeedback('error', '테스트 알림 발송에 실패했습니다.');
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div
      className={`border rounded-xl transition-all ${
        rule.enabled
          ? 'bg-slate-800/50 border-slate-700/50'
          : 'bg-slate-900/30 border-slate-800/30 opacity-60'
      }`}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${severity.bg}`}>
            <SeverityIcon className={`w-4 h-4 ${severity.color}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">{rule.name}</span>
              <span className="text-xs text-slate-500 px-2 py-0.5 bg-slate-700/50 rounded-full">
                {CATEGORY_LABELS[rule.category] || rule.category}
              </span>
            </div>
            {rule.description && (
              <p className="text-xs text-slate-400 mt-0.5">{rule.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 활성/비활성 토글 */}
          <button
            onClick={toggleEnabled}
            disabled={updating}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              rule.enabled ? 'bg-cyan-600' : 'bg-slate-600'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                rule.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>

          {/* 펼치기/접기 */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 채널 요약 (접힘 상태) */}
      {!expanded && (
        <div className="px-4 pb-3 flex items-center gap-2">
          <Mail
            className={`w-3.5 h-3.5 ${rule.emailEnabled ? 'text-cyan-400' : 'text-slate-600'}`}
          />
          <MessageCircle
            className={`w-3.5 h-3.5 ${rule.smsEnabled ? 'text-cyan-400' : 'text-slate-600'}`}
          />
          <Smartphone
            className={`w-3.5 h-3.5 ${rule.pushEnabled ? 'text-cyan-400' : 'text-slate-600'}`}
          />
          {rule.webhookUrl && <Globe className="w-3.5 h-3.5 text-cyan-400" />}
          <span className={`text-xs ml-2 px-1.5 py-0.5 rounded ${severity.bg} ${severity.color}`}>
            {severity.label} 이상
          </span>
        </div>
      )}

      {/* 상세 설정 (펼침 상태) */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-700/30 space-y-4">
          {/* 채널 토글 */}
          <div>
            <p className="text-xs text-slate-500 mb-2">알림 채널</p>
            <div className="flex gap-2 flex-wrap">
              <ChannelButton
                icon={Mail}
                label="이메일"
                active={rule.emailEnabled}
                disabled={updating}
                onClick={() => toggleChannel('emailEnabled')}
              />
              <ChannelButton
                icon={MessageCircle}
                label="카카오톡"
                active={rule.smsEnabled}
                disabled={updating}
                onClick={() => toggleChannel('smsEnabled')}
              />
              <ChannelButton
                icon={Smartphone}
                label="푸시"
                active={rule.pushEnabled}
                disabled={updating}
                onClick={() => toggleChannel('pushEnabled')}
              />
            </div>
            {rule.smsEnabled && !hasPhone && (
              <p className="text-xs text-amber-400 mt-1.5">
                ⚠ 전화번호가 미등록되어 카카오 알림톡이 발송되지 않습니다. 상단에서 번호를 등록하세요.
              </p>
            )}
          </div>

          {/* 심각도 선택 */}
          <div>
            <p className="text-xs text-slate-500 mb-2">최소 심각도</p>
            <div className="flex gap-2">
              {(['info', 'warning', 'critical'] as const).map((sev) => {
                const conf = SEVERITY_CONFIG[sev];
                const Icon = conf.icon;
                return (
                  <button
                    key={sev}
                    onClick={() => changeSeverity(sev)}
                    disabled={updating}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                      rule.severity === sev
                        ? `${conf.bg} ${conf.border} ${conf.color}`
                        : 'bg-slate-800/30 border-slate-700/30 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {conf.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 임계값 설정 */}
          <div>
            <p className="text-xs text-slate-500 mb-2">임계값 조건</p>
            <div className="flex items-center gap-2">
              <select
                value={rule.thresholdOp || 'gt'}
                onChange={(e) => updateThreshold(e.target.value, rule.threshold, rule.thresholdUnit)}
                disabled={updating}
                className="bg-slate-800/30 border border-slate-700/30 rounded-lg px-2 py-1.5 text-xs text-white"
              >
                <option value="gt">초과 (&gt;)</option>
                <option value="gte">이상 (&ge;)</option>
                <option value="lt">미만 (&lt;)</option>
                <option value="lte">이하 (&le;)</option>
                <option value="eq">같음 (=)</option>
              </select>
              <input
                type="number"
                value={rule.threshold ?? ''}
                onChange={(e) => updateThreshold(rule.thresholdOp, e.target.value ? parseFloat(e.target.value) : null, rule.thresholdUnit)}
                disabled={updating}
                placeholder="임계값"
                className="w-24 bg-slate-800/30 border border-slate-700/30 rounded-lg px-2 py-1.5 text-xs text-white"
              />
              <input
                type="text"
                value={rule.thresholdUnit || ''}
                onChange={(e) => updateThreshold(rule.thresholdOp, rule.threshold, e.target.value || null)}
                disabled={updating}
                placeholder="단위"
                className="w-16 bg-slate-800/30 border border-slate-700/30 rounded-lg px-2 py-1.5 text-xs text-white"
              />
            </div>
          </div>

          {/* 테스트 발송 */}
          <div>
            <button
              onClick={sendTestNotification}
              disabled={updating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-lg transition-colors disabled:opacity-50"
            >
              {updating ? <Bell className="w-3.5 h-3.5 animate-pulse" /> : <Bell className="w-3.5 h-3.5" />}
              테스트 알림 발송
            </button>
          </div>

          {/* 웹훅 URL */}
          {rule.webhookUrl && (
            <div>
              <p className="text-xs text-slate-500 mb-1">웹훅 URL</p>
              <p className="text-xs text-slate-400 font-mono bg-slate-900/50 rounded px-2 py-1 truncate">
                {rule.webhookUrl}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 에러/성공 피드백 */}
      {errorMsg && (
        <div className="mx-4 mb-3 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="mx-4 mb-3 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-400">
          {successMsg}
        </div>
      )}
    </div>
  );
}

function ChannelButton({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: typeof Bell;
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all ${
        active
          ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
          : 'bg-slate-800/30 border-slate-700/30 text-slate-500 hover:text-slate-300'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
