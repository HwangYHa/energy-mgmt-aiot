// app/api/control/dr-events/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// GET: Get specific DR event
export async function GET(
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

    return NextResponse.json(event);
  } catch (error) {
    console.error('Failed to fetch DR event:', error);
    return NextResponse.json(
      { error: 'Failed to fetch DR event' },
      { status: 500 }
    );
  }
}

// PATCH: Update DR event
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      name,
      description,
      scheduledAt,
      duration,
      targetReduction,
      compensation,
      status,
    } = body;

    const event = await prisma.drEvent.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description && { description }),
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
        ...(duration && { duration }),
        ...(targetReduction !== undefined && { targetReduction }),
        ...(compensation !== undefined && { compensation }),
        ...(status && { status }),
      },
    });

    return NextResponse.json(event);
  } catch (error) {
    console.error('Failed to update DR event:', error);
    return NextResponse.json(
      { error: 'Failed to update DR event' },
      { status: 500 }
    );
  }
}

// DELETE: Delete DR event
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.drEvent.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: 'Event deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Failed to delete DR event:', error);
    return NextResponse.json(
      { error: 'Failed to delete DR event' },
      { status: 500 }
    );
  }
}
