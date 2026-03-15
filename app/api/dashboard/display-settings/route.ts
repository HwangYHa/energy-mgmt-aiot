/**
 * GET /api/dashboard/display-settings
 *
 * 프론트엔드 대시보드에서 필요한 표시 설정을 반환합니다.
 *
 * 반환 데이터:
 *   - dashboard: 기본 뷰, 차트 유형, 위젯 표시 여부
 *   - alerts:    자동 갱신 주기, 임계값 (UI 표시용)
 *   - general:   언어, 날짜/숫자 형식
 *   - energy:    요금 단가, 탄소 계수, 통화 (계산 표시용)
 *
 * 캐시: private, max-age=60 (60초 브라우저 캐시)
 * 설정 변경 시 즉시 반영: PUT /api/system-settings → cache invalidation → 재요청
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { getSystemSettings } from '@/lib/services/system-settings.service';
import { unauthorizedResponse, serverErrorResponse } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const settings = await getSystemSettings(auth.tenantId);

    const payload = {
      success: true,
      data: {
        dashboard: settings.dashboard,
        alerts: {
          refreshInterval:        settings.alerts.refreshInterval,
          powerThresholdWarning:  settings.alerts.powerThresholdWarning,
          powerThresholdCritical: settings.alerts.powerThresholdCritical,
          emailNotifications:     settings.alerts.emailNotifications,
          kakaoNotifications:     settings.alerts.kakaoNotifications,
        },
        general: settings.general,
        energy: {
          electricityRate: settings.energy.electricityRate,
          peakRate:        settings.energy.peakRate,
          offPeakRate:     settings.energy.offPeakRate,
          carbonFactor:    settings.energy.carbonFactor,
          targetReduction: settings.energy.targetReduction,
          currency:        settings.energy.currency,
        },
        organization: {
          name:         settings.organization.name,
          timezone:     settings.organization.timezone,
          industryType: settings.organization.industryType,
        },
      },
    };

    // 브라우저 캐시 60초 (설정 변경 후 최대 1분 내 반영)
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'private, max-age=60' },
    });
  } catch (error) {
    console.error('[API] display-settings 조회 오류:', error);
    return serverErrorResponse();
  }
}
