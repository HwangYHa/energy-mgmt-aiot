// app/api/src/modules/site/site.controller.ts
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
import { SiteService, CreateSiteDto, UpdateSiteDto } from './site.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles, RolesGuard, UserRole } from '../auth/guards/roles.guard';

@ApiTags('Sites')
@Controller('sites')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SiteController {
  constructor(private readonly siteService: SiteService) {}

  /**
   * 사업장 목록 조회
   */
  @Get()
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Get all sites' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 10;
    const isActiveBool = isActive === 'true' ? true : isActive === 'false' ? false : undefined;

    return this.siteService.findAll(req.user.tenantId, {
      skip: (pageNum - 1) * pageSizeNum,
      take: pageSizeNum,
      isActive: isActiveBool,
      search,
    });
  }

  /**
   * 사업장 단일 조회
   */
  @Get(':id')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Get site by ID' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.siteService.findOne(id, req.user.tenantId);
  }

  /**
   * 사업장 생성
   */
  @Post()
  @Roles(UserRole.SITE_MANAGER)
  @ApiOperation({ summary: 'Create new site' })
  create(@Body() createSiteDto: CreateSiteDto, @Req() req: any) {
    return this.siteService.create(req.user.tenantId, createSiteDto);
  }

  /**
   * 사업장 수정
   */
  @Patch(':id')
  @Roles(UserRole.SITE_MANAGER)
  @ApiOperation({ summary: 'Update site' })
  update(
    @Param('id') id: string,
    @Body() updateSiteDto: UpdateSiteDto,
    @Req() req: any,
  ) {
    return this.siteService.update(id, req.user.tenantId, updateSiteDto);
  }

  /**
   * 사업장 삭제
   */
  @Delete(':id')
  @Roles(UserRole.TENANT_ADMIN)
  @ApiOperation({ summary: 'Delete site' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.siteService.remove(id, req.user.tenantId);
  }

  /**
   * 사업장 통계
   */
  @Get(':id/stats')
  @Roles(UserRole.VIEWER)
  @ApiOperation({ summary: 'Get site statistics' })
  getStats(@Param('id') id: string, @Req() req: any) {
    return this.siteService.getStats(id, req.user.tenantId);
  }
}