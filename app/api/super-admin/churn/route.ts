/**
 * GET  /api/super-admin/churn         이탈 점수 목록
 * POST /api/super-admin/churn         단일 테넌트 즉시 재계산
 * GET  /api/super-admin/churn?tenantId=xxx  특정 테넌트 점수 이력
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyAuth, isSuperAdmin } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
  formatZodErrors,
  serverErrorResponse,
} from '@/lib/api/response';
import { scoreAndSave } from '@/lib/services/churn-score.service';
import { runRetentionPipeline } from '@/lib/services/kakao-alimtalk.service';

const recalcSchema = z.object({
  tenantId:         z.string().uuid(),
  triggerRetention: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!isSuperAdmin(auth)) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const tenantId  = searchParams.get('tenantId');
    const riskLevel = searchParams.get('riskLevel'); // critical|warning|normal
    const today     = new Date().toISOString().slice(0, 10);

    const model = (prisma as any).tenantChurnScore;
    if (!model) {
      return successResponse([], { meta: { message: '이탈 점수 테이블 미생성 (prisma generate 필요)' } });
    }

    // 특정 테넌트 이력 조회
    if (tenantId) {
      const history = await model.findMany({
        where:   { tenantId },
        orderBy: { period: 'desc' },
        take:    30,
      });
      return successResponse(history);
    }

    // 오늘 기준 전체 목록
    const where: Record<string, unknown> = { period: today };
    if (riskLevel) where.riskLevel = riskLevel;

    const scores = await model.findMany({
      where,
      orderBy: { churnScore: 'desc' },
      take: 100,
    });

    const tenantIds = scores.map((s: any) => s.tenantId);
    const tenants   = await prisma.tenant.findMany({
      where:  { id: { in: tenantIds } },
      select: { id: true, name: true, domain: true, industryType: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t]));

    const enriched = scores.map((s: any) => ({
      ...s,
      tenant: tenantMap.get(s.tenantId) ?? null,
    }));

    return successResponse(enriched);
  } catch (error) {
    console.error('[SuperAdmin/Churn GET]', error);
    return serverErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!isSuperAdmin(auth)) return forbiddenResponse();

    const body   = await request.json().catch(() => ({}));
    const parsed = recalcSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse({ fields: formatZodErrors(parsed.error) });
    }

    const { tenantId, triggerRetention = false } = parsed.data;

    const result = await scoreAndSave(tenantId);

    // 이탈 위험 시 자동 리텐션 액션
    if (triggerRetention && result.riskLevel !== 'normal') {
      runRetentionPipeline(tenantId, result.churnScore, result.riskLevel).catch(() => {});
    }

    return successResponse(result);
  } catch (error) {
    console.error('[SuperAdmin/Churn POST]', error);
    return serverErrorResponse();
  }
}
