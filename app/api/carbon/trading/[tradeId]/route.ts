/**
 * DELETE /api/carbon/trading/[tradeId] — 거래 취소 (매수 후 1시간 이내만)
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tradeId } = await params;
    const trade = await prisma.carbonTrade.findFirst({
      where: { id: tradeId, tenantId: auth.tenantId },
      include: { credit: true },
    });

    if (!trade) {
      return NextResponse.json({ error: '거래 내역을 찾을 수 없습니다' }, { status: 404 });
    }

    // 소각(retire)은 취소 불가
    if (trade.tradeType === 'retire') {
      return NextResponse.json({ error: '소각 거래는 취소할 수 없습니다' }, { status: 400 });
    }

    // 1시간 이내만 취소 가능
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (trade.tradedAt < oneHourAgo) {
      return NextResponse.json({ error: '매수 후 1시간이 지나 취소할 수 없습니다' }, { status: 400 });
    }

    // 크레딧 수량 복원 (평균 단가는 단순 복원 — 정밀 회계 아님)
    const newQty = trade.credit.quantity - trade.quantity;

    await prisma.$transaction([
      prisma.carbonTrade.delete({ where: { id: trade.id } }),
      newQty <= 0
        ? prisma.carbonCredit.delete({ where: { id: trade.creditId } })
        : prisma.carbonCredit.update({
            where: { id: trade.creditId },
            data: { quantity: newQty },
          }),
    ]);

    return NextResponse.json({ message: '거래가 취소되었습니다' });
  } catch (error) {
    console.error('[carbon/trading DELETE]', error);
    return NextResponse.json({ error: '거래 취소 중 오류가 발생했습니다' }, { status: 500 });
  }
}
