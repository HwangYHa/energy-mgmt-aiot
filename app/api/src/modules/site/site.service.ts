// app/api/src/modules/site/site.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateSiteDto {
  name: string;
  address: string;
  city?: string;
  country?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  metadata?: any;
}

export interface UpdateSiteDto {
  name?: string;
  address?: string;
  city?: string;
  country?: string;
  timezone?: string;
  latitude?: number;
  longitude?: number;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  isActive?: boolean;
  metadata?: any;
}

@Injectable()
export class SiteService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 사업장 목록 조회
   */
  async findAll(tenantId: string, params?: {
    skip?: number;
    take?: number;
    isActive?: boolean;
    search?: string;
  }) {
    const { skip = 0, take = 10, isActive, search } = params || {};

    const where: any = { tenantId };

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { address: { contains: search } },
        { city: { contains: search } },
      ];
    }

    const [sites, total] = await Promise.all([
      this.prisma.site.findMany({
        where,
        skip,
        take,
        include: {
          _count: {
            select: {
              gateways: true,
              devices: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.site.count({ where }),
    ]);

    return {
      data: sites,
      total,
      page: Math.floor(skip / take) + 1,
      pageSize: take,
      totalPages: Math.ceil(total / take),
    };
  }

  /**
   * 사업장 단일 조회
   */
  async findOne(id: string, tenantId: string) {
    const site = await this.prisma.site.findFirst({
      where: { id, tenantId },
      include: {
        gateways: {
          select: {
            id: true,
            name: true,
            status: true,
            lastSeenAt: true,
          },
        },
        devices: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true,
          },
          take: 10,
        },
        _count: {
          select: {
            gateways: true,
            devices: true,
            metrics: true,
          },
        },
      },
    });

    if (!site) {
      throw new NotFoundException(`Site with ID ${id} not found`);
    }

    return site;
  }

  /**
   * 사업장 생성
   */
  async create(tenantId: string, createSiteDto: CreateSiteDto) {
    const site = await this.prisma.site.create({
      data: {
        ...createSiteDto,
        tenantId,
      },
    });

    return site;
  }

  /**
   * 사업장 수정
   */
  async update(id: string, tenantId: string, updateSiteDto: UpdateSiteDto) {
    // 존재 확인
    await this.findOne(id, tenantId);

    const site = await this.prisma.site.update({
      where: { id },
      data: updateSiteDto,
    });

    return site;
  }

  /**
   * 사업장 삭제 (Soft Delete)
   */
  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    // 연결된 Gateway/Device가 있는지 확인
    const counts = await this.prisma.site.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            gateways: true,
            devices: true,
          },
        },
      },
    });

    if (counts._count.gateways > 0 || counts._count.devices > 0) {
      throw new BadRequestException(
        'Cannot delete site with active gateways or devices',
      );
    }

    const site = await this.prisma.site.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    return { message: 'Site deleted successfully', site };
  }

  /**
   * 사업장 통계
   */
  async getStats(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    const [
      gatewayCount,
      deviceCount,
      onlineDeviceCount,
      metricCount,
      measurementCount,
    ] = await Promise.all([
      this.prisma.gateway.count({ where: { siteId: id } }),
      this.prisma.device.count({ where: { siteId: id } }),
      this.prisma.device.count({ where: { siteId: id, status: 'online' } }),
      this.prisma.metric.count({ where: { siteId: id } }),
      this.prisma.measurement.count({
        where: {
          metric: {
            siteId: id,
          },
        },
      }),
    ]);

    return {
      gateways: gatewayCount,
      devices: {
        total: deviceCount,
        online: onlineDeviceCount,
        offline: deviceCount - onlineDeviceCount,
      },
      metrics: metricCount,
      measurements: measurementCount,
    };
  }
}