/**
 * /api/admin/users - User Management API
 *
 * GET: List all users (with pagination)
 * POST: Create new user
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import { userCreateSchema, formatValidationError } from '@/lib/validation/schemas';
import bcrypt from 'bcryptjs';
import {
  notifyNewUserJoined,
  initDefaultNotificationRules,
} from '@/lib/services/notification.service';
import { generateSeqNo } from '@/lib/utils/sequence';

// GET: List users
export async function GET(request: NextRequest) {
  try {
    // 1. Verify authentication
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Check permission (tenant_admin or higher)
    if (!requireRoleOrHigher(auth, 'tenant_admin' as UserRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // 3. Parse query parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const cursor = searchParams.get('cursor') || undefined;

    // 4. Build where clause
    const where: Record<string, unknown> = {
      tenantId: auth.tenantId,
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    if (role && role !== 'all') {
      where.role = role as UserRole;
    }

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    // 5. Fetch users with pagination
    const [users, total] = await Promise.all([
      (prisma as any).user.findMany({
        where,
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
          lastLoginAt: true,
          lastLoginIp: true,
          loginAttempts: true,
          lockedUntil: true,
          createdAt: true,
          managedSites: {
            select: { id: true, name: true },
            where: { deletedAt: null },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: cursor ? 1 : (page - 1) * limit,
        take: limit,
        ...(cursor && { cursor: { id: cursor } }),
      }),
      prisma.user.count({ where }),
    ]);

    // 6. Calculate stats
    const stats = await prisma.user.groupBy({
      by: ['role'],
      where: {
        tenantId: auth.tenantId,
        deletedAt: null,
      },
      _count: true,
    });

    const roleStats = stats.reduce(
      (acc, stat) => {
        acc[stat.role] = stat._count;
        return acc;
      },
      {} as Record<string, number>
    );

    return NextResponse.json({
      success: true,
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        nextCursor: users.length === limit ? users[users.length - 1]?.id : null,
      },
      stats: {
        total,
        ...roleStats,
      },
    });
  } catch (error) {
    console.error('[API] Users list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Create new user
export async function POST(request: NextRequest) {
  try {
    // 1. Verify authentication
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Check permission (tenant_admin or higher)
    if (!requireRoleOrHigher(auth, 'tenant_admin' as UserRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // 3. Parse and validate body
    const body = await request.json();
    const validated = userCreateSchema.parse(body);

    // 4. Check email uniqueness
    const existingUser = await prisma.user.findUnique({
      where: { email: validated.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 409 }
      );
    }

    // 5. Check plan limits
    const subscription = await prisma.subscription.findFirst({
      where: {
        tenantId: auth.tenantId,
        status: { in: ['ACTIVE', 'EXPIRE_SOON'] },
      },
      include: { plan: true },
    });

    if (subscription?.plan?.maxUsers) {
      const currentUserCount = await prisma.user.count({
        where: {
          tenantId: auth.tenantId,
          deletedAt: null,
        },
      });

      if (currentUserCount >= subscription.plan.maxUsers) {
        return NextResponse.json(
          { error: '플랜 사용자 한도에 도달했습니다. 플랜을 업그레이드하세요.' },
          { status: 403 }
        );
      }
    }

    // 6. Hash password
    const passwordHash = await bcrypt.hash(validated.password, 12);

    // 사용자 코드 채번 (US-YYYYMMDD-NNNN)
    const userCode = await generateSeqNo('USER');

    // 7. Create user with audit log
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await (tx as any).user.create({
        data: {
          code: userCode,
          tenantId: auth.tenantId,
          email: validated.email,
          passwordHash,
          name: validated.name,
          phone: validated.phone,
          role: validated.role as UserRole,
          isActive: validated.isActive,
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: auth.tenantId,
          userId: auth.userId,
          action: 'USER_CREATED',
          resourceType: 'user',
          resourceId: newUser.id,
          changes: {
            email: validated.email,
            name: validated.name,
            role: validated.role,
          },
        },
      });

      return newUser;
    });

    // 기본 알림 규칙 생성 + 새 사용자 알림 (비동기 fire-and-forget)
    initDefaultNotificationRules(auth.tenantId, user.id).catch(() => null);
    notifyNewUserJoined({
      tenantId:     auth.tenantId,
      newUserName:  user.name,
      newUserEmail: user.email,
      newUserRole:  user.role,
    }).catch(() => null);

    return NextResponse.json(
      { success: true, data: user },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatValidationError(error) },
        { status: 400 }
      );
    }

    console.error('[API] User create error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
