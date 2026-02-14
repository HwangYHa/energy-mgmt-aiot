/**
 * /api/sites/[id] - 사이트 상세 API
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
import { siteUpdateSchema, formatValidationError } from '@/lib/validation/schemas';
import { z } from 'zod';
import logger from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/sites/[id] - 사이트 상세 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    console.log('GET /api/sites called111');
    const { id } = await params;

    // ✅ 인증 검증
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ✅ 사이트 조회 (tenantId 검증 포함)
    const site = await prisma.site.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
        deletedAt: null,
      },
      include: {
        manager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        devices: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            deviceType: true,
            status: true,
          },
        },
        gateways: {
          select: {
            id: true,
            name: true,
            serialNumber: true,
            status: true,
          },
        },
        _count: {
          select: {
            devices: true,
            gateways: true,
          },
        },
      },
    });

    if (!site) {
      return NextResponse.json(
        { error: 'Site not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: site,
    });
  } catch (error) {
    logger.error('Site fetch error', {
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    });

    return NextResponse.json(
      { error: 'Failed to fetch site' },
      { status: 500 }
    );
  }
}

// PUT /api/sites/[id] - 사이트 수정
export async function PUT(request: NextRequest, { params }: RouteParams) {
  let auth: Awaited<ReturnType<typeof verifyAuth>> | undefined;
  try {
    const { id } = await params;

    // ✅ 인증 검증
    auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ✅ 권한 검증
    if (!requireRole(auth, ['site_manager', 'tenant_admin'])) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // ✅ 사이트 존재 확인
    const existingSite = await prisma.site.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
        deletedAt: null,
      },
    });

    if (!existingSite) {
      return NextResponse.json(
        { error: 'Site not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // ✅ 입력 검증
    let validated;
    try {
      validated = siteUpdateSchema.parse(body);
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
      const site = await tx.site.update({
        where: { id },
        data: validated,
        select: {
          id: true,
          name: true,
          code: true,
          siteType: true,
          address: true,
          city: true,
          country: true,
          isActive: true,
          updatedAt: true,
        },
      });

      // 감사 로그
      await tx.auditLog.create({
        data: {
          tenantId: auth!.tenantId,
          userId: auth!.userId,
          action: 'SITE_UPDATE',
          resourceType: 'SITE',
          resourceId: site.id,
          changes: {
            before: existingSite,
            after: validated,
          },
          result: 'success',
        },
      });

      return site;
    });

    logger.info('Site updated', {
      siteId: result.id,
      tenantId: auth.tenantId,
      userId: auth.userId,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Site update error', {
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    });

    return NextResponse.json(
      { error: 'Failed to update site' },
      { status: 500 }
    );
  }
}

// DELETE /api/sites/[id] - 사이트 삭제 (소프트 삭제)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  let auth: Awaited<ReturnType<typeof verifyAuth>> | undefined;
  try {
    const { id } = await params;

    // ✅ 인증 검증
    auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ✅ 권한 검증 (삭제는 tenant_admin만)
    if (!requireRole(auth, ['tenant_admin'])) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // ✅ 사이트 존재 확인
    const existingSite = await prisma.site.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
        deletedAt: null,
      },
      include: {
        _count: {
          select: {
            devices: true,
          },
        },
      },
    });

    if (!existingSite) {
      return NextResponse.json(
        { error: 'Site not found' },
        { status: 404 }
      );
    }

    // ✅ 연결된 설비가 있으면 삭제 불가
    if (existingSite._count.devices > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete site with active devices',
          details: `This site has ${existingSite._count.devices} device(s). Please remove or reassign them first.`,
        },
        { status: 400 }
      );
    }

    // ✅ 소프트 삭제
    await prisma.$transaction(async (tx) => {
      await tx.site.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isActive: false,
        },
      });

      // 감사 로그
      await tx.auditLog.create({
        data: {
          tenantId: auth!.tenantId,
          userId: auth!.userId,
          action: 'SITE_DELETE',
          resourceType: 'SITE',
          resourceId: id,
          result: 'success',
        },
      });
    });

    logger.info('Site deleted', {
      siteId: id,
      tenantId: auth.tenantId,
      userId: auth.userId,
    });

    return NextResponse.json({
      success: true,
      message: 'Site deleted successfully',
    });
  } catch (error) {
    logger.error('Site delete error', {
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    });

    return NextResponse.json(
      { error: 'Failed to delete site' },
      { status: 500 }
    );
  }
}
