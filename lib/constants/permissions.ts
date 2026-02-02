/**
 * lib/constants/permissions.ts
 *
 * 세밀한 권한(Permission) 정의 및 역할별 권한 매핑
 * RBAC (Role-Based Access Control) 시스템의 핵심
 */

import { UserRole } from './roles';

/**
 * 리소스 타입
 */
export enum ResourceType {
  /** 테넌트 */
  TENANT = 'tenant',
  /** 사용자 */
  USER = 'user',
  /** 사이트 */
  SITE = 'site',
  /** 디바이스 */
  DEVICE = 'device',
  /** 측정 데이터 */
  MEASUREMENT = 'measurement',
  /** 분석 데이터 */
  ANALYTICS = 'analytics',
  /** 제어 */
  CONTROL = 'control',
  /** 알림/알람 */
  ALERT = 'alert',
  /** 보고서 */
  REPORT = 'report',
  /** 구독 */
  SUBSCRIPTION = 'subscription',
  /** 감사 로그 */
  AUDIT_LOG = 'audit_log',
}

/**
 * 액션 타입 (CRUD + 추가 액션)
 */
export enum Action {
  /** 생성 */
  CREATE = 'create',
  /** 조회 */
  READ = 'read',
  /** 수정 */
  UPDATE = 'update',
  /** 삭제 */
  DELETE = 'delete',
  /** 실행 */
  EXECUTE = 'execute',
  /** 승인 */
  APPROVE = 'approve',
  /** 내보내기 */
  EXPORT = 'export',
  /** 관리 */
  MANAGE = 'manage',
}

/**
 * 권한 문자열 (resource:action 형식)
 */
export type Permission = `${ResourceType}:${Action}`;

/**
 * 권한 정의
 */
export const Permissions = {
  // ==================== 테넌트 권한 ====================
  TENANT_CREATE: 'tenant:create' as Permission,
  TENANT_READ: 'tenant:read' as Permission,
  TENANT_UPDATE: 'tenant:update' as Permission,
  TENANT_DELETE: 'tenant:delete' as Permission,
  TENANT_MANAGE: 'tenant:manage' as Permission,

  // ==================== 사용자 권한 ====================
  USER_CREATE: 'user:create' as Permission,
  USER_READ: 'user:read' as Permission,
  USER_UPDATE: 'user:update' as Permission,
  USER_DELETE: 'user:delete' as Permission,
  USER_MANAGE: 'user:manage' as Permission,

  // ==================== 사이트 권한 ====================
  SITE_CREATE: 'site:create' as Permission,
  SITE_READ: 'site:read' as Permission,
  SITE_UPDATE: 'site:update' as Permission,
  SITE_DELETE: 'site:delete' as Permission,
  SITE_MANAGE: 'site:manage' as Permission,

  // ==================== 디바이스 권한 ====================
  DEVICE_CREATE: 'device:create' as Permission,
  DEVICE_READ: 'device:read' as Permission,
  DEVICE_UPDATE: 'device:update' as Permission,
  DEVICE_DELETE: 'device:delete' as Permission,
  DEVICE_MANAGE: 'device:manage' as Permission,

  // ==================== 측정 데이터 권한 ====================
  MEASUREMENT_CREATE: 'measurement:create' as Permission,
  MEASUREMENT_READ: 'measurement:read' as Permission,
  MEASUREMENT_UPDATE: 'measurement:update' as Permission,
  MEASUREMENT_DELETE: 'measurement:delete' as Permission,

  // ==================== 분석 권한 ====================
  ANALYTICS_READ: 'analytics:read' as Permission,
  ANALYTICS_EXPORT: 'analytics:export' as Permission,

  // ==================== 제어 권한 ====================
  CONTROL_CREATE: 'control:create' as Permission,
  CONTROL_READ: 'control:read' as Permission,
  CONTROL_EXECUTE: 'control:execute' as Permission,
  CONTROL_APPROVE: 'control:approve' as Permission,

  // ==================== 알림 권한 ====================
  ALERT_CREATE: 'alert:create' as Permission,
  ALERT_READ: 'alert:read' as Permission,
  ALERT_UPDATE: 'alert:update' as Permission,
  ALERT_DELETE: 'alert:delete' as Permission,

  // ==================== 보고서 권한 ====================
  REPORT_CREATE: 'report:create' as Permission,
  REPORT_READ: 'report:read' as Permission,
  REPORT_EXPORT: 'report:export' as Permission,

  // ==================== 구독 권한 ====================
  SUBSCRIPTION_CREATE: 'subscription:create' as Permission,
  SUBSCRIPTION_READ: 'subscription:read' as Permission,
  SUBSCRIPTION_UPDATE: 'subscription:update' as Permission,
  SUBSCRIPTION_MANAGE: 'subscription:manage' as Permission,

  // ==================== 감사 로그 권한 ====================
  AUDIT_LOG_READ: 'audit_log:read' as Permission,
} as const;

