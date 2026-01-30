// app/api/analytics/energy/daily/route.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../src/prisma/prisma.service';

/**
 * 📊 에너지 분석 서비스
 * 
 * 역할:
 * - 시간대별 집계 (시간/일/주/월/년)
 * - 피크 분석 (최대/최소 사용량)
 * - 사용 패턴 분석
 * - 부하율 계산
 */

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  unit: string;
}

export interface PeakAnalysis {
  peak: {
    value: number;
    timestamp: Date;
  };
  valley: {
    value: number;
    timestamp: Date;
  };
  average: number;
  loadFactor: number; // 부하율 (평균/피크)
}

export interface UsagePattern {
  hourlyPattern: { hour: number; average: number }[];
  weekdayPattern: { day: number; average: number }[];
  seasonalPattern: { month: number; average: number }[];
}

@Injectable()
export class EnergyAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 시간대별 집계 (Hourly)
   */
  async getHourlyData(
    tenantId: string,
    params: {
      siteId?: string;
      deviceId?: string;
      metricKey: string;
      startDate: Date;
      endDate: Date;
    },
  ): Promise<TimeSeriesData[]> {
    const { siteId, deviceId, metricKey, startDate, endDate } = params;

    // SQL 직접 쿼리 (성능 최적화)
    const query = `
      SELECT 
        DATE_FORMAT(timestamp, '%Y-%m-%d %H:00:00') as hour,
        AVG(CAST(value AS DECIMAL(10,2))) as avg_value,
        MAX(CAST(value AS DECIMAL(10,2))) as max_value,
        MIN(CAST(value AS DECIMAL(10,2))) as min_value,
        COUNT(*) as count
      FROM measurement m
      JOIN metric mt ON m.metricId = mt.id
      WHERE m.tenantId = ?
        AND mt.key = ?
        AND m.timestamp BETWEEN ? AND ?
        ${siteId ? 'AND mt.siteId = ?' : ''}
        ${deviceId ? 'AND mt.deviceId = ?' : ''}
      GROUP BY hour
      ORDER BY hour ASC
    `;

    const params_array = [tenantId, metricKey, startDate, endDate];
    if (siteId) params_array.push(siteId);
    if (deviceId) params_array.push(deviceId);

    const result = await this.prisma.$queryRawUnsafe(query, ...params_array);

    return (result as any[]).map(row => ({
      timestamp: new Date(row.hour),
      value: parseFloat(row.avg_value),
      unit: 'kWh',
    }));
  }

  /**
   * 일별 집계 (Daily)
   */
  async getDailyData(
    tenantId: string,
    params: {
      siteId?: string;
      deviceId?: string;
      metricKey: string;
      startDate: Date;
      endDate: Date;
    },
  ): Promise<TimeSeriesData[]> {
    const { siteId, deviceId, metricKey, startDate, endDate } = params;

    const query = `
      SELECT 
        DATE(timestamp) as day,
        SUM(CAST(value AS DECIMAL(10,2))) as total_value
      FROM measurement m
      JOIN metric mt ON m.metricId = mt.id
      WHERE m.tenantId = ?
        AND mt.key = ?
        AND m.timestamp BETWEEN ? AND ?
        ${siteId ? 'AND mt.siteId = ?' : ''}
        ${deviceId ? 'AND mt.deviceId = ?' : ''}
      GROUP BY day
      ORDER BY day ASC
    `;

    const params_array = [tenantId, metricKey, startDate, endDate];
    if (siteId) params_array.push(siteId);
    if (deviceId) params_array.push(deviceId);

    const result = await this.prisma.$queryRawUnsafe(query, ...params_array);

    return (result as any[]).map(row => ({
      timestamp: new Date(row.day),
      value: parseFloat(row.total_value),
      unit: 'kWh',
    }));
  }

  /**
   * 주간 집계 (Weekly)
   */
  async getWeeklyData(
    tenantId: string,
    params: {
      siteId?: string;
      deviceId?: string;
      metricKey: string;
      startDate: Date;
      endDate: Date;
    },
  ): Promise<TimeSeriesData[]> {
    const { siteId, deviceId, metricKey, startDate, endDate } = params;

    const query = `
      SELECT 
        DATE_FORMAT(timestamp, '%Y-%u') as week,
        DATE(DATE_SUB(timestamp, INTERVAL WEEKDAY(timestamp) DAY)) as week_start,
        SUM(CAST(value AS DECIMAL(10,2))) as total_value
      FROM measurement m
      JOIN metric mt ON m.metricId = mt.id
      WHERE m.tenantId = ?
        AND mt.key = ?
        AND m.timestamp BETWEEN ? AND ?
        ${siteId ? 'AND mt.siteId = ?' : ''}
        ${deviceId ? 'AND mt.deviceId = ?' : ''}
      GROUP BY week, week_start
      ORDER BY week ASC
    `;

    const params_array = [tenantId, metricKey, startDate, endDate];
    if (siteId) params_array.push(siteId);
    if (deviceId) params_array.push(deviceId);

    const result = await this.prisma.$queryRawUnsafe(query, ...params_array);

    return (result as any[]).map(row => ({
      timestamp: new Date(row.week_start),
      value: parseFloat(row.total_value),
      unit: 'kWh',
    }));
  }

  /**
   * 월간 집계 (Monthly)
   */
  async getMonthlyData(
    tenantId: string,
    params: {
      siteId?: string;
      deviceId?: string;
      metricKey: string;
      startDate: Date;
      endDate: Date;
    },
  ): Promise<TimeSeriesData[]> {
    const { siteId, deviceId, metricKey, startDate, endDate } = params;

    const query = `
      SELECT 
        DATE_FORMAT(timestamp, '%Y-%m-01') as month,
        SUM(CAST(value AS DECIMAL(10,2))) as total_value
      FROM measurement m
      JOIN metric mt ON m.metricId = mt.id
      WHERE m.tenantId = ?
        AND mt.key = ?
        AND m.timestamp BETWEEN ? AND ?
        ${siteId ? 'AND mt.siteId = ?' : ''}
        ${deviceId ? 'AND mt.deviceId = ?' : ''}
      GROUP BY month
      ORDER BY month ASC
    `;

    const params_array = [tenantId, metricKey, startDate, endDate];
    if (siteId) params_array.push(siteId);
    if (deviceId) params_array.push(deviceId);

    const result = await this.prisma.$queryRawUnsafe(query, ...params_array);

    return (result as any[]).map(row => ({
      timestamp: new Date(row.month),
      value: parseFloat(row.total_value),
      unit: 'kWh',
    }));
  }

  /**
   * 피크 분석
   */
  async analyzePeak(
    tenantId: string,
    params: {
      siteId?: string;
      deviceId?: string;
      metricKey: string;
      startDate: Date;
      endDate: Date;
    },
  ): Promise<PeakAnalysis> {
    const { siteId, deviceId, metricKey, startDate, endDate } = params;

    const query = `
      SELECT 
        MAX(CAST(value AS DECIMAL(10,2))) as peak_value,
        MIN(CAST(value AS DECIMAL(10,2))) as valley_value,
        AVG(CAST(value AS DECIMAL(10,2))) as avg_value
      FROM measurement m
      JOIN metric mt ON m.metricId = mt.id
      WHERE m.tenantId = ?
        AND mt.key = ?
        AND m.timestamp BETWEEN ? AND ?
        ${siteId ? 'AND mt.siteId = ?' : ''}
        ${deviceId ? 'AND mt.deviceId = ?' : ''}
    `;

    const params_array = [tenantId, metricKey, startDate, endDate];
    if (siteId) params_array.push(siteId);
    if (deviceId) params_array.push(deviceId);

    const result: any = await this.prisma.$queryRawUnsafe(query, ...params_array);
    const stats = result[0];

    // 피크 시각 조회
    const peakQuery = `
      SELECT timestamp, CAST(value AS DECIMAL(10,2)) as value
      FROM measurement m
      JOIN metric mt ON m.metricId = mt.id
      WHERE m.tenantId = ?
        AND mt.key = ?
        AND m.timestamp BETWEEN ? AND ?
        AND CAST(value AS DECIMAL(10,2)) = ?
        ${siteId ? 'AND mt.siteId = ?' : ''}
        ${deviceId ? 'AND mt.deviceId = ?' : ''}
      LIMIT 1
    `;

    const peak_params = [tenantId, metricKey, startDate, endDate, stats.peak_value];
    if (siteId) peak_params.push(siteId);
    if (deviceId) peak_params.push(deviceId);

    const peakResult: any = await this.prisma.$queryRawUnsafe(peakQuery, ...peak_params);

    // Valley 시각 조회
    const valleyQuery = peakQuery.replace('= ?', '= ?');
    const valley_params = [tenantId, metricKey, startDate, endDate, stats.valley_value];
    if (siteId) valley_params.push(siteId);
    if (deviceId) valley_params.push(deviceId);

    const valleyResult: any = await this.prisma.$queryRawUnsafe(valleyQuery, ...valley_params);

    const average = parseFloat(stats.avg_value);
    const peak = parseFloat(stats.peak_value);

    return {
      peak: {
        value: peak,
        timestamp: peakResult[0]?.timestamp || new Date(),
      },
      valley: {
        value: parseFloat(stats.valley_value),
        timestamp: valleyResult[0]?.timestamp || new Date(),
      },
      average,
      loadFactor: peak > 0 ? (average / peak) * 100 : 0,
    };
  }

  /**
   * 사용 패턴 분석
   */
  async analyzeUsagePattern(
    tenantId: string,
    params: {
      siteId?: string;
      deviceId?: string;
      metricKey: string;
      startDate: Date;
      endDate: Date;
    },
  ): Promise<UsagePattern> {
    const { siteId, deviceId, metricKey, startDate, endDate } = params;

    // 시간대별 패턴 (0-23시)
    const hourlyQuery = `
      SELECT 
        HOUR(timestamp) as hour,
        AVG(CAST(value AS DECIMAL(10,2))) as avg_value
      FROM measurement m
      JOIN metric mt ON m.metricId = mt.id
      WHERE m.tenantId = ?
        AND mt.key = ?
        AND m.timestamp BETWEEN ? AND ?
        ${siteId ? 'AND mt.siteId = ?' : ''}
        ${deviceId ? 'AND mt.deviceId = ?' : ''}
      GROUP BY hour
      ORDER BY hour ASC
    `;

    const params_array = [tenantId, metricKey, startDate, endDate];
    if (siteId) params_array.push(siteId);
    if (deviceId) params_array.push(deviceId);

    const hourlyResult: any = await this.prisma.$queryRawUnsafe(hourlyQuery, ...params_array);

    // 요일별 패턴 (0=일요일, 6=토요일)
    const weekdayQuery = `
      SELECT 
        WEEKDAY(timestamp) as day,
        AVG(CAST(value AS DECIMAL(10,2))) as avg_value
      FROM measurement m
      JOIN metric mt ON m.metricId = mt.id
      WHERE m.tenantId = ?
        AND mt.key = ?
        AND m.timestamp BETWEEN ? AND ?
        ${siteId ? 'AND mt.siteId = ?' : ''}
        ${deviceId ? 'AND mt.deviceId = ?' : ''}
      GROUP BY day
      ORDER BY day ASC
    `;

    const weekdayResult: any = await this.prisma.$queryRawUnsafe(weekdayQuery, ...params_array);

    // 월별 패턴 (1-12월)
    const seasonalQuery = `
      SELECT 
        MONTH(timestamp) as month,
        AVG(CAST(value AS DECIMAL(10,2))) as avg_value
      FROM measurement m
      JOIN metric mt ON m.metricId = mt.id
      WHERE m.tenantId = ?
        AND mt.key = ?
        AND m.timestamp BETWEEN ? AND ?
        ${siteId ? 'AND mt.siteId = ?' : ''}
        ${deviceId ? 'AND mt.deviceId = ?' : ''}
      GROUP BY month
      ORDER BY month ASC
    `;

    const seasonalResult: any = await this.prisma.$queryRawUnsafe(seasonalQuery, ...params_array);

    return {
      hourlyPattern: hourlyResult.map((row: any) => ({
        hour: parseInt(row.hour),
        average: parseFloat(row.avg_value),
      })),
      weekdayPattern: weekdayResult.map((row: any) => ({
        day: parseInt(row.day),
        average: parseFloat(row.avg_value),
      })),
      seasonalPattern: seasonalResult.map((row: any) => ({
        month: parseInt(row.month),
        average: parseFloat(row.avg_value),
      })),
    };
  }

  /**
   * 전월 대비 증감
   */
  async compareWithPreviousMonth(
    tenantId: string,
    params: {
      siteId?: string;
      deviceId?: string;
      metricKey: string;
      currentMonth: Date;
    },
  ): Promise<{
    current: number;
    previous: number;
    difference: number;
    percentageChange: number;
  }> {
    const { siteId, deviceId, metricKey, currentMonth } = params;

    const currentStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const currentEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

    const previousStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    const previousEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0);

    // 현재 월
    const currentData = await this.getMonthlyData(tenantId, {
      siteId,
      deviceId,
      metricKey,
      startDate: currentStart,
      endDate: currentEnd,
    });

    // 전월
    const previousData = await this.getMonthlyData(tenantId, {
      siteId,
      deviceId,
      metricKey,
      startDate: previousStart,
      endDate: previousEnd,
    });

    const current = currentData[0]?.value || 0;
    const previous = previousData[0]?.value || 0;
    const difference = current - previous;
    const percentageChange = previous > 0 ? ((difference / previous) * 100) : 0;

    return {
      current,
      previous,
      difference,
      percentageChange,
    };
  }
}