/**
 * IBlockchainBridge — 블록체인 레지스트리 연동 인터페이스
 *
 * 설계 원칙 (어댑터 패턴):
 * - 코어 도메인은 IBlockchainBridge만 의존
 * - 각 프로토콜(Toucan, KlimaDAO, Regen)은 독립 어댑터로 구현
 * - 연동 전환 시 어댑터만 교체 (코어 서비스 불변)
 *
 * 구현 어댑터:
 * - ToucanBridgeAdapter  : Polygon + TCO2/BCT/NCT — 가장 성숙한 VCM 프로토콜
 * - KlimaDAOAdapter      : KLIMA 스테이킹 + 소각 풀
 * - C3Adapter            : UBO/NBO 풀 (Polygon)
 * - MockBridgeAdapter    : 테스트/개발용 (외부 의존 없음)
 *
 * 프로덕션 구현 시 필요한 라이브러리:
 * - ethers.js / viem (EVM 체인)
 * - @solana/web3.js (Solana)
 * - @cosmjs/stargate (Cosmos/Regen)
 */

import type {
  BlockchainNetwork,
  BlockchainProtocol,
  TokenizeParams,
  TokenizeResult,
  RetireOnChainParams,
  RetireOnChainResult,
  OnChainStatus,
  BridgeStatusUpdate,
} from './types';
import { prisma } from '@/lib/db/prisma';
import type { ICarbonPlugin } from '../../plugin-registry';
import type { CarbonDomainEvent } from '../../events';

const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

// ─── 인터페이스 ──────────────────────────────────────────────────────

export interface IBlockchainBridge {
  /** 프로토콜 식별자 */
  readonly protocol: BlockchainProtocol;
  /** 지원 네트워크 */
  readonly network: BlockchainNetwork;

  /**
   * 탄소 크레딧 → 블록체인 토큰화 (온체인 브릿지)
   * - off-chain CarbonCreditRegistry → 온체인 TCO2 토큰 등
   */
  tokenize(params: TokenizeParams): Promise<TokenizeResult>;

  /**
   * 온체인 소유권 검증
   * @returns 지갑이 해당 토큰을 보유 중이면 true
   */
  verifyOwnership(walletAddress: string, contractAddress: string, tokenId?: string): Promise<boolean>;

  /**
   * 온체인 소각 (Retire on-chain)
   * - Toucan: retireExact() + NFT 발행
   * - KlimaDAO: retire()
   */
  retireOnChain(params: RetireOnChainParams): Promise<RetireOnChainResult>;

  /**
   * 지갑의 온체인 잔량 조회 (tCO2e)
   */
  getOnChainBalance(walletAddress: string, contractAddress: string): Promise<number>;

  /**
   * 트랜잭션 상태 폴링 (비동기 확인)
   */
  syncStatus(txHash: string): Promise<OnChainStatus>;
}

// ─── Mock 어댑터 (개발/테스트용) ─────────────────────────────────────

/**
 * 외부 블록체인 연동 없이 동작하는 Mock 어댑터
 *
 * 사용:
 * ```ts
 * BlockchainBridgeRegistry.register(new MockBlockchainAdapter());
 * ```
 */
export class MockBlockchainAdapter implements IBlockchainBridge {
  readonly protocol: BlockchainProtocol = 'custom';
  readonly network: BlockchainNetwork = 'polygon';

  async tokenize(params: TokenizeParams): Promise<TokenizeResult> {
    const fakeTxHash = `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}`;

    await db.carbonTokenRecord.create({
      data: {
        tenantId: params.tenantId,
        registryId: params.registryId,
        walletAddress: params.walletAddress,
        tokenStandard: params.tokenStandard,
        network: params.network,
        contractAddress: '0xMOCK_CONTRACT_ADDRESS',
        tokenizedQuantity: params.quantity,
        onChainStatus: 'confirmed',
        txHash: fakeTxHash,
        blockNumber: Math.floor(Math.random() * 50000000) + 40000000,
        bridgedAt: new Date(),
      },
    });

    return {
      tokenRecordId: `mock-${Date.now()}`,
      txHash: fakeTxHash,
      contractAddress: '0xMOCK_CONTRACT_ADDRESS',
      estimatedConfirmationTime: 15,
    };
  }

  async verifyOwnership(
    _walletAddress: string,
    _contractAddress: string,
    _tokenId?: string
  ): Promise<boolean> {
    return true;
  }

  async retireOnChain(params: RetireOnChainParams): Promise<RetireOnChainResult> {
    const fakeTxHash = `0x${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('')}`;

    await db.carbonTokenRecord.updateMany({
      where: { id: params.tokenRecordId, tenantId: params.tenantId },
      data: {
        onChainStatus: 'retired_on_chain',
        retiredOnChainAt: new Date(),
      },
    });

    return {
      txHash: fakeTxHash,
      retirementNFTId: `NFT-${Date.now()}`,
      retiredAt: new Date().toISOString(),
    };
  }

  async getOnChainBalance(
    _walletAddress: string,
    _contractAddress: string
  ): Promise<number> {
    return 0;
  }

  async syncStatus(_txHash: string): Promise<OnChainStatus> {
    return 'confirmed';
  }
}

// ─── 브릿지 레지스트리 ────────────────────────────────────────────────

