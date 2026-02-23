/**
 * GET /api/status — 공개 시스템 상태 체크 (인증 불필요)
 *
 * 실제 서비스 상태를 확인하여 반환합니다:
 * - DB: Prisma 핑 ($queryRaw SELECT 1)
 * - AI 엔진: /health 엔드포인트 응답 (3초 타임아웃)
 * - MQTT: 환경변수 설정 여부
 * - 인증: NEXTAUTH_SECRET 설정 여부
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

type ServiceStatus = 'operational' | 'degraded' | 'down';

interface ServiceInfo {
  name: string;
  description: string;
  status: ServiceStatus;
}

export async function GET() {
  const checkedAt = new Date().toISOString();
  const services: ServiceInfo[] = [];

  // 1. 웹 애플리케이션 — 이 라우트가 응답하면 정상
  services.push({
    name: '웹 애플리케이션',
    description: '대시보드, 모니터링, 설정 등 웹 인터페이스',
    status: 'operational',
  });

  // 2. API 서버 — 이 라우트가 응답하면 정상
  services.push({
    name: 'API 서버',
    description: 'REST API, 인증, 데이터 조회',
    status: 'operational',
  });

  // 3. 데이터베이스 — Prisma 핑
  let dbStatus: ServiceStatus = 'operational';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'down';
  }
  services.push({
    name: '데이터베이스',
    description: '사용자 데이터, 설정, 이력 저장',
    status: dbStatus,
  });

  // 4. 실시간 데이터 수집 (MQTT) — 환경변수 설정 여부로 판단
  const mqttStatus: ServiceStatus = process.env.MQTT_BROKER_URL
    ? 'operational'
    : 'degraded';
  services.push({
    name: '실시간 데이터 수집',
    description: 'IoT 게이트웨이, MQTT, WebSocket',
    status: mqttStatus,
  });

  // 5. AI 분석 엔진 — /health 엔드포인트 핑
  let aiStatus: ServiceStatus = 'degraded';
  if (process.env.AI_ENGINE_URL) {
    try {
      const res = await fetch(`${process.env.AI_ENGINE_URL}/health`, {
        signal: AbortSignal.timeout(3000),
        cache: 'no-store',
      });
      aiStatus = res.ok ? 'operational' : 'degraded';
    } catch {
      aiStatus = 'degraded';
    }
  }
  services.push({
    name: 'AI 분석 엔진',
    description: '부하 예측, 이상 탐지, 최적화',
    status: aiStatus,
  });

  // 6. 인증 & 보안 — NEXTAUTH_SECRET 설정 여부
  const authStatus: ServiceStatus = process.env.NEXTAUTH_SECRET
    ? 'operational'
    : 'degraded';
  services.push({
    name: '인증 & 보안',
    description: 'OAuth, JWT, CSRF, 접근 제어',
    status: authStatus,
  });

  const overall: ServiceStatus =
    services.some((s) => s.status === 'down')
      ? 'down'
      : services.some((s) => s.status === 'degraded')
      ? 'degraded'
      : 'operational';

  return NextResponse.json({ services, overall, checkedAt });
}
