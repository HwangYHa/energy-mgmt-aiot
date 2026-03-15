/**
 * 블록체인 탄소 크레딧 토큰화 — 타입 정의
 *
 * 지원 토큰 표준:
 * - ERC-20: 균질화 가능한 탄소 토큰 (ex: TCO2, MCO2)
 * - ERC-1155: 반균질화 — 동일 프로젝트/빈티지 배치별 토큰
 * - ERC-721: NFT — 개별 직렬번호 인증
 * - SPL: Solana Program Library (Solana 블록체인)
 *
 * 지원 레지스트리/프로토콜:
 * - Toucan Protocol (Polygon): TCO2 토큰
 * - KlimaDAO (Polygon): KLIMA 거버넌스 + BCT/NCT 풀
 * - C3 Protocol (Polygon): UBO/NBO 풀
 * - Moss.Earth (Polygon/ETH): MCO2 토큰
 * - Regen Network (Cosmos): ecocredits
 *
 * 멀티테넌트 아키텍처:
 * - TenantCarbonWallet: 테넌트별 단일 지갑 주소
 * - CarbonTokenRecord: 레지스트리별 토큰화 기록
 */

// ─── 토큰 표준 / 네트워크 ─────────────────────────────────────────────

export type TokenStandard = 'ERC-20' | 'ERC-1155' | 'ERC-721' | 'SPL' | 'CUSTOM';

export type BlockchainNetwork =
  | 'ethereum'       // ETH Mainnet
  | 'polygon'        // Polygon PoS (Toucan, KlimaDAO, C3)
  | 'celo'           // Celo (저렴한 탄소 거래)
  | 'solana'         // Solana SPL
  | 'cosmos'         // Regen Network
  | 'other';

export type OnChainStatus =
  | 'pending'          // 토큰화 요청 대기
  | 'confirmed'        // 온체인 확인 완료
  | 'bridging'         // 브릿지 진행 중 (off-chain → on-chain)
  | 'retired_on_chain' // 온체인 소각 완료
  | 'failed'           // 트랜잭션 실패
  | 'syncing';         // 오프라인 레코드와 동기화 중

// ─── 프로토콜 어댑터 식별자 ──────────────────────────────────────────

export type BlockchainProtocol =
  | 'toucan'     // Toucan Protocol (Polygon) — TCO2/BCT/NCT
  | 'klimadao'   // KlimaDAO (Polygon) — KLIMA staking
  | 'c3'         // C3 Protocol (Polygon) — UBO/NBO
  | 'moss'       // Moss.Earth — MCO2
  | 'regen'      // Regen Network (Cosmos)
  | 'custom';    // 자체 구현 브릿지

// ─── 토큰 레코드 ─────────────────────────────────────────────────────

export interface TokenRecord {
  id: string;
  tenantId: string;
  registryId: string;           // CarbonCreditRegistry.id
  walletAddress: string;
  tokenStandard: TokenStandard;
  network: BlockchainNetwork;
  protocol: BlockchainProtocol;
  contractAddress: string;
  tokenId?: string;             // ERC-1155 / ERC-721
  tokenizedQuantity: number;    // tCO2e
  onChainStatus: OnChainStatus;
  txHash?: string;              // 민팅/브릿지 트랜잭션 해시
  blockNumber?: number;
  bridgedAt?: string;           // ISO
  retiredOnChainAt?: string;    // ISO — 소각 시각
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TenantCarbonWallet {
  id: string;
  tenantId: string;
  network: BlockchainNetwork;
  walletAddress: string;
  isVerified: boolean;
  verifiedAt?: string;
  createdAt: string;
}

// ─── 오퍼레이션 파라미터 ─────────────────────────────────────────────

export interface TokenizeParams {
  tenantId: string;
  registryId: string;
  quantity: number;             // 토큰화할 tCO2e
  walletAddress: string;
  tokenStandard: TokenStandard;
  network: BlockchainNetwork;
  protocol: BlockchainProtocol;
  /** 프로젝트 속성 (Toucan TCO2 민팅 시 필요) */
  attributes?: {
    projectId?: string;
    vintageYear?: number;
    methodology?: string;
  };
}

export interface TokenizeResult {
  tokenRecordId: string;
  txHash: string;
  contractAddress: string;
  tokenId?: string;
  estimatedConfirmationTime: number; // seconds
}

export interface RetireOnChainParams {
  tokenRecordId: string;
  tenantId: string;
  walletAddress: string;
  quantity: number;
  beneficiaryName: string;
  retirementMessage?: string;
  /** K-ETS 연동 시 KETS 소각 참조 번호 */
  ketsReference?: string;
}

export interface RetireOnChainResult {
  txHash: string;
  retirementNFTId?: string;  // Toucan retirement NFT
  onChainCertificateUrl?: string;
  retiredAt: string;
}

// ─── 브릿지 상태 ─────────────────────────────────────────────────────

export interface BridgeStatusUpdate {
  txHash: string;
  status: OnChainStatus;
  blockNumber?: number;
  confirmedAt?: string;
  error?: string;
}
