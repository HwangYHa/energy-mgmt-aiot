/**
 * lib/auth/server-auth.ts - Server Component 전용 인증 유틸리티
 *
 * Server Component에서 역할/권한 검증:
 * const auth = await requireServerRole('tenant_admin' as UserRole);
 */

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from './session';
import { UserRole } from '@prisma/client';
import { hasRoleOrHigher } from '@/lib/constants/roles';
import { hasPermission, Permission } from '@/lib/constants/permissions';

export interface ServerAuthContext {
  userId: string;
  tenantId: string;
  role: UserRole;
  email: string;
  name: string;
}

export async function getServerAuth(): Promise<ServerAuthContext | null> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  return {
    userId: session.user.id,
    tenantId: session.user.tenantId,
    role: session.user.role as UserRole,
    email: session.user.email || '',
    name: session.user.name || '',
  };
}

export async function requireServerRole(
  minRole: UserRole
): Promise<ServerAuthContext> {
  const auth = await getServerAuth();

  if (!auth) {
    redirect('/login');
  }

  if (!hasRoleOrHigher(auth.role, minRole)) {
    redirect('/dashboard');
  }

  return auth;
}

export async function requireServerPermission(
  permission: Permission
): Promise<ServerAuthContext> {
  const auth = await getServerAuth();

  if (!auth) {
    redirect('/login');
  }

  if (!hasPermission(auth.role, permission)) {
    redirect('/dashboard');
  }

  return auth;
}

