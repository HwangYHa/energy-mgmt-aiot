/**
 * GET/PUT /api/analytics/carbon/settings
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { verifyAuth } from '@/lib/auth/verify';
import { requirePermission } from '@/lib/auth/permissions';
import { successResponse, errorResponse } from '@/lib/api/response';
import { getActiveEngineVersion } from '@/lib/carbon/engine';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED');
  const permErr = requirePermission(auth.role, 'settings:view');
  if (permErr) return permErr;

  const setting = await prisma.tenantComplianceSetting.findUnique({ where: { tenantId: auth.tenantId } });

  const now = new Date();
  const emissionFactors = await prisma.emissionFactor.findMany({
    where: {
      AND: [
        { OR: [{ tenantId: null }, { tenantId: auth.tenantId }] },
        { OR: [{ validTo: null }, { validTo: { gte: now } }] },
      ],
    },
    select: { id: true, name: true, code: true, category: true, sourceType: true, factor: true, unit: true, source: true, year: true, region: true, isDefault: true },
    orderBy: [{ isDefault: 'desc' }, { year: 'desc' }],
  });

  const engineVersions = await prisma.calcEngineVersion.findMany({
    where: { isActive: true },
    select: { id: true, version: true, name: true, methodology: true, releasedAt: true, changelog: true },
    orderBy: { releasedAt: 'desc' },
  });

  const activeEngine = await getActiveEngineVersion();

  return successResponse({
    setting: setting ?? {
      tenantId: auth.tenantId, region: 'KR', reportingStandard: 'GHG Protocol',
      factorSource: '환경부', defaultEngineVersion: activeEngine.version,
      electricityFactor: 0.4567, baseYear: 2020, targetReductionPct: null,
      reportingFrequency: 'monthly', fiscalYearStart: 1,
    },
    available: { emissionFactors, engineVersions, activeEngineId: activeEngine.id },
  });
}

export async function PUT(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED');
  const permErr = requirePermission(auth.role, 'settings:update');
  if (permErr) return permErr;

  let body: { region?: string; reportingStandard?: string; factorSource?: string; defaultEngineVersion?: string; electricityFactor?: number; baseYear?: number; targetReductionPct?: number | null; reportingFrequency?: string; fiscalYearStart?: number };
  try { body = await request.json(); } catch { return errorResponse('VALIDATION_ERROR', { details: { message: 'JSON 파싱 오류' } }); }

  const existing = await prisma.tenantComplianceSetting.findUnique({ where: { tenantId: auth.tenantId } });

  const updated = await prisma.tenantComplianceSetting.upsert({
    where: { tenantId: auth.tenantId },
    create: {
      tenantId: auth.tenantId,
      region: body.region ?? 'KR',
      reportingStandard: body.reportingStandard ?? 'GHG Protocol',
      factorSource: body.factorSource ?? '환경부',
      defaultEngineVersion: body.defaultEngineVersion ?? null,
      electricityFactor: body.electricityFactor ?? 0.4567,
      baseYear: body.baseYear ?? 2020,
      targetReductionPct: body.targetReductionPct ?? null,
      reportingFrequency: body.reportingFrequency ?? 'monthly',
      fiscalYearStart: body.fiscalYearStart ?? 1,
    },
    update: {
      ...(body.region !== undefined && { region: body.region }),
      ...(body.reportingStandard !== undefined && { reportingStandard: body.reportingStandard }),
      ...(body.factorSource !== undefined && { factorSource: body.factorSource }),
      ...(body.defaultEngineVersion !== undefined && { defaultEngineVersion: body.defaultEngineVersion }),
      ...(body.electricityFactor !== undefined && { electricityFactor: body.electricityFactor }),
      ...(body.baseYear !== undefined && { baseYear: body.baseYear }),
      ...(body.targetReductionPct !== undefined && { targetReductionPct: body.targetReductionPct }),
      ...(body.reportingFrequency !== undefined && { reportingFrequency: body.reportingFrequency }),
      ...(body.fiscalYearStart !== undefined && { fiscalYearStart: body.fiscalYearStart }),
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: auth.tenantId, userId: auth.userId,
      action: 'COMPLIANCE_SETTING_UPDATED', resourceType: 'tenant_compliance_setting', resourceId: updated.id,
      changes: { before: existing, after: body } as Prisma.InputJsonValue,
    },
  }).catch(() => null);

  return successResponse(updated);
}
