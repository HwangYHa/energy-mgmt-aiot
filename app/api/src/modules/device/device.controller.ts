// app/api/src/modules/device/device.controller.ts
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
import { DeviceService, CreateDeviceDto, UpdateDeviceDto } from './device.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard, UserRole } from '../auth/guards/roles.guard';

@ApiTags('Devices')
@Controller('devices')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Get()
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Get all devices' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({ name: 'gatewayId', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('siteId') siteId?: string,
    @Query('gatewayId') gatewayId?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 10;

    return this.deviceService.findAll(req.user.tenantId, {
      skip: (pageNum - 1) * pageSizeNum,
      take: pageSizeNum,
      siteId,
      gatewayId,
      type,
      status,
      search,
    });
  }

  @Get(':id')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Get device by ID' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.deviceService.findOne(id, req.user.tenantId);
  }

  @Post()
  @Roles(UserRole.OPERATOR)
  @ApiOperation({ summary: 'Create new device' })
  create(@Body() createDeviceDto: CreateDeviceDto, @Req() req: any) {
    return this.deviceService.create(req.user.tenantId, createDeviceDto);
  }

  @Patch(':id')
  @Roles(UserRole.OPERATOR)
  @ApiOperation({ summary: 'Update device' })
  update(
    @Param('id') id: string,
    @Body() updateDeviceDto: UpdateDeviceDto,
    @Req() req: any,
  ) {
    return this.deviceService.update(id, req.user.tenantId, updateDeviceDto);
  }

  @Delete(':id')
  @Roles(UserRole.SITE_MANAGER)
  @ApiOperation({ summary: 'Delete device' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.deviceService.remove(id, req.user.tenantId);
  }

  @Patch(':id/status')
  @Roles(UserRole.OPERATOR)
  @ApiOperation({ summary: 'Update device status' })
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
    @Req() req: any,
  ) {
    return this.deviceService.updateStatus(id, req.user.tenantId, body.status);
  }

  @Get(':id/measurements')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Get latest measurements' })
  getLatestMeasurements(@Param('id') id: string, @Req() req: any) {
    return this.deviceService.getLatestMeasurements(id, req.user.tenantId);
  }
}