// app/api/src/modules/alert/alert-rule.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AlertService, CreateAlertRuleDto, UpdateAlertRuleDto } from './alert.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard, UserRole } from '../auth/guards/roles.guard';

@ApiTags('Alert Rules')
@Controller('alert-rules')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AlertRuleController {
  constructor(private readonly alertService: AlertService) {}

  @Get()
  @Roles(UserRole.OPERATOR)
  @ApiOperation({ summary: 'Get all alert rules' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'severity', required: false })
  @ApiQuery({ name: 'isActive', required: false })
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('category') category?: string,
    @Query('severity') severity?: string,
    @Query('isActive') isActive?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 10;
    const isActiveBool = isActive === 'true' ? true : isActive === 'false' ? false : undefined;

    return this.alertService.findAllRules(req.user.tenantId, {
      skip: (pageNum - 1) * pageSizeNum,
      take: pageSizeNum,
      category,
      severity,
      isActive: isActiveBool,
    });
  }

  @Get(':id')
  @Roles(UserRole.OPERATOR)
  @ApiOperation({ summary: 'Get alert rule by ID' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.alertService.findOneRule(id, req.user.tenantId);
  }

  @Post()
  @Roles(UserRole.OPERATOR)
  @ApiOperation({ summary: 'Create alert rule' })
  create(@Body() createDto: CreateAlertRuleDto, @Req() req: any) {
    return this.alertService.createRule(req.user.tenantId, createDto);
  }

  @Patch(':id')
  @Roles(UserRole.OPERATOR)
  @ApiOperation({ summary: 'Update alert rule' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAlertRuleDto,
    @Req() req: any,
  ) {
    return this.alertService.updateRule(id, req.user.tenantId, updateDto);
  }

  @Delete(':id')
  @Roles(UserRole.SITE_MANAGER)
  @ApiOperation({ summary: 'Delete alert rule' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.alertService.removeRule(id, req.user.tenantId);
  }

  @Patch(':id/toggle')
  @Roles(UserRole.OPERATOR)
  @ApiOperation({ summary: 'Toggle alert rule active status' })
  toggle(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
    @Req() req: any,
  ) {
    return this.alertService.toggleRule(id, req.user.tenantId, body.isActive);
  }

  @Get('history')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Get alert history' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'ruleId', required: false })
  @ApiQuery({ name: 'severity', required: false })
  getHistory(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('ruleId') ruleId?: string,
    @Query('severity') severity?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 10;

    return this.alertService.getAlertHistory(req.user.tenantId, {
      skip: (pageNum - 1) * pageSizeNum,
      take: pageSizeNum,
      ruleId,
      severity,
    });
  }

  @Get('stats')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Get alert statistics' })
  @ApiQuery({ name: 'days', required: false })
  getStats(@Req() req: any, @Query('days') days?: string) {
    const daysNum = days ? parseInt(days, 10) : 7;
    return this.alertService.getAlertStats(req.user.tenantId, daysNum);
  }
}