/**
 * /api/control/dr-events - DR 이벤트 관리 API
 *
 * GET: DR 이벤트 목록 조회 (인증 기반)
 * POST: 새 DR 이벤트 생성 (operator 이상)
 * PATCH: DR 이벤트 상태 변경 - 실행/중지/취소 (operator 이상)
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import { UserRole } from '@/lib/constants/roles';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/api/response';
import { generateSeqNo } from '@/lib/utils/sequence';

// GET: DR 이벤트 목록 조회
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { tenantId } = auth;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: Record<string, unknown> = { tenantId };
    if (status) where.status = status;

    const events = await prisma.drEvent.findMany({
      where,
      orderBy: { startTime: 'desc' },
    });

    // 프론트엔드 호환 형식으로 변환
    const formatted = events.map((e) => ({
      id: e.id,
      name: e.title,
      status: e.status,
      scheduledAt: e.startTime.toISOString(),
      endTime: e.endTime.toISOString(),
      duration: Math.round((e.endTime.getTime() - e.startTime.getTime()) / 60000),
      targetReduction: Number(e.targetReductionKw),
      actualReduction: e.actualReductionKw ? Number(e.actualReductionKw) : 0,
      compensation: e.revenue ? Number(e.revenue) : 0,
      createdAt: e.createdAt.toISOString(),
    }));

    return successResponse(formatted);
  } catch (error) {
    console.error('[API] DR 이벤트 조회 오류:', error);
    return serverErrorResponse();
  }
}

// POST: 새 DR 이벤트 생성
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'operator' as UserRole)) {
      return forbiddenResponse();
    }

    const { tenantId } = auth;
    const body = await request.json();
    const { name, scheduledAt, duration, targetReduction, compensation } = body;

    if (!name || !scheduledAt) {
      return validationErrorResponse({ message: '이벤트 이름과 예약 시간은 필수입니다.' });
    }

    const startDate = new Date(scheduledAt);
    const endDate = new Date(startDate.getTime() + (duration || 60) * 60 * 1000);

    // DR 이벤트 코드 자동 채번: DR-YYYYMMDD-NNNN
    const code = await generateSeqNo('DR_EVENT');

    const event = await (prisma as any).drEvent.create({
      data: {
        tenantId,
        title: name,
        startTime: startDate,
        endTime: endDate,
        status: 'scheduled',
        targetReductionKw: targetReduction || 0,
        revenue: compensation || null,
        code,
      },
    });

    return successResponse({
      id: event.id,
      name: event.title,
      status: event.status,
      scheduledAt: event.startTime.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('[API] DR 이벤트 생성 오류:', error);
    return serverErrorResponse();
  }
}

// PATCH: DR 이벤트 상태 변경
export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'operator' as UserRole)) {
      return forbiddenResponse();
    }

    const { tenantId } = auth;
    const body = await request.json();
    const { eventId, action } = body;

    if (!eventId || !action) {
      return validationErrorResponse({ message: 'eventId와 action은 필수입니다.' });
    }

    const event = await prisma.drEvent.findUnique({ where: { id: eventId } });
    if (!event || event.tenantId !== tenantId) {
      return validationErrorResponse({ message: '이벤트를 찾을 수 없습니다.' });
    }

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case 'execute':
        if (event.status !== 'scheduled') {
          return validationErrorResponse({ message: '예정된 이벤트만 실행할 수 있습니다.' });
        }
        updateData = { status: 'in_progress' };
        break;
      case 'stop': {
        if (event.status !== 'in_progress') {
          return validationErrorResponse({ message: '실행 중인 이벤트만 중지할 수 있습니다.' });
        }
        const now = new Date();
        const actualEndTime = now < event.endTime ? now : event.endTime;
        const actualDurationHours =
          (actualEndTime.getTime() - event.startTime.getTime()) / (1000 * 60 * 60);
        // 결정론적 달성률 (80~100%) — id 해시 기반
        const idHash = event.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const achievementRate = 0.80 + (idHash % 21) / 100;
        const targetKw = Number(event.targetReductionKw);
        const actualKw = Math.round(targetKw * achievementRate * 10) / 10;
        const revenue = Math.round(actualKw * actualDurationHours * 1000); // ₩1,000/kWh
        updateData = {
          status: 'completed',
          actualReductionKw: actualKw,
          revenue,
          endTime: actualEndTime,
        };
        break;
      }
      case 'cancel':
        if (event.status === 'completed' || event.status === 'cancelled') {
          return validationErrorResponse({ message: '이미 완료/취소된 이벤트입니다.' });
        }
        updateData = { status: 'cancelled' };
        break;
      default:
        return validationErrorResponse({ message: '유효하지 않은 action입니다. (execute|stop|cancel)' });
    }

    const updated = await prisma.drEvent.update({
      where: { id: eventId },
      data: updateData,
    });

    return successResponse({
      id: updated.id,
      name: updated.title,
      status: updated.status,
      actualReductionKw: updated.actualReductionKw ? Number(updated.actualReductionKw) : null,
      revenue: updated.revenue ? Number(updated.revenue) : null,
    });
  } catch (error) {
    console.error('[API] DR 이벤트 상태 변경 오류:', error);
    return serverErrorResponse();
  }
}
