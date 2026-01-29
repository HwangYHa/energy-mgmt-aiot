// app/api/src/modules/analytics/cost.analytics.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EnergyAnalyticsService } from './energy.analytics';

/**
 * 💰 비용 분석 서비스
 * 
 * 역할:
 * - 전력 요금 계산 (한국전력 요금제 기준)
 * - 기본요금 + 전력량요금
 * - 계절별/시간대별 요금 적용
 * - 부가세 계산
 */

// 한국전력 산업용(갑) 요금표 (2024년 기준)
const POWER_TARIFF = {
  // 기본요금 (원/kW)
  basicCharge: {
    summer: 12840,      // 여름 (6-8월)
    spring_fall: 11220, // 봄/가을 (3-5월, 9-10월)
    winter: 11860,      // 겨울 (11-2월)
  },

  // 전력량요금 (원/kWh)
  energyCharge: {
    summer: {
      offPeak: 63.1,     // 경부하 (23:00-09:00)
      midPeak: 124.4,    // 중간부하 (09:00-10:00, 12:00-13:00, 17:00-23:00)
      onPeak: 189.6,     // 최대부하 (10:00-12:00, 13:00-17:00)
    },
    spring_fall: {
      offPeak: 60.1,
      midPeak: 84.7,
      onPeak: 117.6,
    },
    winter: {
      offPeak: 64.1,
      midPeak: 128.6,
      onPeak: 193.7,
    },
  },

  // 부가세
  vat: 0.1, // 10%

  // 전력산업기반기금
  fundRate: 0.037, // 3.7%
};

export interface CostBreakdown {
  basicCharge: number;      // 기본요금
  energyCharge: number;     // 전력량요금
  subtotal: number;         // 소계
  fund: number;             // 전력산업기반기금
  vat: number;              // 부가세
  total: number;            // 합계
}

export interface HourlyCost {
  hour: number;
  energy: number;           // kWh
  cost: number;             // 원
  timeType: 'offPeak' | 'midPeak' | 'onPeak';
}