/**
 * 블록체인 브릿지 어댑터 레지스트리
 * - 프로토콜별 어댑터 등록/조회
 * - CarbonPluginRegistry와 별개 (블록체인 특화)
 */
class _BlockchainBridgeRegistry {
  private readonly _adapters = new Map<BlockchainProtocol, IBlockchainBridge>();

  register(adapter: IBlockchainBridge): void {
    this._adapters.set(adapter.protocol, adapter);
  }

  get(protocol: BlockchainProtocol): IBlockchainBridge | undefined {
    return this._adapters.get(protocol);
  }

  getOrThrow(protocol: BlockchainProtocol): IBlockchainBridge {
    const adapter = this._adapters.get(protocol);
    if (!adapter) {
      throw new Error(
        `블록체인 어댑터를 찾을 수 없습니다: ${protocol}. ` +
        `BlockchainBridgeRegistry.register(new YourAdapter())로 먼저 등록하세요.`
      );
    }
    return adapter;
  }

  list(): BlockchainProtocol[] {
    return Array.from(this._adapters.keys());
  }
}

const g = globalThis as typeof globalThis & {
  _blockchainBridgeRegistry?: _BlockchainBridgeRegistry;
};
if (!g._blockchainBridgeRegistry) {
  g._blockchainBridgeRegistry = new _BlockchainBridgeRegistry();
}
export const BlockchainBridgeRegistry = g._blockchainBridgeRegistry;

// ─── 온체인 소각 플러그인 ─────────────────────────────────────────────

/**
 * RETIRE 이벤트를 받아 자동으로 온체인 소각을 트리거하는 플러그인
 *
 * 사용 조건:
 * 1. `TenantCarbonWallet` 레코드 존재 (지갑 주소 등록)
 * 2. `CarbonTokenRecord` 레코드 존재 (이미 토큰화된 크레딧)
 * 3. 해당 프로토콜 어댑터가 `BlockchainBridgeRegistry`에 등록됨
 *
 * 등록 예시:
 * ```ts
 * CarbonPluginRegistry.register(new OnChainRetirementPlugin('toucan'));
 * ```
 */
export class OnChainRetirementPlugin implements ICarbonPlugin {
  readonly name: string;
  private readonly _protocol: BlockchainProtocol;

  constructor(protocol: BlockchainProtocol = 'custom') {
    this._protocol = protocol;
    this.name = `blockchain-retire-${protocol}`;
  }

  async onEvent(event: CarbonDomainEvent): Promise<void> {
    if (event.type !== 'RETIRE_CARBON_CREDIT') return;

    const bridge = BlockchainBridgeRegistry.get(this._protocol);
    if (!bridge) return;

    // 테넌트 지갑 조회
    const wallet = await db.tenantCarbonWallet.findUnique({
      where: { tenantId: event.tenantId },
    });
    if (!wallet?.isVerified) return;

    // 토큰 레코드 조회 (소각 대상)
    const tokenRecord = await db.carbonTokenRecord.findFirst({
      where: {
        tenantId: event.tenantId,
        registryId: event.registryId,
        onChainStatus: 'confirmed',
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!tokenRecord) return;

    try {
      await bridge.retireOnChain({
        tokenRecordId: tokenRecord.id,
        tenantId: event.tenantId,
        walletAddress: wallet.walletAddress,
        quantity: event.quantity,
        beneficiaryName: (event as any).beneficiaryCompany ?? '',
        retirementMessage: `소각 ID: ${(event as any).retirementId}`,
      });

      console.info(`[OnChainRetirement] 온체인 소각 완료 — ${event.ledgerEntryId}`);
    } catch (err) {
      console.error('[OnChainRetirement] 온체인 소각 실패 (오프체인 기록 유지)', err);
      // 온체인 실패는 오프체인 레코드에 영향 없음
    }
  }
}

// ─── 브릿지 상태 동기화 유틸 ─────────────────────────────────────────

/**
 * pending 상태인 토큰 레코드의 온체인 상태를 폴링하여 동기화
 * (Cron Job: /api/cron/sync-blockchain-status 에서 호출)
 */
export async function syncPendingTokenRecords(
  tenantId: string,
  protocol: BlockchainProtocol
): Promise<BridgeStatusUpdate[]> {
  const bridge = BlockchainBridgeRegistry.get(protocol);
  if (!bridge) return [];

  const pending = await db.carbonTokenRecord.findMany({
    where: {
      tenantId,
      onChainStatus: { in: ['pending', 'bridging'] },
      txHash: { not: null },
    },
    take: 50,
  });

  const updates: BridgeStatusUpdate[] = [];

  for (const record of pending) {
    try {
      const status = await bridge.syncStatus(record.txHash);
      if (status !== record.onChainStatus) {
        await db.carbonTokenRecord.update({
          where: { id: record.id },
          data: {
            onChainStatus: status,
            ...(status === 'confirmed' ? { bridgedAt: new Date() } : {}),
            ...(status === 'retired_on_chain' ? { retiredOnChainAt: new Date() } : {}),
          },
        });
        updates.push({ txHash: record.txHash, status });
      }
    } catch (err) {
      console.error(`[BlockchainSync] 동기화 실패: ${record.txHash}`, err);
    }
  }

  return updates;
}
