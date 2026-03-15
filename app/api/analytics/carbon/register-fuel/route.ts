// app/api/analytics/carbon/register-fuel/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/session';
import { EmissionsService } from '@/lib/services/emissions.service';
// helper for validating emission factor exists
import { getCurrentEmissionFactor } from '@/lib/constants/emission-factors';
import { logActivity, MENU_CODES, ACTION_TYPES } from '@/lib/services/activity-log.service';

/**
 * POST /api/analytics/carbon/register-fuel
 * 연료 사용량 등록
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      deviceId,
      // FuelModal은 fuelType + quantity를 전송 → sourceType/amount 로 매핑
      sourceType: rawSourceType,
      fuelType,
      amount: rawAmount,
      quantity,
      unit,
      period,
    } = body;

    // 파라미터 정규화 헬퍼
    const normalize = (val: unknown): string | null => {
      if (val === undefined || val === null) return null;
      const s = String(val).trim();
      if (!s || s === 'undefined' || s === 'null') return null;
      return s.replace('bunker_c', 'bunker-c');
    };

    const rawSrc = normalize(fuelType ?? rawSourceType);
    const numAmount = Number(quantity ?? rawAmount);

    if (!rawSrc || isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: '연료 종류와 사용량을 올바르게 입력해주세요.' }, { status: 400 });
    }

    // period 형식 검사 (YYYY-MM)
    if (period !== undefined && period !== null) {
      if (typeof period !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
        return NextResponse.json({ error: 'period는 YYYY-MM 형식이어야 합니다 (예: 2026-03)' }, { status: 400 });
      }
    }

    const sourceType = rawSrc; // already normalized

    // 요인 확인 후 400으로 응답
    const factor = getCurrentEmissionFactor('fuel', sourceType);
    if (!factor) {
      return NextResponse.json({ error: `지원되지 않는 연료 유형입니다: ${sourceType}` }, { status: 400 });
    }

    const emissionData = await EmissionsService.registerFuelUsage({
      tenantId: session.user.tenantId,
      deviceId,
      sourceType,
      amount: numAmount,
      unit,
      period,
    });

    // 활동 이력 기록 (fire-and-forget)
    logActivity({
      tenantId: session.user.tenantId,
      menuCode: MENU_CODES.CARBON_FUEL,
      actionType: ACTION_TYPES.CREATE,
      actionLabel: '연료 사용량 등록',
      resourceType: 'fuel_emission',
      resourceId: (emissionData as { id?: string })?.id,
      resourceName: `${sourceType} ${numAmount}${unit ?? ''}`,
      afterData: { sourceType, amount: numAmount, unit, period, deviceId },
      metadata: { factor },
      userId: session.user.id,
      userName: session.user.name ?? undefined,
      userEmail: session.user.email ?? undefined,
      userRole: (session.user as { role?: string }).role ?? undefined,
      request,
    });

    return NextResponse.json(emissionData, { status: 201 });
  } catch (error) {
    console.error('Register fuel error:', error);
    return NextResponse.json(
      { error: 'Failed to register fuel usage' },
      { status: 500 }
    );
  }
}