'use client';

import { useSession } from 'next-auth/react';
import { UserRole } from '@prisma/client';
import { hasRoleOrHigher } from '@/lib/constants/roles';
import { hasPermission, Permission } from '@/lib/constants/permissions';

export function useAuth() {
  const { data: session, status } = useSession();

  return {
    user: session?.user,
    role: (session?.user?.role as UserRole) || ('viewer' as UserRole),
    tenantId: session?.user?.tenantId || '',
    isLoading: status === 'loading',
    isAuthenticated: !!session,
  };
}

export function useHasRole(minRole: UserRole): boolean {
  const { role } = useAuth();
  return hasRoleOrHigher(role, minRole);
}

export function useHasPermission(permission: Permission): boolean {
  const { role } = useAuth();
  return hasPermission(role, permission);
}

/**
 * 역할 또는 권한 기반 접근 가능 여부 확인
 */
export function useCanAccess(minRole?: UserRole, permission?: Permission): boolean {
  const { role } = useAuth();
  const roleOk = minRole ? hasRoleOrHigher(role, minRole) : true;
  const permOk = permission ? hasPermission(role, permission) : true;
  return roleOk && permOk;
}
