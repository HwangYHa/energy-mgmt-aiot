/**
 * GET /api/auth/oauth/naver - Naver OAuth 로그인 시작
 * POST /api/auth/oauth/naver/callback - Naver OAuth 콜백 처리
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || '';
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || '';
const NAVER_REDIRECT_URI = process.env.NAVER_REDIRECT_URI || '';

/**
 * Naver OAuth 로그인 시작
 */
export async function GET(request: NextRequest) {
  try {
    if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
      // 설정이 없으면 로그인 페이지로 리다이렉트하고 에러 메시지 표시
      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent('Naver OAuth가 설정되지 않았습니다.')}`,
          request.url
        )
      );
    }

    const redirectUri =
      NAVER_REDIRECT_URI ||
      `${process.env.NEXTAUTH_URL || process.env.WEB_APP_URL}/api/auth/oauth/naver/callback`;

    // State 생성 (CSRF 방지)
    const state = crypto.randomBytes(32).toString('hex');

    // State를 쿠키에 저장
    const response = NextResponse.redirect(
      `https://nid.naver.com/oauth2.0/authorize?` +
        `response_type=code&` +
        `client_id=${NAVER_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `state=${state}`
    );

    response.cookies.set('naver-oauth-state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10분
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Naver OAuth error:', error);
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent('Naver 로그인 처리 중 오류가 발생했습니다.')}`,
        request.url
      )
    );
  }
}

/**
 * Naver OAuth 콜백 처리
 */
// export async function POST(request: NextRequest) {
//   try {
//     const body = await request.json();
//     const { code, state } = body;

//     if (!code || !state) {
//       return NextResponse.json(
//         { error: '인증 코드 또는 state가 없습니다.' },
//         { status: 400 }
//       );
//     }

//     // State 검증
//     const storedState = request.cookies.get('naver-oauth-state')?.value;
//     if (!storedState || storedState !== state) {
//       return NextResponse.json(
//         { error: '유효하지 않은 state입니다.' },
//         { status: 403 }
//       );
//     }

//     // Access Token 요청
//     const tokenResponse = await fetch('https://nid.naver.com/oauth2.0/token', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
//       body: new URLSearchParams({
//         grant_type: 'authorization_code',
//         client_id: NAVER_CLIENT_ID,
//         client_secret: NAVER_CLIENT_SECRET,
//         code,
//         state,
//       }),
//     });

//     if (!tokenResponse.ok) {
//       return NextResponse.json(
//         { error: '토큰 요청에 실패했습니다.' },
//         { status: 400 }
//       );
//     }

//     const tokenData = await tokenResponse.json();
//     const accessToken = tokenData.access_token;

//     // 사용자 정보 요청
//     const userInfoResponse = await fetch('https://openapi.naver.com/v1/nid/me', {
//       headers: {
//         Authorization: `Bearer ${accessToken}`,
//       },
//     });

//     if (!userInfoResponse.ok) {
//       return NextResponse.json(
//         { error: '사용자 정보 요청에 실패했습니다.' },
//         { status: 400 }
//       );
//     }

//     const userInfo = await userInfoResponse.json();
//     const naverUser = userInfo.response;

//     if (!naverUser.email) {
//       return NextResponse.json(
//         { error: '이메일 정보를 가져올 수 없습니다.' },
//         { status: 400 }
//       );
//     }

//     // 기존 사용자 확인 또는 생성
//     let user = await prisma.user.findUnique({
//       where: { email: naverUser.email },
//       select: {
//         id: true,
//         tenantId: true,
//         role: true,
//         isActive: true,
//       },
//     });

//     if (!user) {
//       // 기본 테넌트 찾기 또는 생성
//       let tenant = await prisma.tenant.findFirst({
//         where: { status: 'active' },
//         select: { id: true },
//       });

//       if (!tenant) {
//         // 임시 테넌트 생성 (실제로는 회원가입 플로우 필요)
//         tenant = await prisma.tenant.create({
//           data: {
//             name: `${naverUser.name}의 조직`,
//             status: 'active',
//           },
//           select: { id: true },
//         });
//       }

//       user = await prisma.user.create({
//         data: {
//           email: naverUser.email,
//           name: naverUser.name,
//           tenantId: tenant.id,
//           role: 'viewer',
//           isActive: true,
//           isEmailVerified: true,
//           passwordHash: '', // OAuth 사용자는 비밀번호 없음
//         },
//         select: {
//           id: true,
//           tenantId: true,
//           role: true,
//           isActive: true,
//         },
//       });
//     }

//     if (!user.isActive) {
//       return NextResponse.json(
//         { error: '비활성화된 계정입니다.' },
//         { status: 403 }
//       );
//     }

//     // JWT 토큰 생성 (간단한 구현)
//     // 실제로는 NextAuth 세션을 사용하는 것이 좋습니다
//     return NextResponse.json({
//       success: true,
//       user: {
//         id: user.id,
//         email: naverUser.email,
//         name: naverUser.name,
//         tenantId: user.tenantId,
//         role: user.role,
//       },
//     });
//   } catch (error) {
//     console.error('Naver OAuth callback error:', error);
//     return NextResponse.json(
//       { error: 'Naver 로그인 처리 중 오류가 발생했습니다.' },
//       { status: 500 }
//     );
//   }
// }
