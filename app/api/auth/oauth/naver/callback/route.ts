/**
 * GET /api/auth/oauth/naver/callback - Naver OAuth 콜백 처리
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { SignJWT } from 'jose';
import env from '@/lib/env';

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent('네이버 로그인이 취소되었습니다.')}`, request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/login?error=' + encodeURIComponent('인증 정보가 없습니다.'), request.url)
      );
    }

    // State 검증
    const storedState = request.cookies.get('naver-oauth-state')?.value;
    if (!storedState || storedState !== state) {
      return NextResponse.redirect(
        new URL('/login?error=' + encodeURIComponent('유효하지 않은 요청입니다.'), request.url)
      );
    }

    // Access Token 요청
    const tokenResponse = await fetch('https://nid.naver.com/oauth2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: NAVER_CLIENT_ID,
        client_secret: NAVER_CLIENT_SECRET,
        code,
        state,
      }),
    });

    if (!tokenResponse.ok) {
      return NextResponse.redirect(
        new URL('/login?error=' + encodeURIComponent('토큰 요청에 실패했습니다.'), request.url)
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // 사용자 정보 요청
    const userInfoResponse = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userInfoResponse.ok) {
      return NextResponse.redirect(
        new URL('/login?error=' + encodeURIComponent('사용자 정보를 가져올 수 없습니다.'), request.url)
      );
    }

    const userInfo = await userInfoResponse.json();
    const naverUser = userInfo.response;

    if (!naverUser.email) {
      return NextResponse.redirect(
        new URL('/login?error=' + encodeURIComponent('이메일 정보를 가져올 수 없습니다.'), request.url)
      );
    }

    // 기존 사용자 확인 또는 생성
    let user = await prisma.user.findUnique({
      where: { email: naverUser.email },
      select: {
        id: true,
        tenantId: true,
        role: true,
        isActive: true,
        name: true,
      },
    });

    if (!user) {
      // 신규 사용자 - 테넌트 생성 (Google OAuth와 동일한 패턴)
      const tenant = await prisma.tenant.create({
        data: {
          name: naverUser.name || naverUser.email.split('@')[0],
          industryType: 'other',
          status: 'active',
        },
        select: { id: true },
      });

      console.log('[Naver OAuth] Tenant created:', tenant.id);

      // First user (tenant creator) is admin, others are viewers
      const isFirstUser = true; // Creating new tenant, so this is the first user
      user = await prisma.user.create({
        data: {
          email: naverUser.email,
          name: naverUser.name || naverUser.email.split('@')[0],
          tenantId: tenant.id,
          role: isFirstUser ? 'tenant_admin' : 'viewer',
          isActive: true,
          isEmailVerified: true, // OAuth는 이메일 검증됨
          passwordHash: 'OAUTH_USER', // OAuth 전용 표시 (Google과 동일)
          lastLoginAt: new Date(),
        },
        select: {
          id: true,
          tenantId: true,
          role: true,
          isActive: true,
          name: true,
        },
      });

      console.log('[Naver OAuth] User created:', user.id);

      // Trial 구독 자동 생성
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
      // 기존 사용자 - 로그인 시간 업데이트
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          isEmailVerified: true,
        },
      });

      console.log('[Naver OAuth] Existing user logged in:', user.id);
    }

    if (!user.isActive) {
      return NextResponse.redirect(
        new URL('/login?error=' + encodeURIComponent('비활성화된 계정입니다.'), request.url)
      );
    }

    // 구독 플랜 apiRateLimit + 온보딩 완료 여부 조회
    let apiRateLimit = 1000;
    let onboardingCompleted = false;
    try {
      const [sub, tenant] = await Promise.all([
        prisma.subscription.findFirst({
          where: { tenantId: user.tenantId, status: { in: ['ACTIVE', 'EXPIRE_SOON'] } },
          select: { plan: { select: { apiRateLimit: true } } },
          orderBy: { startDate: 'desc' },
        }),
        prisma.tenant.findUnique({
          where: { id: user.tenantId },
          select: { onboardingCompletedAt: true },
        }),
      ]);
      apiRateLimit = sub?.plan.apiRateLimit ?? 1000;
      onboardingCompleted = !!tenant?.onboardingCompletedAt;
    } catch {
      // 폴백: 기본값 유지
    }

    // JWT 토큰 생성
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const token = await new SignJWT({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: naverUser.email,
      apiRateLimit,
      onboardingCompleted,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secret);

    // 쿠키에 토큰 설정
    const response = NextResponse.redirect(new URL('/dashboard', request.url));
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24시간
      path: '/',
    });

    // State 쿠키 삭제
    response.cookies.delete('naver-oauth-state');

    return response;
  } catch (error) {
    console.error('Naver OAuth callback error:', error);
    return NextResponse.redirect(
      new URL('/login?error=' + encodeURIComponent('로그인 처리 중 오류가 발생했습니다.'), request.url)
    );
  }
}
