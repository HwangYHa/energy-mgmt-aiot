/**
 * /api/control/schedules - 스케줄 제어 API
 *
 * GET: 스케줄 목록 (viewer 이상)
 * POST: 스케줄 생성 (operator 이상)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import { UserRole } from '@/lib/constants/roles';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
  serverErrorResponse,
  formatZodErrors,
} from '@/lib/api/response';

const createScheduleSchema = z.object({
  deviceId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  action: z.string().min(1).max(100),
  targetValue: z.number().optional(),
  parameters: z.record(z.unknown()).optional(),
  scheduleType: z.enum(['once', 'daily', 'weekly', 'cron']),
  cronExpr: z.string().max(100).optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().optional(),
  repeatDays: z.array(z.number().min(0).max(6)).optional(),
  priority: z.number().min(1).max(10).default(5),
  allowOverlap: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { tenantId } = auth;
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');
    const status = searchParams.get('status');
    const skip = parseInt(searchParams.get('skip') || '0');
    const take = Math.min(parseInt(searchParams.get('take') || '50'), 100);

    const where: Record<string, unknown> = { tenantId, deletedAt: null };
    if (deviceId) where.deviceId = deviceId;
    if (status) where.status = status;

    const [schedules, total] = await Promise.all([
      prisma.controlSchedule.findMany({
        where,
        orderBy: [{ status: 'asc' }, { nextRunAt: 'asc' }],
        skip,
        take,
      }),
      prisma.controlSchedule.count({ where }),
    ]);

    // 디바이스명 매핑
    const deviceIds = [...new Set(schedules.map((s) => s.deviceId))];
    const devices = await prisma.device.findMany({
      where: { id: { in: deviceIds } },
      select: { id: true, name: true, deviceType: true },
    });
    const deviceMap = new Map(devices.map((d) => [d.id, d]));

    const enriched = schedules.map((s) => ({
      ...s,
      targetValue: s.targetValue ? Number(s.targetValue) : null,
      device: deviceMap.get(s.deviceId) || null,
    }));

    return successResponse(enriched, {
      pagination: { skip, take, total, hasMore: skip + take < total },
    });
  } catch (error) {
    console.error('[API] 스케줄 목록 조회 오류:', error);
    return serverErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'operator' as UserRole)) {
      return forbiddenResponse();
    }

    const body = await request.json();
    const parsed = createScheduleSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse({ fields: formatZodErrors(parsed.error) });
    }

    const { tenantId, userId } = auth;
    const data = parsed.data;

    // 디바이스 소유권 확인
    const device = await prisma.device.findFirst({
      where: { id: data.deviceId, tenantId, deletedAt: null },
    });
    if (!device) {
      return validationErrorResponse({ deviceId: '유효하지 않은 디바이스입니다.' });
    }

    // 충돌 검사 (allowOverlap=false인 경우)
    if (!data.allowOverlap) {
      const overlapping = await prisma.controlSchedule.findFirst({
        where: {
          deviceId: data.deviceId,
          deletedAt: null,
          status: 'active',
          startAt: { lte: new Date(data.endAt || data.startAt) },
          OR: [
            { endAt: null },
            { endAt: { gte: new Date(data.startAt) } },
          ],
        },
      });

      if (overlapping) {
        return validationErrorResponse({
          schedule: `기존 스케줄 "${overlapping.name}"과 시간이 겹칩니다. 충돌을 허용하려면 '충돌 허용'을 선택하세요.`,
        });
      }
    }

    const schedule = await prisma.controlSchedule.create({
      data: {
        tenantId,
        deviceId: data.deviceId,
        name: data.name,
        description: data.description,
        action: data.action,
        targetValue: data.targetValue,
        parameters: (data.parameters as Prisma.InputJsonValue) ?? undefined,
        scheduleType: data.scheduleType,
        cronExpr: data.cronExpr,
        startAt: new Date(data.startAt),
        endAt: data.endAt ? new Date(data.endAt) : undefined,
        repeatDays: data.repeatDays as unknown as Prisma.InputJsonValue ?? undefined,
        priority: data.priority,
        allowOverlap: data.allowOverlap,
        status: 'active',
        nextRunAt: new Date(data.startAt),
        createdBy: userId,
      },
    });

    return successResponse(schedule, { status: 201 });
  } catch (error) {
    console.error('[API] 스케줄 생성 오류:', error);
    return serverErrorResponse();
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'operator' as UserRole)) {
      return forbiddenResponse();
    }

    const body = await request.json();
    const { id, action: updateAction } = body as { id: string; action: string };

    if (!id) {
      return validationErrorResponse({ id: '스케줄 ID가 필요합니다.' });
    }

    const existing = await prisma.controlSchedule.findFirst({
      where: { id, tenantId: auth.tenantId, deletedAt: null },
    });

    if (!existing) {
      return validationErrorResponse({ id: '스케줄을 찾을 수 없습니다.' });
    }

    let updateData: Record<string, unknown> = {};

    switch (updateAction) {
      case 'pause':
        updateData = { status: 'paused' };
        break;
      case 'resume':
        updateData = { status: 'active' };
        break;
      case 'delete':
        updateData = { deletedAt: new Date() };
        break;
      default:
        return validationErrorResponse({ action: '유효하지 않은 액션입니다.' });
    }

    const updated = await prisma.controlSchedule.update({
      where: { id },
      data: updateData,
    });

    return successResponse(updated);
  } catch (error) {
    console.error('[API] 스케줄 수정 오류:', error);
    return serverErrorResponse();
  }
}
