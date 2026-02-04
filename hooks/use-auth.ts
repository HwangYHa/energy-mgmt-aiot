'use client';

import { useSession } from 'next-auth/react';
import { UserRole } from '@prisma/client';
import { hasRoleOrHigher } from '@/lib/constants/roles';

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

// hasPermission 함수가 roles.ts에 없으므로 주석 처리
// export function useHasPermission(permission: Permission): boolean {
//   const { role } = useAuth();
//   return hasPermission(role, permission);
// }
