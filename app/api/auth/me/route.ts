import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/api/response';

/**
 * GET /api/auth/me - 현재 사용자 프로필 조회
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        isEmailVerified: true,
        createdAt: true,
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) return unauthorizedResponse();

    return successResponse({
      ...user,
      organizationName: user.tenant?.name || '',
    });
  } catch {
    return serverErrorResponse();
  }
}

/**
 * PATCH /api/auth/me - 프로필 수정 (이름만)
 */
export async function PATCH(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return successResponse(null, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: auth.userId },
      data: { name: name.trim() },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return successResponse(updated);
  } catch {
    return serverErrorResponse();
  }
}
