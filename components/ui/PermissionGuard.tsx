'use client';

import { ReactNode } from 'react';
import { UserRole } from '@prisma/client';
import { useHasRole } from '@/hooks/use-auth';

interface PermissionGuardProps {
  minRole?: UserRole;
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGuard({
  minRole,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const hasRole = useHasRole(minRole || ('viewer' as UserRole));

  if (!hasRole) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
