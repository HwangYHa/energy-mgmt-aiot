/**
 * lib/constants/roles.ts
 *
 * 사용자 역할(Role) 정의 및 권한 계층 구조
 * Prisma enum 사용
 */

import { UserRole } from '@prisma/client';

// Re-export Prisma UserRole
export { UserRole };

/**
 * 역할 계층 구조 (숫자가 클수록 높은 권한)
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  ['super_admin']: 100,
  ['tenant_admin']: 80,
  ['site_manager']: 60,
  ['operator']: 40,
  ['viewer']: 20,
};

/**
 * 역할 레이블 (한글)
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  ['super_admin']: '시스템 관리자',
  ['tenant_admin']: '테넌트 관리자',
  ['site_manager']: '사이트 관리자',
  ['operator']: '운영자',
  ['viewer']: '조회 사용자',
};

/**
 * 역할 설명
 */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  ['super_admin']: '시스템 전체 관리 및 모든 테넌트 접근 권한',
  ['tenant_admin']: '테넌트 내 모든 리소스 관리 및 사용자 관리 권한',
  ['site_manager']: '사이트 및 디바이스 관리, 데이터 조회 권한',
  ['operator']: '디바이스 제어 및 모니터링, 데이터 조회 권한',
  ['viewer']: '데이터 조회 전용 권한 (읽기 전용)',
};

/**
 * 특정 역할이 다른 역할보다 높은 권한을 가지는지 확인
 *
 * @param userRole - 확인할 사용자 역할
 * @param requiredRole - 요구되는 최소 역할
 * @returns 권한이 충분하면 true
 *
 * @example
 * hasRoleOrHigher(UserRole.TENANT_ADMIN, UserRole.OPERATOR) // true
 * hasRoleOrHigher(UserRole.VIEWER, UserRole.OPERATOR) // false
 */
export function hasRoleOrHigher(
  userRole: UserRole | string,
  requiredRole: UserRole
): boolean {
  const userLevel = ROLE_HIERARCHY[userRole as UserRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole];
  return userLevel >= requiredLevel;
}

/**
 * 역할 배열 중 하나라도 만족하는지 확인
 *
 * @param userRole - 확인할 사용자 역할
 * @param allowedRoles - 허용된 역할 목록
 * @returns 허용된 역할 중 하나라도 만족하면 true
 *
 * @example
 * hasAnyRole(UserRole.SITE_MANAGER, [UserRole.SITE_MANAGER, UserRole.TENANT_ADMIN]) // true
 */
export function hasAnyRole(
  userRole: UserRole | string,
  allowedRoles: UserRole[]
): boolean {
  return allowedRoles.some(role =>
    hasRoleOrHigher(userRole as UserRole, role) || userRole === role
  );
}

/**
 * 역할 유효성 검증
 */
export function isValidRole(role: string): role is UserRole {
  return Object.values(UserRole).includes(role as UserRole);
}

/**
 * 문자열을 UserRole로 안전하게 변환
 */
export function parseRole(role: string): UserRole | null {
  return isValidRole(role) ? (role as UserRole) : null;
}

/**
 * 모든 역할 목록 (권한 순으로 정렬)
 */
export const ALL_ROLES = [
  'super_admin' as UserRole,
  'tenant_admin' as UserRole,
  'site_manager' as UserRole,
  'operator' as UserRole,
  'viewer' as UserRole,
] as const;

/**
 * 테넌트 내부에서 할당 가능한 역할 (super_admin 제외)
 */
export const TENANT_ASSIGNABLE_ROLES = [
  'tenant_admin' as UserRole,
  'site_manager' as UserRole,
  'operator' as UserRole,
  'viewer' as UserRole,
] as const;

/**
 * 기본 역할 (신규 가입 사용자)
 */
export const DEFAULT_ROLE = 'viewer' as UserRole;
