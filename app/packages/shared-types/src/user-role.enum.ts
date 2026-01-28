// packages/shared-types/src/user-role.enum.ts

/**
 * 사용자 역할 Enum
 * 
 * 계층 구조: viewer < operator < site_manager < tenant_admin < super_admin
 */
export enum UserRole {
  SUPER_ADMIN = 'super_admin',   // 슈퍼 관리자 (전체 시스템)
  TENANT_ADMIN = 'tenant_admin', // 테넌트 관리자 (회사 전체)
  SITE_MANAGER = 'site_manager', // 사이트 관리자 (특정 사업장)
  OPERATOR = 'operator',         // 운영자 (설비 제어 가능)
  VIEWER = 'viewer',             // 조회 전용
}

/**
 * 역할 계층 레벨
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 5,
  [UserRole.TENANT_ADMIN]: 4,
  [UserRole.SITE_MANAGER]: 3,
  [UserRole.OPERATOR]: 2,
  [UserRole.VIEWER]: 1,
};

/**
 * 역할 비교 함수
 */
export function hasHigherRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * 역할별 기본 권한
 */
export const ROLE_PERMISSIONS = {
  [UserRole.SUPER_ADMIN]: [
    'system:*', // 모든 시스템 권한
  ],
  [UserRole.TENANT_ADMIN]: [
    'tenant:read',
    'tenant:update',
    'user:*',
    'site:*',
    'device:*',
    'gateway:*',
    'control:*',
    'alert:*',
    'report:*',
    'subscription:read',
    'subscription:update',
    'menu:manage',
  ],
  [UserRole.SITE_MANAGER]: [
    'site:read',
    'site:update',
    'device:*',
    'gateway:read',
    'control:*',
    'alert:*',
    'report:read',
    'analytics:advanced',
  ],
  [UserRole.OPERATOR]: [
    'device:read',
    'device:update',
    'control:execute',
    'alert:read',
    'alert:acknowledge',
    'analytics:basic',
  ],
  [UserRole.VIEWER]: [
    'site:read',
    'device:read',
    'measurement:read',
    'alert:read',
    'analytics:view',
  ],
} as const;

/**
 * 특정 권한 보유 여부 확인
 */
export function hasPermission(
  userRole: UserRole,
  permission: string,
): boolean {
  const userPermissions = ROLE_PERMISSIONS[userRole];

  // 와일드카드 체크
  if (userPermissions.includes('system:*')) {
    return true;
  }

  // 정확한 매칭
  if (userPermissions.includes(permission)) {
    return true;
  }

  // 리소스 와일드카드 체크 (예: user:*)
  const [resource] = permission.split(':');
  if (userPermissions.includes(`${resource}:*`)) {
    return true;
  }

  return false;
}

/**
 * 역할 표시명
 */
export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: '슈퍼 관리자',
  [UserRole.TENANT_ADMIN]: '테넌트 관리자',
  [UserRole.SITE_MANAGER]: '사이트 관리자',
  [UserRole.OPERATOR]: '운영자',
  [UserRole.VIEWER]: '조회자',
};

/**
 * 역할별 색상 (UI용)
 */
export const ROLE_COLORS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: 'red',
  [UserRole.TENANT_ADMIN]: 'orange',
  [UserRole.SITE_MANAGER]: 'yellow',
  [UserRole.OPERATOR]: 'blue',
  [UserRole.VIEWER]: 'gray',
};