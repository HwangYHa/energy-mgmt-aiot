/**
 * lib/auth/session.ts - NextAuth Configuration with Google OAuth
 *
 * SECURE BY DEFAULT
 * - JWT-based authentication
 * - Session includes tenantId (multi-tenancy)
 * - Login failure tracking in DB (security)
 * - Google OAuth support for unified UX
 * - Business logic separated into libraries
 */

import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from '@/lib/db/prisma';
import bcrypt from 'bcryptjs';

// Environment variable validation (critical)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
const NEXTAUTH_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

if (!NEXTAUTH_SECRET) {
  throw new Error('NEXTAUTH_SECRET is required');
}

// Google OAuth configuration validation
console.log('[NextAuth] Configuration:', {
  hasGoogleClientId: !!GOOGLE_CLIENT_ID,
  hasGoogleClientSecret: !!GOOGLE_CLIENT_SECRET,
  nextAuthUrl: NEXTAUTH_URL,
  nodeEnv: process.env.NODE_ENV,
});

export const authOptions: NextAuthOptions = {
  providers: [
    // 1. Google OAuth (only enabled when environment variables are set)
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
            // CRITICAL: Profile mapping must be accurate
            profile(profile) {
              console.log('[NextAuth] Google profile received:', {
                sub: profile.sub,
                email: profile.email,
                name: profile.name,
              });
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
    // 2. Credentials (email/password login)
    CredentialsProvider({
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
          // 1. Find user in database
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

          // 2. Account lock validation
          if (user.lockedUntil && new Date() < user.lockedUntil) {
            throw new Error('Account is locked. Try again later.');
          }

          // 3. Active status validation
          if (!user.isActive) {
            throw new Error('User account is inactive');
          }

          // 4. Password validation
          const passwordValid = await bcrypt.compare(
            credentials.password,
            user.passwordHash
          );

          if (!passwordValid) {
            // Security: Increment failure count
            const newAttempts = user.loginAttempts + 1;
            const maxAttempts = 5;

            if (newAttempts >= maxAttempts) {
              // Lock account (30 minutes)
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

            // Update failure count only
            await prisma.user.update({
              where: { id: user.id },
              data: { loginAttempts: newAttempts },
            });

            throw new Error('Invalid password');
          }

          // 5. Login success: Reset failure count and update lastLoginAt
          await prisma.user.update({
            where: { id: user.id },
            data: {
              loginAttempts: 0,
              lockedUntil: null,
              lastLoginAt: new Date(),
              lastLoginIp: (req?.headers?.['x-forwarded-for'] as string) ?? 'unknown',
            },
          });

          console.log('[NextAuth] Credentials login successful:', user.email);

          // 6. Return user info to JWT token
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            tenantId: user.tenantId,
            role: user.role,
          };
        } catch (error) {
          console.error('[NextAuth] Login authorization error:', error);
          throw error;
        }
      },
    }),
  ],

  callbacks: {
    // 1. OAuth login - create/find user
    async signIn({ user, account, profile }) {
      console.log('[NextAuth] signIn callback START:', {
        provider: account?.provider,
        type: account?.type,
        email: user.email,
        hasProfile: !!profile,
      });

      // OAuth login case
      if (account?.provider === 'google') {
        try {
          const email = user.email;
          if (!email) {
            console.error('[NextAuth] No email from Google profile');
            return false;
          }

          console.log('[NextAuth] Checking existing user:', email);

          // Validate existing user
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

          // Create new user if not exists
          if (!dbUser) {
            console.log('[NextAuth] Creating new Google user:', email);

            // Create default tenant
            const tenant = await prisma.tenant.create({
              data: {
                name: (user.name || email.split('@')[0]) as string,
                industryType: 'other',
                status: 'active',
              },
            });

            console.log('[NextAuth] Tenant created:', tenant.id);

            // Create user
            dbUser = await prisma.user.create({
              data: {
                email,
                name: (user.name || email.split('@')[0]) as string,
                tenantId: tenant.id,
                role: 'tenant_admin', // Google login users are admins
                isActive: true,
                isEmailVerified: true, // OAuth emails are verified
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

            console.log('[NextAuth] Google user created:', dbUser.id);
          } else {
            console.log('[NextAuth] Existing user found:', dbUser.id);

            // Existing user - upgrade to OAuth
            if (dbUser.passwordHash !== 'OAUTH_USER') {
              console.log('[NextAuth] Upgrading account to OAuth');
              await prisma.user.update({
                where: { id: dbUser.id },
                data: {
                  isEmailVerified: true,
                  lastLoginAt: new Date(),
                },
              });
            } else {
              // OAuth-only account - update login time only
              await prisma.user.update({
                where: { id: dbUser.id },
                data: {
                  lastLoginAt: new Date(),
                },
              });
            }
          }

          // Inactive account validation
          if (!dbUser.isActive) {
            console.error('[NextAuth] Google user is inactive:', email);
            return false;
          }

          // Add DB info to user object
          (user as any).id = dbUser.id;
          (user as any).tenantId = dbUser.tenantId;
          (user as any).role = dbUser.role;

          console.log('[NextAuth] Google sign in successful:', {
            email,
            userId: dbUser.id,
            tenantId: dbUser.tenantId,
            role: dbUser.role,
          });

          return true;
        } catch (error) {
          console.error('[NextAuth] Google OAuth sign in error:', error);
          return false;
        }
      }

      // Credentials login is handled in authorize
      console.log('[NextAuth] signIn callback END - success');
      return true;
    },

    // JWT token creation/renewal
    async jwt({ token, user, account, trigger }) {
      console.log('[NextAuth] jwt callback:', {
        hasUser: !!user,
        hasAccount: !!account,
        trigger,
        tokenEmail: token.email,
      });

      // Add user info to token on new login
      if (user) {
        token.id = user.id;
        token.tenantId = (user as any).tenantId;
        token.role = (user as any).role;
        token.email = user.email || '';
        token.name = user.name || '';
        console.log('[NextAuth] JWT token updated with user data');
      }

      // Store OAuth token (for later use if needed)
      if (account) {
        token.accessToken = account.access_token;
        token.provider = account.provider;
        console.log('[NextAuth] JWT token updated with OAuth data');
      }

      return token;
    },

    // Session creation
    async session({ session, token }) {
      console.log('[NextAuth] session callback:', {
        hasToken: !!token,
        tokenEmail: token.email,
      });

      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.tenantId = token.tenantId as string;
        session.user.role = token.role as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        console.log('[NextAuth] Session created for:', token.email);
      }
      return session;
    },

    // CRITICAL: Redirect callback - proper URL redirection
    async redirect({ url, baseUrl }) {
      console.log('[NextAuth] redirect callback START:', {
        url,
        baseUrl,
        isAbsolute: url.startsWith('http'),
        isRelative: url.startsWith('/'),
      });

      // 1. Full URL with same domain
      if (url.startsWith(baseUrl)) {
        // Redirect internal auth URLs to dashboard
        if (url.includes('/api/auth/signin') || url.includes('/api/auth/callback')) {
          console.log('[NextAuth] Auth URL detected, redirecting to /dashboard');
          return `${baseUrl}/dashboard`;
        }
        console.log('[NextAuth] Same domain URL, allowing:', url);
        return url;
      }

      // 2. Relative path
      if (url.startsWith('/')) {
        // Redirect auth pages to dashboard
        if (url === '/login' || url === '/register') {
          console.log('[NextAuth] Auth page detected, redirecting to /dashboard');
          return `${baseUrl}/dashboard`;
        }
        console.log('[NextAuth] Relative path, combining with baseUrl:', url);
        return `${baseUrl}${url}`;
      }

      // 3. External URL or default - default: dashboard
      console.log('[NextAuth] Default redirect to /dashboard');
      return `${baseUrl}/dashboard`;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login', // Redirect to login page on error
    signOut: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 60 * 60, // Refresh every 1 hour
  },

  jwt: {
    maxAge: 24 * 60 * 60,
  },

  secret: NEXTAUTH_SECRET,

  // CRITICAL: Enable debug logs (development environment)
  debug: true, // Disable logs before deployment

  // CRITICAL: Event hooks (audit logs)
  events: {
    async signIn({ user, account, isNewUser }) {
      console.log('[NextAuth] EVENT: signIn', {
        email: user.email,
        provider: account?.provider,
        isNewUser,
      });
    },
    async signOut({ token }) {
      console.log('[NextAuth] EVENT: signOut', {
        email: token?.email,
      });
    },
    async createUser({ user }) {
      console.log('[NextAuth] EVENT: createUser', {
        email: user.email,
      });
    },
  },
};

// Type extensions
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
