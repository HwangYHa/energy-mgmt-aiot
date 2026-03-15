/**
 * /api/devices/[id] - 설비 상세 API
 *
 * 보안:
 * ✅ 인증 필수
 * ✅ 테넌트 검증
 * ✅ 입력 검증
 * ✅ 권한 검증
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, requireRole } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import { deviceUpdateSchema, formatValidationError } from '@/lib/validation/schemas';
import { z } from 'zod';
import logger from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/devices/[id] - 설비 상세 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // ✅ 인증 검증
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ 설비 조회 (tenantId 검증 포함)
    const device = await prisma.device.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
        deletedAt: null,
      },
      include: {
        site: {
          select: { id: true, name: true, code: true },
        },
        gateway: {
          select: { id: true, name: true, serialNumber: true, status: true },
        },
        metrics: {
          select: {
            id: true, key: true, name: true,
            dataType: true, unit: true, accessLevel: true,
          },
          orderBy: { key: 'asc' },
        },
        sensors: {
          where: { deletedAt: null },
          select: {
            id: true, name: true, sensorType: true,
            unit: true, lastValue: true, lastSeenAt: true, status: true,
          },
          orderBy: { name: 'asc' },
        },
        _count: {
          select: { metrics: true, sensors: true },
        },
      },
    });

    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: device,
    });
  } catch (error) {
    logger.error('Device fetch error', {
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    });

    return NextResponse.json({ error: 'Failed to fetch device' }, { status: 500 });
  }
}

// PUT /api/devices/[id] - 설비 수정
export async function PUT(request: NextRequest, { params }: RouteParams) {
  let auth: Awaited<ReturnType<typeof verifyAuth>> | undefined;
  try {
    const { id } = await params;

    // ✅ 인증 검증
    auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ 권한 검증
    if (!requireRole(auth, ['operator', 'site_manager', 'tenant_admin'])) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // ✅ 설비 존재 확인
    const existingDevice = await prisma.device.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
        deletedAt: null,
      },
    });

    if (!existingDevice) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    const body = await request.json();

    // ✅ 입력 검증
    let validated;
    try {
      validated = deviceUpdateSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: formatValidationError(error),
          },
          { status: 400 }
        );
      }
      throw error;
    }

    // ✅ 트랜잭션으로 수정
    const result = await prisma.$transaction(async (tx) => {
      const device = await tx.device.update({
        where: { id },
        data: validated,
        select: {
          id: true,
          name: true,
          deviceType: true,
          protocol: true,
          status: true,
          controlMode: true,
          siteId: true,
          updatedAt: true,
        },
      });

      // 감사 로그
      await tx.auditLog.create({
        data: {
          tenantId: auth!.tenantId,
          userId: auth!.userId,
          action: 'DEVICE_UPDATE',
          resourceType: 'DEVICE',
          resourceId: device.id,
          changes: {
            before: existingDevice,
            after: validated,
          },
          result: 'success',
        },
      });

      return device;
    });

    logger.info('Device updated', {
      deviceId: result.id,
      tenantId: auth.tenantId,
      userId: auth.userId,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Device update error', {
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    });

    return NextResponse.json({ error: 'Failed to update device' }, { status: 500 });
  }
}

// DELETE /api/devices/[id] - 설비 삭제 (소프트 삭제)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  let auth: Awaited<ReturnType<typeof verifyAuth>> | undefined;
  try {
    const { id } = await params;

    // ✅ 인증 검증
    auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ 권한 검증 (삭제는 site_manager 이상만)
    if (!requireRole(auth, ['site_manager', 'tenant_admin'])) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // ✅ 설비 존재 확인
    const existingDevice = await prisma.device.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
        deletedAt: null,
      },
    });

    if (!existingDevice) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    // ✅ 소프트 삭제
    await prisma.$transaction(async (tx) => {
      await tx.device.update({
        where: { id },
        data: {
          deletedAt: new Date(),
        },
      });

      // 감사 로그
      await tx.auditLog.create({
        data: {
          tenantId: auth!.tenantId,
          userId: auth!.userId,
          action: 'DEVICE_DELETE',
          resourceType: 'DEVICE',
          resourceId: id,
          result: 'success',
        },
      });
    });

    logger.info('Device deleted', {
      deviceId: id,
      tenantId: auth.tenantId,
      userId: auth.userId,
    });

    return NextResponse.json({
      success: true,
      message: 'Device deleted successfully',
    });
  } catch (error) {
    logger.error('Device delete error', {
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    });

    return NextResponse.json({ error: 'Failed to delete device' }, { status: 500 });
  }
}
