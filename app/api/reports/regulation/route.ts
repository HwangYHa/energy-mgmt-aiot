// app/api/reports/regulation/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getServerSession } from 'next-auth';
import { verifyAuth } from '@/lib/auth/verify';

/**
 * 📋 규제 보고서 API
 * 
 * 역할:
 * - 온실가스 배출량 보고서 (환경부)
 * - RE100 보고서
 * - 에너지 사용량 보고서 (에너지관리공단)
 */

// 탄소배출계수 (tCO2/MWh)
const EMISSION_FACTORS = {
  grid: 0.4593,        // 한국 전력망 (2023년 기준)
  solar: 0,
  wind: 0,
  renewable: 0,
};

/**
 * 최근 생성된 리포트 목록 조회
 * GET /api/reports/regulation?take=10
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const take = Math.min(parseInt(searchParams.get('take') || '10'), 50);

    const reports = await prisma.regulationReport.findMany({
      where: { tenantId: auth.tenantId },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        reportType: true,
        reportName: true,
        period: true,
        status: true,
        dueDate: true,
        submittedDate: true,
        approvedDate: true,
        totalEmissions: true,
        scope1: true,
        scope2: true,
        scope3: true,
        fileUrl: true,
        pdfUrl: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ success: true, data: reports });
  } catch (error) {
    console.error('Report list error:', error);
    return NextResponse.json(
      { error: '리포트 목록을 불러오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { regulationType, year, siteId } = body;

    let reportData;

    switch (regulationType) {
      case 'greenhouse_gas':
        reportData = await generateGreenhouseGasReport(
          session.user.tenantId,
          year,
          siteId,
        );
        break;

      case 're100':
        reportData = await generateRE100Report(
          session.user.tenantId,
          year,
          siteId,
        );
        break;

      case 'energy_usage':
        reportData = await generateEnergyUsageReport(
          session.user.tenantId,
          year,
          siteId,
        );
        break;

      default:
        throw new Error('Invalid regulation type');
    }

    // DB 저장
    const report = await prisma.regulationReport.create({
      data: {
        tenantId: session.user.tenantId,
        reportType: regulationType,
        reportName: `${regulationType} Report ${year}`,
        period: `${year}-12`, // YYYY-MM format
        status: 'draft',
        dueDate: new Date(year, 11, 31), // End of year
        totalEmissions: (reportData as any)?.totalEmissions || 0,
        scope1: (reportData as any)?.scope1 || 0,
        scope2: (reportData as any)?.scope2 || 0,
        scope3: (reportData as any)?.scope3 || 0,
      },
    });

    return NextResponse.json({
      reportId: report.id,
      data: reportData,
      message: 'Regulation report generated successfully',
    });

  } catch (error) {
    console.error('Regulation report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate regulation report' },
      { status: 500 }
    );
  }
}

/**
 * 온실가스 배출량 보고서 (환경부)
 */
async function generateGreenhouseGasReport(
  tenantId: string,
  year: number,
  siteId?: string,
) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);

  // 월별 에너지 사용량
  const query = `
    SELECT 
      MONTH(timestamp) as month,
      SUM(CAST(value AS DECIMAL(10,2))) / 1000 as total_energy_mwh
    FROM measurement m
    JOIN metric mt ON m.metricId = mt.id
    WHERE m.tenantId = ?
      AND mt.key = 'energy'
      AND m.timestamp BETWEEN ? AND ?
      ${siteId ? 'AND mt.siteId = ?' : ''}
    GROUP BY month
    ORDER BY month ASC
  `;

  const params = [tenantId, startDate, endDate];
  if (siteId) params.push(siteId);

  const monthlyData = await prisma.$queryRawUnsafe(query, ...params);

  // 탄소 배출량 계산
  const emissions = (monthlyData as any[]).map(row => {
    const energyMWh = parseFloat(row.total_energy_mwh);
    const emission = energyMWh * EMISSION_FACTORS.grid;

    return {
      month: parseInt(row.month),
      energyMWh: Math.round(energyMWh * 100) / 100,
      emissionTCO2: Math.round(emission * 100) / 100,
    };
  });

  const totalEnergy = emissions.reduce((sum, e) => sum + e.energyMWh, 0);
  const totalEmission = emissions.reduce((sum, e) => sum + e.emissionTCO2, 0);

  return {
    reportType: '온실가스 배출량 보고서',
    year,
    summary: {
      totalEnergyMWh: Math.round(totalEnergy * 100) / 100,
      totalEmissionTCO2: Math.round(totalEmission * 100) / 100,
      emissionFactor: EMISSION_FACTORS.grid,
    },
    monthlyEmissions: emissions,
    scope: {
      scope1: 0, // 직접 배출 (연소)
      scope2: Math.round(totalEmission * 100) / 100, // 간접 배출 (전력)
      scope3: 0, // 기타 간접 배출
    },
  };
}

/**
 * RE100 보고서
 */
