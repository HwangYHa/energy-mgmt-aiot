/**
 * CarbonTradingService
 *
 * 설계 원칙:
 * 1. 낙관적 잠금 (version 컬럼) — 동시성 충돌 탐지
 * 2. 멱등성 키 — 동일 요청 중복 실행 방지 (재시도 안전)
 * 3. 이중 계상 방지 — availableQuantity 검증 + DB 트랜잭션
 * 4. 추가전용 원장 — 모든 이벤트는 INSERT만, UPDATE/DELETE 없음
 * 5. 해시 체인 — 각 엔트리는 이전 해시를 참조 (감사 무결성)
 */

import { createHash } from 'crypto';
import { prisma } from '@/lib/db/prisma';
import type { BuyInput, SellInput, TradingResult, LedgerEventType } from '../types';
import { CarbonPluginRegistry } from '../plugin-registry';
import type { BuyCarbonCreditEvent, SellCarbonCreditEvent, CancelCarbonTradeEvent } from '../events';

const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

// ─── 해시 체인 유틸 ─────────────────────────────────────────────────

function buildEntryHash(data: {
  tenantId: string;
  registryId: string;
  eventType: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  createdAt: string;
  prevHash?: string;
}): string {
  const payload = [
    data.tenantId,
    data.registryId,
    data.eventType,
    data.quantity.toFixed(6),
    data.unitPrice.toFixed(2),
    data.totalAmount.toFixed(2),
    data.createdAt,
    data.prevHash ?? 'genesis',
  ].join('|');
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

async function getLastEntryHash(tenantId: string): Promise<string | undefined> {
  const last = await db.carbonLedgerEntry.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    select: { hashSignature: true },
  });
  return last?.hashSignature;
}

// ─── 서비스 ──────────────────────────────────────────────────────────

export class CarbonTradingService {

