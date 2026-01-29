// app/api/src/modules/control/schedule.controller.ts
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
import { ScheduleService, CreateScheduleDto, UpdateScheduleDto } from './schedule.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard, UserRole } from '../auth/guards/roles.guard';

@ApiTags('Control Schedules')
@Controller('control/schedules')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get()
  @Roles(UserRole.OPERATOR)
  @ApiOperation({ summary: 'Get all schedules' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'deviceId', required: false })
  @ApiQuery({ name: 'isActive', required: false })
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('deviceId') deviceId?: string,
    @Query('isActive') isActive?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 10;
    const isActiveBool = isActive === 'true' ? true : isActive === 'false' ? false : undefined;

    return this.scheduleService.findAll(req.user.tenantId, {
      skip: (pageNum - 1) * pageSizeNum,
      take: pageSizeNum,
      deviceId,
      isActive: isActiveBool,
    });
  }

  @Get(':id')
  @Roles(UserRole.OPERATOR)
  @ApiOperation({ summary: 'Get schedule by ID' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.scheduleService.findOne(id, req.user.tenantId);
  }

  @Post()
  @Roles(UserRole.OPERATOR)
  @ApiOperation({ summary: 'Create schedule' })
  create(@Body() createDto: CreateScheduleDto, @Req() req: any) {
    return this.scheduleService.createSchedule(
      req.user.tenantId,
      req.user.userId,
      createDto,
    );
  }

  @Patch(':id')
  @Roles(UserRole.OPERATOR)
  @ApiOperation({ summary: 'Update schedule' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateScheduleDto,
    @Req() req: any,
  ) {
    return this.scheduleService.update(id, req.user.tenantId, updateDto);
  }

  @Delete(':id')
  @Roles(UserRole.SITE_MANAGER)
  @ApiOperation({ summary: 'Delete schedule' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.scheduleService.remove(id, req.user.tenantId);
  }

  @Patch(':id/toggle')
  @Roles(UserRole.OPERATOR)
  @ApiOperation({ summary: 'Toggle schedule active status' })
  toggle(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
    @Req() req: any,
  ) {
    return this.scheduleService.toggleSchedule(
      id,
      req.user.tenantId,
      body.isActive,
    );
  }

  @Get(':id/logs')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Get schedule execution logs' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  getLogs(
    @Param('id') id: string,
    @Req() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 10;

    return this.scheduleService.getScheduleLogs(id, req.user.tenantId, {
      skip: (pageNum - 1) * pageSizeNum,
      take: pageSizeNum,
    });
  }
}