/**
 * POST /api/monitoring/events
 *
 * 리텐션 이벤트 수집 엔드포인트 (행동 트래킹)
 *
 * 클라이언트에서 사용자 행동을 발송 → retention_event 저장
 * + 온보딩 마일스톤 자동 갱신
 *
 * ─ 이벤트 유형 ───────────────────────────────────────────────
 *   login | logout | device_connected | iot_data_received
 *   ai_analysis_run | report_generated | alert_triggered
 *   alert_clicked | feature_used | payment_succeeded
 *   payment_failed | support_ticket_opened
 *   support_ticket_resolved | plan_changed
 * ─────────────────────────────────────────────────────────────
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyAuth } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  formatZodErrors,
} from '@/lib/api/response';
import { markMilestone } from '@/lib/services/churn-score.service';

const ALLOWED_EVENTS = [
  'login', 'logout',
  'device_connected', 'device_disconnected', 'iot_data_received',
  'ai_analysis_run', 'report_generated',
  'alert_triggered', 'alert_clicked',
  'feature_used',
  'payment_succeeded', 'payment_failed',
  'support_ticket_opened', 'support_ticket_resolved',
  'plan_changed', 'onboarding_step_completed',
] as const;

type EventType = typeof ALLOWED_EVENTS[number];

const bodySchema = z.object({
  eventType:  z.enum(ALLOWED_EVENTS),
  properties: z.record(z.unknown()).optional(),
  occurredAt: z.string().datetime().optional(),
});

// 마일스톤 이벤트 → DB 필드 매핑
const MILESTONE_MAP: Partial<Record<EventType, Parameters<typeof markMilestone>[1]>> = {
  device_connected:  'iotConnectedAt',
  iot_data_received: 'firstDataAt',
  ai_analysis_run:   'firstAiAnalysisAt',
  report_generated:  'firstReportAt',
  alert_triggered:   'firstAlertAt',
};

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();

  const body   = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse({ fields: formatZodErrors(parsed.error) });
  }

  const { eventType, properties, occurredAt } = parsed.data;
  const { tenantId, userId } = auth;

  // retention_event 저장
  const eventModel = (prisma as any).retentionEvent;
  if (eventModel) {
    await eventModel.create({
      data: {
        tenantId,
        userId,
        eventType,
        properties: properties ?? {},
        occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
      },
    }).catch((e: Error) => console.warn('[Events] 저장 실패:', e.message));
  }

  // 온보딩 마일스톤 자동 갱신 (fire-and-forget)
  const milestoneField = MILESTONE_MAP[eventType];
  if (milestoneField) {
    markMilestone(tenantId, milestoneField).catch(() => {});
  }

  return successResponse({ eventType, recorded: true });
}
