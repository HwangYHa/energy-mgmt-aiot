import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { verifyAuth } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import {
  successResponse,
  unauthorizedResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/api/response';

/**
 * POST /api/auth/change-password - 비밀번호 변경
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return errorResponse('VALIDATION_REQUIRED_FIELD');
    }

    if (newPassword.length < 8) {
      return errorResponse('VALIDATION_ERROR', {
        details: { message: '비밀번호는 8자 이상이어야 합니다.' },
      });
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/.test(newPassword)) {
      return errorResponse('VALIDATION_ERROR', {
        details: {
          message: '비밀번호는 대문자, 소문자, 숫자를 포함해야 합니다.',
        },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) return unauthorizedResponse();

    // 현재 비밀번호 확인
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return errorResponse('AUTH_INVALID_CREDENTIALS', {
        details: { message: '현재 비밀번호가 올바르지 않습니다.' },
      });
    }

    // 새 비밀번호 해시
    const bcryptRounds = process.env.NODE_ENV === 'production' ? 12 : 10;
    const passwordHash = await bcrypt.hash(newPassword, bcryptRounds);

    await prisma.user.update({
      where: { id: auth.userId },
      data: { passwordHash },
    });

    return successResponse({ message: '비밀번호가 변경되었습니다.' });
  } catch {
    return serverErrorResponse();
  }
}
