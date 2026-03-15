/**
 * lib/auth/site-access.ts - 사용자 사이트 접근 권한 헬퍼
 *
 * tenant_admin / super_admin → 해당 테넌트 전체 사이트 접근 가능
 * site_manager / operator / viewer → UserSiteAccess 테이블에 명시된 사이트만 접근 가능
 */

import { prisma } from '@/lib/db/prisma';

export type AuthContext = {
  userId: string;
  tenantId: string;
  role: string;
};

/**
 * 사용자가 접근 가능한 siteId 목록 반환.
 * tenant_admin 이상은 null 반환(필터 없음 = 전체 허용).
 */
export async function getAllowedSiteIds(auth: AuthContext): Promise<string[] | null> {
  const adminRoles = ['tenant_admin', 'super_admin'];
  if (adminRoles.includes(auth.role)) return null; // 전체 허용

  const rows = await (prisma as any).userSiteAccess.findMany({
    where: {
      userId: auth.userId,
      tenantId: auth.tenantId,
      revokedAt: null,
    },
    select: { siteId: true },
  }) as Array<{ siteId: string }>;

  return rows.map((r) => r.siteId);
}

/**
 * Prisma where 절에 삽입할 siteId 필터 반환.
 * @returns { siteId: { in: [...] } } 또는 {} (필터 없음)
 */
export async function buildSiteFilter(
  auth: AuthContext,
): Promise<{ siteId?: { in: string[] } }> {
  const siteIds = await getAllowedSiteIds(auth);
  if (siteIds === null) return {};
  return { siteId: { in: siteIds } };
}

/**
 * 특정 siteId에 대한 접근 권한 확인.
 */
export async function canAccessSite(auth: AuthContext, siteId: string): Promise<boolean> {
  const adminRoles = ['tenant_admin', 'super_admin'];
  if (adminRoles.includes(auth.role)) return true;

  const row = await (prisma as any).userSiteAccess.findFirst({
    where: {
      userId: auth.userId,
      tenantId: auth.tenantId,
      siteId,
      revokedAt: null,
    },
    select: { id: true },
  });
  return !!row;
}
