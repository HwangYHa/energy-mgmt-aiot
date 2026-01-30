// app/api/control/dr-events/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

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
      include: {
        tenant: { select: { id: true, name: true } },
        devices: { select: { id: true, name: true, type: true } },
      },
      orderBy: { scheduledAt: 'desc' },
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
      description,
      eventType,
      scheduledAt,
      duration,
      targetReduction,
      compensation,
      deviceIds,
    } = body;

    if (!tenantId || !name || !eventType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const event = await prisma.drEvent.create({
      data: {
        tenantId,
        name,
        description: description || '',
        eventType,
        status: 'scheduled',
        scheduledAt: new Date(scheduledAt),
        duration: duration || 60,
        targetReduction: targetReduction || 0,
        compensation: compensation || 0,
        actualReduction: 0,
        responseRate: 0,
        devices: {
          connect: deviceIds?.map((id: string) => ({ id })) || [],
        },
      },
      include: {
        devices: true,
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
