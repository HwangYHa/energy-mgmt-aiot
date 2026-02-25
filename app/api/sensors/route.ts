/**
 * /api/sensors - 센서 CRUD API
 *
 * GET: 센서 목록 조회 (viewer 이상)
 * POST: 센서 등록 (operator 이상)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import { UserRole } from '@/lib/constants/roles';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
  serverErrorResponse,
  formatZodErrors,
} from '@/lib/api/response';
import { checkPlanLimit } from '@/lib/middleware/plan-limit';

const createSensorSchema = z.object({
  deviceId: z.string().uuid(),
  name: z.string().min(1).max(200),
  code: z.string().max(50).optional(),
  serialNumber: z.string().max(100).optional(),
  sensorType: z.string().min(1).max(50),
  manufacturer: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  unit: z.string().max(20).optional(),
  minRange: z.number().optional(),
  maxRange: z.number().optional(),
  installLocation: z.string().max(200).optional(),
  installDate: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { tenantId } = auth;
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');
    const sensorType = searchParams.get('sensorType');
    const status = searchParams.get('status');
    const skip = parseInt(searchParams.get('skip') || '0');
    const take = Math.min(parseInt(searchParams.get('take') || '50'), 100);

    const where: Record<string, unknown> = {
      tenantId,
      deletedAt: null,
    };

    if (deviceId) where.deviceId = deviceId;
    if (sensorType) where.sensorType = sensorType;
    if (status) where.status = status;

    const [sensors, total] = await Promise.all([
      prisma.sensor.findMany({
        where,
        include: {
          device: {
            select: { id: true, name: true, code: true, status: true, siteId: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.sensor.count({ where }),
    ]);

    return successResponse(sensors, {
      pagination: { skip, take, total, hasMore: skip + take < total },
    });
  } catch (error) {
    console.error('[API] 센서 목록 조회 오류:', error);
    return serverErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'operator' as UserRole)) {
      return forbiddenResponse();
    }

    // ✅ 플랜 한도 확인 (센서 수 제한)
    const limitErr = await checkPlanLimit(auth.tenantId, 'sensor');
    if (limitErr) return limitErr;

    const body = await request.json();
    const parsed = createSensorSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse({ fields: formatZodErrors(parsed.error) });
    }

    const { tenantId } = auth;
    const data = parsed.data;

    // 디바이스가 같은 테넌트 소속인지 확인
    const device = await prisma.device.findFirst({
      where: { id: data.deviceId, tenantId, deletedAt: null },
    });

    if (!device) {
      return validationErrorResponse({ deviceId: '유효하지 않은 디바이스입니다.' });
    }

    const sensor = await prisma.sensor.create({
      data: {
        tenantId,
        deviceId: data.deviceId,
        name: data.name,
        code: data.code,
        serialNumber: data.serialNumber,
        sensorType: data.sensorType,
        manufacturer: data.manufacturer,
        model: data.model,
        unit: data.unit,
        minRange: data.minRange,
        maxRange: data.maxRange,
        installLocation: data.installLocation,
        installDate: data.installDate ? new Date(data.installDate) : undefined,
        metadata: (data.metadata as Prisma.InputJsonValue) ?? undefined,
        status: 'offline',
      },
      include: {
        device: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    return successResponse(sensor, { status: 201 });
  } catch (error) {
    console.error('[API] 센서 등록 오류:', error);
    return serverErrorResponse();
  }
}
