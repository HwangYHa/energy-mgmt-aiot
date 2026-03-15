/**
 * GET  /api/carbon/blockchain/wallet  — 테넌트 탄소 지갑 조회
 * POST /api/carbon/blockchain/wallet  — 지갑 주소 등록/갱신
 * PATCH /api/carbon/blockchain/wallet — 소유권 서명 검증
 *
 * 블록체인 레지스트리 통합의 첫 단계:
 * 테넌트별 지갑 주소를 등록하면 온체인 토큰화/소각 기능 활성화.
 *
 * 지원 네트워크: polygon (Toucan/KlimaDAO), ethereum, celo, solana
 * 주소 검증:
 * - EVM(ethereum/polygon/celo): 0x + 40 hex chars
 * - Solana: Base58 32~44 chars
 */

import { type NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { requireMinRole } from '@/lib/auth/permissions';
import { successResponse, errorResponse } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';
import type { BlockchainNetwork } from '@/lib/domains/carbon-trading/extensions/blockchain/types';

const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

const VALID_NETWORKS: BlockchainNetwork[] = ['ethereum', 'polygon', 'celo', 'solana', 'cosmos', 'other'];

function validateWalletAddress(address: string, network: BlockchainNetwork): boolean {
  if (['ethereum', 'polygon', 'celo'].includes(network)) {
    return /^0x[0-9a-fA-F]{40}$/.test(address);
  }
  if (network === 'solana') {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }
  return address.length >= 20 && address.length <= 100;
}

// ─── GET — 테넌트 지갑 조회 ──────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  try {
    const wallet = await db.tenantCarbonWallet.findUnique({
      where: { tenantId: auth.tenantId },
    });

    if (!wallet) return successResponse({ registered: false, wallet: null });

    return successResponse({
      registered: true,
      wallet: {
        id: wallet.id,
        network: wallet.network,
        walletAddress: wallet.walletAddress,
        isVerified: wallet.isVerified,
        verifiedAt: wallet.verifiedAt,
        createdAt: wallet.createdAt,
      },
    });
  } catch (e) {
    console.error('[carbon/blockchain/wallet GET]', e);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}

// ─── POST — 지갑 등록/갱신 (admin 이상) ─────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  const roleErr = requireMinRole(auth.role, 'admin');
  if (roleErr) return roleErr;

  const body = await req.json().catch(() => null);
  if (!body) return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: '요청 본문이 올바르지 않습니다' } });

  const { network = 'polygon', walletAddress } = body;

  if (!walletAddress) {
    return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: 'walletAddress는 필수입니다' } });
  }
  if (!VALID_NETWORKS.includes(network)) {
    return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: `지원하지 않는 네트워크: ${network}` } });
  }
  if (!validateWalletAddress(walletAddress, network)) {
    return errorResponse('VALIDATION_ERROR', {
      status: 400,
      details: { message: `올바르지 않은 ${network} 지갑 주소 형식입니다` },
    });
  }

  try {
    const wallet = await db.tenantCarbonWallet.upsert({
      where: { tenantId: auth.tenantId },
      update: { network, walletAddress, isVerified: false, verifiedAt: null, updatedAt: new Date() },
      create: { tenantId: auth.tenantId, network, walletAddress, isVerified: false },
    });

    return successResponse({
      id: wallet.id,
      network: wallet.network,
      walletAddress: wallet.walletAddress,
      isVerified: wallet.isVerified,
      createdAt: wallet.createdAt,
      message: '지갑이 등록되었습니다. 온체인 연동을 위해 소유권 검증이 필요합니다.',
    }, { status: 201 });
  } catch (e) {
    console.error('[carbon/blockchain/wallet POST]', e);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}

// ─── PATCH — 지갑 소유권 검증 ────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  const roleErr = requireMinRole(auth.role, 'admin');
  if (roleErr) return roleErr;

  const body = await req.json().catch(() => null);
  if (!body?.signedMessage) {
    return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: 'signedMessage는 필수입니다' } });
  }

  const wallet = await db.tenantCarbonWallet.findUnique({
    where: { tenantId: auth.tenantId },
  });
  if (!wallet) {
    return errorResponse('RESOURCE_NOT_FOUND', { status: 404, details: { message: '등록된 지갑이 없습니다' } });
  }

  /**
   * 실제 구현 시: ethers.js verifyMessage() 또는 nacl.sign.detached.verify()로 검증
   * 현재(개발 단계): signedMessage 최소 길이만 확인 후 verified 처리
   */
  const verified = body.signedMessage.length >= 10;

  if (!verified) {
    return errorResponse('VALIDATION_ERROR', { status: 422, details: { message: '서명 검증에 실패했습니다' } });
  }

  await db.tenantCarbonWallet.update({
    where: { tenantId: auth.tenantId },
    data: { isVerified: true, verifiedAt: new Date() },
  });

  return successResponse({ verified: true, verifiedAt: new Date().toISOString() });
}