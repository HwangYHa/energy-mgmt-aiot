/**
 * /api/support/[id]
 *
 * GET    → 문의 상세 조회 (tenant_admin+)
 * PATCH  → 상태/메모 업데이트 (tenant_admin+)
 * DELETE → 문의 삭제 (super_admin)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
  serverErrorResponse,
  formatZodErrors,
} from '@/lib/api/response';
import { UserRole } from '@/lib/constants/roles';

const patchSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'resolved', 'closed']).optional(),
  adminNote: z.string().max(2000).optional().nullable(),
});

// ──────────────────────────────────────────────────────────────
// 공통: 권한 + 접근 가능 여부 확인
// ──────────────────────────────────────────────────────────────

async function findInquiry(id: string, tenantId: string, isSuperAdmin: boolean) {
  return prisma.supportInquiry.findFirst({
    where: {
      id,
      ...(isSuperAdmin ? {} : { tenantId }),
    },
  });
}

// ──────────────────────────────────────────────────────────────
// GET — 상세 조회
// ──────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'tenant_admin' as UserRole)) {
      return forbiddenResponse();
    }

    const { id } = await params;
    const isSuperAdmin = requireRoleOrHigher(auth, 'super_admin' as UserRole);

    const inquiry = await prisma.supportInquiry.findFirst({
      where: {
        id,
        ...(isSuperAdmin ? {} : { tenantId: auth.tenantId }),
      },
    });

    if (!inquiry) return errorResponse('RESOURCE_NOT_FOUND');

    return successResponse({ inquiry });
  } catch (error) {
    console.error('[API] 문의 상세 조회 오류:', error);
    return serverErrorResponse();
  }
}

// ──────────────────────────────────────────────────────────────
// PATCH — 상태 / 메모 업데이트
// ──────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'tenant_admin' as UserRole)) {
      return forbiddenResponse();
    }

    const { id } = await params;
    const isSuperAdmin = requireRoleOrHigher(auth, 'super_admin' as UserRole);

    const inquiry = await findInquiry(id, auth.tenantId, isSuperAdmin);
    if (!inquiry) return errorResponse('RESOURCE_NOT_FOUND');

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse({ fields: formatZodErrors(parsed.error) });
    }

    const updated = await prisma.supportInquiry.update({
      where: { id },
      data: {
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.adminNote !== undefined ? { adminNote: parsed.data.adminNote } : {}),
      },
    });

    return successResponse({ inquiry: updated });
  } catch (error) {
    console.error('[API] 문의 상태 업데이트 오류:', error);
    return serverErrorResponse();
  }
}

// ──────────────────────────────────────────────────────────────
// DELETE — 삭제 (super_admin)
// ──────────────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'super_admin' as UserRole)) {
      return forbiddenResponse();
    }

    const { id } = await params;
    const inquiry = await prisma.supportInquiry.findUnique({ where: { id } });
    if (!inquiry) return errorResponse('RESOURCE_NOT_FOUND');

    await prisma.supportInquiry.delete({ where: { id } });

    return successResponse({ deleted: id });
  } catch (error) {
    console.error('[API] 문의 삭제 오류:', error);
    return serverErrorResponse();
  }
}
