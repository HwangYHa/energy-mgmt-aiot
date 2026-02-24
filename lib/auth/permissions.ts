/**
 * lib/auth/permissions.ts — RBAC 권한 매트릭스
 *
 * 역할 계층:
 *   viewer < operator < site_manager < tenant_admin < super_admin
 *
 * 사용법:
 *   hasPermission(auth.role, 'sites:create')   // boolean
 *   requirePermission(auth.role, 'ai:use')     // NextResponse | null
 *   hasMinRole(auth.role, 'site_manager')      // boolean
 *
 * 원칙:
 *   - UI는 보조, 서버에서 반드시 재검증
 *   - 모든 API 라우트는 이 모듈을 통해 권한 체크
 */

import { NextResponse } from 'next/server';

// ──────────────────────────────────────────────────────────────
// 역할 계층 (숫자가 높을수록 상위)
// ──────────────────────────────────────────────────────────────

export const ROLE_HIERARCHY: Record<string, number> = {
  viewer:       0,
  operator:     1,
  site_manager: 2,
  tenant_admin: 3,
  super_admin:  4,
} as const;

export type UserRole = keyof typeof ROLE_HIERARCHY;

// ──────────────────────────────────────────────────────────────
// 퍼미션 매트릭스
// key: 'resource:action'
// value: 최소 역할 (이 역할 이상이면 허용)
// ──────────────────────────────────────────────────────────────

export const PERMISSION_MIN_ROLE: Record<string, UserRole> = {
  // ── 대시보드 ──────────────────────────────────────────────
  'dashboard:view':                 'viewer',
  'dashboard:realtime':             'viewer',

  // ── 모니터링 ──────────────────────────────────────────────
  'monitoring:view':                'viewer',
  'monitoring:export':              'operator',

  // ── 설비 제어 ─────────────────────────────────────────────
  'control:view':                   'operator',
  'control:execute':                'operator',
  'control:ai_optimize':            'site_manager',
  'control:schedule':               'site_manager',

  // ── 분석 ──────────────────────────────────────────────────
  'analytics:view':                 'viewer',
  'analytics:cost':                 'viewer',
  'analytics:carbon':               'viewer',
  'analytics:carbon_trading':       'viewer',
  'analytics:simulator':            'viewer',
  'analytics:templates':            'viewer',
  'analytics:raw_data':             'site_manager',
  'analytics:download':             'operator',
  'analytics:compliance_report':    'site_manager',

  // ── AI 기능 ───────────────────────────────────────────────
  'ai:anomaly':                     'viewer',
  'ai:forecast':                    'viewer',
  'ai:optimize':                    'site_manager',

  // ── 알림 ──────────────────────────────────────────────────
  'alerts:view':                    'operator',
  'alerts:rules:view':              'operator',
  'alerts:rules:create':            'operator',
  'alerts:rules:delete':            'site_manager',

  // ── 디지털 트윈 ───────────────────────────────────────────
  'digital_twin:view':              'viewer',
  'digital_twin:edit':              'site_manager',

  // ── 보고서 ────────────────────────────────────────────────
  'reports:view':                   'viewer',
  'reports:create':                 'operator',
  'reports:delete':                 'site_manager',

  // ── 사업장(Site) ──────────────────────────────────────────
  'sites:view':                     'viewer',
  'sites:create':                   'tenant_admin',
  'sites:update':                   'site_manager',
  'sites:delete':                   'tenant_admin',

  // ── 장치(Device/Sensor) ───────────────────────────────────
  'devices:view':                   'viewer',
  'devices:create':                 'site_manager',
  'devices:update':                 'site_manager',
  'devices:delete':                 'tenant_admin',

  // ── 게이트웨이 ────────────────────────────────────────────
  'gateways:view':                  'site_manager',
  'gateways:create':                'site_manager',
  'gateways:update':                'site_manager',
  'gateways:delete':                'tenant_admin',

  // ── 사용자 관리 ───────────────────────────────────────────
  'users:view':                     'tenant_admin',
  'users:create':                   'tenant_admin',
  'users:update':                   'tenant_admin',
  'users:delete':                   'tenant_admin',
  'users:role_assign':              'tenant_admin',

  // ── API 키 ────────────────────────────────────────────────
  'api_keys:view':                  'tenant_admin',
  'api_keys:create':                'tenant_admin',
  'api_keys:delete':                'tenant_admin',

  // ── 구독/결제 ─────────────────────────────────────────────
  'subscription:view':              'tenant_admin',
  'subscription:upgrade':           'tenant_admin',
  'subscription:cancel':            'tenant_admin',

  // ── 테넌트 설정 ───────────────────────────────────────────
  'settings:view':                  'tenant_admin',
  'settings:update':                'tenant_admin',
  'settings:system':                'tenant_admin',

  // ── Super Admin 전용 ─────────────────────────────────────
  'admin:tenants':                  'super_admin',
  'admin:plans':                    'super_admin',
  'admin:traffic':                  'super_admin',
  'admin:partners':                 'super_admin',
  'admin:menu':                     'super_admin',
  'admin:support':                  'super_admin',
  'admin:cache':                    'super_admin',

  // ── 감사 로그 ─────────────────────────────────────────────
  'audit:view':                     'tenant_admin',
  'audit:export':                   'super_admin',
};

