/**
 * /api/admin/partners — 설치 파트너 관리
 *
 * GET  — 파트너 목록 조회 (super_admin / tenant_admin)
 * POST — 파트너 등록 (super_admin)
 * PUT  — 파트너-클라이언트 매핑 설정 (super_admin)
 *
 * 파트너 구조:
 *   Tenant.settings.isPartner = true 인 테넌트가 파트너
 *   Tenant.settings.partnerId = '{partnerId}' 인 테넌트가 해당 파트너의 클라이언트
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
  validationErrorResponse,
} from '@/lib/api/response';
import { UserRole } from '@/lib/constants/roles';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────────────────────
// GET — 파트너 목록
// ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'tenant_admin' as UserRole)) return forbiddenResponse();

    const isSuperAdmin = auth.role === 'super_admin';
    const { searchParams } = new URL(request.url);
    const includeClients = searchParams.get('includeClients') === 'true';

    // super_admin: 모든 파트너, 그 외: 자기 테넌트가 파트너인지만 확인
    const partnerTenants = await prisma.tenant.findMany({
      where: {
        status: 'active',
        ...(isSuperAdmin ? {} : { id: auth.tenantId }),
      },
      select: {
        id: true,
        name: true,
        industryType: true,
        settings: true,
        status: true,
        createdAt: true,
        users: {
          where: { role: 'tenant_admin' },
          select: { name: true, email: true },
          take: 1,
        },
        sites: { select: { id: true }, take: 1 },
        gateways: { select: { id: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // settings.isPartner = true 필터
    const partners = partnerTenants.filter((t) => {
      const s = (t.settings as Record<string, unknown> | null) ?? {};
      return s.isPartner === true;
    });

    // 클라이언트 목록 포함 옵션
    let clientsByPartner: Record<string, unknown[]> = {};
    if (includeClients && isSuperAdmin) {
      const allTenants = await prisma.tenant.findMany({
        where: { status: 'active' },
        select: {
          id: true,
          name: true,
          industryType: true,
          settings: true,
          createdAt: true,
          users: { where: { role: 'tenant_admin' }, select: { name: true, email: true }, take: 1 },
          gateways: { select: { id: true } },
        },
      });

      const partnerIds = new Set(partners.map((p) => p.id));
      clientsByPartner = {};
      for (const t of allTenants) {
        const s = (t.settings as Record<string, unknown> | null) ?? {};
        const pid = s.partnerId as string | undefined;
        if (pid && partnerIds.has(pid)) {
          if (!clientsByPartner[pid]) clientsByPartner[pid] = [];
          clientsByPartner[pid].push({
            id: t.id,
            name: t.name,
            industryType: t.industryType,
            adminEmail: t.users[0]?.email,
            gatewayCount: t.gateways.length,
            joinedAt: t.createdAt,
          });
        }
      }
    }

    const result = partners.map((p) => ({
      id: p.id,
      name: p.name,
      industryType: p.industryType,
      status: p.status,
      adminName: p.users[0]?.name,
      adminEmail: p.users[0]?.email,
      siteCount: p.sites.length,
      gatewayCount: p.gateways.length,
      joinedAt: p.createdAt,
      isPartner: true,
      clients: clientsByPartner[p.id] ?? [],
    }));

    return successResponse({ partners: result, total: result.length });
  } catch (error) {
    console.error('[Partners] GET 오류:', error);
    return serverErrorResponse();
  }
}

// ──────────────────────────────────────────────────────────────
// POST — 파트너 등록 (기존 테넌트를 파트너로 승격)
// ──────────────────────────────────────────────────────────────

const RegisterSchema = z.object({
  tenantId:    z.string().uuid('유효한 테넌트 ID 필요'),
  partnerCode: z.string().min(2).max(20).optional(),
  notes:       z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'super_admin' as UserRole)) return forbiddenResponse();

    const body = await request.json();
    const parse = RegisterSchema.safeParse(body);
    if (!parse.success) {
      return validationErrorResponse(parse.error.flatten().fieldErrors as Record<string, string>);
    }

    const { tenantId, partnerCode, notes } = parse.data;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, settings: true },
    });
    if (!tenant) {
      return NextResponse.json({ success: false, error: '테넌트 없음' }, { status: 404 });
    }

    const currentSettings = (tenant.settings as Record<string, unknown> | null) ?? {};
    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          ...currentSettings,
          isPartner: true,
          partnerCode: partnerCode ?? `P-${tenantId.slice(0, 6).toUpperCase()}`,
          partnerNotes: notes,
          partnerRegisteredAt: new Date().toISOString(),
        },
      },
      select: { id: true, name: true, settings: true },
    });

    return successResponse({ partner: updated }, { status: 201 as 201 });
  } catch (error) {
    console.error('[Partners] POST 오류:', error);
    return serverErrorResponse();
  }
}

// ──────────────────────────────────────────────────────────────
// PUT — 파트너-클라이언트 연결
// ──────────────────────────────────────────────────────────────

const AssignSchema = z.object({
  clientTenantId: z.string().uuid(),
  partnerId:      z.string().uuid().nullable(),
});

export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!requireRoleOrHigher(auth, 'super_admin' as UserRole)) return forbiddenResponse();

    const body = await request.json();
    const parse = AssignSchema.safeParse(body);
    if (!parse.success) {
      return validationErrorResponse(parse.error.flatten().fieldErrors as Record<string, string>);
    }

    const { clientTenantId, partnerId } = parse.data;

    const client = await prisma.tenant.findUnique({
      where: { id: clientTenantId },
      select: { settings: true },
    });
    if (!client) {
      return NextResponse.json({ success: false, error: '클라이언트 테넌트 없음' }, { status: 404 });
    }

    const current = (client.settings as Record<string, unknown> | null) ?? {};
    const updated = await prisma.tenant.update({
      where: { id: clientTenantId },
      data: {
        settings: {
          ...current,
          partnerId: partnerId ?? null,
          partnerAssignedAt: partnerId ? new Date().toISOString() : null,
        },
      },
      select: { id: true, name: true, settings: true },
    });

    return successResponse({ client: updated });
  } catch (error) {
    console.error('[Partners] PUT 오류:', error);
    return serverErrorResponse();
  }
}
