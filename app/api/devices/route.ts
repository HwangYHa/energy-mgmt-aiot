/**
 * /api/devices - 기기 관리 API
 * 
 * 보안:
 * ✅ 인증 필수
 * ✅ 테넌트 검증
 * ✅ 입력 검증
 * ✅ 권한 검증
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, validateTenantMatch, requireRoleOrHigher } from '@/lib/auth/verify';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { deviceCreateSchema, formatValidationError } from '@/lib/validation/schemas';
import { z } from 'zod';
import { successResponse, serverErrorResponse, unauthorizedResponse } from '@/lib/api/response';
import { logActivity, MENU_CODES, ACTION_TYPES } from '@/lib/services/activity-log.service';
import { generateSeqNo } from '@/lib/utils/sequence';
import { getAllowedSiteIds } from '@/lib/auth/site-access';
import { getDataCollectionSettings } from '@/lib/services/system-settings.service';

export async function GET(request: NextRequest) {
  try {
    // ✅ 인증 검증
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    // 쿼리 파라미터 처리
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    const controlCapable = searchParams.get('controlCapable');
    const statusFilter = searchParams.get('status');
    const take = Math.min(Number(searchParams.get('take') || 20), 100); // 최대 100개 제한
    const cursor = searchParams.get('cursor');
    const skip = Number(searchParams.get('skip') || 0);

    // ✅ 기기 조회 (tenantId 필터 + 사용자별 사이트 접근 권한)
    const allowedSiteIds = await getAllowedSiteIds(auth);
    const where: Record<string, unknown> = {
      tenantId: auth.tenantId,
      deletedAt: null,
      ...(allowedSiteIds !== null ? { siteId: { in: allowedSiteIds } } : {}),
    };
    if (siteId) where.siteId = siteId; // explicit filter overrides (but still within allowed)
    if (controlCapable === 'true') where.controlCapable = true;
    if (controlCapable === 'false') where.controlCapable = false;
    if (statusFilter) where.status = statusFilter;

    const findArgs: Record<string, unknown> = {
      where,
      select: {
        id: true,
        name: true,
        deviceType: true,
        status: true,
        controlCapable: true,
        controlMode: true,
        lastSeenAt: true,
        siteId: true,
        site: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    };

    if (cursor) {
      findArgs.cursor = { id: cursor };
      findArgs.skip = 1;
      findArgs.take = take;
    } else {
      findArgs.skip = skip;
      findArgs.take = take;
    }

    const devices = await prisma.device.findMany(findArgs as Parameters<typeof prisma.device.findMany>[0]);

    const nextCursor =
      devices.length === take && devices.length > 0
        ? devices[devices.length - 1]?.id
        : null;

    return successResponse(devices, {
      meta: { nextCursor, pageSize: take },
    });
  } catch (error) {
    console.error('Device fetch error:', error);
    return serverErrorResponse({ message: 'Failed to fetch devices' });
  }
}

export async function POST(request: NextRequest) {
  try {
    // ✅ 인증 검증
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ✅ 권한 검증 (기기 생성은 operator 이상)
    if (!requireRoleOrHigher(auth, 'operator' as UserRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // ✅ 입력 검증
    const validated = deviceCreateSchema.parse(body);

    // ✅ 사이트 존재 확인 및 테넌트 일치 검증
    const site = await prisma.site.findUnique({
      where: { id: validated.siteId },
      select: { tenantId: true },
    });

    if (!site) {
      return NextResponse.json(
        { error: 'Site not found' },
        { status: 404 }
      );
    }

    if (!validateTenantMatch(auth.tenantId, site.tenantId)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // 기기 코드 자동 채번: DV-YYYYMMDD-NNNN
    const [code, dcSettings] = await Promise.all([
      generateSeqNo('DEVICE_MGMT'),
      getDataCollectionSettings(auth.tenantId),
    ]);

    // 폴링 주기: 시스템 설정의 defaultInterval(초) → ms 변환. 기본 60초=60000ms
    const pollIntervalMs = dcSettings.defaultInterval * 1000;

    // ✅ 기기 생성
    const device = await prisma.device.create({
      data: {
        ...validated,
        code,
        tenantId: auth.tenantId, // ← 검증된 tenantId만 사용
        status: 'offline',
        pollIntervalMs,
      },
      select: {
        id: true,
        name: true,
        deviceType: true,
        siteId: true,
        createdAt: true,
      },
    });

    // ✅ 감사 로그
    await prisma.auditLog.create({
      data: {
        tenantId: auth.tenantId,
        userId: auth.userId,
        action: 'DEVICE_CREATE',
        resourceType: 'DEVICE',
        resourceId: device.id,
        result: 'success',
      },
    }).catch((err) => console.error('Audit log error:', err));

    // 활동 이력 기록 (fire-and-forget)
    logActivity({
      tenantId: auth.tenantId,
      menuCode: MENU_CODES.DEVICE_MGMT,
      actionType: ACTION_TYPES.CREATE,
      actionLabel: '기기 생성',
      resourceType: 'device',
      resourceId: device.id,
      resourceName: device.name,
      afterData: { name: device.name, deviceType: device.deviceType, siteId: device.siteId },
      userId: auth.userId,
      userEmail: auth.email,
      userRole: auth.role,
      request,
    });

    return NextResponse.json(device, { status: 201 });
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

    console.error('Device creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create device' },
      { status: 500 }
    );
  }
}