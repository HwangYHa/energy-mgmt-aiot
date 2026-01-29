// app/api/src/modules/control/control.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ControlService, CreateControlCommandDto, ApproveControlDto } from './control.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard, UserRole } from '../auth/guards/roles.guard';

@ApiTags('Control')
@Controller('control')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ControlController {
  constructor(private readonly controlService: ControlService) {}

  /**
   * 제어 명령 생성
   */
  @Post()
  @Roles(UserRole.OPERATOR)
  @ApiOperation({ summary: 'Create control command' })
  createCommand(
    @Body() createDto: CreateControlCommandDto,
    @Req() req: any,
  ) {
    return this.controlService.createCommand(
      req.user.userId,
      req.user.tenantId,
      createDto,
    );
  }

  /**
   * 제어 이력 조회
   */
  @Get('history')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Get control history' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'deviceId', required: false })
  @ApiQuery({ name: 'status', required: false })
  getHistory(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('deviceId') deviceId?: string,
    @Query('status') status?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 10;

    return this.controlService.getControlHistory(req.user.tenantId, {
      skip: (pageNum - 1) * pageSizeNum,
      take: pageSizeNum,
      deviceId,
      status,
    });
  }

  /**
   * 승인 대기 목록
   */
  @Get('pending')
  @Roles(UserRole.SITE_MANAGER)
  @ApiOperation({ summary: 'Get pending approvals' })
  getPendingApprovals(@Req() req: any) {
    return this.controlService.getPendingApprovals(req.user.tenantId);
  }

  /**
   * 제어 승인/거부
   */
  @Patch(':id/approve')
  @Roles(UserRole.SITE_MANAGER)
  @ApiOperation({ summary: 'Approve or reject control command' })
  approveControl(
    @Param('id') id: string,
    @Body() approveDto: ApproveControlDto,
    @Req() req: any,
  ) {
    return this.controlService.approveControl(
      id,
      req.user.userId,
      req.user.tenantId,
      approveDto,
    );
  }

  /**
   * 제어 취소
   */
  @Patch(':id/cancel')
  @Roles(UserRole.OPERATOR)
  @ApiOperation({ summary: 'Cancel control command' })
  cancelControl(@Param('id') id: string, @Req() req: any) {
    return this.controlService.cancelControl(
      id,
      req.user.userId,
      req.user.tenantId,
    );
  }

  /**
   * 제어 통계
   */
  @Get('stats')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Get control statistics' })
  @ApiQuery({ name: 'days', required: false })
  getStats(@Req() req: any, @Query('days') days?: string) {
    const daysNum = days ? parseInt(days, 10) : 7;
    return this.controlService.getControlStats(req.user.tenantId, daysNum);
  }
}