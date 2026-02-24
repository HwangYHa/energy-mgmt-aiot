/**
 * POST /api/analytics/carbon/recalculate
 * GET  /api/analytics/carbon/recalculate?period=YYYY-MM
 */
import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { requirePermission } from '@/lib/auth/permissions';
import { recalculatePeriod } from '@/lib/carbon/engine';
import { successResponse, errorResponse } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED');

  const permErr = requirePermission(auth.role, 'analytics:compliance_report');
  if (permErr) return permErr;

  let body: { period?: string; newEngineVersionId?: string; newEmissionFactorId?: string; reason?: string };
  try { body = await request.json(); } catch { return errorResponse('VALIDATION_ERROR', { details: { message: 'JSON 파싱 오류' } }); }

  const { period, newEngineVersionId, newEmissionFactorId, reason } = body;
  if (!period || !newEngineVersionId || !reason) return errorResponse('VALIDATION_ERROR', { details: { message: 'period, newEngineVersionId, reason 필수' } });
  if (!/^\d{4}-\d{2}$/.test(period)) return errorResponse('VALIDATION_ERROR', { details: { message: 'period 형식: YYYY-MM' } });
  if (reason.trim().length < 5) return errorResponse('VALIDATION_ERROR', { details: { message: '재계산 사유는 5자 이상 입력해주세요.' } });

  try {
    const result = await recalculatePeriod({ tenantId: auth.tenantId, period, newEngineVersionId, newEmissionFactorId, reason: reason.trim(), requestedBy: auth.userId });
    return successResponse({ ...result, message: `${period} 재계산 완료: ${result.archivedCount}건 아카이브, ${result.newRecordCount}건 신규 생성` });
  } catch (error) {
    return errorResponse('SERVER_ERROR', { details: { message: error instanceof Error ? error.message : '재계산 오류' } });
  }
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED');

  const permErr = requirePermission(auth.role, 'analytics:carbon');
  if (permErr) return permErr;

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period');
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return errorResponse('VALIDATION_ERROR', { details: { message: 'period 파라미터 필요 (YYYY-MM)' } });

  const records = await prisma.emissionsRecord.findMany({
    where: { tenantId: auth.tenantId, period },
    include: {
      engineVersion: { select: { version: true, name: true, methodology: true } },
      emissionFactor: { select: { name: true, source: true, year: true, factor: true, unit: true } },
    },
    orderBy: [{ isArchived: 'asc' }, { createdAt: 'desc' }],
  });

  const active = records.filter(r => !r.isArchived);
  const archived = records.filter(r => r.isArchived);
  type Rec = typeof records[number];
  const toSummary = (recs: Rec[]) => ({
    scope1: recs.filter(r => r.scope === 'scope1').reduce((s, r) => s + Number(r.emissions), 0),
    scope2: recs.filter(r => r.scope === 'scope2').reduce((s, r) => s + Number(r.emissions), 0),
    scope3: recs.filter(r => r.scope === 'scope3').reduce((s, r) => s + Number(r.emissions), 0),
  });

  return successResponse({
    period,
    active:   { count: active.length,   summary: toSummary(active),   records: active },
    archived: { count: archived.length, summary: toSummary(archived), records: archived },
  });
}
