/**
 * GET  /api/carbon/blockchain/tokens   — 토큰화 레코드 목록
 * POST /api/carbon/blockchain/tokens   — 탄소 크레딧 토큰화 요청
 *
 * 블록체인 토큰화 흐름:
 * 1. POST: 토큰화 요청 → MockAdapter(개발) 또는 ToucanAdapter(프로덕션)
 * 2. GET:  pending → confirmed 상태 폴링
 * 3. RETIRE 이벤트 발생 시 OnChainRetirementPlugin이 retireOnChain() 자동 호출
 *
 * 프로토콜별 실제 구현:
 * - polygon/toucan: @toucan-earth/toucan-sdk 필요 (ethers.js)
 * - polygon/klimadao: KlimaDAO SDK 필요
 * - 현재 개발: MockBlockchainAdapter (외부 의존 없음)
 */

import { type NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';
import {
  MockBlockchainAdapter,
  BlockchainBridgeRegistry,
} from '@/lib/domains/carbon-trading/extensions/blockchain/blockchain-bridge.interface';
import type {
  TokenStandard,
  BlockchainNetwork,
  BlockchainProtocol,
} from '@/lib/domains/carbon-trading/extensions/blockchain/types';

const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

const VALID_STANDARDS: TokenStandard[] = ['ERC-20', 'ERC-1155', 'ERC-721', 'SPL', 'CUSTOM'];
const VALID_NETWORKS: BlockchainNetwork[] = ['ethereum', 'polygon', 'celo', 'solana', 'cosmos', 'other'];
const VALID_PROTOCOLS: BlockchainProtocol[] = ['toucan', 'klimadao', 'c3', 'moss', 'regen', 'custom'];

// ─── GET — 토큰 레코드 목록 ──────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  const { searchParams } = req.nextUrl;
  const registryId = searchParams.get('registryId') || undefined;
  const onChainStatus = searchParams.get('status') || undefined;
  const page  = Math.max(1, Number(searchParams.get('page')  ?? 1));
  const limit = Math.min(50, Number(searchParams.get('limit') ?? 20));

  const where: Record<string, unknown> = { tenantId: auth.tenantId };
  if (registryId) where.registryId = registryId;
  if (onChainStatus) where.onChainStatus = onChainStatus;

  try {
    const [items, total] = await Promise.all([
      db.carbonTokenRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          registry: {
            select: { registry: true, projectId: true, creditType: true, vintageYear: true },
          },
        },
      }),
      db.carbonTokenRecord.count({ where }),
    ]);

    return successResponse({
      items: items.map((r: any) => ({
        ...r,
        tokenizedQuantity: Number(r.tokenizedQuantity),
        blockNumber: r.blockNumber ? Number(r.blockNumber) : null,
      })),
      total,
      page,
      limit,
    });
  } catch (e) {
    console.error('[carbon/blockchain/tokens GET]', e);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}

// ─── POST — 토큰화 요청 ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: '요청 본문이 올바르지 않습니다' } });

  const {
    registryId,
    quantity,
    tokenStandard = 'ERC-20',
    network = 'polygon',
    protocol = 'custom',
  } = body;

  // 필수 검증
  if (!registryId) {
    return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: 'registryId는 필수입니다' } });
  }
  if (!quantity || Number(quantity) <= 0) {
    return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: 'quantity는 0보다 커야 합니다' } });
  }
  if (!VALID_STANDARDS.includes(tokenStandard)) {
    return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: `유효하지 않은 토큰 표준: ${tokenStandard}` } });
  }
  if (!VALID_NETWORKS.includes(network)) {
    return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: `지원하지 않는 네트워크: ${network}` } });
  }
  if (!VALID_PROTOCOLS.includes(protocol)) {
    return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: `지원하지 않는 프로토콜: ${protocol}` } });
  }

  // 지갑 존재 및 검증 확인
  const wallet = await db.tenantCarbonWallet.findUnique({
    where: { tenantId: auth.tenantId },
  });
  if (!wallet) {
    return errorResponse('VALIDATION_ERROR', {
      status: 422,
      details: { message: '탄소 지갑을 먼저 등록하세요 (POST /api/carbon/blockchain/wallet)' },
    });
  }
  if (!wallet.isVerified) {
    return errorResponse('VALIDATION_ERROR', {
      status: 422,
      details: { message: '지갑 소유권 검증이 필요합니다 (PATCH /api/carbon/blockchain/wallet)' },
    });
  }

  // 레지스트리 보유 확인
  const registry = await db.carbonCreditRegistry.findFirst({
    where: { id: registryId, tenantId: auth.tenantId, status: 'active' },
  });
  if (!registry) {
    return errorResponse('RESOURCE_NOT_FOUND', { status: 404, details: { message: '크레딧 레지스트리를 찾을 수 없습니다' } });
  }
  if (Number(registry.availableQuantity) < Number(quantity)) {
    return errorResponse('VALIDATION_ERROR', {
      status: 422,
      details: { message: `가용 수량(${Number(registry.availableQuantity).toFixed(1)} tCO₂) 부족` },
    });
  }

  // 어댑터 선택 — 등록된 어댑터 없으면 Mock 사용
  let adapter = BlockchainBridgeRegistry.get(protocol as BlockchainProtocol);
  if (!adapter) {
    adapter = new MockBlockchainAdapter();
    console.warn(`[carbon/blockchain/tokens] '${protocol}' 어댑터 미등록 — MockAdapter 사용`);
  }

  try {
    const result = await adapter.tokenize({
      tenantId: auth.tenantId,
      registryId,
      quantity: Number(quantity),
      walletAddress: wallet.walletAddress,
      tokenStandard,
      network,
      protocol: protocol as BlockchainProtocol,
    });

    return successResponse({
      ...result,
      walletAddress: wallet.walletAddress,
      network,
      protocol,
      status: 'pending',
      message: '토큰화 요청이 제출되었습니다. 온체인 확인까지 일부 시간이 소요됩니다.',
    }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '토큰화 처리 중 오류가 발생했습니다';
    console.error('[carbon/blockchain/tokens POST]', e);
    return errorResponse('SERVER_ERROR', { status: 500, details: { message: msg } });
  }
}