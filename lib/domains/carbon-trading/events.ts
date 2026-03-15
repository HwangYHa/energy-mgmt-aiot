/**
 * Carbon Trading — 도메인 이벤트 정의
 *
 * 설계 원칙:
 * - 불변(Immutable): 이벤트는 과거에 일어난 사실 (동사 과거형)
 * - Append-only: 이벤트는 수정/삭제 없이 누적만
 * - 도메인 경계: 이벤트는 순수 데이터 — 인프라 의존 없음
 *
 * 확장 가능성:
 * - VCM: BUY/RETIRE 이벤트에 projectCategory, sdgGoals 추가
 * - 블록체인: RETIRE 이벤트로 온체인 소각 트리거
 * - XBRL: RETIRE 이벤트로 자동 XBRL 요소 생성
 * - ESG Bridge: RETIRE 이벤트로 ESG 보고서 탄소 상쇄 자동 반영
 */

import type { CarbonRegistry, CreditType, LedgerEventType } from './types';

// ─── 이벤트 기반 ─────────────────────────────────────────────────────

export interface BaseCarbonEvent {
  /** 이벤트 유형 식별자 */
  type: string;
  /** 테넌트 격리 */
  tenantId: string;
  /** 이벤트 발생 시각 (ISO 8601) */
  occurredAt: string;
  /** 원장 엔트리 ID (추적용) */
  ledgerEntryId: string;
  /** 크레딧 레지스트리 ID */
  registryId: string;
}

// ─── 구체 이벤트 ─────────────────────────────────────────────────────

export interface BuyCarbonCreditEvent extends BaseCarbonEvent {
  type: 'BUY_CARBON_CREDIT';
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  registry: CarbonRegistry;
  projectId: string;
  creditType: CreditType;
  vintageYear: number;
  certificationBody: string;
  performedBy: string;
  paymentMethod: 'bank_transfer' | 'pg' | 'escrow';
  counterparty?: string;
  // VCM 확장 필드 (선택적)
  vcmProjectId?: string;
}

export interface SellCarbonCreditEvent extends BaseCarbonEvent {
  type: 'SELL_CARBON_CREDIT';
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  performedBy: string;
  paymentMethod: 'bank_transfer' | 'pg' | 'escrow';
  counterparty?: string;
}

export interface RetireCarbonCreditEvent extends BaseCarbonEvent {
  type: 'RETIRE_CARBON_CREDIT';
  quantity: number;
  retirementId: string;           // RET-YYYYMMDD-NNNNN
  retirementReason: string;
  beneficiaryCompany: string;
  offsetScope?: 'scope1' | 'scope2' | 'scope3';
  compliancePeriod?: string;      // "2025"
  registryReference?: string;
  registry: CarbonRegistry;
  projectId: string;
  creditType: CreditType;
  vintageYear: number;
  performedBy: string;
  hashSignature: string;          // 소각 원장 해시 (무결성 증빙)
  // 블록체인 확장: 온체인 소각 트리거용
  walletAddress?: string;
}

export interface CancelCarbonTradeEvent extends BaseCarbonEvent {
  type: 'CANCEL_CARBON_TRADE';
  cancelledEventType: LedgerEventType;
  quantity: number;
  performedBy: string;
  reason?: string;
}

// ─── 유니온 타입 ──────────────────────────────────────────────────────

export type CarbonDomainEvent =
  | BuyCarbonCreditEvent
  | SellCarbonCreditEvent
  | RetireCarbonCreditEvent
  | CancelCarbonTradeEvent;

// ─── 이벤트 타입 가드 ─────────────────────────────────────────────────

export function isBuyEvent(e: CarbonDomainEvent): e is BuyCarbonCreditEvent {
  return e.type === 'BUY_CARBON_CREDIT';
}

export function isSellEvent(e: CarbonDomainEvent): e is SellCarbonCreditEvent {
  return e.type === 'SELL_CARBON_CREDIT';
}

export function isRetireEvent(e: CarbonDomainEvent): e is RetireCarbonCreditEvent {
  return e.type === 'RETIRE_CARBON_CREDIT';
}
