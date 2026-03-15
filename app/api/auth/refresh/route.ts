/**
 * POST /api/auth/refresh
 *
 * JWT 액세스 토큰 갱신 (슬라이딩 세션)
 * - Authorization: Bearer <expiredOrValidToken> 헤더에서 기존 토큰 읽기
 * - 유효 기간 1시간 이내 만료 예정이면 새 토큰 발급
 * - 블랙리스트된 토큰(강제 로그아웃) 차단
 * - 새 액세스 토큰 + 만료 시각 반환
 *
 * POST /api/auth/refresh  with  { action: 'revoke' }
 * → 현재 토큰 무효화(강제 로그아웃) — jti 기반 블랙리스트
 */

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, SignJWT, JWTPayload } from 'jose';
import env from '@/lib/env';
import { logSecurityEvent } from '@/lib/services/security-event.service';

const secret = new TextEncoder().encode(env.JWT_SECRET);

// ── 메모리 블랙리스트 (jti → expiresAt) ────────────────────────
// 프로덕션에서는 Redis 사용 권장
const revokedJtis = new Map<string, number>(); // jti → expiresAt ms
setInterval(() => {
  const now = Date.now();
  for (const [jti, exp] of revokedJtis) {
    if (exp < now) revokedJtis.delete(jti);
  }
}, 5 * 60 * 1000);

export function isTokenRevoked(jti: string): boolean {
  return revokedJtis.has(jti);
}

// ── 토큰에서 payload 추출 (만료 토큰도 허용) ───────────────────
async function decodeTokenLeniently(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (err: unknown) {
    // 만료된 토큰도 payload 추출 시도 (refresh 플로우)
    if (err instanceof Error && err.message.includes('expired')) {
      try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const decoded = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8'));
        // 만료 토큰은 최대 7일 이내만 허용
        const exp = decoded.exp as number;
        if (exp && Date.now() / 1000 - exp > 7 * 24 * 3600) return null;
        return decoded as JWTPayload;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '0.0.0.0';

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: '토큰이 필요합니다.' }, { status: 401 });
  }

  const payload = await decodeTokenLeniently(token);
  if (!payload) {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
  }

  const jti = payload.jti as string | undefined;
  const sub = payload.sub as string;
  const tenantId = payload.tenantId as string;

  // 블랙리스트 체크
  if (jti && isTokenRevoked(jti)) {
    await logSecurityEvent({
      type: 'TOKEN_INVALID',
      severity: 'HIGH',
      ip,
      userId: sub,
      tenantId,
      details: { reason: '폐기된 토큰 재사용 시도', jti },
    });
    return NextResponse.json({ error: '폐기된 토큰입니다. 다시 로그인해주세요.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  // ── 강제 로그아웃 (토큰 폐기) ────────────────────────────────
  if (body.action === 'revoke') {
    if (jti) {
      const expMs = ((payload.exp ?? 0) * 1000) || (Date.now() + 24 * 60 * 60 * 1000);
      revokedJtis.set(jti, expMs);
    }
    await logSecurityEvent({
      type: 'FORCE_LOGOUT',
      severity: 'LOW',
      ip,
      userId: sub,
      tenantId,
      details: { jti },
    });
    return NextResponse.json({ success: true, message: '로그아웃 처리되었습니다.' });
  }

  // ── 토큰 갱신 ─────────────────────────────────────────────────
  const now = Math.floor(Date.now() / 1000);
  const exp = payload.exp ?? 0;
  const ttlLeft = exp - now; // 남은 초

  // 이미 만료됐거나 1시간 이내 만료 예정인 경우만 갱신
  if (ttlLeft > 3600) {
    return NextResponse.json({
      success: true,
      refreshed: false,
      expiresIn: ttlLeft,
      message: '아직 갱신이 필요하지 않습니다.',
    });
  }

  // 새 jti 생성
  const newJti = crypto.randomUUID();

  // 기존 jti 블랙리스트 처리 (재사용 방지)
  if (jti) {
    revokedJtis.set(jti, (exp * 1000) + 60_000); // 원래 만료 + 1분 여유
  }

  // 새 토큰 발급 (24시간)
  const newToken = await new SignJWT({
    sub,
    jti: newJti,
    tenantId,
    role:         payload.role,
    email:        payload.email,
    name:         payload.name,
    apiRateLimit: payload.apiRateLimit,
    onboardingCompleted: payload.onboardingCompleted,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret);

  return NextResponse.json({
    success: true,
    refreshed: true,
    accessToken: newToken,
    expiresIn: 86400,
    tokenType: 'Bearer',
  });
}
