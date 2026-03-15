/**
 * /api/admin/users/[id]/site-access
 *
 * GET  → 사용자의 사이트 접근 목록 조회
 * POST → 사이트 접근 권한 부여 { siteId }
 * DELETE → 사이트 접근 권한 회수 { siteId }
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, requireRoleOrHigher } from '@/lib/auth/verify';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!requireRoleOrHigher(auth, 'tenant_admin' as UserRole))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id: userId } = await params;

    const rows = await (prisma as any).userSiteAccess.findMany({
      where: { userId, tenantId: auth.tenantId, revokedAt: null },
      include: { site: { select: { id: true, name: true, code: true, siteType: true } } },
      orderBy: { grantedAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: rows });
  } catch (e) {
    console.error('[site-access GET]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!requireRoleOrHigher(auth, 'tenant_admin' as UserRole))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id: userId } = await params;
    const { siteId } = await request.json();
    if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

    // 같은 테넌트 사이트인지 확인
    const site = await prisma.site.findFirst({
      where: { id: siteId, tenantId: auth.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    // upsert: 이미 있으면 revokedAt 초기화
    const existing = await (prisma as any).userSiteAccess.findFirst({
      where: { userId, siteId },
      select: { id: true },
    });

    let row;
    if (existing) {
      row = await (prisma as any).userSiteAccess.update({
        where: { id: existing.id },
        data: { revokedAt: null },
      });
    } else {
      row = await (prisma as any).userSiteAccess.create({
        data: { userId, tenantId: auth.tenantId, siteId },
      });
    }

    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (e) {
    console.error('[site-access POST]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!requireRoleOrHigher(auth, 'tenant_admin' as UserRole))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id: userId } = await params;
    const { siteId } = await request.json();
    if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });

    await (prisma as any).userSiteAccess.updateMany({
      where: { userId, siteId, tenantId: auth.tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[site-access DELETE]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
