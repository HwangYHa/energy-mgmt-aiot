/**
 * lib/auth/verify.ts - 인증 및 테넌트 검증
 *
 * 모든 API 라우트에서 사용:
 * const auth = await verifyAuth(request);
 * if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 */

import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/db/prisma';
import { TenantContext } from '@/lib/context/tenant-context';
import env from '@/lib/env';
import { UserRole, hasRoleOrHigher, hasAnyRole } from '@/lib/constants/roles';
import { Permission, hasPermission, hasAnyPermission, hasAllPermissions } from '@/lib/constants/permissions';

const secret = new TextEncoder().encode(env.JWT_SECRET);

/**
 * 요청에서 JWT 토큰 추출
 */
function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * JWT 토큰 검증 및 사용자 정보 조회
 * 
 * ⭐ CRITICAL: 3중 검증
 * 1. JWT 서명 검증
 * 2. DB에서 사용자 존재 확인
 * 3. JWT 클레임 vs DB 테넌트 ID 비교
 */
export async function verifyAuth(
  request: NextRequest
): Promise<TenantContext | null> {
  try {
    // 1. 토큰 추출
    const token = extractToken(request);
    if (!token) {
      return null;
    }

    // 2. JWT 서명 검증
    let payload;
    try {
      const verified = await jwtVerify(token, secret);
      payload = verified.payload;
    } catch (error) {
      console.error('JWT verification failed:', error);
      return null;
    }

    const userId = payload.sub as string;
    const claimedTenantId = payload.tenantId as string;
    const claimedRole = payload.role as string;

    if (!userId || !claimedTenantId) {
      return null;
    }

    // 3. DB에서 사용자 조회 (⭐ 검증 포인트)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        tenantId: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      // 보안 이벤트: 사용자 없음 또는 비활성
      console.warn(`AUTH_FAILED: User not found or inactive. userId=${userId}`);
      return null;
    }

    // 4. JWT 클레임의 tenantId와 DB의 tenantId 비교 (⭐ CRITICAL 검증)
    if (claimedTenantId !== user.tenantId) {
      // 보안 이벤트: 토큰 조작 의심
      console.error(
        `SECURITY_TOKEN_TAMPERING: Tenant mismatch. claimed=${claimedTenantId}, actual=${user.tenantId}, userId=${userId}`
      );

      // 감사 로그 기록
      await prisma.auditLog.create({
        data: {
          tenantId: user.tenantId, // 실제 테넌트
          userId,
          action: 'SECURITY_TOKEN_TAMPERING_DETECTED',
          resourceType: 'USER',
          resourceId: userId,
          result: 'failure',
          errorMessage: `Token tampering: claimed tenant ${claimedTenantId} != actual tenant ${user.tenantId}`,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        },
      }).catch((err) => console.error('Failed to log audit event:', err));

      return null;
    }

    // 5. 역할 검증 (토큰의 역할과 DB의 역할 일치)
    if (claimedRole !== user.role) {
      console.warn(
        `ROLE_MISMATCH: claimed=${claimedRole}, actual=${user.role}, userId=${userId}`
      );
      return null;
    }

    // ✅ 모든 검증 통과
    return {
      tenantId: user.tenantId,
      userId: user.id,
      role: user.role as any,
      email: user.email,
    };
  } catch (error) {
    console.error('Auth verification error:', error);
    return null;
  }
}

/**
 * 특정 역할 요구 검증 (기존 방식 - 하위 호환성 유지)
 *
 * @deprecated 새로운 코드에서는 requireRoleOrHigher 또는 requireAnyRole 사용 권장
 */
export function requireRole(
  context: TenantContext | null,
  requiredRoles: string[]
): boolean {
  if (!context) return false;
  return requiredRoles.includes(context.role);
}

/**
 * 특정 역할 또는 그 이상의 권한 요구
 *
 * @example
 * // site_manager 이상 권한 필요 (site_manager, tenant_admin, super_admin 허용)
 * if (!requireRoleOrHigher(auth, UserRole.SITE_MANAGER)) {
 *   return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
 * }
 */
export function requireRoleOrHigher(
  context: TenantContext | null,
  minimumRole: UserRole
): boolean {
  if (!context) return false;
  return hasRoleOrHigher(context.role, minimumRole);
}

/**
 * 여러 역할 중 하나라도 만족하는지 검증
 *
 * @example
 * // site_manager 또는 operator 필요
 * if (!requireAnyRole(auth, [UserRole.SITE_MANAGER, UserRole.OPERATOR])) {
 *   return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
 * }
 */
export function requireAnyRole(
  context: TenantContext | null,
  allowedRoles: UserRole[]
): boolean {
  if (!context) return false;
  return hasAnyRole(context.role, allowedRoles);
}

/**
 * 세밀한 권한 검증 (Permission 기반)
 *
 * @example
 * // 사이트 생성 권한 필요
 * if (!requirePermission(auth, Permissions.SITE_CREATE)) {
 *   return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
 * }
 */
export function requirePermission(
  context: TenantContext | null,
  permission: Permission
): boolean {
  if (!context) return false;
  return hasPermission(context.role as UserRole, permission);
}

/**
 * 여러 권한 중 하나라도 가지는지 검증
 */
export function requireAnyPermission(
  context: TenantContext | null,
  permissions: Permission[]
): boolean {
  if (!context) return false;
  return hasAnyPermission(context.role as UserRole, permissions);
}

/**
 * 모든 권한을 가지는지 검증
 */
export function requireAllPermissions(
  context: TenantContext | null,
  permissions: Permission[]
): boolean {
  if (!context) return false;
  return hasAllPermissions(context.role as UserRole, permissions);
}

/**
 * 두 테넌트 ID가 같은지 검증 (Multi-tenancy 격리)
 *
 * @example
 * const site = await prisma.site.findUnique({ where: { id: siteId } });
 * if (!validateTenantMatch(auth.tenantId, site.tenantId)) {
 *   return NextResponse.json({ error: 'Access denied' }, { status: 403 });
 * }
 */
export function validateTenantMatch(
  contextTenantId: string,
  resourceTenantId: string
): boolean {
  if (contextTenantId !== resourceTenantId) {
    console.warn(
      `TENANT_MISMATCH: context=${contextTenantId}, resource=${resourceTenantId}`
    );
    return false;
  }
  return true;
}

/**
 * super_admin 권한 확인
 */
export function isSuperAdmin(context: TenantContext | null): boolean {
  return context?.role === 'super_admin';
}

/**
 * tenant_admin 이상 권한 확인
 */
export function isTenantAdmin(context: TenantContext | null): boolean {
  if (!context) return false;
  return requireRoleOrHigher(context, 'tenant_admin' as UserRole);
}
