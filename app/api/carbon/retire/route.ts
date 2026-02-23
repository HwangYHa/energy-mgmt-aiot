/**
 * POST /api/carbon/retire — 크레딧 소각 (배출량 상계)
 *
 * 소각된 크레딧은 취소 불가 (규제 감사 추적용)
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { creditId, quantity, memo } = body as {
      creditId: string;
      quantity: number;
      memo?: string;
    };

    if (!creditId || !quantity) {
      return NextResponse.json({ error: '필수 항목을 입력해주세요' }, { status: 400 });
    }
    if (quantity <= 0) {
      return NextResponse.json({ error: '소각 수량은 0보다 커야 합니다' }, { status: 400 });
    }

    const credit = await prisma.carbonCredit.findFirst({
      where: { id: creditId, tenantId: auth.tenantId },
    });

    if (!credit) {
      return NextResponse.json({ error: '크레딧을 찾을 수 없습니다' }, { status: 404 });
    }

    if (credit.quantity < quantity) {
      return NextResponse.json(
        { error: `보유 수량(${credit.quantity} tCO₂)이 부족합니다` },
        { status: 400 }
      );
    }

    const newQty = credit.quantity - quantity;

    const [, trade] = await prisma.$transaction([
      newQty <= 0
        ? prisma.carbonCredit.delete({ where: { id: creditId } })
        : prisma.carbonCredit.update({
            where: { id: creditId },
            data: { quantity: newQty },
          }),
      prisma.carbonTrade.create({
        data: {
          tenantId: auth.tenantId,
          creditId,
          tradeType: 'retire',
          quantity,
          price: 0,
          totalAmount: 0,
          memo: memo ?? null,
        },
      }),
    ]);

    return NextResponse.json({
      message: `${quantity} tCO₂ 소각 완료`,
      remainingQuantity: newQty,
      trade,
    });
  } catch (error) {
    console.error('[carbon/retire POST]', error);
    return NextResponse.json({ error: '소각 처리 중 오류가 발생했습니다' }, { status: 500 });
  }
}
