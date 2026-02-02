// app/api/control/dr-events/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET: List all DR events
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    const status = searchParams.get('status');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    const where: any = { tenantId };
    if (status) where.status = status;

    const events = await prisma.drEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error('Failed to fetch DR events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch DR events' },
      { status: 500 }
    );
  }
}

// POST: Create new DR event
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tenantId,
      name,
      scheduledAt,
      duration,
      targetReduction,
      compensation,
    } = body;

    if (!tenantId || !name || !scheduledAt) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const startDate = new Date(scheduledAt);
    const endDate = new Date(startDate.getTime() + (duration || 60) * 60 * 1000);

    const event = await prisma.drEvent.create({
      data: {
        tenantId,
        title: name,
        startTime: startDate,
        endTime: endDate,
        status: 'scheduled',
        targetReductionKw: targetReduction || 0,
        actualReductionKw: null,
        revenue: compensation || null,
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error('Failed to create DR event:', error);
    return NextResponse.json(
      { error: 'Failed to create DR event' },
      { status: 500 }
    );
  }
}
