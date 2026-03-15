/**
 * GET /api/health — 헬스 체크 엔드포인트
 * Docker HEALTHCHECK + Load Balancer probe용
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface HealthDetail {
  status: 'ok' | 'degraded' | 'down';
  latencyMs?: number;
  error?: string;
}

export async function GET() {
  const start = Date.now();
  const checks: Record<string, HealthDetail> = {};
  let overallStatus: 'ok' | 'degraded' | 'down' = 'ok';

  // ── DB 체크 ──────────────────────────────────────────────
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok', latencyMs: Date.now() - dbStart };
  } catch {
    checks.database = { status: 'down', error: 'DB connection failed' };
    overallStatus = 'down';
  }

  // ── Redis 체크 (선택적 — REDIS_URL 설정 시, net 모듈로 ping) ──
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const redisStart = Date.now();
    try {
      const url = new URL(redisUrl);
      const host = url.hostname;
      const port = parseInt(url.port || '6379', 10);
      await new Promise<void>((resolve, reject) => {
        const net = require('net') as typeof import('net');
        const socket = net.createConnection({ host, port, timeout: 3000 }, () => {
          socket.destroy();
          resolve();
        });
        socket.on('error', reject);
        socket.on('timeout', () => { socket.destroy(); reject(new Error('timeout')); });
      });
      checks.redis = { status: 'ok', latencyMs: Date.now() - redisStart };
    } catch {
      checks.redis = { status: 'degraded', error: 'Redis connection failed' };
      if (overallStatus === 'ok') overallStatus = 'degraded';
    }
  }

  // ── 메모리 체크 ──────────────────────────────────────────
  const mem = process.memoryUsage();
  const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotalMb = Math.round(mem.heapTotal / 1024 / 1024);
  checks.memory = {
    status: heapUsedMb > 1500 ? 'degraded' : 'ok',
    latencyMs: heapUsedMb,  // MB 값을 latencyMs 필드 재활용
  };
  if (heapUsedMb > 1500 && overallStatus === 'ok') overallStatus = 'degraded';

  const responseTime = Date.now() - start;

  const body = {
    status: overallStatus,
    version: process.env.npm_package_version ?? '1.0.0',
    commit: process.env.NEXT_PUBLIC_COMMIT_SHA ?? 'dev',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    responseTimeMs: responseTime,
    checks,
    memory: {
      heapUsedMb,
      heapTotalMb,
      rssMb: Math.round(mem.rss / 1024 / 1024),
    },
  };

  const httpStatus = overallStatus === 'down' ? 503
    : overallStatus === 'degraded' ? 200
    : 200;

  return NextResponse.json(body, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-store',
      'X-Health-Status': overallStatus,
    },
  });
}