/**
 * 역할별 권한 매핑
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  /**
   * super_admin: 시스템 전체 관리자 (모든 권한)
   */
  [UserRole.SUPER_ADMIN]: [
    // 테넌트
    Permissions.TENANT_CREATE,
    Permissions.TENANT_READ,
    Permissions.TENANT_UPDATE,
    Permissions.TENANT_DELETE,
    Permissions.TENANT_MANAGE,
    // 사용자
    Permissions.USER_CREATE,
    Permissions.USER_READ,
    Permissions.USER_UPDATE,
    Permissions.USER_DELETE,
    Permissions.USER_MANAGE,
    // 사이트
    Permissions.SITE_CREATE,
    Permissions.SITE_READ,
    Permissions.SITE_UPDATE,
    Permissions.SITE_DELETE,
    Permissions.SITE_MANAGE,
    // 디바이스
    Permissions.DEVICE_CREATE,
    Permissions.DEVICE_READ,
    Permissions.DEVICE_UPDATE,
    Permissions.DEVICE_DELETE,
    Permissions.DEVICE_MANAGE,
    // 측정 데이터
    Permissions.MEASUREMENT_CREATE,
    Permissions.MEASUREMENT_READ,
    Permissions.MEASUREMENT_UPDATE,
    Permissions.MEASUREMENT_DELETE,
    // 분석
    Permissions.ANALYTICS_READ,
    Permissions.ANALYTICS_EXPORT,
    // 제어
    Permissions.CONTROL_CREATE,
    Permissions.CONTROL_READ,
    Permissions.CONTROL_EXECUTE,
    Permissions.CONTROL_APPROVE,
    // 알림
    Permissions.ALERT_CREATE,
    Permissions.ALERT_READ,
    Permissions.ALERT_UPDATE,
    Permissions.ALERT_DELETE,
    // 보고서
    Permissions.REPORT_CREATE,
    Permissions.REPORT_READ,
    Permissions.REPORT_EXPORT,
    // 구독
    Permissions.SUBSCRIPTION_CREATE,
    Permissions.SUBSCRIPTION_READ,
    Permissions.SUBSCRIPTION_UPDATE,
    Permissions.SUBSCRIPTION_MANAGE,
    // 감사 로그
    Permissions.AUDIT_LOG_READ,
  ],

  /**
   * tenant_admin: 테넌트 관리자 (테넌트 내 모든 권한, super_admin 전용 제외)
   */
  [UserRole.TENANT_ADMIN]: [
    // 테넌트 (자기 테넌트만 조회/수정 가능)
    Permissions.TENANT_READ,
    Permissions.TENANT_UPDATE,
    // 사용자
    Permissions.USER_CREATE,
    Permissions.USER_READ,
    Permissions.USER_UPDATE,
    Permissions.USER_DELETE,
    Permissions.USER_MANAGE,
    // 사이트
    Permissions.SITE_CREATE,
    Permissions.SITE_READ,
    Permissions.SITE_UPDATE,
    Permissions.SITE_DELETE,
    Permissions.SITE_MANAGE,
    // 디바이스
    Permissions.DEVICE_CREATE,
    Permissions.DEVICE_READ,
    Permissions.DEVICE_UPDATE,
    Permissions.DEVICE_DELETE,
    Permissions.DEVICE_MANAGE,
    // 측정 데이터
    Permissions.MEASUREMENT_CREATE,
    Permissions.MEASUREMENT_READ,
    Permissions.MEASUREMENT_UPDATE,
    Permissions.MEASUREMENT_DELETE,
    // 분석
    Permissions.ANALYTICS_READ,
    Permissions.ANALYTICS_EXPORT,
    // 제어
    Permissions.CONTROL_CREATE,
    Permissions.CONTROL_READ,
    Permissions.CONTROL_EXECUTE,
    Permissions.CONTROL_APPROVE,
    // 알림
    Permissions.ALERT_CREATE,
    Permissions.ALERT_READ,
    Permissions.ALERT_UPDATE,
    Permissions.ALERT_DELETE,
    // 보고서
    Permissions.REPORT_CREATE,
    Permissions.REPORT_READ,
    Permissions.REPORT_EXPORT,
    // 구독
    Permissions.SUBSCRIPTION_READ,
    Permissions.SUBSCRIPTION_UPDATE,
    Permissions.SUBSCRIPTION_MANAGE,
    // 감사 로그
    Permissions.AUDIT_LOG_READ,
  ],

  /**
   * site_manager: 사이트 관리자 (사이트 및 디바이스 관리)
   */
  [UserRole.SITE_MANAGER]: [
    // 테넌트 (조회만)
    Permissions.TENANT_READ,
    // 사용자 (조회만)
    Permissions.USER_READ,
    // 사이트
    Permissions.SITE_CREATE,
    Permissions.SITE_READ,
    Permissions.SITE_UPDATE,
    Permissions.SITE_DELETE,
    // 디바이스
    Permissions.DEVICE_CREATE,
    Permissions.DEVICE_READ,
    Permissions.DEVICE_UPDATE,
    Permissions.DEVICE_DELETE,
    // 측정 데이터
    Permissions.MEASUREMENT_CREATE,
    Permissions.MEASUREMENT_READ,
    Permissions.MEASUREMENT_UPDATE,
    // 분석
    Permissions.ANALYTICS_READ,
    Permissions.ANALYTICS_EXPORT,
    // 제어
    Permissions.CONTROL_CREATE,
    Permissions.CONTROL_READ,
    Permissions.CONTROL_EXECUTE,
    // 알림
    Permissions.ALERT_CREATE,
    Permissions.ALERT_READ,
    Permissions.ALERT_UPDATE,
    Permissions.ALERT_DELETE,
    // 보고서
    Permissions.REPORT_CREATE,
    Permissions.REPORT_READ,
    Permissions.REPORT_EXPORT,
  ],

  /**
   * operator: 운영자 (디바이스 제어 및 모니터링)
   */
  [UserRole.OPERATOR]: [
    // 테넌트 (조회만)
    Permissions.TENANT_READ,
    // 사용자 (조회만)
    Permissions.USER_READ,
    // 사이트 (조회만)
    Permissions.SITE_READ,
    // 디바이스 (조회 및 수정)
    Permissions.DEVICE_READ,
    Permissions.DEVICE_UPDATE,
    // 측정 데이터
    Permissions.MEASUREMENT_CREATE,
    Permissions.MEASUREMENT_READ,
    // 분석
    Permissions.ANALYTICS_READ,
    // 제어
    Permissions.CONTROL_CREATE,
    Permissions.CONTROL_READ,
    Permissions.CONTROL_EXECUTE,
    // 알림 (조회 및 생성)
    Permissions.ALERT_CREATE,
    Permissions.ALERT_READ,
    // 보고서 (조회 및 생성)
    Permissions.REPORT_CREATE,
    Permissions.REPORT_READ,
  ],

  /**
   * viewer: 조회 전용 사용자 (읽기만 가능)
   */
  [UserRole.VIEWER]: [
    // 테넌트 (조회만)
    Permissions.TENANT_READ,
    // 사용자 (조회만)
    Permissions.USER_READ,
    // 사이트 (조회만)
    Permissions.SITE_READ,
    // 디바이스 (조회만)
    Permissions.DEVICE_READ,
    // 측정 데이터 (조회만)
    Permissions.MEASUREMENT_READ,
    // 분석 (조회만)
    Permissions.ANALYTICS_READ,
    // 제어 (조회만)
    Permissions.CONTROL_READ,
    // 알림 (조회만)
    Permissions.ALERT_READ,
    // 보고서 (조회만)
    Permissions.REPORT_READ,
  ],
};

