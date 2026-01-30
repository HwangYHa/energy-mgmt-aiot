// lib/services/emissions.service.ts
import { prisma } from '@/lib/db/prisma';
import {
  getCurrentEmissionFactor,
  calculateEmission,
  ELECTRICITY_FACTORS,
} from '@/lib/constants/emission-factors';

/**
 * 🌱 배출량 계산 엔진
 * 
 * 역할:
 * - Scope 1/2/3 분류 및 계산
 * - 자동 배출량 집계
 * - 월간/연간 배출량 리포트
 * - 감축 목표 대비 달성률
 */

export interface EmissionCalculationInput {
  tenantId: string;
  siteId?: string;
  period: string; // YYYY-MM
}

export interface ScopeEmissions {
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
  unit: 'tCO₂';
}

export interface EmissionBreakdown {
  category: string;
  sourceType: string;
  amount: number;
  unit: string;
  emission: number;
  percentage: number;
}

export class EmissionsService {
  /**
   * Scope 2: 전력 배출량 계산
   */
  static async calculateScope2Electricity(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    siteId?: string
  ): Promise<number> {
    // 전력 사용량 조회 (MWh)
    const query = `
      SELECT 
        SUM(CAST(value AS DECIMAL(15,4))) / 1000 as total_energy_mwh
      FROM measurement m
      JOIN metric mt ON m.metricId = mt.id
      WHERE m.tenantId = ?
        AND mt.key = 'energy'
        AND m.time BETWEEN ? AND ?
        ${siteId ? 'AND mt.deviceId IN (SELECT id FROM device WHERE siteId = ?)' : ''}
    `;

    const params: any[] = [tenantId, startDate, endDate];
    if (siteId) params.push(siteId);

    const result: any = await prisma.$queryRawUnsafe(query, ...params);
    const energyMWh = parseFloat(result[0]?.total_energy_mwh || '0');

    // 배출계수 적용
    const factor = getCurrentEmissionFactor('electricity', 'grid');
    if (!factor) {
      throw new Error('Electricity emission factor not found');
    }

    const emission = energyMWh * factor.factor;
    
    return Math.round(emission * 1000) / 1000; // tCO₂ (소수점 3자리)
  }

  /**
   * Scope 1: 연료 연소 배출량 계산
   */
  static async calculateScope1Fuel(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    siteId?: string
  ): Promise<number> {
    // EmissionsData 테이블에서 연료 사용량 조회
    const fuelData = await prisma.emissionsData.findMany({
      where: {
        tenantId,
        emissionType: 'scope1',
        period: {
          gte: this.formatPeriod(startDate),
          lte: this.formatPeriod(endDate),
        },
        ...(siteId && {
          device: {
            siteId,
          },
        }),
      },
    });

    const totalEmission = fuelData.reduce(
      (sum, data) => sum + parseFloat(data.calculatedEmission.toString()),
      0
    );

    return Math.round(totalEmission * 1000) / 1000;
  }

  /**
   * Scope 3: 운송 배출량 계산
   */
  static async calculateScope3Transport(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const transportData = await prisma.emissionsData.findMany({
      where: {
        tenantId,
        emissionType: 'scope3',
        period: {
          gte: this.formatPeriod(startDate),
          lte: this.formatPeriod(endDate),
        },
      },
    });

    const totalEmission = transportData.reduce(
      (sum, data) => sum + parseFloat(data.calculatedEmission.toString()),
      0
    );

    return Math.round(totalEmission * 1000) / 1000;
  }

  /**
   * 전체 배출량 계산
   */
  static async calculateTotalEmissions(
    input: EmissionCalculationInput
  ): Promise<ScopeEmissions> {
    const { tenantId, siteId, period } = input;

    // 기간 파싱
    const [year, month] = period.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // 각 Scope별 계산
    const [scope1, scope2, scope3] = await Promise.all([
      this.calculateScope1Fuel(tenantId, startDate, endDate, siteId),
      this.calculateScope2Electricity(tenantId, startDate, endDate, siteId),
      this.calculateScope3Transport(tenantId, startDate, endDate),
    ]);

    const total = scope1 + scope2 + scope3;

    return {
      scope1: Math.round(scope1 * 1000) / 1000,
      scope2: Math.round(scope2 * 1000) / 1000,
      scope3: Math.round(scope3 * 1000) / 1000,
      total: Math.round(total * 1000) / 1000,
      unit: 'tCO₂',
    };
  }

  /**
   * 월간 배출량 (12개월)
   */
  static async getMonthlyEmissions(
    tenantId: string,
    year: number,
    siteId?: string
  ): Promise<
    Array<{
      month: number;
      scope1: number;
      scope2: number;
      scope3: number;
      total: number;
    }>
  > {
    const results = [];

    for (let month = 1; month <= 12; month++) {
      const period = `${year}-${month.toString().padStart(2, '0')}`;
      const emissions = await this.calculateTotalEmissions({
        tenantId,
        siteId,
        period,
      });

      results.push({
        month,
        ...emissions,
      });
    }

    return results;
  }

