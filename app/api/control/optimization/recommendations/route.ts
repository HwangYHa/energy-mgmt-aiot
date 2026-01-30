// app/api/control/optimization/recommendations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

// GET: Get optimization recommendations for a tenant
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    const siteId = searchParams.get('siteId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    // Mock optimization recommendations based on device types
    const devices = await prisma.device.findMany({
      where: {
        site: {
          tenantId,
          ...(siteId && { id: siteId }),
        },
      },
      include: {
        measurements: {
          orderBy: { timestamp: 'desc' },
          take: 24,
        },
      },
    });

    const recommendations = generateRecommendations(devices);

    return NextResponse.json({
      recommendations,
      generatedAt: new Date(),
      tenantId,
      siteId,
    });
  } catch (error) {
    console.error('Failed to fetch recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recommendations' },
      { status: 500 }
    );
  }
}

function generateRecommendations(devices: any[]) {
  const recommendations = [];

  // Peak Shaving recommendations
  const hvacDevices = devices.filter(
    (d) => d.type === 'hvac' || d.type === 'cooling'
  );
  if (hvacDevices.length > 0) {
    const avgPower =
      hvacDevices.reduce((sum, d) => {
        const measurements = d.measurements || [];
        if (measurements.length === 0) return sum;
        const avg =
          measurements.reduce((s, m) => s + (m.value || 0), 0) /
          measurements.length;
        return sum + avg;
      }, 0) / hvacDevices.length;

    if (avgPower > 50) {
      recommendations.push({
        id: 'peak-shaving-hvac',
        category: 'peak-shaving',
        priority: 'high',
        title: 'HVAC 피크 제어',
        description: `피크 시간(9-11AM, 6-8PM)에 HVAC 냉방 설정을 25°C에서 26°C로 상향 조정하여 전력 소비 ${(avgPower * 0.15).toFixed(1)}kW 감소`,
        estimatedSavings: avgPower * 0.15,
        unit: 'kW',
        estimatedCost: Math.round(avgPower * 0.15 * 1200),
        devices: hvacDevices.map((d) => d.id),
        actions: [
          {
            deviceType: 'hvac',
            parameter: 'setpoint',
            value: 26,
            condition: 'peak-hours',
          },
        ],
      });
    }
  }

  // Lighting optimization
  const lightingDevices = devices.filter((d) => d.type === 'lighting');
  if (lightingDevices.length > 0) {
    recommendations.push({
      id: 'lighting-optimization',
      category: 'lighting',
      priority: 'medium',
      title: '조명 자동 제어',
      description: '자동 조명 제어 시스템으로 주간 자연광 활용 시 조명 20% 감소',
      estimatedSavings: 5.2,
      unit: 'kW',
      estimatedCost: Math.round(5.2 * 1200),
      devices: lightingDevices.map((d) => d.id),
      actions: [
        {
          deviceType: 'lighting',
          parameter: 'brightness',
          value: 80,
          condition: 'daytime',
        },
      ],
    });
  }

  // ESS optimization
  recommendations.push({
    id: 'ess-optimization',
    category: 'ess',
    priority: 'high',
    title: 'ESS 충방전 최적화',
    description:
      '피크 시간 이전 저가 시간대(23:00-07:00)에 충전하고 피크 시간에 방전하여 전기료 절감',
    estimatedSavings: 12.5,
    unit: '₩M/월',
    estimatedCost: 0,
    devices: [],
    schedule: {
      charging: { start: '23:00', end: '07:00' },
      discharging: { start: '09:00', end: '11:00' },
      discharging2: { start: '18:00', end: '20:00' },
    },
  });

  // Demand Response
  recommendations.push({
    id: 'dr-program',
    category: 'dr',
    priority: 'high',
    title: '수요반응 프로그램 참여',
    description:
      'K-PX 수요반응 프로그램에 참여하여 피크 시간에 부하를 감축하고 보상금 획득',
    estimatedSavings: 9.2,
    unit: '₩M/월',
    estimatedCost: 0,
    devices: [],
    drProgram: {
      name: 'K-PX Demand Response',
      season: 'summer',
      daysPerMonth: 8,
      compensationPerDay: 1.15,
    },
  });

  return recommendations;
}