/**
 * 특정 역할이 특정 권한을 가지는지 확인
 *
 * @param role - 사용자 역할
 * @param permission - 확인할 권한
 * @returns 권한이 있으면 true
 *
 * @example
 * hasPermission(UserRole.SITE_MANAGER, Permissions.SITE_CREATE) // true
 * hasPermission(UserRole.VIEWER, Permissions.SITE_CREATE) // false
 */
export function hasPermission(
  role: UserRole | string,
  permission: Permission
): boolean {
  const permissions = ROLE_PERMISSIONS[role as UserRole];
  return permissions ? permissions.includes(permission) : false;
}

/**
 * 특정 역할이 여러 권한 중 하나라도 가지는지 확인
 *
 * @param role - 사용자 역할
 * @param permissions - 확인할 권한 목록
 * @returns 권한 중 하나라도 있으면 true
 */
export function hasAnyPermission(
  role: UserRole | string,
  permissions: Permission[]
): boolean {
  return permissions.some(permission => hasPermission(role, permission));
}

/**
 * 특정 역할이 모든 권한을 가지는지 확인
 *
 * @param role - 사용자 역할
 * @param permissions - 확인할 권한 목록
 * @returns 모든 권한이 있으면 true
 */
export function hasAllPermissions(
  role: UserRole | string,
  permissions: Permission[]
): boolean {
  return permissions.every(permission => hasPermission(role, permission));
}

/**
 * 역할의 모든 권한 목록 반환
 */
export function getRolePermissions(role: UserRole | string): Permission[] {
  return ROLE_PERMISSIONS[role as UserRole] || [];
}

/**
 * 권한 파싱 (resource:action → { resource, action })
 */
export function parsePermission(permission: Permission): {
  resource: ResourceType;
  action: Action;
} | null {
  const parts = permission.split(':');
  if (parts.length !== 2) return null;

  const [resource, action] = parts;
  return {
    resource: resource as ResourceType,
    action: action as Action,
  };
}

/**
 * 리소스에 대한 모든 권한 생성
 */
export function getResourcePermissions(resource: ResourceType): Permission[] {
  return Object.values(Action).map(
    action => `${resource}:${action}` as Permission
  );
}
