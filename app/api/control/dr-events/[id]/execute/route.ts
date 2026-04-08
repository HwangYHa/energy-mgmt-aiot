/**
 * POST /api/control/dr-events/[id]/execute
 *
 * DR 이벤트 실행 — operator 이상 권한 필요
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
} from '@/lib/api/response';
import { UserRole } from '@/lib/constants/roles';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'operator' as UserRole)) return forbiddenResponse();

    const { id } = await params;

    const event = await prisma.drEvent.findFirst({
      where: { id, tenantId: auth.tenantId },
    });

    if (!event) {
      return NextResponse.json({ success: false, error: 'DR 이벤트를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (event.status !== 'scheduled') {
      return NextResponse.json(
        { success: false, error: `현재 상태(${event.status})에서는 실행할 수 없습니다.` },
        { status: 409 }
      );
    }

    const updatedEvent = await prisma.drEvent.update({
      where: { id },
      data: { status: 'in_progress' },
    });

    // 감사 로그
    await prisma.auditLog.create({
      data: {
        tenantId: auth.tenantId,
        userId:   auth.userId,
        action:   'DR_EVENT_EXECUTED',
        resourceType: 'dr_event',
        resourceId:   id,
        changes:  { previousStatus: event.status, newStatus: 'in_progress' },
      },
    }).catch(() => null);

    return successResponse({
      event:   updatedEvent,
      message: 'DR 이벤트 실행이 시작되었습니다.',
    });
  } catch (error) {
    console.error('[DR Execute]', error);
    return serverErrorResponse();
  }
}
