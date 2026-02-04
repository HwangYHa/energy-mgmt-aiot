import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    // 인증 검증 (모든 역할 가능)
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 활성 플랜 조회 (public만)
    const plans = await prisma.plan.findMany({
      where: {
        isActive: true,
        isPublic: true,
      },
      orderBy: {
        monthlyPrice: 'asc',
      },
    });

    return NextResponse.json({ success: true, data: plans });
  } catch (error) {
    console.error('[API] Plans fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
