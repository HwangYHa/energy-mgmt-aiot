// app/api/analytics/carbon/register-transport/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/session';
import { EmissionsService } from '@/lib/services/emissions.service';
// helper used to validate that a transport factor exists
import { getCurrentEmissionFactor } from '@/lib/constants/emission-factors';
import { logActivity, MENU_CODES, ACTION_TYPES } from '@/lib/services/activity-log.service';

/**
 * POST /api/analytics/carbon/register-transport
 * 운송 거리 등록
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      // TransportModal은 vehicleType + fuelType을 전송 → sourceType 조합
      sourceType: rawSourceType,
      vehicleType,
      fuelType,
      distance,
      period,
    } = body;

    const normalize = (val: unknown): string | null => {
      if (val === undefined || val === null) return null;
      const s = String(val).trim();
      if (!s || s === 'undefined' || s === 'null') return null;
      return s;
    };

    // 파라미터 정규화: TransportModal 필드 우선, 직접 API 호출은 sourceType도 허용
    let sourceType: string | null = normalize(rawSourceType);
    if (!sourceType && vehicleType && fuelType) {
      // 모달 전송: vehicleType(car/truck/air/ship/rail) + fuelType(diesel/gasoline/electric/lng)
      const combined = `${vehicleType}-${fuelType}`;
      sourceType = combined;
    }

    if (!sourceType) {
      return NextResponse.json({ error: '운송 수단 정보를 올바르게 입력해주세요.' }, { status: 400 });
    }

    const numDistance = Number(distance);
    if (isNaN(numDistance) || numDistance <= 0) {
      return NextResponse.json({ error: '거리를 올바르게 입력해주세요.' }, { status: 400 });
    }

    // period 형식 검사 (YYYY-MM)
    if (period !== undefined && period !== null) {
      if (typeof period !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
        return NextResponse.json({ error: 'period는 YYYY-MM 형식이어야 합니다 (예: 2026-03)' }, { status: 400 });
      }
    }

    // 확인용: 등록 가능한 계수인지 먼저 검사
    const factor = getCurrentEmissionFactor('transport', sourceType);
    if (!factor) {
      return NextResponse.json({ error: `지원되지 않는 운송 유형입니다: ${sourceType}` }, { status: 400 });
    }

    const emissionData = await EmissionsService.registerTransport({
      tenantId: session.user.tenantId,
      sourceType,
      distance: numDistance,
      period,
    });

    // 활동 이력 기록 (fire-and-forget)
    logActivity({
      tenantId: session.user.tenantId,
      menuCode: MENU_CODES.CARBON_TRANSPORT,
      actionType: ACTION_TYPES.CREATE,
      actionLabel: '운송 배출량 등록',
      resourceType: 'transport_emission',
      resourceId: (emissionData as { id?: string })?.id,
      resourceName: `${sourceType} ${numDistance}km`,
      afterData: { sourceType, distance: numDistance, period },
      metadata: { factor },
      userId: session.user.id,
      userName: session.user.name ?? undefined,
      userEmail: session.user.email ?? undefined,
      userRole: (session.user as { role?: string }).role ?? undefined,
      request,
    });

    return NextResponse.json(emissionData, { status: 201 });
  } catch (error) {
    console.error('Register transport error:', error);
    return NextResponse.json(
      { error: 'Failed to register transport' },
      { status: 500 }
    );
  }
}