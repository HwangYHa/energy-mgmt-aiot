import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { notifyDrEventCreated } from '@/lib/services/notification.service';
import { logActivity, MENU_CODES, ACTION_TYPES } from '@/lib/services/activity-log.service';
import { DrEventStatus } from '@prisma/client';

// ── 유효 상태 목록 ──────────────────────────────────────────────
const VALID_STATUSES = Object.values(DrEventStatus) as string[];

// ── 요청 스키마 ─────────────────────────────────────────────────
const drEventSchema = z.object({
  title:             z.string().min(1, '제목을 입력하세요').max(200, '제목은 200자 이하'),
  startTime:         z.string().refine((v) => !isNaN(Date.parse(v)), '유효한 시작 시간을 입력하세요'),
  endTime:           z.string().refine((v) => !isNaN(Date.parse(v)), '유효한 종료 시간을 입력하세요'),
  targetReductionKw: z.number({ invalid_type_error: 'targetReductionKw는 숫자여야 합니다' })
                       .positive('감축 목표는 0보다 커야 합니다')
                       .max(100000, '감축 목표가 너무 큽니다 (최대 100,000 kW)'),
}).refine(
  (d) => new Date(d.startTime) < new Date(d.endTime),
  { message: '종료 시간은 시작 시간 이후여야 합니다', path: ['endTime'] }
);

// ── 권한: operator 이상 ─────────────────────────────────────────
const ALLOWED_ROLES = ['super_admin', 'tenant_admin', 'site_manager', 'operator'];

function hasWritePermission(role?: string): boolean {
  return ALLOWED_ROLES.includes(role ?? '');
}

// GET: DR 이벤트 목록
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const statusParam = searchParams.get('status');

    // 상태 파라미터 유효성 검사
    if (statusParam && !VALID_STATUSES.includes(statusParam)) {
      return NextResponse.json(
        { error: `유효하지 않은 status 값입니다. 허용값: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const events = await prisma.drEvent.findMany({
      where: {
        tenantId: session.user.tenantId,
        ...(statusParam && { status: statusParam as DrEventStatus }),
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

    // 권한 검사: operator 이상만 DR 이벤트 생성 가능
    const userRole = (session.user as { role?: string }).role;
    if (!hasWritePermission(userRole)) {
      return NextResponse.json({ error: 'DR 이벤트 생성 권한이 없습니다 (operator 이상 필요)' }, { status: 403 });
    }

    const rawBody = await request.json().catch(() => null);
    if (!rawBody) {
      return NextResponse.json({ error: '요청 본문이 올바르지 않습니다' }, { status: 400 });
    }

    // Zod 검증
    const parsed = drEventSchema.safeParse(rawBody);
    if (!parsed.success) {
      const fields = parsed.error.errors.reduce<Record<string, string>>((acc, e) => {
        acc[e.path.join('.')] = e.message;
        return acc;
      }, {});
      return NextResponse.json({ error: '입력값 오류', fields }, { status: 400 });
    }

    const { title, startTime, endTime, targetReductionKw } = parsed.data;

    const event = await prisma.drEvent.create({
      data: {
        tenantId: session.user.tenantId,
        title,
        startTime: new Date(startTime),
        endTime:   new Date(endTime),
        targetReductionKw,
        status: 'scheduled',
      },
    });

    // DR 이벤트 생성 알림 (비동기, fire-and-forget)
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
      userRole: userRole ?? undefined,
      request,
    });

    return NextResponse.json(event, { status: 201 });

  } catch (error) {
    console.error('DR creation error:', error);
    return NextResponse.json({ error: 'Failed to create DR event' }, { status: 500 });
  }
}
