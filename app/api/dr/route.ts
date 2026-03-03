import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { notifyDrEventCreated } from '@/lib/services/notification.service';
import { logActivity, MENU_CODES, ACTION_TYPES } from '@/lib/services/activity-log.service';

// GET: DR 이벤트 목록
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const statusParam = searchParams.get('status');

    // TODO: DB에서 DR 이벤트 조회
    const events = await prisma.drEvent.findMany({
      where: {
        tenantId: session.user.tenantId,
        ...(statusParam && { status: statusParam as any }),
      },
      orderBy: { startTime: 'desc' },
    });

    return NextResponse.json(events);

  } catch (error) {
    console.error('DR list error:', error);
    return NextResponse.json({ error: 'Failed to fetch DR events' }, { status: 500 });
  }
}

// POST: DR 이벤트 생성
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, startTime, endTime, targetReductionKw } = body;

    // DR 이벤트 생성
    const event = await prisma.drEvent.create({
      data: {
        tenantId: session.user.tenantId,
        title,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        targetReductionKw,
        status: 'scheduled',
      },
    });

    // DR 이벤트 생성 알림 → operator 이상 모든 사용자 (비동기)
    notifyDrEventCreated({
      tenantId: session.user.tenantId,
      eventId: event.id,
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      targetReductionKw: Number(event.targetReductionKw ?? 0),
      createdByName: session.user.name ?? undefined,
    }).catch(() => null);

    // 활동 이력 기록 (fire-and-forget)
    logActivity({
      tenantId: session.user.tenantId,
      menuCode: MENU_CODES.DR_EVENT,
      actionType: ACTION_TYPES.CREATE,
      actionLabel: 'DR 이벤트 생성',
      resourceType: 'dr_event',
      resourceId: event.id,
      resourceName: event.title,
      afterData: { title, startTime, endTime, targetReductionKw },
      userId: session.user.id,
      userName: session.user.name ?? undefined,
      userEmail: session.user.email ?? undefined,
      userRole: (session.user as { role?: string }).role ?? undefined,
      request,
    });

    return NextResponse.json(event, { status: 201 });

  } catch (error) {
    console.error('DR creation error:', error);
    return NextResponse.json({ error: 'Failed to create DR event' }, { status: 500 });
  }
}
