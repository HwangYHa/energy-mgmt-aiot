/**
 * lib/auth/session.ts - NextAuth Configuration with Google OAuth
 */

import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from '@/lib/db/prisma';
import bcrypt from 'bcryptjs';
import { notifyUserLogin } from '@/lib/services/notification.service';

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
          throw new Error('이메일 또는 비밀번호를 입력해주세요');
        }

        try {
          // 기본 필드만 조회 (loginAttempts 등은 DB 마이그레이션 여부와 무관하게 처리)
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
            },
          });

          if (!user) {
            throw new Error('사용자를 찾을 수 없습니다');
          }

          if (!user.passwordHash || user.passwordHash === 'OAUTH_USER') {
            throw new Error('소셜 로그인 전용 계정입니다');
          }

          // 계정 잠금 확인 (컬럼 존재 시)
          const userExt = await (prisma as any).user.findUnique({
            where: { id: user.id },
            select: { loginAttempts: true, lockedUntil: true },
          }).catch(() => null);

          if (userExt?.lockedUntil && new Date() < new Date(userExt.lockedUntil)) {
            throw new Error('로그인 시도 초과로 계정이 잠겼습니다. 잠시 후 다시 시도해주세요.');
          }

          if (!user.isActive) {
            throw new Error('비활성화된 계정입니다');
          }

          const passwordValid = await bcrypt.compare(
            credentials.password,
            user.passwordHash
          );

          const loginIp = (req?.headers?.['x-forwarded-for'] as string) ?? 'unknown';
          const userAgent = (req?.headers?.['user-agent'] as string) ?? undefined;

          // loginHistory 모델 존재 여부 사전 확인 (prisma generate 미실행 환경 대응)
          const hasLoginHistory = typeof (prisma as any).loginHistory?.create === 'function';

          if (!passwordValid) {
            const currentAttempts = userExt?.loginAttempts ?? 0;
            const newAttempts = currentAttempts + 1;
            const maxAttempts = 5;
            const locked = newAttempts >= maxAttempts;

            // loginAttempts 업데이트 (컬럼 없으면 무시)
            (prisma as any).user.update({
              where: { id: user.id },
              data: {
                loginAttempts: newAttempts,
                ...(locked ? { lockedUntil: new Date(Date.now() + 30 * 60 * 1000) } : {}),
              },
            }).catch(() => {});

            // 실패 이력 기록 (모델 존재 시에만)
            if (hasLoginHistory) {
              (prisma as any).loginHistory.create({
                data: {
                  userId: user.id,
                  tenantId: user.tenantId,
                  ipAddress: loginIp !== 'unknown' ? loginIp : null,
                  userAgent,
                  provider: 'credentials',
                  success: false,
                  failReason: locked ? '계정 잠금 (5회 초과)' : '비밀번호 불일치',
                },
              }).catch(() => {});
            }

            throw new Error(
              locked
                ? '로그인 시도 횟수 초과로 계정이 30분간 잠겼습니다.'
                : '비밀번호가 올바르지 않습니다'
            );
          }

          // 성공 시 loginAttempts 초기화 (컬럼 없으면 무시)
          (prisma as any).user.update({
            where: { id: user.id },
            data: {
              loginAttempts: 0,
              lockedUntil: null,
              lastLoginAt: new Date(),
              lastLoginIp: loginIp !== 'unknown' ? loginIp : null,
            },
          }).catch(() => {});

          // 성공 이력 기록 (모델 존재 시에만)
          if (hasLoginHistory) {
            (prisma as any).loginHistory.create({
              data: {
                userId: user.id,
                tenantId: user.tenantId,
                ipAddress: loginIp !== 'unknown' ? loginIp : null,
                userAgent,
                provider: 'credentials',
                success: true,
              },
            }).catch(() => {});
          }

          // 로그인 카카오 알림 (fire-and-forget)
          notifyUserLogin({
            userId: user.id,
            userName: user.name ?? user.email,
            loginTime: new Date(),
            ipAddress: loginIp !== 'unknown' ? loginIp : undefined,
            provider: 'credentials',
          }).catch((e) => console.warn('[인증] 로그인 알림 발송 실패:', e));

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            tenantId: user.tenantId,
            role: user.role,
          };
        } catch (error) {
          console.error('[인증] 로그인 오류:', error instanceof Error ? error.message : error);
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

            // Trial 구독 자동 생성 (plan_trial이 DB에 존재하는 경우)
            const trialPlan = await prisma.plan.findUnique({ where: { id: 'plan_trial' }, select: { id: true } });
            if (trialPlan) {
              const trialEnd = new Date();
              trialEnd.setDate(trialEnd.getDate() + 30);
              await prisma.subscription.create({
                data: {
                  tenantId: tenant.id,
                  planId: 'plan_trial',
                  status: 'ACTIVE',
                  billingCycle: 'monthly',
                  startDate: new Date(),
                  endDate: trialEnd,
                },
              });
            }
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

          // 소셜 로그인 이력 기록 (모델 존재 시에만)
          if (typeof (prisma as any).loginHistory?.create === 'function') {
            (prisma as any).loginHistory.create({
              data: {
                userId: dbUser.id,
                tenantId: dbUser.tenantId,
                provider: account.provider,
                success: true,
              },
            }).catch(() => {});
          }

          // 소셜 로그인 카카오 알림 (fire-and-forget)
          notifyUserLogin({
            userId: dbUser.id,
            userName: user.name ?? email,
            loginTime: new Date(),
            provider: account.provider,
          }).catch((e) => console.warn('[인증] 소셜 로그인 알림 발송 실패:', e));

          return true;
        } catch (error) {
          console.error(`[인증] ${account.provider} OAuth 오류:`, error);
          return false;
        }
      }

      return true;
    },

    async jwt({ token, user, account }) {
      // ── 최초 로그인 시: 기본 사용자 정보 세팅 ──────────────────
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

      // ── 매 JWT 갱신마다 planTier + onboardingCompleted DB 재조회 ──
      // update() 호출 또는 updateAge(1h) 도달 시마다 실행됨.
      // 결제/플랜 변경 후 update()를 호출하면 즉시 최신 값 반영.
      if (token.tenantId) {
        try {
          const [sub, tenant] = await Promise.all([
            prisma.subscription.findFirst({
              where: {
                tenantId: token.tenantId as string,
                status: { in: ['ACTIVE', 'EXPIRE_SOON'] },
              },
              select: { plan: { select: { apiRateLimit: true, tier: true } } },
              orderBy: { startDate: 'desc' },
            }),
            prisma.tenant.findUnique({
              where: { id: token.tenantId as string },
              select: { onboardingCompletedAt: true },
            }),
          ]);
          token.planTier = (sub?.plan.tier ?? 'trial').toLowerCase();
          token.apiRateLimit = sub?.plan.apiRateLimit ?? 1000;
          token.onboardingCompleted = !!tenant?.onboardingCompletedAt;
        } catch {
          // DB 오류 시 기존 값 유지 (초기값 폴백)
          if (token.planTier === undefined) token.planTier = 'trial';
          if (token.apiRateLimit === undefined) token.apiRateLimit = 1000;
          if (token.onboardingCompleted === undefined) token.onboardingCompleted = false;
        }
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
        session.user.planTier = (token.planTier as string) ?? 'trial';
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      // NextAuth 4 + App Router에서 baseUrl이 HOSTNAME:PORT(내부 주소)로
      // 폴백되는 버그 방지 — NEXTAUTH_URL 환경변수를 직접 사용
      const appBase = (process.env.NEXTAUTH_URL ?? baseUrl).replace(/\/$/, '');

      if (url.startsWith(appBase) || url.startsWith(baseUrl)) {
        if (url.includes('/api/auth/signin') || url.includes('/api/auth/callback')) {
          return `${appBase}/dashboard`;
        }
        return url.startsWith(appBase) ? url : url.replace(baseUrl, appBase);
      }

      if (url.startsWith('/')) {
        if (url === '/login' || url === '/register') {
          return `${appBase}/dashboard`;
        }
        return `${appBase}${url}`;
      }

      return `${appBase}/dashboard`;
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

  // __Secure-/__Host- prefix는 HTTPS에서만 유효
  // HTTP 운영 중(도메인+SSL 발급 전)에는 일반 쿠키명 사용
  // NEXTAUTH_URL이 https://로 시작할 때만 Secure 쿠키 활성화
  cookies: process.env.NEXTAUTH_URL?.startsWith('https://')
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
      planTier: string;
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
    apiRateLimit?: number;
    planTier?: string;
  }
}
