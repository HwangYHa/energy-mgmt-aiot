import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const roleUpdateSchema = z.object({
  role: z.enum(['viewer', 'operator', 'site_manager', 'tenant_admin']),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // 1. Await params (Next.js 15)
    const { userId } = await params;

    // 2. 인증 검증
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. 권한 검증 (tenant_admin 이상)
    if (!requireRoleOrHigher(auth, 'tenant_admin' as UserRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // 4. 입력 검증
    const body = await request.json();
    const { role } = roleUpdateSchema.parse(body);

    // 5. 대상 사용자 조회
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 6. 테넌트 격리 검증
    if (targetUser.tenantId !== auth.tenantId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // 7. 트랜잭션으로 역할 변경 + 감사 로그
    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { role: role as UserRole },
        select: { id: true, email: true, name: true, role: true },
      });

      await tx.auditLog.create({
        data: {
          tenantId: auth.tenantId,
          userId: auth.userId,
          action: 'USER_ROLE_CHANGED',
          resourceType: 'user',
          resourceId: userId,
          changes: {
            from: targetUser.role,
            to: role,
          },
        },
      });

      return updatedUser;
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[API] User role update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
