// app/api/analytics/carbon/footprint/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/session';
import { EmissionsService } from '@/lib/services/emissions.service';

/**
 * GET /api/analytics/carbon/footprint
 * 탄소 발자국 및 감축 목표 조회
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const target = parseFloat(searchParams.get('target') || '500');
    const siteId = searchParams.get('siteId') || undefined;

    // 기간 설정
    const period = `${year}-${new Date().getMonth() + 1}`.padStart(2, '0');

    // 전체 배출량
    const totalEmissions = await EmissionsService.calculateTotalEmissions({
      tenantId: session.user.tenantId,
      siteId,
      period,
    });

    // 감축 목표 진행률
    const progress = await EmissionsService.getReductionProgress(
      session.user.tenantId,
      year,
      target
    );

    // 배출원별 상세
    const breakdown = await EmissionsService.getEmissionBreakdown(
      session.user.tenantId,
      period,
      siteId
    );

    // 감축 권장사항
    const recommendations = [];
    
    if (totalEmissions.scope2 > totalEmissions.total * 0.5) {
      recommendations.push('재생에너지 사용 비율을 높이세요 (태양광, 풍력)');
      recommendations.push('고효율 설비로 교체하여 전력 사용량을 줄이세요');
      recommendations.push('LED 조명, 인버터 에어컨 도입을 검토하세요');
    }

    if (totalEmissions.scope1 > 10) {
      recommendations.push('전기차 도입으로 디젤/가솔린 차량을 대체하세요');
      recommendations.push('LNG 보일러를 전기 히트펌프로 전환하세요');
    }

    if (progress.achievement > 100) {
      recommendations.push(`목표 대비 ${(progress.achievement - 100).toFixed(1)}% 초과 배출 중`);
      recommendations.push('에너지 관리 시스템(EMS) 도입으로 실시간 모니터링을 강화하세요');
    }

    if (progress.reductionRate < 5) {
      recommendations.push('연간 5% 이상 감축 목표를 설정하세요');
      recommendations.push('탄소중립 로드맵을 수립하세요');
    }

    return NextResponse.json({
      emissions: totalEmissions,
      progress,
      breakdown,
      recommendations,
    });
  } catch (error) {
    console.error('Carbon footprint error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate carbon footprint' },
      { status: 500 }
    );
  }
}