@Injectable()
export class CostAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly energyAnalytics: EnergyAnalyticsService,
  ) {}

  /**
   * 계절 구분
   */
  private getSeason(date: Date): 'summer' | 'spring_fall' | 'winter' {
    const month = date.getMonth() + 1; // 1-12

    if (month >= 6 && month <= 8) {
      return 'summer';
    } else if ((month >= 3 && month <= 5) || (month >= 9 && month <= 10)) {
      return 'spring_fall';
    } else {
      return 'winter';
    }
  }

  /**
   * 시간대 구분
   */
  private getTimeType(hour: number, season: string): 'offPeak' | 'midPeak' | 'onPeak' {
    if (season === 'summer') {
      // 여름철
      if (hour >= 23 || hour < 9) {
        return 'offPeak'; // 경부하 (23:00-09:00)
      } else if (
        (hour >= 9 && hour < 10) ||
        (hour >= 12 && hour < 13) ||
        (hour >= 17 && hour < 23)
      ) {
        return 'midPeak'; // 중간부하
      } else {
        return 'onPeak'; // 최대부하 (10:00-12:00, 13:00-17:00)
      }
    } else {
      // 봄/가을/겨울
      if (hour >= 23 || hour < 9) {
        return 'offPeak';
      } else if (
        (hour >= 9 && hour < 10) ||
        (hour >= 12 && hour < 13) ||
        (hour >= 17 && hour < 23)
      ) {
        return 'midPeak';
      } else {
        return 'onPeak';
      }
    }
  }

  /**
   * 기본요금 계산
   */
  private calculateBasicCharge(contractPower: number, month: Date): number {
    const season = this.getSeason(month);
    const rate = POWER_TARIFF.basicCharge[season];
    return contractPower * rate;
  }

  /**
   * 전력량요금 계산 (시간대별)
   */
  private calculateEnergyCharge(
    energy: number,
    hour: number,
    season: string,
  ): number {
    const timeType = this.getTimeType(hour, season);
    const rate = POWER_TARIFF.energyCharge[season][timeType];
    return energy * rate;
  }

  /**
   * 월간 비용 계산
   */
  async calculateMonthlyCost(
    tenantId: string,
    params: {
      siteId?: string;
      contractPower: number; // 계약전력 (kW)
      month: Date;
    },
  ): Promise<CostBreakdown> {
    const { siteId, contractPower, month } = params;

    const startDate = new Date(month.getFullYear(), month.getMonth(), 1);
    const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    // 1. 기본요금
    const basicCharge = this.calculateBasicCharge(contractPower, month);

    // 2. 시간대별 전력 사용량 조회
    const hourlyData = await this.energyAnalytics.getHourlyData(tenantId, {
      siteId,
      metricKey: 'energy',
      startDate,
      endDate,
    });

    // 3. 전력량요금 계산
    const season = this.getSeason(month);
    let energyCharge = 0;

    for (const data of hourlyData) {
      const hour = data.timestamp.getHours();
      const cost = this.calculateEnergyCharge(data.value, hour, season);
      energyCharge += cost;
    }

    // 4. 소계
    const subtotal = basicCharge + energyCharge;

    // 5. 전력산업기반기금
    const fund = subtotal * POWER_TARIFF.fundRate;

    // 6. 부가세
    const vat = (subtotal + fund) * POWER_TARIFF.vat;

    // 7. 합계
    const total = subtotal + fund + vat;

    return {
      basicCharge: Math.round(basicCharge),
      energyCharge: Math.round(energyCharge),
      subtotal: Math.round(subtotal),
      fund: Math.round(fund),
      vat: Math.round(vat),
      total: Math.round(total),
    };
  }

  /**
   * 시간대별 비용 분석
   */
  async getHourlyCostBreakdown(
    tenantId: string,
    params: {
      siteId?: string;
      date: Date;
    },
  ): Promise<HourlyCost[]> {
    const { siteId, date } = params;

    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    // 시간대별 데이터
    const hourlyData = await this.energyAnalytics.getHourlyData(tenantId, {
      siteId,
      metricKey: 'energy',
      startDate,
      endDate,
    });

    const season = this.getSeason(date);

    return hourlyData.map(data => {
      const hour = data.timestamp.getHours();
      const timeType = this.getTimeType(hour, season);
      const cost = this.calculateEnergyCharge(data.value, hour, season);

      return {
        hour,
        energy: data.value,
        cost: Math.round(cost),
        timeType,
      };
    });
  }

  /**
   * 계절별 비용 비교
   */
  async getSeasonalCostComparison(
    tenantId: string,
    params: {
      siteId?: string;
      contractPower: number;
      year: number;
    },
  ): Promise<{
    summer: CostBreakdown;
    spring_fall: CostBreakdown;
    winter: CostBreakdown;
  }> {
    const { siteId, contractPower, year } = params;

    // 여름 (7월 대표)
    const summer = await this.calculateMonthlyCost(tenantId, {
      siteId,
      contractPower,
      month: new Date(year, 6, 1),
    });

    // 봄/가을 (4월 대표)
    const spring_fall = await this.calculateMonthlyCost(tenantId, {
      siteId,
      contractPower,
      month: new Date(year, 3, 1),
    });

    // 겨울 (1월 대표)
    const winter = await this.calculateMonthlyCost(tenantId, {
      siteId,
      contractPower,
      month: new Date(year, 0, 1),
    });

    return {
      summer,
      spring_fall,
      winter,
    };
  }

  /**
   * 비용 절감 잠재력 분석
   */
  async analyzeCostSavingPotential(
    tenantId: string,
    params: {
      siteId?: string;
      month: Date;
    },
  ): Promise<{
    currentCost: number;
    potentialSaving: number;
    savingPercentage: number;
    recommendations: string[];
  }> {
    const { siteId, month } = params;

    const startDate = new Date(month.getFullYear(), month.getMonth(), 1);
    const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    // 시간대별 비용
    const hourlyData = await this.energyAnalytics.getHourlyData(tenantId, {
      siteId,
      metricKey: 'energy',
      startDate,
      endDate,
    });

    const season = this.getSeason(month);
    let currentCost = 0;
    let onPeakEnergy = 0;
    let midPeakEnergy = 0;

    for (const data of hourlyData) {
      const hour = data.timestamp.getHours();
      const timeType = this.getTimeType(hour, season);
      const cost = this.calculateEnergyCharge(data.value, hour, season);
      
      currentCost += cost;

      if (timeType === 'onPeak') {
        onPeakEnergy += data.value;
      } else if (timeType === 'midPeak') {
        midPeakEnergy += data.value;
      }
    }

    // 피크 → 경부하 이동 시 절감액
    const onPeakRate = POWER_TARIFF.energyCharge[season].onPeak;
    const offPeakRate = POWER_TARIFF.energyCharge[season].offPeak;
    const potentialSaving = onPeakEnergy * (onPeakRate - offPeakRate);

    const savingPercentage = currentCost > 0 ? (potentialSaving / currentCost) * 100 : 0;

    const recommendations = [];
    if (onPeakEnergy > 0) {
      recommendations.push('최대부하 시간대(10-12시, 13-17시) 사용 감소');
      recommendations.push('경부하 시간대(23-09시)로 부하 이동');
    }
    if (midPeakEnergy > 0) {
      recommendations.push('중간부하 시간대 최적화');
    }

    return {
      currentCost: Math.round(currentCost),
      potentialSaving: Math.round(potentialSaving),
      savingPercentage: Math.round(savingPercentage * 10) / 10,
      recommendations,
    };
  }

  /**
   * 전월 대비 비용 증감
   */
  async compareCostWithPreviousMonth(
    tenantId: string,
    params: {
      siteId?: string;
      contractPower: number;
      currentMonth: Date;
    },
  ): Promise<{
    current: CostBreakdown;
    previous: CostBreakdown;
    difference: number;
    percentageChange: number;
  }> {
    const { siteId, contractPower, currentMonth } = params;

    const previousMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() - 1,
      1,
    );

    const current = await this.calculateMonthlyCost(tenantId, {
      siteId,
      contractPower,
      month: currentMonth,
    });

    const previous = await this.calculateMonthlyCost(tenantId, {
      siteId,
      contractPower,
      month: previousMonth,
    });

    const difference = current.total - previous.total;
    const percentageChange = previous.total > 0 
      ? ((difference / previous.total) * 100) 
      : 0;

    return {
      current,
      previous,
      difference: Math.round(difference),
      percentageChange: Math.round(percentageChange * 10) / 10,
    };
  }
}