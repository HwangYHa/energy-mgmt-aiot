/**
 * lib/middleware/cors.ts - CORS 정책
 */

import { NextRequest, NextResponse } from 'next/server';
import env from '@/lib/env';

// 허용된 도메인 목록
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  env.WEB_APP_URL,
];

export function corsMiddleware(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('origin');

  // OPTIONS 요청 처리 (Preflight)
  if (request.method === 'OPTIONS') {
    if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
      return new NextResponse('CORS policy violation', { status: 403 });
    }

    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-csrf-token',
        'Access-Control-Max-Age': '3600',
        'Access-Control-Allow-Credentials': 'true',
      },
    });
  }

  // 일반 요청에 CORS 헤더 추가
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    const response = NextResponse.next();
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    return response;
  }

  return null;
}
