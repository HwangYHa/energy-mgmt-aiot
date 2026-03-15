/**
 * GET  /api/analytics/carbon/emission-factors
 * POST /api/analytics/carbon/emission-factors
 *
 * POST: EmissionFactorService.createVersion() 사용 (Hash-chain 감사 자동 기록)
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { requirePermission } from '@/lib/auth/permissions';
import { successResponse, errorResponse } from '@/lib/api/response';
import { Prisma } from '@prisma/client';
import { EmissionFactorService } from '@/lib/domains/carbon/services/emission-factor.service';
import { generateSeqNo } from '@/lib/utils/sequence';

export const dynamic = 'force-dynamic';

// ── 현재 연도 기반 year 범위 ─────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear();

// ── POST 요청 Zod 스키마 ─────────────────────────────────────────
const createFactorSchema = z.object({
  code:           z.string().max(50).optional(),
  category:       z.string().min(1, 'category는 필수입니다').max(50),
  sourceType:     z.string().max(100).optional(),
  factor:         z.number({ invalid_type_error: 'factor는 숫자여야 합니다' })
                   .positive('배출계수(factor)는 0보다 커야 합니다'),
  unit:           z.string().min(1, 'unit은 필수입니다').max(50),
  inputUnit:      z.string().max(50).optional(),
  source:         z.string().min(1, 'source는 필수입니다').max(200),
  year:           z.number({ invalid_type_error: 'year는 숫자여야 합니다' })
                   .int('year는 정수여야 합니다')
                   .min(2000, 'year는 2000 이상이어야 합니다')
                   .max(CURRENT_YEAR + 5, `year는 ${CURRENT_YEAR + 5} 이하여야 합니다`),
  region:         z.string().max(10).optional(),
  validFrom:      z.string().optional().refine(
                   (v) => !v || !isNaN(Date.parse(v)),
                   'validFrom 날짜 형식이 올바르지 않습니다'
                  ),
  validTo:        z.string().optional().refine(
                   (v) => !v || !isNaN(Date.parse(v)),
                   'validTo 날짜 형식이 올바르지 않습니다'
                  ),
  isGlobal:       z.boolean().optional(),
  changeReason:   z.string().max(500).optional(),
  parentVersionId: z.string().uuid('parentVersionId는 UUID여야 합니다').optional(),
}).refine(
  (d) => {
    if (!d.validFrom || !d.validTo) return true;
    return new Date(d.validFrom) < new Date(d.validTo);
  },
  { message: 'validTo는 validFrom 이후여야 합니다', path: ['validTo'] }
);

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED');
  const permErr = requirePermission(auth.role, 'analytics:carbon');
  if (permErr) return permErr;

  const { searchParams } = new URL(request.url);
  const category   = searchParams.get('category');
  const yearParam  = searchParams.get('year');
  const activeOnly = searchParams.get('activeOnly') !== 'false';

  // year 파라미터 유효성 검사
  if (yearParam !== null) {
    const yr = Number(yearParam);
    if (!Number.isInteger(yr) || yr < 2000 || yr > CURRENT_YEAR + 5) {
      return errorResponse('VALIDATION_ERROR', { details: { message: `year는 2000~${CURRENT_YEAR + 5} 사이의 정수여야 합니다` } });
    }
  }

  const now = new Date();
  const andConditions: Prisma.EmissionFactorWhereInput[] = [
    { OR: [{ tenantId: null }, { tenantId: auth.tenantId }] },
  ];
  if (category)   andConditions.push({ category });
  if (yearParam)  andConditions.push({ year: Number(yearParam) });
  if (activeOnly) andConditions.push({ OR: [{ validTo: null }, { validTo: { gte: now } }] });

  const factors = await prisma.emissionFactor.findMany({
    where: { AND: andConditions },
    select: {
      id: true, code: true, category: true, sourceType: true,
      factor: true, unit: true, inputUnit: true, source: true, year: true,
      region: true, isDefault: true, version: true, validFrom: true, validTo: true, tenantId: true,
    },
    orderBy: [{ isDefault: 'desc' }, { year: 'desc' }, { category: 'asc' }],
  });
  return successResponse(factors);
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED');
  const permErr = requirePermission(auth.role, 'settings:update');
  if (permErr) return permErr;

  const rawBody = await request.json().catch(() => null);
  if (!rawBody) return errorResponse('VALIDATION_ERROR', { details: { message: 'JSON 파싱 오류' } });

  // Zod 검증
  const parsed = createFactorSchema.safeParse(rawBody);
  if (!parsed.success) {
    const fields = parsed.error.errors.reduce<Record<string, string>>((acc, e) => {
      acc[e.path.join('.')] = e.message;
      return acc;
    }, {});
    return errorResponse('VALIDATION_ERROR', { details: { message: '입력값 오류', fields } });
  }

  const body = parsed.data;
  const isGlobal = body.isGlobal && auth.role === 'super_admin';
  const tenantId = isGlobal ? null : auth.tenantId;
  const code = body.code || await generateSeqNo('EMISSION_FACTOR');

  try {
    const factor = await EmissionFactorService.createVersion(
      {
        code,
        category: body.category,
        sourceType: body.sourceType ?? body.category,
        factor: body.factor,
        unit: body.unit,
        inputUnit: body.inputUnit ?? 'kWh',
        source: body.source,
        year: body.year,
        region: body.region ?? 'KR',
        validFrom: body.validFrom ? new Date(body.validFrom) : new Date(`${body.year}-01-01`),
        validTo: body.validTo ? new Date(body.validTo) : null,
        tenantId,
        changeReason: body.changeReason,
        parentVersionId: body.parentVersionId,
      },
      auth.userId
    );
    return successResponse(factor);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '배출계수 생성 실패';
    if (msg.includes('겹치는')) {
      return errorResponse('RESOURCE_CONFLICT', { details: { message: msg } });
    }
    if (msg.includes('양수') || msg.includes('validFrom') || msg.includes('중복')) {
      return errorResponse('VALIDATION_ERROR', { details: { message: msg } });
    }
    console.error('[emission-factors POST]', err);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}
