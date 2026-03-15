/**
 * GET  /api/carbon/trading — 포트폴리오 조회 + 최근 거래 내역
 * POST /api/carbon/trading — 크레딧 매수(buy)
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { requireFeature } from '@/lib/auth/subscription';
import { generateSeqNo } from '@/lib/utils/sequence';

const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

/** DB에서 최신 K-ETS 시장 가격 조회 (폴백: env → 8500) */
async function getKetsPrice(): Promise<number> {
  try {
    const row = await db.carbonMarketPrice.findFirst({
      where: { market: 'KETS' },
      orderBy: { priceDate: 'desc' },
      select: { price: true },
    });
    if (row) return Number(row.price);
  } catch {
    // DB 미마이그레이션 환경 폴백
  }
  return Number(process.env.KETS_MARKET_PRICE ?? 8500);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [, subErr] = await requireFeature(auth.tenantId, 'analytics_carbon_trading');
    if (subErr) return subErr;

    const [credits, recentTrades, marketPrice] = await Promise.all([
      // quantity > 0 인 크레딧만 반환 (전량 소각된 크레딧 제외)
      prisma.carbonCredit.findMany({
        where: { tenantId: auth.tenantId, quantity: { gt: 0 } },
        orderBy: [{ vintage: 'desc' }, { type: 'asc' }],
      }),
      prisma.carbonTrade.findMany({
        where: { tenantId: auth.tenantId },
        orderBy: { tradedAt: 'desc' },
        take: 20,
        include: { credit: { select: { type: true, vintage: true } } },
      }),
      getKetsPrice(),
    ]);

    // 포트폴리오 집계
    const totalQuantity = credits.reduce((sum: number, c: { quantity: number; avgCost: number }) => sum + c.quantity, 0);
    const totalValue = credits.reduce((sum: number, c: { quantity: number }) => sum + c.quantity * marketPrice, 0);
    const totalCost = credits.reduce((sum: number, c: { quantity: number; avgCost: number }) => sum + c.quantity * c.avgCost, 0);
    const unrealizedPnl = totalValue - totalCost;

    return NextResponse.json({
      portfolio: {
        totalQuantity,
        totalValue,
        totalCost,
        unrealizedPnl,
        avgCost: totalQuantity > 0 ? totalCost / totalQuantity : 0,
        marketPrice,
      },
      credits,
      recentTrades,
      marketPrice,
    });
  } catch (error) {
    console.error('[carbon/trading GET]', error);
    return NextResponse.json({ error: '조회 중 오류가 발생했습니다' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { vintage, type, quantity, price, memo } = body as {
      vintage: number;
      type: string;
      quantity: number;
      price: number;
      memo?: string;
    };

    // 입력 유효성 검증
    if (!vintage || !type || !quantity || !price) {
      return NextResponse.json({ error: '필수 항목을 입력해주세요' }, { status: 400 });
    }
    if (!['KAU', 'KCU', 'OFFSET'].includes(type)) {
      return NextResponse.json({ error: '유효하지 않은 크레딧 타입입니다' }, { status: 400 });
    }
    if (quantity <= 0 || price <= 0) {
      return NextResponse.json({ error: '수량과 단가는 0보다 커야 합니다' }, { status: 400 });
    }

    // 동일 vintage+type의 기존 크레딧 조회 (있으면 수량 추가, 없으면 신규 생성)
    const existing = await prisma.carbonCredit.findFirst({
      where: { tenantId: auth.tenantId, vintage, type },
    });

    let credit;
    if (existing) {
      // 가중 평균 단가 재계산
      const newTotalCost = existing.quantity * existing.avgCost + quantity * price;
      const newTotalQty = existing.quantity + quantity;
      const newAvgCost = newTotalCost / newTotalQty;

      credit = await prisma.carbonCredit.update({
        where: { id: existing.id },
        data: { quantity: newTotalQty, avgCost: newAvgCost },
      });
    } else {
      credit = await prisma.carbonCredit.create({
        data: {
          tenantId: auth.tenantId,
          vintage,
          type,
          quantity,
          avgCost: price,
        },
      });
    }

    // 탄소 거래 코드 자동 채번: CG-YYYYMMDD-NNNN
    const code = await generateSeqNo('CARBON_TRADING');

    // 거래 기록
    const trade = await (prisma as any).carbonTrade.create({
      data: {
        tenantId: auth.tenantId,
        creditId: credit.id,
        tradeType: 'buy',
        quantity,
        price,
        totalAmount: quantity * price,
        memo: memo ?? null,
        code,
      },
    });

    return NextResponse.json({ credit, trade }, { status: 201 });
  } catch (error) {
    console.error('[carbon/trading POST]', error);
    return NextResponse.json({ error: '매수 처리 중 오류가 발생했습니다' }, { status: 500 });
  }
}
