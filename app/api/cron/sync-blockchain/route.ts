/**
 * GET /api/cron/sync-blockchain
 *
 * 블록체인 토큰 상태 동기화 크론 엔드포인트.
 *
 * 처리 항목:
 *   1. onChainStatus = pending|bridging 레코드 폴링
 *   2. Polygon RPC로 트랜잭션 영수증 확인
 *   3. confirmed|failed 상태로 업데이트
 *
 * 권장 실행 주기: 5분
 * 보안: CRON_SECRET 헤더 인증
 *
 * Vercel Cron 설정 (vercel.json):
 *   crons: [{ path: "/api/cron/sync-blockchain", schedule: "every 5 minutes" }]
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  BlockchainBridgeRegistry,
  syncPendingTokenRecords,
} from '@/lib/domains/carbon-trading/extensions/blockchain/blockchain-bridge.interface';
import type { BlockchainProtocol } from '@/lib/domains/carbon-trading/extensions/blockchain/types';

// ── 크론 인증 헬퍼 ─────────────────────────────────────────────────

function isCronAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // 미설정 시 허용 (개발 환경)

  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  return ip === '127.0.0.1' || ip === '::1';
}

// ── 메인 핸들러 ────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const results: Record<string, number> = {};
  const errors:  Array<{ tenantId: string; protocol: string; error: string }> = [];

  try {
    // 등록된 블록체인 어댑터 프로토콜 목록
    const registeredProtocols = BlockchainBridgeRegistry.list();

    if (registeredProtocols.length === 0) {
      return NextResponse.json({
        success: true,
        message: '등록된 블록체인 어댑터 없음 (환경변수 확인)',
        durationMs: Date.now() - startedAt,
      });
    }

    // pending/bridging 상태의 레코드가 있는 테넌트 목록 조회
    const pendingRecords = await (prisma as any).carbonTokenRecord.findMany({
      where: {
        onChainStatus: { in: ['pending', 'bridging'] },
        txHash:        { not: null, notIn: ['0x0'] },
      },
      select: { tenantId: true, protocol: true },
      distinct: ['tenantId', 'protocol'],
      take: 100,
    }) as Array<{ tenantId: string; protocol: string }>;

    if (pendingRecords.length === 0) {
      return NextResponse.json({
        success: true,
        message: '동기화할 pending 레코드 없음',
        durationMs: Date.now() - startedAt,
      });
    }

    // 테넌트 × 프로토콜별 동기화 실행
    for (const { tenantId, protocol } of pendingRecords) {
      // 등록된 어댑터에서만 처리
      if (!registeredProtocols.includes(protocol as BlockchainProtocol)) continue;

      try {
        const updates = await syncPendingTokenRecords(
          tenantId,
          protocol as BlockchainProtocol
        );

        const key = `${protocol}:${tenantId.slice(0, 8)}`;
        results[key] = (results[key] ?? 0) + updates.length;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ tenantId, protocol, error: msg });
        console.error(`[BlockchainSync] 동기화 오류 tenantId=${tenantId} protocol=${protocol}:`, err);
      }
    }

    const totalUpdated = Object.values(results).reduce((a, b) => a + b, 0);

    console.info(
      `[BlockchainSync] 완료: ${totalUpdated}건 업데이트, ` +
      `${errors.length}건 오류, ${Date.now() - startedAt}ms`
    );

    return NextResponse.json({
      success: true,
      summary: {
        totalPending:  pendingRecords.length,
        totalUpdated,
        byProtocol:    results,
        errorCount:    errors.length,
        errors:        errors.length > 0 ? errors : undefined,
      },
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    console.error('[BlockchainSync] 크론 실행 오류:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : '내부 서버 오류',
        durationMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}
