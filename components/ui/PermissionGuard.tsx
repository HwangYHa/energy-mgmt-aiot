'use client';

import { ReactNode } from 'react';
import { UserRole } from '@prisma/client';
import { useHasRole, useHasPermission } from '@/hooks/use-auth';
import { Permission } from '@/lib/constants/permissions';

interface PermissionGuardProps {
  minRole?: UserRole;
  permission?: Permission;
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGuard({
  minRole,
  permission,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const hasRole = useHasRole(minRole || ('viewer' as UserRole));
  const hasPerm = permission ? useHasPermission(permission) : true;

  if (!hasRole || !hasPerm) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
