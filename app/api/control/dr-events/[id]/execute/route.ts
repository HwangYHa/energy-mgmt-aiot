// app/api/control/dr-events/[id]/execute/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// POST: Execute DR event
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const event = await prisma.drEvent.findUnique({
      where: { id },
    });

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Update event status to running
    const updatedEvent = await prisma.drEvent.update({
      where: { id },
      data: {
        status: 'in_progress',
      },
    });

    // Note: Device control logs would be created here
    // TODO: Implement device control when devices relation is available

    return NextResponse.json({
      event: updatedEvent,
      message: 'DR event execution started',
    });
  } catch (error) {
    console.error('Failed to execute DR event:', error);
    return NextResponse.json(
      { error: 'Failed to execute DR event' },
      { status: 500 }
    );
  }
}
