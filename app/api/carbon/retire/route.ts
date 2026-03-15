/**
 * POST /api/carbon/retire — 크레딧 소각 (배출량 상계)
 *
 * 소각된 크레딧은 취소 불가 (규제 감사 추적용)
 * 수량이 0이 되어도 credit 레코드는 삭제하지 않음 — CarbonTrade FK 보존
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { requireFeature } from '@/lib/auth/subscription';
import { generateSeqNo } from '@/lib/utils/sequence';

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 플랜 권한 확인 (GET과 동일한 기준)
    const [, subErr] = await requireFeature(auth.tenantId, 'analytics_carbon_trading');
    if (subErr) return subErr;

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
    if (credit.quantity <= 0) {
      return NextResponse.json({ error: '이미 전량 소각된 크레딧입니다' }, { status: 400 });
    }
    if (credit.quantity < quantity) {
      return NextResponse.json(
        { error: `보유 수량(${credit.quantity.toFixed(1)} tCO₂)이 부족합니다` },
        { status: 400 }
      );
    }

    const newQty = Math.max(0, credit.quantity - quantity);

    // 소각 거래 코드 자동 채번: CR-YYYYMMDD-NNNN
    const code = await generateSeqNo('CARBON_RETIRE');

    // ── 트랜잭션: credit 먼저 UPDATE 후 trade CREATE ──
    // credit을 절대 DELETE 하지 않음 → CarbonTrade FK 보존 (감사 추적)
    const [, trade] = await prisma.$transaction([
      prisma.carbonCredit.update({
        where: { id: creditId },
        data: { quantity: newQty },
      }),
      (prisma as any).carbonTrade.create({
        data: {
          tenantId: auth.tenantId,
          creditId,
          tradeType: 'retire',
          quantity,
          price: 0,
          totalAmount: 0,
          memo: memo ?? null,
          code,
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
