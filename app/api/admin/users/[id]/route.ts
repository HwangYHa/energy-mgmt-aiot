/**
 * /api/admin/users/[id] - User Detail API
 *
 * GET: Get user details
 * PUT: Update user
 * DELETE: Delete user (soft delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import { userUpdateSchema, formatValidationError } from '@/lib/validation/schemas';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: Get user details
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // 1. Verify authentication
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Check permission (tenant_admin or self)
    const isSelf = auth.userId === id;
    if (!isSelf && !requireRoleOrHigher(auth, 'tenant_admin' as UserRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // 3. Fetch user
    const user = await (prisma as any).user.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
        code: true,
        email: true,
        name: true,
        phone: true,
        country: true,
        city: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        mfaEnabled: true,
        lastLoginAt: true,
        lastLoginIp: true,
        loginAttempts: true,
        lockedUntil: true,
        createdAt: true,
        updatedAt: true,
        preferences: true,
        managedSites: {
          select: {
            id: true,
            name: true,
            code: true,
            siteType: true,
            isActive: true,
          },
          where: { deletedAt: null },
        },
        _count: {
          select: {
            auditLogs: true,
            generatedReports: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 4. Get recent activity
    const recentActivity = await prisma.auditLog.findMany({
      where: {
        userId: id,
        tenantId: auth.tenantId,
      },
      select: {
        id: true,
        action: true,
        resourceType: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...user,
        recentActivity,
      },
    });
  } catch (error) {
    console.error('[API] User detail error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT: Update user
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // 1. Verify authentication
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Check permission (tenant_admin or self for limited fields)
    const isSelf = auth.userId === id;
    if (!isSelf && !requireRoleOrHigher(auth, 'tenant_admin' as UserRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // 3. Parse and validate body
    const body = await request.json();
    const validated = userUpdateSchema.parse(body);

    // 4. Restrict self-updates to certain fields
    if (isSelf && !requireRoleOrHigher(auth, 'tenant_admin' as UserRole)) {
      // Regular users can only update name and phone
      const { role, isActive, ...allowedFields } = validated;
      Object.assign(validated, allowedFields);
      delete (validated as Record<string, unknown>).role;
      delete (validated as Record<string, unknown>).isActive;
    }

    // 5. Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: {
        id,
        tenantId: auth.tenantId,
        deletedAt: null,
      },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 6. Prevent self-demotion for last admin
    if (isSelf && validated.role && validated.role !== existingUser.role) {
      if (existingUser.role === 'tenant_admin') {
        const adminCount = await prisma.user.count({
          where: {
            tenantId: auth.tenantId,
            role: 'tenant_admin',
            isActive: true,
            deletedAt: null,
          },
        });

        if (adminCount <= 1) {
          return NextResponse.json(
            { error: 'Cannot demote the last admin' },
            { status: 400 }
          );
        }
      }
    }

    // 7. Update user with audit log
    const user = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id },
        data: {
          ...(validated.name && { name: validated.name }),
          ...(validated.phone !== undefined && { phone: validated.phone }),
          ...(validated.role && { role: validated.role as UserRole }),
          ...(validated.isActive !== undefined && { isActive: validated.isActive }),
          ...((body as Record<string, unknown>).country !== undefined && { country: String((body as Record<string, unknown>).country) }),
          ...((body as Record<string, unknown>).city !== undefined && { city: (body as Record<string, unknown>).city as string | null }),
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          isActive: true,
          updatedAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: auth.tenantId,
          userId: auth.userId,
          action: 'USER_UPDATED',
          resourceType: 'user',
          resourceId: id,
          changes: {
            before: {
              name: existingUser.name,
              phone: existingUser.phone,
              role: existingUser.role,
              isActive: existingUser.isActive,
            },
            after: validated,
          },
        },
      });

      return updatedUser;
    });

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatValidationError(error) },
        { status: 400 }
      );
    }

    console.error('[API] User update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Soft delete user
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // 1. Verify authentication
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Check permission (tenant_admin only)
    if (!requireRoleOrHigher(auth, 'tenant_admin' as UserRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // 3. Prevent self-deletion
    if (auth.userId === id) {
      return NextResponse.json(
        { error: 'Cannot delete yourself' },
        { status: 400 }
      );
    }

    // 4~6. 트랜잭션 내에서 사용자 조회 + 마지막 관리자 체크 + 소프트 삭제 (경쟁 조건 방지)
    try {
      await prisma.$transaction(async (tx) => {
        // 4. Check if user exists (트랜잭션 내에서 재확인)
        const existingUser = await tx.user.findFirst({
          where: { id, tenantId: auth.tenantId, deletedAt: null },
        });

        if (!existingUser) throw new Error('USER_NOT_FOUND');

        // 5. Prevent deletion of last admin (트랜잭션 내에서 체크 - race condition 방지)
        if (existingUser.role === 'tenant_admin') {
          const adminCount = await tx.user.count({
            where: {
              tenantId: auth.tenantId,
              role: 'tenant_admin',
              isActive: true,
              deletedAt: null,
            },
          });

          if (adminCount <= 1) throw new Error('LAST_ADMIN');
        }

        // 6. Soft delete with audit log
        await tx.site.updateMany({
          where: { managerId: id },
          data: { managerId: null },
        });

        await tx.user.update({
          where: { id },
          data: {
            deletedAt: new Date(),
            isActive: false,
            email: `deleted_${id}@deleted.local`,
          },
        });

        await tx.auditLog.create({
          data: {
            tenantId: auth.tenantId,
            userId: auth.userId,
            action: 'USER_DELETED',
            resourceType: 'user',
            resourceId: id,
            changes: {
              email: existingUser.email,
              name: existingUser.name,
            },
          },
        });
      });
    } catch (txError) {
      if (txError instanceof Error) {
        if (txError.message === 'USER_NOT_FOUND') {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        if (txError.message === 'LAST_ADMIN') {
          return NextResponse.json(
            { error: 'Cannot delete the last admin' },
            { status: 400 }
          );
        }
      }
      throw txError;
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('[API] User delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
