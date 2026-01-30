import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

// GET: DR 이벤트 목록
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');

    // TODO: DB에서 DR 이벤트 조회
    const events = await prisma.drEvent.findMany({
      where: {
        tenantId: session.user.tenantId,
        ...(status && { status }),
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

    return NextResponse.json(event, { status: 201 });

  } catch (error) {
    console.error('DR creation error:', error);
    return NextResponse.json({ error: 'Failed to create DR event' }, { status: 500 });
  }
}
