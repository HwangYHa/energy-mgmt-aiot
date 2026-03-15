/**
 * CarbonPortfolioService
 *
 * 원장 기반 포트폴리오 계산 엔진
 * - 파생 상태: CarbonCreditRegistry를 기반으로 집계
 * - 원장(CarbonLedgerEntry)에서 실현 손익 계산
 * - 가중 평균 단가(WAC)는 BUY 이벤트 집계
 * - mark-to-market: 시장가로 평가 손익 계산
 */

import { prisma } from '@/lib/db/prisma';
import type { CarbonPortfolio, PortfolioPosition } from '../types';

const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

/** DB에서 최신 시장 가격 조회 (없으면 env → 기본값 순으로 폴백) */
async function getMarketPrice(market = 'KETS'): Promise<number> {
  try {
    const row = await db.carbonMarketPrice.findFirst({
      where: { market },
      orderBy: { priceDate: 'desc' },
      select: { price: true },
    });
    if (row) return Number(row.price);
  } catch {
    // DB 미마이그레이션 환경(개발) 폴백
  }
  return Number(process.env.KETS_MARKET_PRICE ?? 8500);
}

export class CarbonPortfolioService {

  /**
   * 테넌트 전체 포트폴리오 계산
   */
  static async calculate(tenantId: string): Promise<CarbonPortfolio> {
    // 0. DB에서 최신 시장 가격 조회
    const marketPriceKrw = await getMarketPrice('KETS');

    // 1. 활성 레지스트리 조회
    const registries = await db.carbonCreditRegistry.findMany({
      where: { tenantId, status: 'active' },
      orderBy: [{ vintageYear: 'desc' }, { creditType: 'asc' }],
    });

    // 2. 각 레지스트리의 BUY 원장에서 WAC 계산
    const positions: PortfolioPosition[] = await Promise.all(
      registries.map((reg: any) => CarbonPortfolioService._buildPosition(reg, marketPriceKrw))
    );

    // 3. 집계 요약
    const summary = positions.reduce(
      (acc, pos) => ({
        ...acc,
        totalAvailableQuantity: acc.totalAvailableQuantity + pos.availableQuantity,
        totalRetiredQuantity:   acc.totalRetiredQuantity   + pos.retiredQuantity,
        totalCost:              acc.totalCost              + pos.totalCost,
        totalMarketValue:       acc.totalMarketValue       + pos.marketValue,
        totalUnrealizedPnl:     acc.totalUnrealizedPnl     + pos.unrealizedPnl,
        totalRealizedPnl:       acc.totalRealizedPnl       + pos.realizedPnl,
      }),
      {
        totalPositions: positions.length,
        totalAvailableQuantity: 0,
        totalRetiredQuantity: 0,
        totalCost: 0,
        totalMarketValue: 0,
        totalUnrealizedPnl: 0,
        totalRealizedPnl: 0,
        marketPrice: marketPriceKrw,
      }
    );

    return {
      tenantId,
      calculatedAt: new Date().toISOString(),
      positions,
      summary,
    };
  }

  private static async _buildPosition(reg: any, marketPriceKrw: number): Promise<PortfolioPosition> {
    // BUY 원장에서 가중 평균 단가 계산
    const buyEntries = await db.carbonLedgerEntry.findMany({
      where: { registryId: reg.id, eventType: 'BUY' },
      select: { quantity: true, unitPrice: true, totalAmount: true },
    });

    // SELL 원장에서 실현 손익 계산 (FIFO 근사 — SELL 시 WAC 적용)
    const sellEntries = await db.carbonLedgerEntry.findMany({
      where: { registryId: reg.id, eventType: 'SELL' },
      select: { quantity: true, unitPrice: true, totalAmount: true },
    });

    const totalBoughtQty = buyEntries.reduce((s: number, e: any) => s + Number(e.quantity), 0);
    const totalBoughtCost = buyEntries.reduce((s: number, e: any) => s + Number(e.totalAmount), 0);
    const wac = totalBoughtQty > 0 ? totalBoughtCost / totalBoughtQty : 0;

    const totalSoldQty = sellEntries.reduce((s: number, e: any) => s + Number(e.quantity), 0);
    const totalSoldRevenue = sellEntries.reduce((s: number, e: any) => s + Number(e.totalAmount), 0);
    const realizedPnl = totalSoldRevenue - totalSoldQty * wac;

    const availableQty  = Number(reg.availableQuantity);
    const retiredQty    = Number(reg.retiredQuantity);
    const totalCost     = availableQty * wac;
    const marketValue   = availableQty * marketPriceKrw;
    const unrealizedPnl = marketValue - totalCost;

    return {
      registryId:          reg.id,
      registry:            reg.registry,
      projectId:           reg.projectId,
      creditType:          reg.creditType,
      vintageYear:         reg.vintageYear,
      availableQuantity:   availableQty,
      retiredQuantity:     retiredQty,
      weightedAvgCost:     Math.round(wac * 100) / 100,
      marketPrice:         marketPriceKrw,
      unrealizedPnl:       Math.round(unrealizedPnl),
      realizedPnl:         Math.round(realizedPnl),
      totalCost:           Math.round(totalCost),
      marketValue:         Math.round(marketValue),
      serialNumberStart:   reg.serialNumberStart,
      certificationBody:   reg.certificationBody,
    };
  }

  /**
   * 레지스트리 목록 (보유 크레딧만)
   */
  static async getActiveRegistries(tenantId: string) {
    const rows = await db.carbonCreditRegistry.findMany({
      where: { tenantId, status: 'active', availableQuantity: { gt: 0 } },
      orderBy: [{ vintageYear: 'desc' }, { creditType: 'asc' }],
    });
    return rows.map((r: any) => ({
      id: r.id,
      registry: r.registry,
      projectId: r.projectId,
      creditType: r.creditType,
      vintageYear: r.vintageYear,
      availableQuantity: Number(r.availableQuantity),
      retiredQuantity: Number(r.retiredQuantity),
      certificationBody: r.certificationBody,
      serialNumberStart: r.serialNumberStart,
      status: r.status,
    }));
  }
}
