// app/api/devices/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { DeviceService } from '@/lib/services/device.service';

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const devices = await DeviceService.findAll(session.user.tenantId);
  return NextResponse.json(devices);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  const body = await request.json();
  
  const device = await DeviceService.create(
    session.user.tenantId,
    body,
  );
  
  return NextResponse.json(device);
}