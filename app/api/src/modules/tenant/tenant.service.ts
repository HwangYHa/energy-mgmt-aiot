// app/api/src/modules/tenant/tenant.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTenantDto, UpdateTenantDto } from './dto';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 테넌트 목록 조회
   */
  async findAll(params?: {
    skip?: number;
    take?: number;
    status?: string;
    industryType?: string;
  }) {
    const { skip = 0, take = 10, status, industryType } = params || {};

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (industryType) {
      where.industryType = industryType;
    }

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          name: true,
          businessNumber: true,
          domain: true,
          industryType: true,
          status: true,
          createdAt: true,
          _count: {
            select: {
              users: true,
              sites: true,
              devices: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      data: tenants,
      total,
      page: Math.floor(skip / take) + 1,
      pageSize: take,
      totalPages: Math.ceil(total / take),
    };
  }

  /**
   * 테넌트 단일 조회
   */
  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        subscriptions: {
          include: {
            plan: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
        _count: {
          select: {
            users: true,
            sites: true,
            gateways: true,
            devices: true,
            metrics: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with ID ${id} not found`);
    }

    return tenant;
  }

  /**
   * 테넌트 생성
   */
  async create(createTenantDto: CreateTenantDto) {
    // 도메인 중복 확인
    if (createTenantDto.domain) {
      const existingTenant = await this.prisma.tenant.findUnique({
        where: { domain: createTenantDto.domain },
      });

      if (existingTenant) {
        throw new BadRequestException('Domain already exists');
      }
    }

    // 사업자등록번호 중복 확인
    if (createTenantDto.businessNumber) {
      const existingTenant = await this.prisma.tenant.findUnique({
        where: { businessNumber: createTenantDto.businessNumber },
      });

      if (existingTenant) {
        throw new BadRequestException('Business number already exists');
      }
    }

    // 테넌트 생성
    const tenant = await this.prisma.tenant.create({
      data: {
        name: createTenantDto.name,
        businessNumber: createTenantDto.businessNumber,
        domain: createTenantDto.domain,
        industryType: createTenantDto.industryType,
        address: createTenantDto.address,
        city: createTenantDto.city,
        country: createTenantDto.country || 'KR',
        timezone: createTenantDto.timezone || 'Asia/Seoul',
        status: 'active',
        settings: createTenantDto.settings || {},
      },
    });

    return tenant;
  }

  /**
   * 테넌트 수정
   */
  async update(id: string, updateTenantDto: UpdateTenantDto) {
    // 테넌트 존재 확인
    await this.findOne(id);

    // 도메인 변경 시 중복 확인
    if (updateTenantDto.domain) {
      const existingTenant = await this.prisma.tenant.findFirst({
        where: {
          domain: updateTenantDto.domain,
          id: { not: id },
        },
      });

      if (existingTenant) {
        throw new BadRequestException('Domain already exists');
      }
    }

    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: updateTenantDto,
    });

    return tenant;
  }

  /**
   * 테넌트 삭제 (Soft Delete)
   */
  async remove(id: string) {
    await this.findOne(id);

    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: {
        status: 'terminated',
        deletedAt: new Date(),
      },
    });

    return { message: 'Tenant deleted successfully', tenant };
  }

  /**
   * 테넌트 상태 변경
   */
  async updateStatus(id: string, status: 'active' | 'suspended' | 'terminated') {
    await this.findOne(id);

    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: { status },
    });

    // 감사 로그
    await this.prisma.auditLog.create({
      data: {
        tenantId: id,
        action: 'tenant.status_change',
        resourceType: 'tenant',
        resourceId: id,
        changes: {
          status,
        },
        result: 'success',
      },
    });

    return tenant;
  }

  /**
   * 테넌트 통계
   */
  async getStats(id: string) {
    await this.findOne(id);

    const [
      userCount,
      siteCount,
      gatewayCount,
      deviceCount,
      activeDeviceCount,
    ] = await Promise.all([
      this.prisma.user.count({ where: { tenantId: id, isActive: true } }),
      this.prisma.site.count({ where: { tenantId: id, isActive: true } }),
      this.prisma.gateway.count({ where: { tenantId: id } }),
      this.prisma.device.count({ where: { tenantId: id } }),
      this.prisma.device.count({
        where: { tenantId: id, status: 'online' },
      }),
    ]);

    return {
      users: userCount,
      sites: siteCount,
      gateways: gatewayCount,
      devices: {
        total: deviceCount,
        active: activeDeviceCount,
        inactive: deviceCount - activeDeviceCount,
      },
    };
  }
}