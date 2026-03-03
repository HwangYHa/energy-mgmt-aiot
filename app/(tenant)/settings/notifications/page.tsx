/**
 * 알림 설정 페이지
 * 모든 역할 접근 가능 (자기 알림 설정만 수정)
 */

import { redirect } from 'next/navigation';
import { getServerAuth } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/db/prisma';
import { NotificationSettings } from '@/components/notifications/NotificationSettings';
import { Bell } from 'lucide-react';
import { isKakaoEnabled } from '@/lib/services/kakao.service';

export default async function NotificationsPage() {
  const auth = await getServerAuth();
  if (!auth) redirect('/login');

  // 현재 사용자 정보 + 알림 규칙 병렬 조회
  const [user, rules] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: auth.userId },
      select: { id: true, name: true, email: true, phone: true },
    }),
    prisma.notificationRule.findMany({
      where:    { tenantId: auth.tenantId, userId: auth.userId },
      orderBy:  [{ category: 'asc' }, { createdAt: 'desc' }],
    }),
  ]);

  const serializedRules = rules.map((r) => ({
    id:            r.id,
    name:          r.name,
    description:   r.description,
    category:      r.category,
    severity:      r.severity,
    emailEnabled:  r.emailEnabled,
    smsEnabled:    r.smsEnabled,
    pushEnabled:   r.pushEnabled,
    webhookUrl:    r.webhookUrl,
    enabled:       r.enabled,
    threshold:     r.threshold ? Number(r.threshold) : null,
    thresholdUnit: r.thresholdUnit,
    thresholdOp:   r.thresholdOp,
  }));

  return (
    <div className="min-h-screen bg-[#051225] text-white p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="w-6 h-6 text-cyan-400" />
        <div>
          <h1 className="text-xl font-bold text-white">알림 설정</h1>
          <p className="text-xs text-slate-400 mt-0.5">이메일 · SMS 알림 채널 및 규칙을 관리합니다</p>
        </div>
      </div>

      <NotificationSettings
        initialRules={serializedRules}
        userPhone={user?.phone ?? null}
        userEmail={user?.email ?? ''}
        smsServiceEnabled={isKakaoEnabled()}
      />
    </div>
  );
}
