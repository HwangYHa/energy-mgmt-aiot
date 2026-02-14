/**
 * lib/auth/session.ts - NextAuth Configuration with Google OAuth
 */

import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from '@/lib/db/prisma';
import bcrypt from 'bcryptjs';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
if (!NEXTAUTH_SECRET) {
  throw new Error('NEXTAUTH_SECRET is required');
}

export const authOptions: NextAuthOptions = {
  providers: [
    ...(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
            authorization: {
              params: {
                prompt: 'consent',
                access_type: 'offline',
                response_type: 'code',
              },
            },
            profile(profile) {
              return {
                id: profile.sub,
                name: profile.name || '',
                email: profile.email || '',
                image: profile.picture,
                tenantId: '',
                role: '',
              };
            },
          }),
        ]
      : []),
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'name@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Missing email or password');
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
            select: {
              id: true,
              email: true,
              name: true,
              passwordHash: true,
              tenantId: true,
              role: true,
              isActive: true,
              loginAttempts: true,
              lockedUntil: true,
            },
          });

          if (!user) {
            throw new Error('User not found');
          }

          if (!user.passwordHash || user.passwordHash === 'OAUTH_USER') {
            throw new Error('OAuth-only account');
          }

          if (user.lockedUntil && new Date() < user.lockedUntil) {
            throw new Error('Account is locked. Try again later.');
          }

          if (!user.isActive) {
            throw new Error('User account is inactive');
          }

          const passwordValid = await bcrypt.compare(
            credentials.password,
            user.passwordHash
          );

          if (!passwordValid) {
            const newAttempts = user.loginAttempts + 1;
            const maxAttempts = 5;

            if (newAttempts >= maxAttempts) {
              await prisma.user.update({
                where: { id: user.id },
                data: {
                  loginAttempts: newAttempts,
                  lockedUntil: new Date(Date.now() + 30 * 60 * 1000),
                },
              });
              throw new Error(
                'Too many failed login attempts. Account locked for 30 minutes.'
              );
            }

            await prisma.user.update({
              where: { id: user.id },
              data: { loginAttempts: newAttempts },
            });

            throw new Error('Invalid password');
          }

          await prisma.user.update({
            where: { id: user.id },
            data: {
              loginAttempts: 0,
              lockedUntil: null,
              lastLoginAt: new Date(),
              lastLoginIp: (req?.headers?.['x-forwarded-for'] as string) ?? 'unknown',
            },
          });

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            tenantId: user.tenantId,
            role: user.role,
          };
        } catch (error) {
          console.error('[Auth] Login error:', error instanceof Error ? error.message : error);
          throw error;
        }
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google' || account?.provider === 'naver') {
        try {
          const email = user.email;
          if (!email) return false;

          let dbUser = await prisma.user.findUnique({
            where: { email },
            select: {
              id: true,
              tenantId: true,
              role: true,
              isActive: true,
              passwordHash: true,
            },
          });

          if (!dbUser) {
            const tenant = await prisma.tenant.create({
              data: {
                name: (user.name || email.split('@')[0]) as string,
                industryType: 'other',
                status: 'active',
              },
            });

            dbUser = await prisma.user.create({
              data: {
                email,
                name: (user.name || email.split('@')[0]) as string,
                tenantId: tenant.id,
                role: 'tenant_admin',
                isActive: true,
                isEmailVerified: true,
                passwordHash: 'OAUTH_USER',
                lastLoginAt: new Date(),
              },
              select: {
                id: true,
                tenantId: true,
                role: true,
                isActive: true,
                passwordHash: true,
              },
            });
          } else {
            await prisma.user.update({
              where: { id: dbUser.id },
              data: {
                isEmailVerified: true,
                lastLoginAt: new Date(),
              },
            });
          }

          if (!dbUser.isActive) return false;

          (user as any).id = dbUser.id;
          (user as any).tenantId = dbUser.tenantId;
          (user as any).role = dbUser.role;

          return true;
        } catch (error) {
          console.error(`[Auth] ${account.provider} OAuth error:`, error);
          return false;
        }
      }

      return true;
    },

    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.tenantId = (user as any).tenantId;
        token.role = (user as any).role;
        token.email = user.email || '';
        token.name = user.name || '';
      }

      if (account) {
        token.accessToken = account.access_token;
        token.provider = account.provider;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.tenantId = token.tenantId as string;
        session.user.role = token.role as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) {
        if (url.includes('/api/auth/signin') || url.includes('/api/auth/callback')) {
          return `${baseUrl}/dashboard`;
        }
        return url;
      }

      if (url.startsWith('/')) {
        if (url === '/login' || url === '/register') {
          return `${baseUrl}/dashboard`;
        }
        return `${baseUrl}${url}`;
      }

      return `${baseUrl}/dashboard`;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
    signOut: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60,
    updateAge: 60 * 60,
  },

  jwt: {
    maxAge: 24 * 60 * 60,
  },

  cookies: process.env.NODE_ENV === 'production'
    ? {
        sessionToken: {
          name: '__Secure-next-auth.session-token',
          options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true },
        },
        callbackUrl: {
          name: '__Secure-next-auth.callback-url',
          options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true },
        },
        csrfToken: {
          name: '__Host-next-auth.csrf-token',
          options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true },
        },
      }
    : {
        sessionToken: {
          name: 'next-auth.session-token',
          options: { httpOnly: true, sameSite: 'lax', path: '/', secure: false },
        },
        callbackUrl: {
          name: 'next-auth.callback-url',
          options: { httpOnly: true, sameSite: 'lax', path: '/', secure: false },
        },
        csrfToken: {
          name: 'next-auth.csrf-token',
          options: { httpOnly: true, sameSite: 'lax', path: '/', secure: false },
        },
      },

  secret: NEXTAUTH_SECRET,
  debug: false,
  events: {},
};

declare module 'next-auth' {
  interface User {
    tenantId: string;
    role: string;
  }

  interface Session {
    user: User & {
      id: string;
      tenantId: string;
      role: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    tenantId: string;
    role: string;
    email: string;
    name: string;
    accessToken?: string;
    provider?: string;
  }
}
