/**
 * KlimaDAO (Polygon) 블록체인 브릿지 어댑터
 *
 * ─── 개요 ────────────────────────────────────────────────────────────
 * KlimaDAO는 Polygon 기반 탄소 시장 DAO.
 * BCT/MCO2/UBO 등 탄소 풀 토큰을 KLIMA 토큰으로 교환/스테이킹.
 * Retire 기능: KlimaDAO의 Retirement Aggregator 사용.
 *
 * ─── 지원 토큰 ──────────────────────────────────────────────────────
 * - BCT  (Base Carbon Tonne): Toucan 기본 탄소 풀
 * - NCT  (Nature Carbon Tonne): Toucan 자연 기반 풀
 * - MCO2 (Moss Carbon Credit): Moss.Earth 토큰
 * - UBO  (Universal Base Offset): C3 Protocol
 * - NBO  (Nature Base Offset): C3 Protocol
 *
 * ─── 설치 필요 패키지 ────────────────────────────────────────────────
 * pnpm add ethers@^6
 * (선택) pnpm add @klimadao/sdk
 *
 * ─── 환경변수 ────────────────────────────────────────────────────────
 * POLYGON_RPC_URL              Polygon Mainnet RPC
 * CARBON_WALLET_PRIVATE_KEY    서버 서명 지갑 개인키 (HSM 권장)
 * KLIMADAO_DEFAULT_TOKEN       기본 탄소 토큰 (bct|nct|mco2|ubo, 기본: bct)
 */

import type { IBlockchainBridge } from '../blockchain-bridge.interface';
import type {
  BlockchainNetwork,
  BlockchainProtocol,
  TokenizeParams,
  TokenizeResult,
  RetireOnChainParams,
  RetireOnChainResult,
  OnChainStatus,
} from '../types';
import { prisma } from '@/lib/db/prisma';

const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

// ─── KlimaDAO 컨트랙트 주소 (Polygon Mainnet) ─────────────────────────

const KLIMA_CONTRACTS = {
  /** KlimaDAO Retirement Aggregator V2 (BCT/NCT/MCO2/UBO/NBO 통합 소각) */
  retirementAggregatorV2: '0x8cE54d9625371fb2a068986d32C85De8E6e995f8',

  /** 탄소 풀 토큰 주소 */
  tokens: {
    bct:  '0x2F800Db0fdb5223b3C3f354886d907A671414A7f',  // Base Carbon Tonne
    nct:  '0xD838290e877E0188a4A44700463419ED96c16107',  // Nature Carbon Tonne
    mco2: '0xAa7DbD1598251f856C12f63557A4C4397c253Cea',  // Moss Carbon Credit
    ubo:  '0x2B3eCb0991AF0498ECE9135bcD04013d7993110c',  // C3 UBO
    nbo:  '0x6BCa3B77C1909Ce1a4Ba1A20d1103bDe8d222E48',  // C3 NBO
  } as Record<string, string | undefined>,
} as const;

/** KlimaDAO RetirementAggregatorV2 최소 ABI */
const KLIMA_AGGREGATOR_ABI = [
  /** 특정 탄소 토큰으로 정확한 양 소각 */
  'function retireExactCarbonDefault(address _sourceToken, address _poolToken, uint256 _maxAmountIn, uint256 _retireAmount, string memory _entity, address _beneficiaryAddress, string memory _beneficiaryString, string memory _retirementMessage, uint8 _fromMode) external payable',
  /** 소각에 필요한 sourceToken 양 계산 */
  'function getSourceAmountDefaultRetirement(address _sourceToken, address _poolToken, uint256 _retireAmount) view returns (uint256)',
] as const;

// ─── KlimaDAO 어댑터 ──────────────────────────────────────────────────

export type KlimaTokenSymbol = 'bct' | 'nct' | 'mco2' | 'ubo' | 'nbo';

export interface KlimaAdapterConfig {
  rpcUrl: string;
  privateKey: string;
  defaultToken?: KlimaTokenSymbol;
  /** 가스 가격 한도 (gwei, 기본: 300) */
  maxGasPriceGwei?: number;
}

export class KlimaDAOAdapter implements IBlockchainBridge {
  readonly protocol: BlockchainProtocol = 'klimadao';
  readonly network: BlockchainNetwork   = 'polygon';

