'use client';

import { useState, useCallback } from 'react';
import { Plus, Loader2, Phone, Mail, CheckCircle, AlertCircle, Pencil, X, MessageCircle } from 'lucide-react';
import { NotificationRuleCard } from './NotificationRuleCard';
import { NotificationLogList } from './NotificationLogList';
import { apiPost, apiPatch } from '@/lib/api/client';
import { toast } from '@/lib/toast';

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
  initialRules:       NotificationRule[];
  userPhone:          string | null;
  userEmail:          string;
  smsServiceEnabled:  boolean;
}

const CATEGORIES = [
  { value: 'energy',   label: '에너지 알림',   description: '에너지 사용량 초과, 이상 패턴 감지' },
  { value: 'device',   label: '설비 알림',     description: '설비 고장, 이상 온도, 통신 두절' },
  { value: 'system',   label: '시스템 알림',   description: '시스템 장애, 업데이트, 점검 안내' },
  { value: 'security', label: '보안 알림',     description: '비정상 접근, 인증 실패' },
  { value: 'dr',       label: 'DR/수요반응',   description: 'DR 이벤트 발령, 참여 요청' },
  { value: 'carbon',   label: '탄소 알림',     description: '탄소 배출 초과, 목표 달성' },
  { value: 'cost',     label: '비용 알림',     description: '예산 초과, 요금 변동' },
] as const;

// ─── 전화번호 관리 섹션 ──────────────────────────────────────────

function PhoneSection({
  phone,
  email,
  smsServiceEnabled,
  onPhoneUpdated,
}: {
  phone: string | null;
  email: string;
  smsServiceEnabled: boolean;
  onPhoneUpdated: (phone: string | null) => void;
}) {
  const [editing, setEditing]   = useState(false);
  const [input, setInput]       = useState(phone ?? '');
  const [saving, setSaving]     = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await apiPatch('/api/users/me', { phone: input.trim() || null });
      if (res.success) {
        onPhoneUpdated((res.data as { phone: string | null })?.phone ?? null);
        setEditing(false);
        toast.success('전화번호가 저장되었습니다.');
      } else {
        toast.error(res.error ?? '저장에 실패했습니다.');
      }
    } catch {
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setInput(phone ?? '');
    setEditing(false);
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-4">
      <h2 className="text-sm font-medium text-slate-300 flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-cyan-400" />
        수신 채널 설정
      </h2>

      {/* 이메일 (읽기전용) */}
      <div className="flex items-center justify-between py-2.5 border-b border-slate-700/30">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-emerald-400" />
          <span className="text-sm text-slate-300">이메일</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400 font-mono">{email}</span>
          <CheckCircle className="w-4 h-4 text-emerald-400" />
        </div>
      </div>

      {/* 카카오 알림톡 수신 번호 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-cyan-400" />
          <span className="text-sm text-slate-300">카카오 알림톡 수신 번호</span>
        </div>

        {editing ? (
          <div className="flex items-center gap-2">
            <input
              type="tel"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="010-0000-0000"
              className="w-40 bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={save}
              disabled={saving}
              className="px-3 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '저장'}
            </button>
            <button
              onClick={cancel}
              className="p-1.5 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {phone ? (
              <>
                <span className="text-sm text-slate-300 font-mono">{phone}</span>
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              </>
            ) : (
              <>
                <span className="text-sm text-slate-500">미등록</span>
                <AlertCircle className="w-4 h-4 text-amber-500" />
              </>
            )}
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 text-slate-400 hover:text-cyan-400 transition-colors"
              title="전화번호 수정"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 안내 메시지 */}
      <div className="space-y-1.5 pt-1">
        {!smsServiceEnabled && (
          <p className="text-xs text-amber-400/80 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            알림톡 서비스가 서버에 미설정 상태입니다. (SOLAPI 환경변수 필요)
          </p>
        )}
        {!phone && (
          <p className="text-xs text-slate-500">
            ※ 카카오 알림톡을 받으려면 전화번호를 등록하고 알림 규칙에서 카카오톡 채널을 활성화하세요.
          </p>
        )}
        {phone && (
          <p className="text-xs text-slate-500">
            ※ 알림 규칙에서 카카오톡 채널을 켜야 실제로 알림톡이 발송됩니다.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ───────────────────────────────────────────────

export function NotificationSettings({ initialRules, userPhone, userEmail, smsServiceEnabled }: Props) {
  const [rules,   setRules]   = useState<NotificationRule[]>(initialRules);
  const [phone,   setPhone]   = useState<string | null>(userPhone);
  const [creating, setCreating] = useState(false);

  const handleUpdate = useCallback((updated: NotificationRule) => {
    setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }, []);

  async function createDefaultRule(category: string, label: string, description: string) {
    setCreating(true);
    try {
      const res = await apiPost('/api/notifications/rules', {
        name:        label,
        description,
        category,
        severity:     'warning',
        emailEnabled: true,
        smsEnabled:   false,
        pushEnabled:  false,
      });
      if (res.success && res.data) {
        setRules((prev) => [...prev, res.data as NotificationRule]);
      }
    } catch {
      toast.error('알림 규칙 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setCreating(false);
    }
  }

  // 카테고리별로 규칙 그룹핑
  const rulesByCategory = new Map<string, NotificationRule[]>();
  for (const rule of rules) {
    const existing = rulesByCategory.get(rule.category) ?? [];
    existing.push(rule);
    rulesByCategory.set(rule.category, existing);
  }

  return (
    <div className="space-y-6">
      {/* 수신 채널 설정 */}
      <PhoneSection
        phone={phone}
        email={userEmail}
        smsServiceEnabled={smsServiceEnabled}
        onPhoneUpdated={setPhone}
      />

      {/* 카테고리별 규칙 섹션 */}
      <section>
        <h2 className="text-sm font-medium text-slate-400 mb-4">카테고리별 알림 규칙</h2>
        <div className="space-y-3">
          {CATEGORIES.map((cat) => {
            const categoryRules = rulesByCategory.get(cat.value) ?? [];

            if (categoryRules.length === 0) {
              return (
                <div
                  key={cat.value}
                  className="flex items-center justify-between p-4 bg-slate-800/30 border border-slate-700/30 border-dashed rounded-xl"
                >
                  <div>
                    <p className="text-sm text-slate-400">{cat.label}</p>
                    <p className="text-xs text-slate-600">{cat.description}</p>
                  </div>
                  <button
                    onClick={() => createDefaultRule(cat.value, cat.label, cat.description)}
                    disabled={creating}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {creating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    규칙 추가
                  </button>
                </div>
              );
            }

            return categoryRules.map((rule) => (
              <NotificationRuleCard
                key={rule.id}
                rule={rule}
                hasPhone={!!phone}
                onUpdate={handleUpdate}
              />
            ));
          })}
        </div>
      </section>

      {/* 최근 알림 로그 */}
      <section>
        <h2 className="text-sm font-medium text-slate-400 mb-4">최근 알림 기록</h2>
        <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4">
          <NotificationLogList />
        </div>
      </section>
    </div>
  );
}
