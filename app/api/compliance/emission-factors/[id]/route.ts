/**
 * /api/compliance/emission-factors/[id]
 *
 * GET   : 배출계수 상세 조회 (버전 이력 + 사용 통계 포함)
 * PATCH : 승인 / 폐지 / 값 수정 (site_manager 이상)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import { UserRole } from '@/lib/constants/roles';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/api/response';

const SCOPE_CATEGORY_MAP: Record<string, string> = {
  electricity: 'scope2', steam: 'scope2', district_heat: 'scope2',
  fuel: 'scope1', process: 'scope1', refrigerant: 'scope1',
  transport: 'scope3', waste: 'scope3', purchased_goods: 'scope3',
  raw_materials: 'scope3', capital_goods: 'scope3', business_travel: 'scope3',
};

const patchSchema = z.object({
  action: z.enum(['approve', 'deprecate', 'reject', 'activate', 'deactivate']).optional(),
  reason: z.string().max(500).optional(),
  // 값 직접 수정 (DRAFT 상태만 허용)
  factor:       z.number().positive().optional(),
  name:         z.string().max(200).optional(),
  sourceUrl:    z.string().max(500).optional(),
  changeReason: z.string().max(500).optional(),
});

// ─── GET ─────────────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();

  const { id } = await params;

  try {
    const factor = await prisma.emissionFactor.findFirst({
      where: {
        id,
        OR: [{ tenantId: null }, { tenantId: auth.tenantId }],
      },
    });
    if (!factor) return notFoundResponse();

    // 버전 이력 (같은 factorCode 체인)
    const versions = factor.factorCode
      ? await prisma.emissionFactor.findMany({
          where: {
            factorCode: factor.factorCode,
            OR: [{ tenantId: null }, { tenantId: auth.tenantId }],
          },
          orderBy: { validFrom: 'desc' },
          select: {
            id: true, version: true, validFrom: true, validTo: true,
            factor: true, approvalStatus: true, isActive: true,
            changeReason: true, createdAt: true,
          },
        })
      : [];

    // 사용 중인 EmissionsRecord 수
    const usageCount = await (prisma as any).emissionsRecord.count({
      where: { emissionFactorId: id, isArchived: false },
    });

    const now      = new Date();
    const in30Days = new Date(now.getTime() + 30 * 86_400_000);

    return successResponse({
      ...factor,
      factor:  Number(factor.factor),
      scope:   SCOPE_CATEGORY_MAP[factor.category] ?? 'scope1',
      statusLabel:
        factor.validTo && new Date(factor.validTo) < now ? 'expired'
        : factor.validTo && new Date(factor.validTo) < in30Days ? 'expiring'
        : factor.approvalStatus === 'APPROVED' && factor.isActive ? 'active'
        : factor.approvalStatus === 'PENDING_REVIEW' ? 'pending'
        : factor.approvalStatus === 'DRAFT' ? 'draft'
        : factor.approvalStatus === 'REJECTED' ? 'rejected'
        : 'active',
      versions: versions.map((v) => ({ ...v, factor: Number(v.factor) })),
      usageCount,
    });
  } catch (error) {
    console.error('[API] 배출계수 상세 조회 오류:', error);
    return serverErrorResponse();
  }
}

// ─── PATCH ───────────────────────────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();
  if (!requireRoleOrHigher(auth, 'site_manager' as UserRole)) {
    return forbiddenResponse();
  }

  const { id } = await params;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'JSON 파싱 오류' }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '입력 오류', details: parsed.error.flatten() }, { status: 400 });
  }

  const { action, reason, factor, name, sourceUrl, changeReason } = parsed.data;

  try {
    const existing = await prisma.emissionFactor.findFirst({
      where: { id, OR: [{ tenantId: null }, { tenantId: auth.tenantId }] },
    });
    if (!existing) return notFoundResponse();

    const updateData: Record<string, unknown> = {};

    if (action === 'approve') {
      updateData.approvalStatus = 'APPROVED';
      updateData.approvedBy     = auth.userId;
      updateData.approvedAt     = new Date();
      updateData.isActive       = true;
    } else if (action === 'deprecate') {
      updateData.isActive       = false;
      updateData.validTo        = new Date();
      updateData.changeReason   = reason ?? '관리자 폐지';
    } else if (action === 'reject') {
      updateData.approvalStatus  = 'REJECTED';
      updateData.rejectedBy      = auth.userId;
      updateData.rejectedAt      = new Date();
      updateData.rejectionReason = reason ?? '검토 결과 반려';
      updateData.isActive        = false;
    } else if (action === 'activate') {
      updateData.isActive = true;
    } else if (action === 'deactivate') {
      updateData.isActive = false;
    }

    // 값 직접 수정 (DRAFT 상태만 허용)
    if (factor   !== undefined && existing.approvalStatus === 'DRAFT') updateData.factor    = factor;
    if (name     !== undefined)                                          updateData.name      = name;
    if (sourceUrl !== undefined)                                         updateData.sourceUrl = sourceUrl;
    if (changeReason !== undefined)                                      updateData.changeReason = changeReason;

    const updated = await prisma.emissionFactor.update({ where: { id }, data: updateData });

    return successResponse({ ...updated, factor: Number(updated.factor) });
  } catch (error) {
    console.error('[API] 배출계수 수정 오류:', error);
    return serverErrorResponse();
  }
}
