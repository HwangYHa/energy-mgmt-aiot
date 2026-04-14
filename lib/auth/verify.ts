/**
 * lib/auth/verify.ts - 인증 및 테넌트 검증
 *
 * 모든 API 라우트에서 사용:
 * const auth = await verifyAuth(request);
 * if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *
 * 지원 인증 방식:
 * 1. Bearer ea_live_* API 키 (외부 통합, operator 권한 고정)
 * 2. Bearer JWT 토큰 (Naver OAuth, API 호출)
 * 3. auth-token 쿠키 (Naver OAuth)
 * 4. NextAuth 세션 (Google OAuth) - 쿠키 기반
 */

import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { getToken } from 'next-auth/jwt';
import { createHash } from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { TenantContext } from '@/lib/context/tenant-context';
import env from '@/lib/env';
import { UserRole, hasRoleOrHigher, hasAnyRole } from '@/lib/constants/roles';
import { Permission, hasPermission, hasAnyPermission, hasAllPermissions } from '@/lib/constants/permissions';

const secret = new TextEncoder().encode(env.JWT_SECRET);

/**
 * 요청에서 JWT 토큰 추출 (Authorization 헤더)
 */
function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * 요청에서 auth-token 쿠키 추출 (Naver OAuth)
 */
function extractCookieToken(request: NextRequest): string | null {
  return request.cookies.get('auth-token')?.value || null;
}

/**
 * NextAuth 세션에서 인증 정보 추출
 */
async function verifyNextAuthSession(request: NextRequest): Promise<TenantContext | null> {
  try {
    // HTTPS 여부에 따라 쿠키 이름 결정 (middleware.ts, session.ts와 반드시 동기화)
    // NODE_ENV가 아닌 NEXTAUTH_URL로 판단 — HTTP 운영 환경 대응
    const isHttps = process.env.NEXTAUTH_URL?.startsWith('https://') ?? false;
    const cookieName = isHttps
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token';

    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET || env.NEXTAUTH_SECRET,
      cookieName,
    });

    if (!token) {
      return null;
    }

    // NextAuth 세션에서 사용자 정보 추출
    const userId = token.id as string || token.sub as string;
    const tenantId = token.tenantId as string;

    if (!userId || !tenantId) {
      console.warn('[Auth] NextAuth 세션에 필수 정보 누락:', { userId, tenantId });
      return null;
    }

    // DB에서 사용자 확인 (활성 상태)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        tenantId: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      console.warn(`[Auth] 사용자 없음 또는 비활성: userId=${userId}`);
      return null;
    }

    // 테넌트 ID 검증
    if (tenantId !== user.tenantId) {
      console.error(`[보안] 세션 테넌트 불일치: session=${tenantId}, db=${user.tenantId}`);
      return null;
    }

    return {
      tenantId: user.tenantId,
      userId: user.id,
      role: user.role as UserRole,
      email: user.email,
    };
  } catch (error) {
    console.error('[Auth] NextAuth 세션 검증 오류:', error);
    return null;
  }
}

/**
 * JWT 토큰 검증 (Bearer 또는 쿠키)
 */
