/**
 * GET  /api/analytics/carbon/engine-versions
 * POST /api/analytics/carbon/engine-versions
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { requirePermission, requireSuperAdmin } from '@/lib/auth/permissions';
import { successResponse, errorResponse } from '@/lib/api/response';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED');
  const permErr = requirePermission(auth.role, 'analytics:carbon');
  if (permErr) return permErr;

  const versions = await prisma.calcEngineVersion.findMany({
    select: {
      id: true, version: true, name: true, description: true,
      methodology: true, formula: true, parameters: true,
      isActive: true, releasedAt: true, deprecatedAt: true,
      changelog: true, createdAt: true,
    },
    orderBy: { releasedAt: 'desc' },
  });
  return successResponse(versions);
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED');
  const permErr = requireSuperAdmin(auth.role);
  if (permErr) return permErr;

  let body: { version?: string; name?: string; description?: string; methodology?: string; formula?: Record<string, unknown>; parameters?: Record<string, unknown>; changelog?: string; setAsActive?: boolean };
  try { body = await request.json(); } catch { return errorResponse('VALIDATION_ERROR', { details: { message: 'JSON 파싱 오류' } }); }

  if (!body.version || !body.name || !body.methodology) return errorResponse('VALIDATION_ERROR', { details: { message: 'version, name, methodology 필수' } });

  const existing = await prisma.calcEngineVersion.findUnique({ where: { version: body.version } });
  if (existing) return errorResponse('RESOURCE_CONFLICT', { details: { message: `버전 ${body.version} 이미 존재` } });

  if (body.setAsActive) {
    await prisma.calcEngineVersion.updateMany({ where: { isActive: true }, data: { isActive: false, deprecatedAt: new Date() } });
  }

  const newVersion = await prisma.calcEngineVersion.create({
    data: {
      version: body.version, name: body.name, description: body.description ?? null,
      methodology: body.methodology,
      formula: body.formula as Prisma.InputJsonValue ?? Prisma.JsonNull,
      parameters: body.parameters as Prisma.InputJsonValue ?? Prisma.JsonNull,
      changelog: body.changelog ?? null,
      isActive: body.setAsActive ?? false, releasedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: auth.tenantId, userId: auth.userId,
      action: 'CALC_ENGINE_VERSION_CREATED', resourceType: 'calc_engine_version', resourceId: newVersion.id,
      changes: { version: body.version, methodology: body.methodology },
    },
  }).catch(() => null);

  return successResponse(newVersion);
}
