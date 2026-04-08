/**
 * GET /api/control/optimization/recommendations
 *
 * 에너지 최적화 추천 항목 조회 — viewer 이상 권한 필요
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/api/response';
import { type Device } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');

    const devices = await prisma.device.findMany({
      where: {
        site: {
          tenantId: auth.tenantId,
          ...(siteId ? { id: siteId } : {}),
        },
      },
    });

    const recommendations = generateRecommendations(devices);

    return successResponse({
      recommendations,
      generatedAt: new Date(),
      tenantId: auth.tenantId,
      siteId,
    });
  } catch (error) {
    console.error('[Optimization Recommendations]', error);
    return serverErrorResponse();
  }
}

function generateRecommendations(devices: Device[]) {
  const recommendations = [];

  // HVAC 피크 제어
  const hvacDevices = devices.filter(d => d.deviceType === 'hvac' || d.deviceType === 'cooling');
  if (hvacDevices.length > 0) {
    const avgPower = 75;
    if (avgPower > 50) {
      recommendations.push({
        id: 'peak-shaving-hvac',
        category: 'peak-shaving',
        priority: 'high',
        title: 'HVAC 피크 제어',
        description: `피크 시간(9-11AM, 6-8PM) HVAC 설정온도 1°C 상향으로 전력 ${(avgPower * 0.15).toFixed(1)}kW 절감`,
        estimatedSavings: avgPower * 0.15,
        unit: 'kW',
        estimatedCostSaving: Math.round(avgPower * 0.15 * 1200),
        devices: hvacDevices.map(d => d.id),
        actions: [{ deviceType: 'hvac', parameter: 'setpoint', value: 26, condition: 'peak-hours' }],
      });
    }
  }

  // 조명 최적화
  const lightingDevices = devices.filter(d => d.deviceType === 'lighting');
  if (lightingDevices.length > 0) {
    recommendations.push({
      id: 'lighting-optimization',
      category: 'lighting',
      priority: 'medium',
      title: '조명 자동 제어',
      description: '주간 자연광 활용 시 조명 20% 감소 가능',
      estimatedSavings: 5.2,
      unit: 'kW',
      estimatedCostSaving: Math.round(5.2 * 1200),
      devices: lightingDevices.map(d => d.id),
      actions: [{ deviceType: 'lighting', parameter: 'brightness', value: 80, condition: 'daytime' }],
    });
  }

  // ESS 최적화 (범용)
  recommendations.push({
    id: 'ess-optimization',
    category: 'ess',
    priority: 'high',
    title: 'ESS 충방전 최적화',
    description: '저가 시간대(23:00-07:00) 충전, 피크 시간 방전으로 전기료 절감',
    estimatedSavings: 12.5,
    unit: '₩M/월',
    estimatedCostSaving: 0,
    devices: [],
    schedule: { charging: '23:00-07:00', discharging: '09:00-11:00, 18:00-20:00' },
  });

  // DR 프로그램 참여 추천
  recommendations.push({
    id: 'dr-program',
    category: 'dr',
    priority: 'high',
    title: '수요반응 프로그램 참여',
    description: 'K-PX 수요반응으로 피크 부하 감축 및 보상금 획득',
    estimatedSavings: 9.2,
    unit: '₩M/월',
    estimatedCostSaving: 0,
    devices: [],
    drProgram: { name: 'K-PX Demand Response', season: 'summer', compensationPerDay: 1.15 },
  });

  return recommendations;
}
