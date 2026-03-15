/**
 * Carbon Trading v2 — 도메인 타입 정의
 *
 * 설계 원칙:
 * - CarbonCreditRegistry: 법적 자산 레코드 (불변)
 * - CarbonLedgerEntry: 모든 이벤트의 추가전용 원장 (Event Sourcing)
 * - 포트폴리오는 원장 집계로 계산 (파생 상태)
 * - 소각 인증서는 규제 증거 문서
 */

// ─── 레지스트리 ─────────────────────────────────────────────────────

export type CarbonRegistry = 'K-ETS' | 'Verra' | 'GoldStandard' | 'CDM' | 'J-Credit' | 'OTHER';

export type CreditType = 'KAU' | 'KCU' | 'OFFSET' | 'VER' | 'GS-VER' | 'CER';

export interface CreditRegistryRecord {
  id: string;
  tenantId: string;
  registry: CarbonRegistry;
  projectId: string;
  serialNumberStart: string;
  serialNumberEnd: string;
  vintageYear: number;
  creditType: CreditType;
  certificationBody: string;
  issuanceDate: string;       // ISO date
  totalQuantity: number;
  availableQuantity: number;
  retiredQuantity: number;
  lockedQuantity: number;
  version: number;
  status: 'active' | 'retired' | 'cancelled';
  createdAt: string;
}

// ─── 원장 이벤트 ────────────────────────────────────────────────────

export type LedgerEventType = 'BUY' | 'SELL' | 'RETIRE' | 'LOCK' | 'UNLOCK' | 'CANCEL';

export type PaymentStatus = 'N/A' | 'INITIATED' | 'PENDING' | 'SETTLED' | 'FAILED';
export type SettlementStatus = 'N/A' | 'PENDING' | 'SETTLED' | 'DISPUTED';

export interface LedgerEntry {
  id: string;
  tenantId: string;
  registryId: string;
  eventType: LedgerEventType;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  currency: string;
  counterparty?: string;
  paymentStatus: PaymentStatus;
  settlementStatus: SettlementStatus;
  idempotencyKey?: string;
  hashSignature: string;
  prevHash?: string;
  memo?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// ─── 포트폴리오 ─────────────────────────────────────────────────────

export interface PortfolioPosition {
  registryId: string;
  registry: CarbonRegistry;
  projectId: string;
  creditType: CreditType;
  vintageYear: number;
  availableQuantity: number;
  retiredQuantity: number;
  weightedAvgCost: number;  // WAC — 가중 평균 단가
  marketPrice: number;
  unrealizedPnl: number;    // 평가 손익
  realizedPnl: number;      // 실현 손익
  totalCost: number;
  marketValue: number;
  // 추가 메타
  serialNumberStart: string;
  certificationBody: string;
}

export interface CarbonPortfolio {
  tenantId: string;
  calculatedAt: string;
  positions: PortfolioPosition[];
  summary: {
    totalPositions: number;
    totalAvailableQuantity: number;
    totalRetiredQuantity: number;
    totalCost: number;
    totalMarketValue: number;
    totalUnrealizedPnl: number;
    totalRealizedPnl: number;
    marketPrice: number;
  };
}

// ─── 거래 입력 ───────────────────────────────────────────────────────

export interface BuyInput {
  tenantId: string;
  performedBy: string;
  idempotencyKey: string;
  // 레지스트리 정보 (신규 크레딧)
  registry: CarbonRegistry;
  projectId: string;
  serialNumberStart: string;
  serialNumberEnd: string;
  vintageYear: number;
  creditType: CreditType;
  certificationBody: string;
  issuanceDate: string;
  // 거래 조건
  quantity: number;
  unitPrice: number;
  counterparty?: string;
  paymentMethod: 'bank_transfer' | 'pg' | 'escrow';
  memo?: string;
}

export interface SellInput {
  tenantId: string;
  registryId: string;
  performedBy: string;
  idempotencyKey: string;
  quantity: number;
  unitPrice: number;
  counterparty?: string;
  paymentMethod: 'bank_transfer' | 'pg' | 'escrow';
  memo?: string;
}

export interface RetireInput {
  tenantId: string;
  registryId: string;
  performedBy: string;
  idempotencyKey: string;
  quantity: number;
  retirementReason: string;
  beneficiaryCompany: string;
  offsetScope?: 'scope1' | 'scope2' | 'scope3';
  compliancePeriod?: string;    // "2025"
  registryReference?: string;
  memo?: string;
}

// ─── 소각 인증서 ─────────────────────────────────────────────────────

export interface RetirementCertificate {
  id: string;
  retirementId: string;           // RET-YYYYMMDD-NNNNN
  tenantId: string;
  registry: CarbonRegistry;
  projectId: string;
  creditType: CreditType;
  vintageYear: number;
  serialNumbers: string[];
  retiredQuantity: number;
  retirementReason: string;
  beneficiaryCompany: string;
  retirementDate: string;
  registryReference?: string;
  certificatePdfUrl?: string;
  offsetScope?: string;
  compliancePeriod?: string;
  ketsSubmissionId?: string;
  createdAt: string;
}

// ─── 결제 ────────────────────────────────────────────────────────────

export interface PaymentRecord {
  id: string;
  ledgerEntryId: string;
  paymentMethod: 'bank_transfer' | 'pg' | 'escrow';
  paymentStatus: PaymentStatus;
  amount: number;
  currency: string;
  pgProvider?: string;
  pgTransactionId?: string;
  bankRefNumber?: string;
  initiatedAt: string;
  settledAt?: string;
  failedAt?: string;
  failureReason?: string;
}

// ─── 서비스 응답 ──────────────────────────────────────────────────────

export interface TradingResult {
  ledgerEntryId: string;
  registryId: string;
  eventType: LedgerEventType;
  quantity: number;
  totalAmount: number;
  paymentId?: string;
  hashSignature: string;
}

export interface RetirementResult {
  ledgerEntryId: string;
  certificate: RetirementCertificate;
}