async function generateRE100Report(
  tenantId: string,
  year: number,
  siteId?: string,
) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);

  // 전체 에너지 사용량
  const totalQuery = `
    SELECT 
      SUM(CAST(value AS DECIMAL(10,2))) / 1000 as total_energy_mwh
    FROM measurement m
    JOIN metric mt ON m.metricId = mt.id
    WHERE m.tenantId = ?
      AND mt.key = 'energy'
      AND m.timestamp BETWEEN ? AND ?
      ${siteId ? 'AND mt.siteId = ?' : ''}
  `;

  const params = [tenantId, startDate, endDate];
  if (siteId) params.push(siteId);

  const totalResult = await prisma.$queryRawUnsafe(totalQuery, ...params);
  const totalEnergy = parseFloat((totalResult as any)[0]?.total_energy_mwh || 0);

  // 재생에너지 사용량 (예시: 태양광 설비가 있다고 가정)
  const renewableQuery = `
    SELECT 
      SUM(CAST(value AS DECIMAL(10,2))) / 1000 as renewable_energy_mwh
    FROM measurement m
    JOIN metric mt ON m.metricId = mt.id
    JOIN device d ON mt.deviceId = d.id
    WHERE m.tenantId = ?
      AND mt.key = 'energy'
      AND d.type IN ('solar', 'wind')
      AND m.timestamp BETWEEN ? AND ?
      ${siteId ? 'AND mt.siteId = ?' : ''}
  `;

  const renewableResult = await prisma.$queryRawUnsafe(renewableQuery, ...params);
  const renewableEnergy = parseFloat((renewableResult as any)[0]?.renewable_energy_mwh || 0);

  const re100Percentage = totalEnergy > 0 ? (renewableEnergy / totalEnergy) * 100 : 0;

  return {
    reportType: 'RE100 보고서',
    year,
    summary: {
      totalEnergyMWh: Math.round(totalEnergy * 100) / 100,
      renewableEnergyMWh: Math.round(renewableEnergy * 100) / 100,
      re100Percentage: Math.round(re100Percentage * 100) / 100,
      target: 100, // 목표 100%
      achievement: re100Percentage >= 100,
    },
    breakdown: {
      grid: Math.round((totalEnergy - renewableEnergy) * 100) / 100,
      solar: Math.round(renewableEnergy * 100) / 100,
      wind: 0,
      other: 0,
    },
  };
}

/**
 * 에너지 사용량 보고서 (에너지관리공단)
 */
async function generateEnergyUsageReport(
  tenantId: string,
  year: number,
  siteId?: string,
) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);

  // 월별 사용량
  const query = `
    SELECT 
      MONTH(timestamp) as month,
      SUM(CAST(value AS DECIMAL(10,2))) as total_energy_kwh,
      MAX(CAST(value AS DECIMAL(10,2))) as peak_power_kw
    FROM measurement m
    JOIN metric mt ON m.metricId = mt.id
    WHERE m.tenantId = ?
      AND mt.key = 'energy'
      AND m.timestamp BETWEEN ? AND ?
      ${siteId ? 'AND mt.siteId = ?' : ''}
    GROUP BY month
    ORDER BY month ASC
  `;

  const params = [tenantId, startDate, endDate];
  if (siteId) params.push(siteId);

  const monthlyData = await prisma.$queryRawUnsafe(query, ...params);

  const summary = (monthlyData as any[]).map(row => ({
    month: parseInt(row.month),
    energyKWh: Math.round(parseFloat(row.total_energy_kwh)),
    peakPowerKW: Math.round(parseFloat(row.peak_power_kw)),
  }));

  const totalEnergy = summary.reduce((sum, s) => sum + s.energyKWh, 0);

  return {
    reportType: '에너지 사용량 보고서',
    year,
    summary: {
      totalEnergyKWh: totalEnergy,
      averageMonthlyKWh: Math.round(totalEnergy / 12),
      peakPowerKW: Math.max(...summary.map(s => s.peakPowerKW)),
    },
    monthlyUsage: summary,
  };
}

/**
 * 보고서 제출
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { reportId, action } = body;

    const report = await prisma.regulationReport.findFirst({
      where: {
        id: reportId,
        tenantId: session.user.tenantId,
      },
    });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    let status;
    if (action === 'submit') {
      status = 'submitted';
    } else if (action === 'approve') {
      status = 'approved';
    } else if (action === 'reject') {
      status = 'rejected';
    } else {
      throw new Error('Invalid action');
    }

    const updated = await prisma.regulationReport.update({
      where: { id: reportId },
      data: {
        status: status as any,
        submittedDate: action === 'submit' ? new Date() : undefined,
        submittedBy: action === 'submit' ? session.user.id : undefined,
      },
    });

    return NextResponse.json({
      message: 'Report status updated',
      report: updated,
    });

  } catch (error) {
    console.error('Report submission error:', error);
    return NextResponse.json(
      { error: 'Failed to update report status' },
      { status: 500 }
    );
  }
}