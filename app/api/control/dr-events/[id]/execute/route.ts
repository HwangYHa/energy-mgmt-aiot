// app/api/control/dr-events/[id]/execute/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

// POST: Execute DR event
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const event = await prisma.drEvent.findUnique({
      where: { id: params.id },
      include: { devices: true },
    });

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Update event status to running
    const updatedEvent = await prisma.drEvent.update({
      where: { id: params.id },
      data: {
        status: 'running',
        startedAt: new Date(),
      },
    });

    // Create control logs for each device
    const logs = await Promise.all(
      event.devices.map((device) =>
        prisma.controlLog.create({
          data: {
            deviceId: device.id,
            command: `DR_EVENT_${event.eventType}`,
            parameter: {
              eventId: event.id,
              targetReduction: event.targetReduction,
            },
            status: 'executed',
            executedAt: new Date(),
          },
        })
      )
    );

    return NextResponse.json({
      event: updatedEvent,
      logs,
    });
  } catch (error) {
    console.error('Failed to execute DR event:', error);
    return NextResponse.json(
      { error: 'Failed to execute DR event' },
      { status: 500 }
    );
  }
}
