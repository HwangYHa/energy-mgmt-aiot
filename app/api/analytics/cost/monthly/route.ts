// app/api/analytics/cost/monthly/route.ts
import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { EnergyAnalyticsService } from './energy.analytics';
import { CostAnalyticsService } from '../../../src/modules/analytics/cost.analytics';
import { JwtAuthGuard } from '../../../src/modules/auth/guards/jwt-auth.guard';
import { Roles, RolesGuard, UserRole } from '../auth/guards/roles.guard';

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(
    private readonly energyAnalytics: EnergyAnalyticsService,
    private readonly costAnalytics: CostAnalyticsService,
  ) {}

  /**
   * 시간대별 에너지 데이터
   */
  @Get('energy/hourly')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Get hourly energy data' })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({ name: 'deviceId', required: false })
  @ApiQuery({ name: 'metricKey', required: true })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  getHourlyEnergy(
    @Req() req: any,
    @Query('siteId') siteId?: string,
    @Query('deviceId') deviceId?: string,
    @Query('metricKey') metricKey?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.energyAnalytics.getHourlyData(req.user.tenantId, {
      siteId,
      deviceId,
      metricKey: metricKey || 'energy',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });
  }

  /**
   * 일별 에너지 데이터
   */
  @Get('energy/daily')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Get daily energy data' })
  getDailyEnergy(
    @Req() req: any,
    @Query('siteId') siteId?: string,
    @Query('deviceId') deviceId?: string,
    @Query('metricKey') metricKey?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.energyAnalytics.getDailyData(req.user.tenantId, {
      siteId,
      deviceId,
      metricKey: metricKey || 'energy',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });
  }

  /**
   * 주간 에너지 데이터
   */
  @Get('energy/weekly')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Get weekly energy data' })
  getWeeklyEnergy(
    @Req() req: any,
    @Query('siteId') siteId?: string,
    @Query('deviceId') deviceId?: string,
    @Query('metricKey') metricKey?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.energyAnalytics.getWeeklyData(req.user.tenantId, {
      siteId,
      deviceId,
      metricKey: metricKey || 'energy',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });
  }

  /**
   * 월간 에너지 데이터
   */
  @Get('energy/monthly')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Get monthly energy data' })
  getMonthlyEnergy(
    @Req() req: any,
    @Query('siteId') siteId?: string,
    @Query('deviceId') deviceId?: string,
    @Query('metricKey') metricKey?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.energyAnalytics.getMonthlyData(req.user.tenantId, {
      siteId,
      deviceId,
      metricKey: metricKey || 'energy',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });
  }

  /**
   * 피크 분석
   */
  @Get('energy/peak')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Analyze peak usage' })
  analyzePeak(
    @Req() req: any,
    @Query('siteId') siteId?: string,
    @Query('deviceId') deviceId?: string,
    @Query('metricKey') metricKey?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.energyAnalytics.analyzePeak(req.user.tenantId, {
      siteId,
      deviceId,
      metricKey: metricKey || 'power',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });
  }

  /**
   * 사용 패턴 분석
   */
  @Get('energy/pattern')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Analyze usage pattern' })
  analyzePattern(
    @Req() req: any,
    @Query('siteId') siteId?: string,
    @Query('deviceId') deviceId?: string,
    @Query('metricKey') metricKey?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.energyAnalytics.analyzeUsagePattern(req.user.tenantId, {
      siteId,
      deviceId,
      metricKey: metricKey || 'power',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });
  }

  /**
   * 전월 대비
   */
  @Get('energy/compare')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Compare with previous month' })
  compareEnergy(
    @Req() req: any,
    @Query('siteId') siteId?: string,
    @Query('deviceId') deviceId?: string,
    @Query('metricKey') metricKey?: string,
    @Query('currentMonth') currentMonth?: string,
  ) {
    return this.energyAnalytics.compareWithPreviousMonth(req.user.tenantId, {
      siteId,
      deviceId,
      metricKey: metricKey || 'energy',
      currentMonth: new Date(currentMonth),
    });
  }

  /**
   * 월간 비용 계산
   */
  @Get('cost/monthly')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Calculate monthly cost' })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({ name: 'contractPower', required: true })
  @ApiQuery({ name: 'month', required: true })
  getMonthlyCost(
    @Req() req: any,
    @Query('siteId') siteId?: string,
    @Query('contractPower') contractPower?: string,
    @Query('month') month?: string,
  ) {
    return this.costAnalytics.calculateMonthlyCost(req.user.tenantId, {
      siteId,
      contractPower: parseFloat(contractPower),
      month: new Date(month),
    });
  }

  /**
   * 시간대별 비용
   */
  @Get('cost/hourly')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Get hourly cost breakdown' })
  getHourlyCost(
    @Req() req: any,
    @Query('siteId') siteId?: string,
    @Query('date') date?: string,
  ) {
    return this.costAnalytics.getHourlyCostBreakdown(req.user.tenantId, {
      siteId,
      date: new Date(date),
    });
  }

  /**
   * 계절별 비용 비교
   */
  @Get('cost/seasonal')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Compare seasonal costs' })
  getSeasonalCost(
    @Req() req: any,
    @Query('siteId') siteId?: string,
    @Query('contractPower') contractPower?: string,
    @Query('year') year?: string,
  ) {
    return this.costAnalytics.getSeasonalCostComparison(req.user.tenantId, {
      siteId,
      contractPower: parseFloat(contractPower),
      year: parseInt(year, 10),
    });
  }

  /**
   * 비용 절감 잠재력
   */
  @Get('cost/saving-potential')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Analyze cost saving potential' })
  getCostSavingPotential(
    @Req() req: any,
    @Query('siteId') siteId?: string,
    @Query('month') month?: string,
  ) {
    return this.costAnalytics.analyzeCostSavingPotential(req.user.tenantId, {
      siteId,
      month: new Date(month),
    });
  }

  /**
   * 전월 대비 비용
   */
  @Get('cost/compare')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Compare cost with previous month' })
  compareCost(
    @Req() req: any,
    @Query('siteId') siteId?: string,
    @Query('contractPower') contractPower?: string,
    @Query('currentMonth') currentMonth?: string,
  ) {
    return this.costAnalytics.compareCostWithPreviousMonth(req.user.tenantId, {
      siteId,
      contractPower: parseFloat(contractPower),
      currentMonth: new Date(currentMonth),
    });
  }
}