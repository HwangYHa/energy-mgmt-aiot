import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from './session';
import { UserRole } from '@prisma/client';
import { hasRoleOrHigher } from '@/lib/constants/roles';

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
    redirect('/unauthorized');
  }

  return auth;
}

