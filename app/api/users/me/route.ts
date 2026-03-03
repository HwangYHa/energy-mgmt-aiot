/**
 * /api/users/me
 *
 * GET  — 현재 로그인 사용자 정보 조회 (전화번호 포함)
 * PATCH — 현재 사용자 프로필 수정 (phone, name)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyAuth } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import {
  successResponse,
  unauthorizedResponse,
  validationErrorResponse,
  serverErrorResponse,
  formatZodErrors,
} from '@/lib/api/response';

const updateMeSchema = z.object({
  name:  z.string().min(1).max(100).optional(),
  phone: z
    .string()
    .max(20)
    .regex(/^[0-9\-+\s()]*$/, '유효한 전화번호 형식이 아닙니다.')
    .optional()
    .nullable(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const user = await prisma.user.findUnique({
      where:  { id: auth.userId },
      select: { id: true, email: true, name: true, phone: true, role: true },
    });

    return successResponse(user);
  } catch (error) {
    console.error('[API] GET /api/users/me 오류:', error);
    return serverErrorResponse();
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const body   = await request.json();
    const parsed = updateMeSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse({ fields: formatZodErrors(parsed.error) });
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.name  !== undefined) updateData.name  = parsed.data.name;
    if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone;

    const user = await prisma.user.update({
      where:  { id: auth.userId },
      data:   updateData,
      select: { id: true, email: true, name: true, phone: true, role: true },
    });

    return successResponse(user);
  } catch (error) {
    console.error('[API] PATCH /api/users/me 오류:', error);
    return serverErrorResponse();
  }
}
