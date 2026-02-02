/**
 * lib/constants/roles.ts
 *
 * 사용자 역할(Role) 정의 및 권한 계층 구조
 * Prisma enum과 동기화 필요
 */

/**
 * 사용자 역할 (Prisma UserRole enum과 동일)
 */
export enum UserRole {
  /** 시스템 관리자 (최고 권한) */
  SUPER_ADMIN = 'super_admin',

  /** 테넌트 관리자 (테넌트 내 모든 권한) */
  TENANT_ADMIN = 'tenant_admin',

  /** 사이트 관리자 (사이트 생성/관리) */
  SITE_MANAGER = 'site_manager',

  /** 운영자 (디바이스 제어 및 모니터링) */
  OPERATOR = 'operator',

  /** 조회 전용 사용자 */
  VIEWER = 'viewer',
}

/**
 * 역할 계층 구조 (숫자가 클수록 높은 권한)
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 100,
  [UserRole.TENANT_ADMIN]: 80,
  [UserRole.SITE_MANAGER]: 60,
  [UserRole.OPERATOR]: 40,
  [UserRole.VIEWER]: 20,
};

/**
 * 역할 레이블 (한글)
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: '시스템 관리자',
  [UserRole.TENANT_ADMIN]: '테넌트 관리자',
  [UserRole.SITE_MANAGER]: '사이트 관리자',
  [UserRole.OPERATOR]: '운영자',
  [UserRole.VIEWER]: '조회 사용자',
};

/**
 * 역할 설명
 */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: '시스템 전체 관리 및 모든 테넌트 접근 권한',
  [UserRole.TENANT_ADMIN]: '테넌트 내 모든 리소스 관리 및 사용자 관리 권한',
  [UserRole.SITE_MANAGER]: '사이트 및 디바이스 관리, 데이터 조회 권한',
  [UserRole.OPERATOR]: '디바이스 제어 및 모니터링, 데이터 조회 권한',
  [UserRole.VIEWER]: '데이터 조회 전용 권한 (읽기 전용)',
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
  UserRole.SUPER_ADMIN,
  UserRole.TENANT_ADMIN,
  UserRole.SITE_MANAGER,
  UserRole.OPERATOR,
  UserRole.VIEWER,
] as const;

/**
 * 테넌트 내부에서 할당 가능한 역할 (super_admin 제외)
 */
export const TENANT_ASSIGNABLE_ROLES = [
  UserRole.TENANT_ADMIN,
  UserRole.SITE_MANAGER,
  UserRole.OPERATOR,
  UserRole.VIEWER,
] as const;

/**
 * 기본 역할 (신규 가입 사용자)
 */
export const DEFAULT_ROLE = UserRole.VIEWER;
