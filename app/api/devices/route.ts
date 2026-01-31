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
import { verifyAuth, validateTenantMatch, requireRole } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import { deviceCreateSchema, deviceUpdateSchema, formatValidationError } from '@/lib/validation/schemas';
import { z } from 'zod';

export async function GET(request: NextRequest) {
  try {
    // ✅ 인증 검증
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 쿼리 파라미터 처리 (pagination: cursor or skip/take)
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    const take = Number(searchParams.get('take') || 20);
    const cursor = searchParams.get('cursor');
    const skip = Number(searchParams.get('skip') || 0);

    // ✅ 기기 조회 (tenantId 필터 자동 포함)
    const where: any = { tenantId: auth.tenantId };
    if (siteId) where.siteId = siteId;

    const findArgs: any = {
      where,
      select: {
        id: true,
        name: true,
        deviceType: true,
        status: true,
        lastSeenAt: true,
        siteId: true,
      },
      orderBy: { createdAt: 'desc' },
    };

    if (cursor) {
      // 커서 기반 페이지네이션: 커서 항목 자체는 제외하고 다음 항목부터 조회
      findArgs.cursor = { id: cursor };
      findArgs.skip = 1;
      findArgs.take = take;
    } else {
      // 기존 skip/take 페이징과 호환
      findArgs.skip = skip;
      findArgs.take = take;
    }

    const devices = await prisma.device.findMany(findArgs);

    const nextCursor = devices.length === take ? devices[devices.length - 1].id : null;

    return NextResponse.json({ data: devices, nextCursor, pageSize: take });
  } catch (error) {
    console.error('Device fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch devices' },
      { status: 500 }
    );
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

    // ✅ 권한 검증 (기기 생성은 site_manager 이상만)
    if (!requireRole(auth, ['site_manager', 'tenant_admin'])) {
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

    // ✅ 기기 생성
    const device = await prisma.device.create({
      data: {
        ...validated,
        tenantId: auth.tenantId, // ← 검증된 tenantId만 사용
        status: 'offline',
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