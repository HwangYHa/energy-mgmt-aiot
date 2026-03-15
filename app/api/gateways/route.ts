/**
 * /api/gateways
 *
 * 게이트웨이 목록 조회 및 생성
 *
 * GET  ?siteId=&status=&page=&limit=  → 게이트웨이 목록 (페이지네이션)
 * POST                                → 게이트웨이 등록
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
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
import { checkPlanLimit } from '@/lib/middleware/plan-limit';
import { generateSeqNo } from '@/lib/utils/sequence';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────────────────────
// Validation Schema
// ──────────────────────────────────────────────────────────────

const createGatewaySchema = z.object({
  siteId: z.string().min(1, '사이트를 선택하세요'),
  serialNumber: z.string().min(1, '시리얼 번호를 입력하세요').max(100),
  name: z.string().max(100).optional(),
  model: z.string().max(50).optional(),
  firmwareVersion: z.string().max(20).optional(),
  ipAddress: z.string().max(45).optional(),
  macAddress: z.string().max(17).optional(),
  vpnAddress: z.string().max(45).optional(),
  primaryConnection: z.enum(['ethernet', 'lte', 'wifi']).default('ethernet'),
  fallbackConnection: z.enum(['lte', 'wifi', 'none']).default('lte'),
  bufferSizeMb: z.number().int().min(1).max(10240).default(100),
  ownership: z.enum(['company', 'customer']).default('company'),
  installationDate: z.string().optional(),
  config: z.record(z.unknown()).optional(),
});

// ──────────────────────────────────────────────────────────────
// GET — 게이트웨이 목록
// ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20')));
    const skip = (page - 1) * limit;

    const where: Prisma.GatewayWhereInput = {
      tenantId: auth.tenantId,
      ...(siteId ? { siteId } : {}),
      ...(status ? { status: status as never } : {}),
      ...(search
        ? {
            OR: [
              { serialNumber: { contains: search } },
              { name: { contains: search } },
              { ipAddress: { contains: search } },
              { model: { contains: search } },
            ],
          }
        : {}),
    };

    const [total, gateways] = await Promise.all([
      prisma.gateway.count({ where }),
      prisma.gateway.findMany({
        where,
        include: {
          site: { select: { id: true, name: true, city: true } },
          _count: { select: { devices: true } },
        },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return successResponse(
      { gateways },
      {
        pagination: {
          skip,
          take: limit,
          total,
          hasMore: skip + limit < total,
        },
      }
    );
  } catch (error) {
    console.error('[API] 게이트웨이 목록 조회 오류:', error);
    return serverErrorResponse();
  }
}

// ──────────────────────────────────────────────────────────────
// POST — 게이트웨이 등록
// ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'site_manager' as UserRole)) {
      return forbiddenResponse();
    }

    // ✅ 플랜 한도 확인 (게이트웨이 수 제한)
    const limitErr = await checkPlanLimit(auth.tenantId, 'gateway');
    if (limitErr) return limitErr;

    const body = await request.json();
    const parsed = createGatewaySchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse({ fields: formatZodErrors(parsed.error) });
    }

    const d = parsed.data;

    // 사이트 테넌트 격리 검증
    const site = await prisma.site.findFirst({
      where: { id: d.siteId, tenantId: auth.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!site) return errorResponse('RESOURCE_NOT_FOUND');

    // 시리얼 중복 확인
    const existing = await prisma.gateway.findUnique({
      where: { serialNumber: d.serialNumber },
      select: { id: true },
    });
    if (existing) return errorResponse('RESOURCE_ALREADY_EXISTS');

    // 게이트웨이 코드 자동 채번: GW-YYYYMMDD-NNNN
    const code = await generateSeqNo('GATEWAY_MGMT');

    const gateway = await (prisma as any).gateway.create({
      data: {
        tenantId: auth.tenantId,
        siteId: d.siteId,
        serialNumber: d.serialNumber,
        code,
        name: d.name ?? null,
        model: d.model ?? null,
        firmwareVersion: d.firmwareVersion ?? null,
        ipAddress: d.ipAddress ?? null,
        macAddress: d.macAddress ?? null,
        vpnAddress: d.vpnAddress ?? null,
        primaryConnection: d.primaryConnection as never,
        fallbackConnection: d.fallbackConnection as never,
        bufferSizeMb: d.bufferSizeMb,
        ownership: d.ownership as never,
        installationDate: d.installationDate ? new Date(d.installationDate) : null,
        config: d.config ? (d.config as Prisma.InputJsonValue) : undefined,
        status: 'offline',
      },
      include: {
        site: { select: { id: true, name: true, city: true } },
      },
    });

    return successResponse({ gateway }, { status: 201 });
  } catch (error) {
    console.error('[API] 게이트웨이 등록 오류:', error);
    return serverErrorResponse();
  }
}