  private readonly _config: Required<KlimaAdapterConfig>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _ethers: any = null;

  constructor(config: KlimaAdapterConfig) {
    this._config = {
      defaultToken:    config.defaultToken   ?? 'bct',
      maxGasPriceGwei: config.maxGasPriceGwei ?? 300,
      rpcUrl:          config.rpcUrl,
      privateKey:      config.privateKey,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async _getEthers(): Promise<any> {
    if (!this._ethers) {
      try {
        this._ethers = await import('ethers' as string);
      } catch {
        throw new Error(
          '[KlimaDAOAdapter] ethers.js 미설치. ' +
          '`pnpm add ethers@^6` 후 재시작하세요.'
        );
      }
    }
    return this._ethers;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async _getSigner(): Promise<{ ethers: any; provider: any; signer: any }> {
    const ethers   = await this._getEthers();
    const provider = new ethers.JsonRpcProvider(this._config.rpcUrl);
    const signer   = new ethers.Wallet(this._config.privateKey, provider);
    return { ethers, provider, signer };
  }

  // ── IBlockchainBridge 구현 ─────────────────────────────────────────

  /**
   * 토큰화 — BCT/NCT 등 탄소 토큰을 DB에 기록.
   * KlimaDAO 자체 브릿지: Toucan TCO2 → BCT/NCT 풀 예치
   */
  async tokenize(params: TokenizeParams): Promise<TokenizeResult> {
    const { signer } = await this._getSigner();
    const tokenAddr: string = (KLIMA_CONTRACTS.tokens[this._config.defaultToken] ?? KLIMA_CONTRACTS.tokens.bct) as string;

    const tokenRecord = await db.carbonTokenRecord.create({
      data: {
        tenantId:          params.tenantId,
        registryId:        params.registryId,
        walletAddress:     params.walletAddress,
        tokenStandard:     params.tokenStandard,
        network:           this.network,
        protocol:          this.protocol,
        contractAddress:   tokenAddr,
        tokenizedQuantity: params.quantity,
        onChainStatus:     'pending',
        metadata: {
          klimaToken:   this._config.defaultToken,
          signerAddress: await signer.getAddress(),
          requestedAt:  new Date().toISOString(),
        },
      },
    });

    return {
      tokenRecordId:              tokenRecord.id,
      txHash:                     '0x0',
      contractAddress:            tokenAddr,
      estimatedConfirmationTime:  3600,
    };
  }

  /**
   * 온체인 소유권 검증.
   */
  async verifyOwnership(
    walletAddress: string,
    contractAddress: string,
    _tokenId?: string
  ): Promise<boolean> {
    const { ethers, provider } = await this._getSigner();
    const erc20 = new ethers.Contract(
      contractAddress,
      ['function balanceOf(address) view returns (uint256)'],
      provider
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const balance: any = await erc20.balanceOf(walletAddress);
    return BigInt(balance) > BigInt(0);
  }

  /**
   * 온체인 소각 — KlimaDAO RetirementAggregatorV2 사용.
   *
   * 소각 흐름:
   * 1. `getSourceAmountDefaultRetirement()` 로 필요 토큰량 계산
   * 2. 토큰 approve → AggregatorV2
   * 3. `retireExactCarbonDefault()` 호출 → 소각 + 인증서 발행
   */
  async retireOnChain(params: RetireOnChainParams): Promise<RetireOnChainResult> {
    const { ethers, signer } = await this._getSigner();

    const tokenRecord = await db.carbonTokenRecord.findFirst({
      where: { id: params.tokenRecordId, tenantId: params.tenantId },
    });
    if (!tokenRecord) {
      throw new Error(`[KlimaDAOAdapter] 토큰 레코드를 찾을 수 없습니다: ${params.tokenRecordId}`);
    }

    const tokenSymbol  = (tokenRecord.metadata as Record<string, unknown>)?.klimaToken as KlimaTokenSymbol ?? this._config.defaultToken;
    const tokenAddress = KLIMA_CONTRACTS.tokens[tokenSymbol] ?? KLIMA_CONTRACTS.tokens.bct;
    const aggregator   = new ethers.Contract(
      KLIMA_CONTRACTS.retirementAggregatorV2,
      KLIMA_AGGREGATOR_ABI,
      signer
    );

    const retireAmount = ethers.parseEther(String(params.quantity));

    // 1. 필요 소스 토큰량 계산
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requiredAmount: any = await aggregator.getSourceAmountDefaultRetirement(
      tokenAddress,
      tokenAddress,
      retireAmount
    );

    // 2. Approve (서버 지갑 → AggregatorV2)
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function approve(address spender, uint256 amount) returns (bool)'],
      signer
    );
    const approveTx = await tokenContract.approve(
      KLIMA_CONTRACTS.retirementAggregatorV2,
      requiredAmount
    );
    await approveTx.wait();

    // 3. 소각 실행
    // FromMode.EXTERNAL (0): 외부 지갑에서 직접 사용
    const retireTx = await aggregator.retireExactCarbonDefault(
      tokenAddress,                     // sourceToken
      tokenAddress,                     // poolToken
      requiredAmount,                   // maxAmountIn
      retireAmount,                     // retireAmount
      '탄소이음 EMS',                   // entity
      params.walletAddress,             // beneficiaryAddress
      params.beneficiaryName,           // beneficiaryString
      params.retirementMessage ?? 'Carbon offset via 탄소이음 EMS',
      0                                 // fromMode: EXTERNAL
    );
    const receipt = await retireTx.wait();
    const txHash: string = (receipt?.hash ?? retireTx.hash) as string;

    // 4. DB 업데이트
    await db.carbonTokenRecord.update({
      where: { id: params.tokenRecordId },
      data: {
        onChainStatus:    'retired_on_chain',
        retiredOnChainAt: new Date(),
        txHash,
        metadata: {
          ...((tokenRecord.metadata as Record<string, unknown>) ?? {}),
          retiredBy:         await signer.getAddress(),
          beneficiaryName:   params.beneficiaryName,
          retirementMessage: params.retirementMessage ?? '',
          klimaToken:        tokenSymbol,
          blockNumber:       receipt?.blockNumber,
        },
      },
    });

    console.info(
      `[KlimaDAOAdapter] 온체인 소각 완료: ${params.quantity} tCO2e (${tokenSymbol}), txHash=${txHash}`
    );

    return {
      txHash,
      retirementNFTId:       `KLIMA-RETIRE-${Date.now()}`,
      onChainCertificateUrl: `https://www.klimadao.finance/retirements/${await signer.getAddress()}`,
      retiredAt:             new Date().toISOString(),
    };
  }

  /**
   * 온체인 잔량 조회.
   */
  async getOnChainBalance(
    walletAddress: string,
    contractAddress: string
  ): Promise<number> {
    const { ethers, provider } = await this._getSigner();
    const erc20 = new ethers.Contract(
      contractAddress,
      ['function balanceOf(address) view returns (uint256)'],
      provider
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const balance: any = await erc20.balanceOf(walletAddress);
    return Number(ethers.formatEther(balance));
  }

  /**
   * 트랜잭션 상태 조회.
   */
  async syncStatus(txHash: string): Promise<OnChainStatus> {
    if (!txHash || txHash === '0x0') return 'pending';

    try {
      const { provider } = await this._getSigner();
      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt) return 'syncing';
      return receipt.status === 1 ? 'confirmed' : 'failed';
    } catch {
      return 'syncing';
    }
  }
}

// ─── 팩토리 ───────────────────────────────────────────────────────────

/**
 * 환경변수 기반 KlimaDAOAdapter 생성.
 */
export function createKlimaDAOAdapter(): KlimaDAOAdapter | null {
  const rpcUrl     = process.env.POLYGON_RPC_URL;
  const privateKey = process.env.CARBON_WALLET_PRIVATE_KEY;

  if (!rpcUrl || !privateKey) return null;

  const defaultToken = (process.env.KLIMADAO_DEFAULT_TOKEN ?? 'bct') as KlimaTokenSymbol;
  const maxGasPriceGwei = Number(process.env.KLIMADAO_MAX_GAS_PRICE_GWEI ?? '300');

  return new KlimaDAOAdapter({ rpcUrl, privateKey, defaultToken, maxGasPriceGwei });
}
