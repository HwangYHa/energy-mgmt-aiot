/**
 * lib/context/tenant-context.ts - 테넌트 검증 및 AsyncLocalStorage
 */

import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  tenantId: string;
  userId: string;
  role: 'super_admin' | 'tenant_admin' | 'site_manager' | 'operator' | 'viewer';
  email: string;
}

export const tenantContext = new AsyncLocalStorage<TenantContext>();

/**
 * 현재 요청의 테넌트 컨텍스트 가져오기
 */
export function getTenantContext(): TenantContext | undefined {
  return tenantContext.getStore();
}

/**
 * 필수 테넌트 컨텍스트 가져오기
 * 컨텍스트가 없으면 에러 발생
 */
export function requireTenantContext(): TenantContext {
  const context = tenantContext.getStore();
  if (!context) {
    throw new Error('Tenant context not found. Call within request handler.');
  }
  return context;
}

/**
 * 테넌트 컨텍스트와 함께 콜백 실행
 */
export function withTenantContext<T>(
  context: TenantContext,
  callback: () => Promise<T> | T
): Promise<T> {
  return Promise.resolve(
    tenantContext.run(context, () => callback())
  );
}

/**
 * 테넌트 ID 검증 헬퍼
 */
export function validateTenantAccess(
  userTenantId: string,
  resourceTenantId: string
): boolean {
  return userTenantId === resourceTenantId;
}