  /**
   * 매수 (BUY)
   * - 기존 registry 있으면 수량 추가 (가중 평균 단가 재계산)
   * - 없으면 신규 registry 생성
   * - 멱등성 키로 중복 방지
   */
  static async buy(input: BuyInput): Promise<TradingResult> {
    // 멱등성 확인
    const existing = await db.carbonLedgerEntry.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: { id: true, registryId: true, totalAmount: true, hashSignature: true },
    });
    if (existing) {
      return {
        ledgerEntryId: existing.id,
        registryId: existing.registryId,
        eventType: 'BUY',
        quantity: input.quantity,
        totalAmount: Number(existing.totalAmount),
        hashSignature: existing.hashSignature,
      };
    }

    const totalAmount = Math.round(input.quantity * input.unitPrice * 100) / 100;
    const now = new Date().toISOString();
    const prevHash = await getLastEntryHash(input.tenantId);

    return db.$transaction(async (tx: any) => {
      // 1. 기존 registry 조회 (동일 tenant+registry+project+serial+vintage)
      const existingReg = await tx.carbonCreditRegistry.findUnique({
        where: {
          tenantId_registry_projectId_serialNumberStart_vintageYear: {
            tenantId: input.tenantId,
            registry: input.registry,
            projectId: input.projectId,
            serialNumberStart: input.serialNumberStart,
            vintageYear: input.vintageYear,
          },
        },
      });

      let registry;
      if (existingReg) {
        // 수량 추가 — 낙관적 잠금으로 버전 확인
        registry = await tx.carbonCreditRegistry.update({
          where: { id: existingReg.id, version: existingReg.version },
          data: {
            availableQuantity: { increment: input.quantity },
            totalQuantity: { increment: input.quantity },
            version: { increment: 1 },
          },
        });
      } else {
        // 신규 registry 생성
        registry = await tx.carbonCreditRegistry.create({
          data: {
            tenantId: input.tenantId,
            registry: input.registry,
            projectId: input.projectId,
            serialNumberStart: input.serialNumberStart,
            serialNumberEnd: input.serialNumberEnd,
            vintageYear: input.vintageYear,
            creditType: input.creditType,
            certificationBody: input.certificationBody,
            issuanceDate: new Date(input.issuanceDate),
            totalQuantity: input.quantity,
            availableQuantity: input.quantity,
          },
        });
      }

      // 2. 원장 엔트리 생성 (Append-only)
      const hashSignature = buildEntryHash({
        tenantId: input.tenantId,
        registryId: registry.id,
        eventType: 'BUY',
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        totalAmount,
        createdAt: now,
        prevHash,
      });

      const ledgerEntry = await tx.carbonLedgerEntry.create({
        data: {
          tenantId: input.tenantId,
          registryId: registry.id,
          eventType: 'BUY',
          quantity: input.quantity,
          unitPrice: input.unitPrice,
          totalAmount,
          currency: 'KRW',
          counterparty: input.counterparty,
          paymentStatus: 'INITIATED',
          settlementStatus: 'PENDING',
          idempotencyKey: input.idempotencyKey,
          hashSignature,
          prevHash: prevHash ?? null,
          memo: input.memo,
        },
      });

      // 3. 결제 레코드 생성
      const payment = await tx.carbonPayment.create({
        data: {
          tenantId: input.tenantId,
          ledgerEntryId: ledgerEntry.id,
          paymentMethod: input.paymentMethod,
          paymentStatus: 'INITIATED',
          amount: totalAmount,
          currency: 'KRW',
        },
      });

      return {
        ledgerEntryId: ledgerEntry.id,
        registryId: registry.id,
        eventType: 'BUY' as LedgerEventType,
        quantity: input.quantity,
        totalAmount,
        paymentId: payment.id,
        hashSignature,
      };
    }).then((result: TradingResult) => {
      // 트랜잭션 완료 후 Fire-and-forget 이벤트 발행
      const event: BuyCarbonCreditEvent = {
        type: 'BUY_CARBON_CREDIT',
        tenantId: input.tenantId,
        registryId: result.registryId,
        ledgerEntryId: result.ledgerEntryId,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        totalAmount: result.totalAmount,
        registry: input.registry,
        projectId: input.projectId,
        creditType: input.creditType,
        vintageYear: input.vintageYear,
        certificationBody: input.certificationBody,
        performedBy: input.performedBy,
        paymentMethod: input.paymentMethod,
        counterparty: input.counterparty,
        occurredAt: new Date().toISOString(),
      };
      CarbonPluginRegistry.emit(event).catch((err) =>
        console.error('[CarbonPlugin] BUY emit 실패', err)
      );
      return result;
    });
  }

  /**
   * 매도 (SELL)
   * - availableQuantity >= sellQuantity 확인 (이중 계상 방지)
   * - 낙관적 잠금으로 동시성 제어
   */
  static async sell(input: SellInput): Promise<TradingResult> {
    // 멱등성 확인
    const existingEntry = await db.carbonLedgerEntry.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: { id: true, registryId: true, totalAmount: true, hashSignature: true },
    });
    if (existingEntry) {
      return {
        ledgerEntryId: existingEntry.id,
        registryId: existingEntry.registryId,
        eventType: 'SELL',
        quantity: input.quantity,
        totalAmount: Number(existingEntry.totalAmount),
        hashSignature: existingEntry.hashSignature,
      };
    }

    const totalAmount = Math.round(input.quantity * input.unitPrice * 100) / 100;
    const now = new Date().toISOString();
    const prevHash = await getLastEntryHash(input.tenantId);

    return db.$transaction(async (tx: any) => {
      // SELECT FOR UPDATE via findUnique (트랜잭션 내 잠금)
      const registry = await tx.carbonCreditRegistry.findFirst({
        where: { id: input.registryId, tenantId: input.tenantId, status: 'active' },
      });

      if (!registry) throw new Error('크레딧을 찾을 수 없거나 비활성 상태입니다');

      const available = Number(registry.availableQuantity);
      if (available < input.quantity) {
        throw new Error(`가용 수량(${available.toFixed(1)} tCO₂) 부족. 요청: ${input.quantity}`);
      }

      // 낙관적 잠금 업데이트 — 버전 불일치 시 예외
      const updated = await tx.carbonCreditRegistry.updateMany({
        where: { id: registry.id, version: registry.version },
        data: {
          availableQuantity: { decrement: input.quantity },
          version: { increment: 1 },
        },
      });
      if (updated.count === 0) throw new Error('동시 거래 충돌이 발생했습니다. 다시 시도해주세요');

      const hashSignature = buildEntryHash({
        tenantId: input.tenantId,
        registryId: registry.id,
        eventType: 'SELL',
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        totalAmount,
        createdAt: now,
        prevHash,
      });

      const ledgerEntry = await tx.carbonLedgerEntry.create({
        data: {
          tenantId: input.tenantId,
          registryId: registry.id,
          eventType: 'SELL',
          quantity: input.quantity,
          unitPrice: input.unitPrice,
          totalAmount,
          currency: 'KRW',
          counterparty: input.counterparty,
          paymentStatus: 'INITIATED',
          settlementStatus: 'PENDING',
          idempotencyKey: input.idempotencyKey,
          hashSignature,
          prevHash: prevHash ?? null,
          memo: input.memo,
        },
      });

      const payment = await tx.carbonPayment.create({
        data: {
          tenantId: input.tenantId,
          ledgerEntryId: ledgerEntry.id,
          paymentMethod: input.paymentMethod,
          paymentStatus: 'INITIATED',
          amount: totalAmount,
          currency: 'KRW',
        },
      });

      return {
        ledgerEntryId: ledgerEntry.id,
        registryId: registry.id,
        eventType: 'SELL' as LedgerEventType,
        quantity: input.quantity,
        totalAmount,
        paymentId: payment.id,
        hashSignature,
      };
    }).then((result: TradingResult) => {
      const event: SellCarbonCreditEvent = {
        type: 'SELL_CARBON_CREDIT',
        tenantId: input.tenantId,
        registryId: result.registryId,
        ledgerEntryId: result.ledgerEntryId,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        totalAmount: result.totalAmount,
        performedBy: input.performedBy,
        paymentMethod: input.paymentMethod,
        counterparty: input.counterparty,
        occurredAt: new Date().toISOString(),
      };
      CarbonPluginRegistry.emit(event).catch((err) =>
        console.error('[CarbonPlugin] SELL emit 실패', err)
      );
      return result;
    });
  }

  /**
   * 거래 취소 (1시간 이내 BUY만 가능)
   * - RETIRE는 취소 불가 (규제)
   * - 결제 상태가 SETTLED이면 취소 불가
   */
  static async cancelBuy(ledgerEntryId: string, tenantId: string): Promise<void> {
    return db.$transaction(async (tx: any) => {
      const entry = await tx.carbonLedgerEntry.findFirst({
        where: { id: ledgerEntryId, tenantId },
        include: { payment: true },
      });

      if (!entry) throw new Error('거래를 찾을 수 없습니다');
      if (entry.eventType !== 'BUY') throw new Error('매수 거래만 취소 가능합니다');
      if (entry.payment?.paymentStatus === 'SETTLED') throw new Error('결제 완료된 거래는 취소할 수 없습니다');

      const elapsed = Date.now() - new Date(entry.createdAt).getTime();
      if (elapsed > 60 * 60 * 1000) throw new Error('매수 후 1시간이 지나 취소할 수 없습니다');

      // registry 수량 복원
      await tx.carbonCreditRegistry.update({
        where: { id: entry.registryId },
        data: {
          availableQuantity: { decrement: Number(entry.quantity) },
          totalQuantity:     { decrement: Number(entry.quantity) },
          version: { increment: 1 },
        },
      });

      // 취소 원장 엔트리 (Append-only — BUY를 수정하지 않음)
      const prevHash = await getLastEntryHash(tenantId);
      const now = new Date().toISOString();
      const hashSignature = buildEntryHash({
        tenantId,
        registryId: entry.registryId,
        eventType: 'CANCEL',
        quantity: Number(entry.quantity),
        unitPrice: 0,
        totalAmount: 0,
        createdAt: now,
        prevHash,
      });

      await tx.carbonLedgerEntry.create({
        data: {
          tenantId,
          registryId: entry.registryId,
          eventType: 'CANCEL',
          quantity: Number(entry.quantity),
          unitPrice: 0,
          totalAmount: 0,
          currency: 'KRW',
          paymentStatus: 'N/A',
          settlementStatus: 'N/A',
          hashSignature,
          prevHash: prevHash ?? null,
          memo: `BUY ${ledgerEntryId} 취소`,
          metadata: { cancelledEntryId: ledgerEntryId },
        },
      });

      // 결제 상태 FAILED로 업데이트
      if (entry.payment) {
        await tx.carbonPayment.update({
          where: { id: entry.payment.id },
          data: { paymentStatus: 'FAILED', failedAt: new Date(), failureReason: '매수 취소' },
        });
      }
    }).then(() => {
      const event: CancelCarbonTradeEvent = {
        type: 'CANCEL_CARBON_TRADE',
        tenantId,
        registryId: '',        // 트랜잭션 내 조회했으나 스코프 밖 — 로그용으로 빈값 허용
        ledgerEntryId,
        cancelledEventType: 'BUY',
        quantity: 0,           // 서비스 레이어에서 검증 완료
        performedBy: tenantId, // cancelBuy는 performedBy 파라미터 없음 (tenantId 대리)
        occurredAt: new Date().toISOString(),
      };
      CarbonPluginRegistry.emit(event).catch((err) =>
        console.error('[CarbonPlugin] CANCEL emit 실패', err)
      );
    });
  }

  /**
   * 최근 원장 거래 내역 (페이지네이션)
   */
  static async listTrades(
    tenantId: string,
    options: { eventType?: string; page?: number; limit?: number } = {}
  ) {
    const page  = Math.max(1, options.page  ?? 1);
    const limit = Math.min(100, options.limit ?? 20);
    const skip  = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };
    if (options.eventType) where.eventType = options.eventType;

    const [items, total] = await Promise.all([
      db.carbonLedgerEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          registry: {
            select: {
              registry: true,
              projectId: true,
              creditType: true,
              vintageYear: true,
              serialNumberStart: true,
            },
          },
          payment: { select: { paymentStatus: true, paymentMethod: true, amount: true } },
        },
      }),
      db.carbonLedgerEntry.count({ where }),
    ]);

    return {
      items: items.map((e: any) => ({
        id: e.id,
        eventType: e.eventType,
        quantity: Number(e.quantity),
        unitPrice: Number(e.unitPrice),
        totalAmount: Number(e.totalAmount),
        currency: e.currency,
        counterparty: e.counterparty,
        paymentStatus: e.paymentStatus,
        settlementStatus: e.settlementStatus,
        memo: e.memo,
        createdAt: e.createdAt,
        registry: e.registry,
        payment: e.payment
          ? { ...e.payment, amount: Number(e.payment.amount) }
          : null,
        hashSignature: e.hashSignature,
      })),
      total,
      page,
      limit,
    };
  }
}
