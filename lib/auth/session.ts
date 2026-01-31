/**
 * lib/auth/session.ts - NextAuth 설정
 * 
 * ⭐ SECURE BY DEFAULT
 * - JWT 전략 사용
 * - 토큰에 tenantId 포함 (검증용)
 * - 로그인 실패 시 DB 업데이트 (보안)
 */

import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/db/prisma';
import bcrypt from 'bcrypt';

export const authOptions: NextAuthOptions = {
  providers: [
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
          // 1. 데이터베이스에서 사용자 조회
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

          // 2. 계정 잠금 확인
          if (user.lockedUntil && new Date() < user.lockedUntil) {
            throw new Error('Account is locked. Try again later.');
          }

          // 3. 활성 상태 확인
          if (!user.isActive) {
            throw new Error('User account is inactive');
          }

          // 4. 비밀번호 검증
          const passwordValid = await bcrypt.compare(
            credentials.password,
            user.passwordHash
          );

          if (!passwordValid) {
            // ⭐ 보안: 실패 시도 기록
            const newAttempts = user.loginAttempts + 1;
            const maxAttempts = 5;

            if (newAttempts >= maxAttempts) {
              // 계정 임시 잠금 (15분)
              await prisma.user.update({
                where: { id: user.id },
                data: {
                  loginAttempts: newAttempts,
                  lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
                },
              });
              throw new Error(
                'Too many failed login attempts. Account locked for 15 minutes.'
              );
            }

            // 실패 시도만 업데이트
            await prisma.user.update({
              where: { id: user.id },
              data: { loginAttempts: newAttempts },
            });

            throw new Error('Invalid password');
          }

          // 5. 로그인 성공: 시도 횟수 초기화 및 lastLoginAt 업데이트
          await prisma.user.update({
            where: { id: user.id },
            data: {
              loginAttempts: 0,
              lockedUntil: null,
              lastLoginAt: new Date(),
              lastLoginIp: (req?.headers?.['x-forwarded-for'] as string) ?? 'unknown',
            },
          });

          // 6. JWT 토큰용 사용자 객체 반환
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            tenantId: user.tenantId,
            role: user.role,
          };
        } catch (error) {
          console.error('Login authorization error:', error);
          throw error;
        }
      },
    }),
  ],

  callbacks: {
    // JWT 토큰 생성/갱신
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tenantId = user.tenantId;
        token.role = user.role;
      }
      return token;
    },

    // 세션 생성
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.tenantId = token.tenantId as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/auth/error',
  },

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24시간
    updateAge: 60 * 60, // 1시간마다 갱신
  },

  jwt: {
    maxAge: 24 * 60 * 60,
  },

  secret: process.env.NEXTAUTH_SECRET,
};

// ✅ 타입 확장
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

  interface JWT {
    id: string;
    tenantId: string;
    role: string;
  }
}