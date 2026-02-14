/**
 * /api/compliance/emission-factors - 배출계수 관리 API
 *
 * GET: 배출계수 목록 (viewer 이상)
 * POST: 배출계수 등록 (tenant_admin 이상)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import { UserRole } from '@/lib/constants/roles';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
  serverErrorResponse,
  formatZodErrors,
} from '@/lib/api/response';

const createFactorSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50),
  category: z.string().min(1).max(50),
  sourceType: z.string().min(1).max(100),
  factor: z.number().positive(),
  unit: z.string().min(1).max(50),
  inputUnit: z.string().min(1).max(50),
  source: z.string().min(1).max(200),
  year: z.number().int().min(2000).max(2100),
  region: z.string().max(10).default('KR'),
  isDefault: z.boolean().default(false),
  validFrom: z.string(),
  validTo: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const year = searchParams.get('year');

    const where: Record<string, unknown> = {
      OR: [
        { tenantId: null }, // 글로벌 기본값
        { tenantId: auth.tenantId }, // 테넌트 커스텀
      ],
    };
    if (category) where.category = category;
    if (year) where.year = parseInt(year);

    const factors = await prisma.emissionFactor.findMany({
      where,
      orderBy: [{ category: 'asc' }, { year: 'desc' }, { name: 'asc' }],
    });

    // 카테고리별 집계
    const categories = [...new Set(factors.map((f) => f.category))];

    return successResponse(factors.map((f) => ({
      ...f,
      factor: Number(f.factor),
    })), {
      meta: { categories },
    });
  } catch (error) {
    console.error('[API] 배출계수 조회 오류:', error);
    return serverErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'tenant_admin' as UserRole)) {
      return forbiddenResponse();
    }

    const body = await request.json();
    const parsed = createFactorSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse({ fields: formatZodErrors(parsed.error) });
    }

    const data = parsed.data;

    const factor = await prisma.emissionFactor.create({
      data: {
        tenantId: auth.tenantId,
        name: data.name,
        code: data.code,
        category: data.category,
        sourceType: data.sourceType,
        factor: data.factor,
        unit: data.unit,
        inputUnit: data.inputUnit,
        source: data.source,
        year: data.year,
        region: data.region,
        isDefault: data.isDefault,
        validFrom: new Date(data.validFrom),
        validTo: data.validTo ? new Date(data.validTo) : undefined,
      },
    });

    return successResponse({ ...factor, factor: Number(factor.factor) }, { status: 201 });
  } catch (error) {
    console.error('[API] 배출계수 등록 오류:', error);
    return serverErrorResponse();
  }
}
