'use client';

import { useState, useCallback } from 'react';
import { Plus, Loader2, Mail, CheckCircle, AlertCircle, MessageCircle } from 'lucide-react';
// [SMS_DISABLED] Phone, Pencil, X 아이콘 일시 미사용
import { NotificationRuleCard } from './NotificationRuleCard';
import { NotificationLogList } from './NotificationLogList';
import { apiPost } from '@/lib/api/client';
// [SMS_DISABLED] apiPatch 일시 미사용
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
  phone: _phone,         // [SMS_DISABLED]
  email,
  smsServiceEnabled: _smsServiceEnabled,    // [SMS_DISABLED]
  onPhoneUpdated: _onPhoneUpdated,          // [SMS_DISABLED]
}: {
  phone: string | null;
  email: string;
  smsServiceEnabled: boolean;
  onPhoneUpdated: (phone: string | null) => void;
}) {
  // [SMS_DISABLED] 전화번호 편집 state 일시 미사용
  // const [editing, setEditing] = useState(false);
  // const [input, setInput] = useState(phone ?? '');
  // const [saving, setSaving] = useState(false);

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

      {/* [SMS_DISABLED] 카카오 알림톡 수신 번호 — 일시 비활성화
          재활성화: 아래 주석 블록을 해제하고 위 disabled 배너 제거 */}

      {/* SMS 서비스 준비 중 안내 배너 */}
      <div className="flex items-center gap-2 py-2.5 px-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
        <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
        <div>
          <p className="text-xs text-amber-300 font-medium">카카오 알림톡 서비스 준비 중</p>
          <p className="text-xs text-amber-400/70 mt-0.5">비즈니스 채널 개설 후 활성화됩니다. 현재 이메일 알림만 사용 가능합니다.</p>
        </div>
      </div>

      {/*
      [SMS_DISABLED] 전화번호 입력 섹션 — 아래 주석 해제 시 재활성화
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-cyan-400" />
          <span className="text-sm text-slate-300">카카오 알림톡 수신 번호</span>
        </div>
        ...전화번호 입력 UI...
      </div>
      */}
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
