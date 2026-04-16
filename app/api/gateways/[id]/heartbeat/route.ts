/**
 * POST /api/gateways/{id}/heartbeat
 *
 * Collector 서비스 전용 — API 키 인증으로 게이트웨이 온라인 상태 갱신.
 * 세션 불필요 (현장 장치에서 직접 호출).
 *
 * 인증: Bearer {API_KEY} 또는 X-Gateway-Token: {serial}:{secret}
 *
 * 페이로드:
 * {
 *   "status": "online",
 *   "bufferedRecords": 123,
 *   "firmwareVersion": "1.0.0"
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const HeartbeatSchema = z.object({
  status:          z.enum(['online', 'offline']).default('online'),
  bufferedRecords: z.number().int().min(0).optional(),
  firmwareVersion: z.string().max(20).optional(),
  ipAddress:       z.string().max(45).optional(),
});

async function authenticateGateway(
  request: NextRequest,
  gatewayId: string,
): Promise<string | null> {
  // 1) Bearer API Key
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const rawKey = authHeader.slice(7);
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const key = await prisma.apiKey.findFirst({
      where: { keyHash, isActive: true },
      select: { tenantId: true },
    });
    if (key) {
      const gw = await prisma.gateway.findFirst({
        where: { id: gatewayId, tenantId: key.tenantId },
        select: { id: true },
      });
      if (gw) return gw.id;
    }
  }

  // 2) X-Gateway-Token: {serial}
  const gwToken = request.headers.get('x-gateway-token');
  if (gwToken) {
    const [serial] = gwToken.split(':');
    const gw = await prisma.gateway.findFirst({
      where: { id: gatewayId, serialNumber: serial },
      select: { id: true },
    });
    if (gw) return gw.id;
  }

  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: gatewayId } = await params;

  const gwId = await authenticateGateway(request, gatewayId);
  if (!gwId) {
    return NextResponse.json(
      { success: false, error: '게이트웨이 인증 실패' },
      { status: 401 },
    );
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // 빈 body 허용
  }

  const parsed = HeartbeatSchema.safeParse(body);
  const data = parsed.success ? parsed.data : { status: 'online' as const };

  await prisma.gateway.update({
    where: { id: gwId },
    data: {
      status:             data.status,
      lastSeenAt:         new Date(),
      lastHeartbeatAt:    new Date(),
      ...(data.bufferedRecords !== undefined && { bufferedRecords: data.bufferedRecords }),
      ...(data.firmwareVersion  !== undefined && { firmwareVersion:  data.firmwareVersion }),
      ...(data.ipAddress        !== undefined && { ipAddress:        data.ipAddress }),
    } as Record<string, unknown>,
  });

  return NextResponse.json({ success: true, timestamp: new Date().toISOString() });
}