async function verifyJwtToken(token: string, request: NextRequest): Promise<TenantContext | null> {
  try {
    // JWT 서명 검증
    let payload;
    try {
      const verified = await jwtVerify(token, secret);
      payload = verified.payload;
    } catch (error) {
      console.error('[Auth] JWT 서명 검증 실패:', error);
      return null;
    }

    const userId = payload.sub as string;
    const claimedTenantId = payload.tenantId as string;
    const claimedRole = payload.role as string;

    if (!userId || !claimedTenantId) {
      return null;
    }

    // DB에서 사용자 조회
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
      console.warn(`[Auth] 사용자 없음 또는 비활성: userId=${userId}`);
      return null;
    }

    // 테넌트 ID 검증 (⭐ CRITICAL)
    if (claimedTenantId !== user.tenantId) {
      console.error(
        `[보안] 토큰 조작 의심: claimed=${claimedTenantId}, actual=${user.tenantId}`
      );

      // 감사 로그 기록
      await prisma.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId,
          action: 'SECURITY_TOKEN_TAMPERING_DETECTED',
          resourceType: 'USER',
          resourceId: userId,
          result: 'failure',
          errorMessage: `Token tampering: claimed tenant ${claimedTenantId} != actual tenant ${user.tenantId}`,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        },
      }).catch((err) => console.error('[Auth] 감사 로그 기록 실패:', err));

      return null;
    }

    // 역할 검증
    if (claimedRole !== user.role) {
      console.warn(`[Auth] 역할 불일치: claimed=${claimedRole}, actual=${user.role}`);
      return null;
    }

    return {
      tenantId: user.tenantId,
      userId: user.id,
      role: user.role as UserRole,
      email: user.email,
    };
  } catch (error) {
    console.error('[Auth] JWT 토큰 검증 오류:', error);
    return null;
  }
}

/**
 * ea_live_ API 키 검증 (외부 API 통합용)
 *
 * Authorization: Bearer ea_live_XXXX 헤더로 전달된 키를 SHA-256 해시 후
 * DB에서 조회하여 인증 컨텍스트 반환. lastUsedAt 비동기 갱신.
 */
async function verifyApiKey(token: string): Promise<TenantContext | null> {
  try {
    const keyHash = createHash('sha256').update(token).digest('hex');

    const apiKey = await prisma.apiKey.findFirst({
      where: {
        keyHash,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: {
        id: true,
        tenantId: true,
        userId: true,
      },
    });

    if (!apiKey) return null;

    // 사용자 이메일 조회 (TenantContext.email 필수)
    const user = await prisma.user.findUnique({
      where: { id: apiKey.userId },
      select: { email: true, isActive: true },
    });

    if (!user || !user.isActive) return null;

    // lastUsedAt 비동기 갱신 (응답 지연 없이)
    prisma.apiKey
      .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});

    return {
      tenantId: apiKey.tenantId,
      userId: apiKey.userId,
      role: 'operator' as UserRole, // API 키는 operator 권한으로 고정
      email: user.email,
    };
  } catch (error) {
    console.error('[Auth] API 키 검증 오류:', error);
    return null;
  }
}

/**
 * 통합 인증 검증 함수
 *
 * 우선순위:
 * 1. Authorization: Bearer ea_live_* (외부 API 키)
 * 2. Authorization: Bearer JWT 토큰 (Naver OAuth, API 호출)
 * 3. auth-token 쿠키 (Naver OAuth)
 * 4. NextAuth 세션 (Google OAuth)
 *
 * ⭐ 3중 검증:
 * 1. 토큰/세션 서명 검증
 * 2. DB에서 사용자 존재 및 활성 상태 확인
 * 3. 토큰 클레임과 DB 테넌트 ID 비교
 */
export async function verifyAuth(
  request: NextRequest
): Promise<TenantContext | null> {
  try {
    // 1. Authorization: Bearer 토큰 확인
    const bearerToken = extractBearerToken(request);
    if (bearerToken) {
      // 1-a. ea_live_ 접두사 → API 키 검증
      if (bearerToken.startsWith('ea_live_')) {
        const result = await verifyApiKey(bearerToken);
        if (result) return result;
        return null; // API 키로 시도했지만 실패 → JWT 시도 안 함
      }
      // 1-b. 일반 JWT 검증
      const result = await verifyJwtToken(bearerToken, request);
      if (result) return result;
    }

    // 2. auth-token 쿠키 확인 (Naver OAuth)
    const cookieToken = extractCookieToken(request);
    if (cookieToken) {
      const result = await verifyJwtToken(cookieToken, request);
      if (result) return result;
    }

    // 3. NextAuth 세션 확인 (Google OAuth)
    const sessionResult = await verifyNextAuthSession(request);
    if (sessionResult) return sessionResult;

    // 모든 인증 방식 실패
    return null;
  } catch (error) {
    console.error('[Auth] 인증 검증 오류:', error);
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
