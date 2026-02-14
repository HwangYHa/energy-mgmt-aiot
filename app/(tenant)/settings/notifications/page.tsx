/**
 * 알림 설정 페이지
 * 모든 역할 접근 가능 (자기 알림 설정만 수정)
 */

import { redirect } from 'next/navigation';
import { getServerAuth } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/db/prisma';
import { NotificationSettings } from '@/components/notifications/NotificationSettings';
import { Bell } from 'lucide-react';

export default async function NotificationsPage() {
  const auth = await getServerAuth();
  if (!auth) redirect('/login');

  // 현재 사용자의 알림 규칙 조회
  const rules = await prisma.notificationRule.findMany({
    where: {
      tenantId: auth.tenantId,
      userId: auth.userId,
    },
    orderBy: [{ category: 'asc' }, { createdAt: 'desc' }],
  });

  const serializedRules = rules.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    severity: r.severity,
    emailEnabled: r.emailEnabled,
    smsEnabled: r.smsEnabled,
    pushEnabled: r.pushEnabled,
    webhookUrl: r.webhookUrl,
    enabled: r.enabled,
    threshold: r.threshold ? Number(r.threshold) : null,
    thresholdUnit: r.thresholdUnit,
    thresholdOp: r.thresholdOp,
  }));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="w-6 h-6 text-cyan-400" />
        <h1 className="text-xl font-bold text-white">알림 설정</h1>
      </div>

      <NotificationSettings initialRules={serializedRules} />
    </div>
  );
}
