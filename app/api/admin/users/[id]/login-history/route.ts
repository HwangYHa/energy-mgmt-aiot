/**
 * GET /api/admin/users/[id]/login-history
 * 사용자 로그인 이력 조회 (최근 50건)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!requireRoleOrHigher(auth, 'tenant_admin' as UserRole))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id: userId } = await params;

    // 같은 테넌트의 사용자인지 확인
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const history = await (prisma as any).loginHistory.findMany({
      where: { userId, tenantId: auth.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        provider: true,
        success: true,
        failReason: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, data: history });
  } catch (e) {
    console.error('[login-history GET]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
