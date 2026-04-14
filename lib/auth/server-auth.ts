/**
 * lib/auth/server-auth.ts - Server Component 전용 인증 유틸리티
 *
 * Server Component에서 역할/권한 검증:
 * const auth = await requireServerRole('tenant_admin' as UserRole);
 *
 * 인증 우선순위:
 * 1. NextAuth 세션 (Google OAuth)
 * 2. auth-token 쿠키 (Naver OAuth JWT)
 */

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { authOptions } from './session';
import { UserRole } from '@prisma/client';
import { hasRoleOrHigher } from '@/lib/constants/roles';
import { hasPermission, Permission } from '@/lib/constants/permissions';
import { prisma } from '@/lib/db/prisma';
import env from '@/lib/env';

const secret = new TextEncoder().encode(env.JWT_SECRET);

export interface ServerAuthContext {
  userId: string;
  tenantId: string;
  role: UserRole;
  email: string;
  name: string;
}

/**
 * auth-token 쿠키 (Naver OAuth JWT) 검증
 */
async function getServerAuthFromJwtCookie(): Promise<ServerAuthContext | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth-token')?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, secret);
    const userId = payload.sub as string;
    const claimedTenantId = payload.tenantId as string;
    const claimedRole = payload.role as string;

    if (!userId || !claimedTenantId) return null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        tenantId: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) return null;
    if (claimedTenantId !== user.tenantId) return null;
    if (claimedRole !== user.role) return null;

    return {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role as UserRole,
      email: user.email,
      name: user.name || '',
    };
  } catch {
    return null;
  }
}

export async function getServerAuth(): Promise<ServerAuthContext | null> {
  // 1. NextAuth 세션 (Google OAuth)
  const session = await getServerSession(authOptions);
  if (session?.user) {
    return {
      userId: session.user.id,
      tenantId: session.user.tenantId,
      role: session.user.role as UserRole,
      email: session.user.email || '',
      name: session.user.name || '',
    };
  }

  // 2. auth-token 쿠키 (Naver OAuth JWT)
  return getServerAuthFromJwtCookie();
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
