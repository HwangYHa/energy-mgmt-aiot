'use client';

import { useState, useCallback } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { NotificationRuleCard } from './NotificationRuleCard';
import { NotificationLogList } from './NotificationLogList';
import { apiPost } from '@/lib/api/client';

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
  initialRules: NotificationRule[];
}

const CATEGORIES = [
  { value: 'energy', label: '에너지 알림', description: '에너지 사용량 초과, 이상 패턴 감지' },
  { value: 'device', label: '설비 알림', description: '설비 고장, 이상 온도, 통신 두절' },
  { value: 'system', label: '시스템 알림', description: '시스템 장애, 업데이트, 점검 안내' },
  { value: 'security', label: '보안 알림', description: '비정상 접근, 인증 실패' },
  { value: 'dr', label: 'DR/수요반응', description: 'DR 이벤트 발령, 참여 요청' },
  { value: 'carbon', label: '탄소 알림', description: '탄소 배출 초과, 목표 달성' },
  { value: 'cost', label: '비용 알림', description: '예산 초과, 요금 변동' },
] as const;

export function NotificationSettings({ initialRules }: Props) {
  const [rules, setRules] = useState<NotificationRule[]>(initialRules);
  const [creating, setCreating] = useState(false);

  const handleUpdate = useCallback((updated: NotificationRule) => {
    setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }, []);

  async function createDefaultRule(category: string, label: string, description: string) {
    setCreating(true);
    try {
      const res = await apiPost('/api/notifications/rules', {
        name: `${label}`,
        description,
        category,
        severity: 'warning',
        emailEnabled: true,
        smsEnabled: false,
        pushEnabled: false,
      });
      if (res.success && res.data) {
        setRules((prev) => [...prev, res.data as NotificationRule]);
      }
    } catch {
      alert('알림 규칙 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setCreating(false);
    }
  }

  // 카테고리별로 규칙 그룹핑
  const rulesByCategory = new Map<string, NotificationRule[]>();
  for (const rule of rules) {
    const existing = rulesByCategory.get(rule.category) || [];
    existing.push(rule);
    rulesByCategory.set(rule.category, existing);
  }

  return (
    <div className="space-y-8">
      {/* 카테고리별 규칙 섹션 */}
      <section>
        <h2 className="text-sm font-medium text-slate-400 mb-4">카테고리별 알림 규칙</h2>
        <div className="space-y-3">
          {CATEGORIES.map((cat) => {
            const categoryRules = rulesByCategory.get(cat.value) || [];

            if (categoryRules.length === 0) {
              // 규칙 없는 카테고리 → 생성 버튼
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

            // 규칙 있는 카테고리 → 규칙 카드들
            return categoryRules.map((rule) => (
              <NotificationRuleCard key={rule.id} rule={rule} onUpdate={handleUpdate} />
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