// ──────────────────────────────────────────────────────────────
// 헬퍼 함수
// ──────────────────────────────────────────────────────────────

/**
 * 최소 역할 이상인지 확인.
 */
export function hasMinRole(userRole: string, minRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] ?? -1) >= (ROLE_HIERARCHY[minRole] ?? 999);
}

/**
 * 특정 퍼미션이 있는지 확인.
 */
export function hasPermission(userRole: string, permission: string): boolean {
  const minRole = PERMISSION_MIN_ROLE[permission];
  if (!minRole) {
    console.warn('[RBAC] 정의되지 않은 퍼미션:', permission);
    return false;
  }
  return hasMinRole(userRole, minRole);
}

/**
 * Super Admin 여부.
 */
export function isSuperAdmin(userRole: string): boolean {
  return userRole === 'super_admin';
}

// ──────────────────────────────────────────────────────────────
// API 가드 (NextResponse 반환)
// ──────────────────────────────────────────────────────────────

/**
 * 최소 역할 미달 시 403 반환.
 *
 * ```ts
 * const err = requireMinRole(auth.role, 'tenant_admin');
 * if (err) return err;
 * ```
 */
export function requireMinRole(
  userRole: string,
  minRole: string
): NextResponse | null {
  if (!hasMinRole(userRole, minRole)) {
    return NextResponse.json(
      {
        success: false,
        code: 'PERMISSION_DENIED',
        error: `이 작업은 ${minRole} 이상의 역할이 필요합니다.`,
      },
      { status: 403 }
    );
  }
  return null;
}

/**
 * 퍼미션 없으면 403 반환.
 *
 * ```ts
 * const err = requirePermission(auth.role, 'sites:create');
 * if (err) return err;
 * ```
 */
export function requirePermission(
  userRole: string,
  permission: string
): NextResponse | null {
  if (!hasPermission(userRole, permission)) {
    return NextResponse.json(
      {
        success: false,
        code: 'PERMISSION_DENIED',
        error: '이 작업을 수행할 권한이 없습니다.',
        required: PERMISSION_MIN_ROLE[permission],
        current: userRole,
      },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Super Admin만 허용.
 */
export function requireSuperAdmin(userRole: string): NextResponse | null {
  return requireMinRole(userRole, 'super_admin');
}

// ──────────────────────────────────────────────────────────────
// 테넌트 격리 + 역할 체크 통합 가드
// ──────────────────────────────────────────────────────────────

interface AuthContext {
  tenantId: string;
  role: string;
  userId?: string;
}

/**
 * 요청자의 tenantId가 대상 리소스 tenantId와 일치하는지 확인.
 * Super Admin은 모든 테넌트 접근 허용.
 *
 * ```ts
 * const err = requireTenantAccess(auth, resourceTenantId);
 * if (err) return err;
 * ```
 */
export function requireTenantAccess(
  auth: AuthContext,
  resourceTenantId: string
): NextResponse | null {
  // Super Admin은 모든 테넌트 접근 가능
  if (isSuperAdmin(auth.role)) return null;

  if (auth.tenantId !== resourceTenantId) {
    console.warn('[RBAC] 테넌트 격리 위반 시도:', {
      requestorTenantId: auth.tenantId,
      resourceTenantId,
      userId: auth.userId,
    });
    return NextResponse.json(
      {
        success: false,
        code: 'TENANT_ACCESS_DENIED',
        error: '접근 권한이 없는 리소스입니다.',
      },
      { status: 403 }
    );
  }
  return null;
}

/**
 * 테넌트 접근 + 퍼미션 복합 체크.
 *
 * ```ts
 * const err = requireTenantPermission(auth, resourceTenantId, 'sites:delete');
 * if (err) return err;
 * ```
 */
export function requireTenantPermission(
  auth: AuthContext,
  resourceTenantId: string,
  permission: string
): NextResponse | null {
  const tenantErr = requireTenantAccess(auth, resourceTenantId);
  if (tenantErr) return tenantErr;

  return requirePermission(auth.role, permission);
}
