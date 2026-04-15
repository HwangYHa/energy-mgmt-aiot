/**
 * /api/compliance/emission-factors — 배출계수 관리 API
 *
 * GET : 배출계수 목록 조회 (viewer 이상)
 *   ?category=electricity&scope=scope2&status=active&isCustom=false
 *   ?calculationType=location&year=2025&region=KR&search=한국전력
 *   ?expiringSoon=true  → 30일 내 만료 예정
 *   ?includeStats=true  → meta.stats(KPI) 포함 반환
 *
 * POST: 배출계수 등록 (site_manager 이상)
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import { UserRole } from '@/lib/constants/roles';
import { EmissionFactorService } from '@/lib/domains/carbon/services/emission-factor.service';
import { generateSeqNo } from '@/lib/utils/sequence';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
  serverErrorResponse,
  formatZodErrors,
} from '@/lib/api/response';

// ─── Scope 카테고리 매핑 ──────────────────────────────────────────────────────
const SCOPE_CATEGORY_MAP: Record<string, string> = {
  electricity:     'scope2',
  steam:           'scope2',
  district_heat:   'scope2',
  fuel:            'scope1',
  process:         'scope1',
  refrigerant:     'scope1',
  transport:       'scope3',
  waste:           'scope3',
  purchased_goods: 'scope3',
  raw_materials:   'scope3',
  capital_goods:   'scope3',
  business_travel: 'scope3',
};

// ─── 등록 스키마 ──────────────────────────────────────────────────────────────
const createFactorSchema = z.object({
  code:             z.string().max(50).optional(),
  name:             z.string().max(200).optional(),
  factorCode:       z.string().max(100).optional(),
  category:         z.string().min(1).max(50),
  sourceType:       z.string().min(1).max(100),
  countryCode:      z.string().length(2).default('KR'),
  energyType:       z.string().max(50).optional(),
  calculationType:  z.enum(['location', 'market', 'activity', 'spend']).optional(),
  factor:           z.number().positive(),
  unit:             z.string().min(1).max(50),
  inputUnit:        z.string().min(1).max(50),
  source:           z.string().min(1).max(200),
  sourceName:       z.string().max(200).optional(),
  sourceVersion:    z.string().max(50).optional(),
  sourceUrl:        z.string().max(500).optional(),
  factorSourceType: z.enum(['official', 'international', 'tenant_custom']).optional(),
  year:             z.number().int().min(2000).max(2100),
  region:           z.string().max(10).default('KR'),
  validFrom:        z.string(),
  validTo:          z.string().optional(),
  isDefault:        z.boolean().default(false),
  changeReason:     z.string().max(500).optional(),
});

// ─── GET ─────────────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const category        = searchParams.get('category');
    const scope           = searchParams.get('scope');
    const year            = searchParams.get('year');
    const region          = searchParams.get('region');
    const calculationType = searchParams.get('calculationType');
    const statusParam     = searchParams.get('status');
    const isCustomParam   = searchParams.get('isCustom');
    const search          = searchParams.get('search');
    const expiringSoon    = searchParams.get('expiringSoon') === 'true';
    const includeStats    = searchParams.get('includeStats') === 'true';

    const where: Record<string, unknown> = {
      OR: [
        { tenantId: null },
        { tenantId: auth.tenantId },
      ],
    };

    // 카테고리 / Scope 필터
    if (category) {
      where.category = category;
    } else if (scope) {
      const cats = Object.entries(SCOPE_CATEGORY_MAP)
        .filter(([, s]) => s === scope)
        .map(([c]) => c);
      if (cats.length > 0) where.category = { in: cats };
    }

    if (year)            where.year            = parseInt(year);
    if (region)          where.region          = region;
    if (calculationType) where.calculationType = calculationType;

    if (isCustomParam !== null) {
      where.isCustom = isCustomParam === 'true';
    }

    const now      = new Date();
    const in30Days = new Date(now.getTime() + 30 * 86_400_000);

    if (statusParam === 'active') {
      where.isActive       = true;
      where.approvalStatus = 'APPROVED';
    } else if (statusParam === 'draft') {
      where.approvalStatus = { in: ['DRAFT', 'PENDING_REVIEW'] };
    } else if (statusParam === 'pending') {
      where.approvalStatus = 'PENDING_REVIEW';
    } else if (statusParam === 'expired') {
      where.validTo = { lt: now };
    } else if (statusParam === 'expiring') {
      where.validTo = { gte: now, lte: in30Days };
    }

    if (expiringSoon) {
      where.validTo = { gte: now, lte: in30Days };
    }

    if (search) {
      (where as any).AND = [
        {
          OR: [
            { name:       { contains: search } },
            { code:       { contains: search } },
            { factorCode: { contains: search } },
            { source:     { contains: search } },
            { sourceName: { contains: search } },
            { sourceType: { contains: search } },
          ],
        },
      ];
    }

    const factors = await prisma.emissionFactor.findMany({
      where,
      orderBy: [{ category: 'asc' }, { year: 'desc' }, { code: 'asc' }],
    });

    // Scope + statusLabel 파생 추가
    const factorsWithScope = factors.map((f) => ({
      ...f,
      factor:      Number(f.factor),
      scope:       SCOPE_CATEGORY_MAP[f.category] ?? 'scope1',
      statusLabel:
        f.validTo && new Date(f.validTo) < now ? 'expired'
        : f.validTo && new Date(f.validTo) < in30Days ? 'expiring'
        : f.approvalStatus === 'APPROVED' && f.isActive ? 'active'
        : f.approvalStatus === 'PENDING_REVIEW' ? 'pending'
        : f.approvalStatus === 'DRAFT' ? 'draft'
        : f.approvalStatus === 'REJECTED' ? 'rejected'
        : 'active',
    }));

    // ── KPI 통계 ─────────────────────────────────────────────────────────────
    let stats: Record<string, number> | undefined;
    if (includeStats) {
      const base: Record<string, unknown> = {
        OR: [{ tenantId: null }, { tenantId: auth.tenantId }],
      };
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [total, active, pendingApproval, expiringCount, customCount, changedThisMonth] =
        await Promise.all([
          prisma.emissionFactor.count({ where: base }),
          prisma.emissionFactor.count({ where: { ...base, isActive: true, approvalStatus: 'APPROVED' } }),
          prisma.emissionFactor.count({ where: { ...base, approvalStatus: 'PENDING_REVIEW' } }),
          prisma.emissionFactor.count({ where: { ...base, validTo: { gte: now, lte: in30Days } } }),
          prisma.emissionFactor.count({ where: { ...base, isCustom: true } }),
          prisma.emissionFactor.count({ where: { ...base, createdAt: { gte: monthStart } } }),
        ]);

      // EmissionsRecord에서 실제 사용 중인 계수 집합
      const usedRows = await (prisma as any).emissionsRecord.findMany({
        where:    { tenantId: auth.tenantId, isArchived: false },
        select:   { emissionFactorId: true },
        distinct: ['emissionFactorId'],
      }) as Array<{ emissionFactorId: string }>;

      stats = {
        total,
        active,
        inUse:        usedRows.length,
        pending:      pendingApproval,
        expiringSoon: expiringCount,
        custom:       customCount,
        changedThisMonth,
      };
    }

    const categories = [...new Set(factors.map((f) => f.category))];

    return successResponse(factorsWithScope, {
      meta: { categories, ...(stats ? { stats } : {}) },
    });
  } catch (error) {
    console.error('[API] 배출계수 조회 오류:', error);
    return serverErrorResponse();
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'site_manager' as UserRole)) {
      return forbiddenResponse();
    }

    const body   = await request.json();
    const parsed = createFactorSchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse({ fields: formatZodErrors(parsed.error) });
    }

    const data  = parsed.data;
    const code  = data.code || (await generateSeqNo('EMISSION_FACTOR'));
    const fCode = data.factorCode ||
      `${data.countryCode.toLowerCase()}-${data.category}-${code.toLowerCase()}`;

    const factor = await EmissionFactorService.createVersion(
      {
        code,
        name:             data.name,
        factorCode:       fCode,
        category:         data.category,
        sourceType:       data.sourceType,
        countryCode:      data.countryCode,
        energyType:       data.energyType,
        calculationType:  data.calculationType,
        factor:           data.factor,
        unit:             data.unit,
        inputUnit:        data.inputUnit,
        source:           data.source,
        sourceName:       data.sourceName,
        sourceVersion:    data.sourceVersion,
        sourceUrl:        data.sourceUrl,
        factorSourceType: data.factorSourceType,
        year:             data.year,
        region:           data.region,
        validFrom:        new Date(data.validFrom),
        validTo:          data.validTo ? new Date(data.validTo) : null,
        tenantId:         auth.tenantId,
        changeReason:     data.changeReason,
      },
      auth.userId
    );

    return successResponse(factor, { status: 201 });
  } catch (error) {
    console.error('[API] 배출계수 등록 오류:', error);
    return serverErrorResponse();
  }
}
