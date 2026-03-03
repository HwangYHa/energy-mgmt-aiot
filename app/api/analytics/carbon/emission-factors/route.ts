/**
 * GET  /api/analytics/carbon/emission-factors
 * POST /api/analytics/carbon/emission-factors
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { requirePermission } from '@/lib/auth/permissions';
import { successResponse, errorResponse } from '@/lib/api/response';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED');
  const permErr = requirePermission(auth.role, 'analytics:carbon');
  if (permErr) return permErr;

  const { searchParams } = new URL(request.url);
  const category   = searchParams.get('category');
  const year       = searchParams.get('year');
  const activeOnly = searchParams.get('activeOnly') !== 'false';

  const now = new Date();
  const andConditions: Prisma.EmissionFactorWhereInput[] = [
    { OR: [{ tenantId: null }, { tenantId: auth.tenantId }] },
  ];
  if (category)   andConditions.push({ category });
  if (year)       andConditions.push({ year: Number(year) });
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

  let body: { name?: string; code?: string; category?: string; sourceType?: string; factor?: number; unit?: string; inputUnit?: string; source?: string; year?: number; region?: string; isDefault?: boolean; validFrom?: string; validTo?: string; isGlobal?: boolean };
  try { body = await request.json(); } catch { return errorResponse('VALIDATION_ERROR', { details: { message: 'JSON 파싱 오류' } }); }

  if (!body.name || !body.code || !body.category || !body.factor || !body.unit || !body.source || !body.year)
    return errorResponse('VALIDATION_ERROR', { details: { message: 'name, code, category, factor, unit, source, year 필수' } });

  const isGlobal = body.isGlobal && auth.role === 'super_admin';
  const tenantId = isGlobal ? null : auth.tenantId;

  const dup = await prisma.emissionFactor.findFirst({ where: { code: body.code, tenantId } });
  if (dup) return errorResponse('RESOURCE_CONFLICT', { details: { message: `배출계수 코드 '${body.code}' 이미 존재` } });

  const factor = await prisma.emissionFactor.create({
    data: {
      tenantId, code: body.code, category: body.category,
      sourceType: body.sourceType ?? body.category, factor: body.factor,
      unit: body.unit, inputUnit: body.inputUnit ?? 'kWh', source: body.source,
      year: body.year, region: body.region ?? 'KR', isDefault: body.isDefault ?? false,
      version: '1.0.0', validFrom: body.validFrom ? new Date(body.validFrom) : new Date(`${body.year}-01-01`),
      validTo: body.validTo ? new Date(body.validTo) : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: auth.tenantId, userId: auth.userId,
      action: 'EMISSION_FACTOR_CREATED', resourceType: 'emission_factor', resourceId: factor.id,
      changes: { code: body.code, factor: body.factor, source: body.source, year: body.year, isGlobal },
    },
  }).catch(() => null);

  return successResponse(factor);
}