  /**
   * 배출원별 상세 분석
   */
  static async getEmissionBreakdown(
    tenantId: string,
    period: string,
    siteId?: string
  ): Promise<EmissionBreakdown[]> {
    const [year, month] = period.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Scope 2: 전력
    const scope2Emission = await this.calculateScope2Electricity(
      tenantId,
      startDate,
      endDate,
      siteId
    );

    // Scope 1: 연료별
    const fuelData = await prisma.emissionsData.groupBy({
      by: ['sourceType'],
      where: {
        tenantId,
        emissionType: 'scope1',
        period: this.formatPeriod(startDate),
      },
      _sum: {
        amount: true,
        calculatedEmission: true,
      },
    });

    // Scope 3: 운송별
    const transportData = await prisma.emissionsData.groupBy({
      by: ['sourceType'],
      where: {
        tenantId,
        emissionType: 'scope3',
        period: this.formatPeriod(startDate),
      },
      _sum: {
        amount: true,
        calculatedEmission: true,
      },
    });

    const breakdown: EmissionBreakdown[] = [];

    // Scope 2
    if (scope2Emission > 0) {
      breakdown.push({
        category: 'electricity',
        sourceType: 'grid',
        amount: 0,
        unit: 'MWh',
        emission: scope2Emission,
        percentage: 0,
      });
    }

    // Scope 1
    fuelData.forEach((fuel) => {
      breakdown.push({
        category: 'fuel',
        sourceType: fuel.sourceType,
        amount: parseFloat(fuel._sum.amount?.toString() || '0'),
        unit: 'kL or ton',
        emission: parseFloat(fuel._sum.calculatedEmission?.toString() || '0'),
        percentage: 0,
      });
    });

    // Scope 3
    transportData.forEach((transport) => {
      breakdown.push({
        category: 'transport',
        sourceType: transport.sourceType,
        amount: parseFloat(transport._sum.amount?.toString() || '0'),
        unit: 'km',
        emission: parseFloat(transport._sum.calculatedEmission?.toString() || '0'),
        percentage: 0,
      });
    });

    // 총 배출량
    const total = breakdown.reduce((sum, b) => sum + b.emission, 0);

    // 비율 계산
    breakdown.forEach((b) => {
      b.percentage = total > 0 ? Math.round((b.emission / total) * 1000) / 10 : 0;
    });

    return breakdown;
  }

  /**
   * 감축 목표 대비 달성률
   */
  static async getReductionProgress(
    tenantId: string,
    year: number,
    target: number
  ): Promise<{
    current: number;
    target: number;
    achievement: number;
    reduction: number;
    reductionRate: number;
  }> {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    // 현재 연도 배출량
    const [scope1, scope2, scope3] = await Promise.all([
      this.calculateScope1Fuel(tenantId, startDate, endDate),
      this.calculateScope2Electricity(tenantId, startDate, endDate),
      this.calculateScope3Transport(tenantId, startDate, endDate),
    ]);

    const current = scope1 + scope2 + scope3;

    // 전년도 배출량
    const prevYear = year - 1;
    const prevStartDate = new Date(prevYear, 0, 1);
    const prevEndDate = new Date(prevYear, 11, 31);

    const [prevScope1, prevScope2, prevScope3] = await Promise.all([
      this.calculateScope1Fuel(tenantId, prevStartDate, prevEndDate),
      this.calculateScope2Electricity(tenantId, prevStartDate, prevEndDate),
      this.calculateScope3Transport(tenantId, prevStartDate, prevEndDate),
    ]);

    const previous = prevScope1 + prevScope2 + prevScope3;

    // 감축량 및 감축률
    const reduction = previous - current;
    const reductionRate = previous > 0 ? (reduction / previous) * 100 : 0;

    // 목표 대비 달성률
    const achievement = target > 0 ? (current / target) * 100 : 0;

    return {
      current: Math.round(current * 1000) / 1000,
      target,
      achievement: Math.round(achievement * 10) / 10,
      reduction: Math.round(reduction * 1000) / 1000,
      reductionRate: Math.round(reductionRate * 10) / 10,
    };
  }

  /**
   * 연료 사용량 등록
   */
  static async registerFuelUsage(data: {
    tenantId: string;
    deviceId?: string;
    sourceType: string;
    amount: number;
    unit: string;
    period: string;
  }) {
    const { tenantId, deviceId, sourceType, amount, unit, period } = data;

    // 배출계수 조회
    const factor = getCurrentEmissionFactor('fuel', sourceType);
    if (!factor) {
      throw new Error(`Fuel emission factor not found: ${sourceType}`);
    }

    // 배출량 계산
    const emission = calculateEmission('fuel', sourceType, amount, unit);

    // DB 저장
    const emissionData = await prisma.emissionsData.create({
      data: {
        tenantId,
        deviceId,
        emissionType: 'scope1',
        sourceType,
        amount,
        unit,
        emissionFactor: factor.factor,
        calculatedEmission: emission,
        period,
        calculationMethod: 'auto',
        dataSource: 'MANUAL',
      },
    });

    return emissionData;
  }

  /**
   * 운송 거리 등록
   */
  static async registerTransport(data: {
    tenantId: string;
    sourceType: string;
    distance: number;
    period: string;
  }) {
    const { tenantId, sourceType, distance, period } = data;

    // 배출계수 조회
    const factor = getCurrentEmissionFactor('transport', sourceType);
    if (!factor) {
      throw new Error(`Transport emission factor not found: ${sourceType}`);
    }

    // 배출량 계산
    const emission = calculateEmission('transport', sourceType, distance, 'km');

    // DB 저장
    const emissionData = await prisma.emissionsData.create({
      data: {
        tenantId,
        emissionType: 'scope3',
        sourceType,
        amount: distance,
        unit: 'km',
        emissionFactor: factor.factor,
        calculatedEmission: emission,
        period,
        calculationMethod: 'auto',
        dataSource: 'MANUAL',
      },
    });

    return emissionData;
  }

  /**
   * 유틸리티: 기간 포맷 (YYYY-MM)
   */
  private static formatPeriod(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  }
}