/**
 * /api/sensors/[id] - 센서 상세/수정/삭제 API
 *
 * GET: 센서 상세 조회 (viewer 이상)
 * PUT: 센서 수정 (operator 이상)
 * DELETE: 센서 삭제 (site_manager 이상)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import { UserRole } from '@/lib/constants/roles';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  serverErrorResponse,
  formatZodErrors,
} from '@/lib/api/response';

const updateSensorSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().max(50).optional(),
  serialNumber: z.string().max(100).optional(),
  sensorType: z.string().min(1).max(50).optional(),
  manufacturer: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  unit: z.string().max(20).optional(),
  minRange: z.number().optional(),
  maxRange: z.number().optional(),
  status: z.enum(['online', 'offline', 'error', 'maintenance']).optional(),
  installLocation: z.string().max(200).optional(),
  installDate: z.string().optional(),
  calibrationDate: z.string().optional(),
  nextCalibrationDate: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { id } = await params;

    const sensor = await prisma.sensor.findFirst({
      where: { id, tenantId: auth.tenantId, deletedAt: null },
      include: {
        device: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
            site: { select: { id: true, name: true } },
          },
        },
        metrics: {
          select: { id: true, key: true, name: true, unit: true, dataType: true },
        },
      },
    });

    if (!sensor) return notFoundResponse('센서');

    return successResponse(sensor);
  } catch (error) {
    console.error('[API] 센서 상세 조회 오류:', error);
    return serverErrorResponse();
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'operator' as UserRole)) {
      return forbiddenResponse();
    }

    const { id } = await params;

    const body = await request.json();
    const parsed = updateSensorSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse({ fields: formatZodErrors(parsed.error) });
    }

    const data = parsed.data;
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.code !== undefined) updateData.code = data.code;
    if (data.serialNumber !== undefined) updateData.serialNumber = data.serialNumber;
    if (data.sensorType !== undefined) updateData.sensorType = data.sensorType;
    if (data.manufacturer !== undefined) updateData.manufacturer = data.manufacturer;
    if (data.model !== undefined) updateData.model = data.model;
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.minRange !== undefined) updateData.minRange = data.minRange;
    if (data.maxRange !== undefined) updateData.maxRange = data.maxRange;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.installLocation !== undefined) updateData.installLocation = data.installLocation;
    if (data.installDate !== undefined) updateData.installDate = new Date(data.installDate);
    if (data.calibrationDate !== undefined) updateData.calibrationDate = new Date(data.calibrationDate);
    if (data.nextCalibrationDate !== undefined) updateData.nextCalibrationDate = new Date(data.nextCalibrationDate);
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    // TOCTOU 방지: 트랜잭션 내에서 소유권 확인 + 업데이트 원자적 처리
    const updated = await prisma.$transaction(async (tx) => {
      const sensor = await tx.sensor.findFirst({
        where: { id, tenantId: auth.tenantId, deletedAt: null },
      });
      if (!sensor) return null;

      return tx.sensor.update({
        where: { id },
        data: updateData,
        include: {
          device: { select: { id: true, name: true, code: true } },
        },
      });
    });

    if (!updated) return notFoundResponse('센서');
    return successResponse(updated);
  } catch (error) {
    console.error('[API] 센서 수정 오류:', error);
    return serverErrorResponse();
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'site_manager' as UserRole)) {
      return forbiddenResponse();
    }

    const { id } = await params;

    // TOCTOU 방지: 트랜잭션 내에서 소유권 확인 + 삭제 원자적 처리
    const deleted = await prisma.$transaction(async (tx) => {
      const sensor = await tx.sensor.findFirst({
        where: { id, tenantId: auth.tenantId, deletedAt: null },
      });
      if (!sensor) return false;

      await tx.sensor.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      return true;
    });

    if (!deleted) return notFoundResponse('센서');
    return successResponse({ deleted: true });
  } catch (error) {
    console.error('[API] 센서 삭제 오류:', error);
    return serverErrorResponse();
  }
}
