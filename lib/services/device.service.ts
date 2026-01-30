// app/api/src/modules/device/device.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface CreateDeviceDto {
  siteId: string;
  gatewayId?: string;
  name: string;
  type: string;
  protocol?: string;
  address?: string;
  port?: number;
  slaveId?: number;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  installDate?: Date;
  warrantyEndDate?: Date;
  metadata?: any;
}

export interface UpdateDeviceDto {
  siteId?: string;
  gatewayId?: string;
  name?: string;
  type?: string;
  protocol?: string;
  address?: string;
  port?: number;
  slaveId?: number;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  status?: string;
  installDate?: Date;
  warrantyEndDate?: Date;
  metadata?: any;
}

@Injectable()
export class DeviceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 디바이스 목록 조회
   */
  async findAll(tenantId: string, params?: {
    skip?: number;
    take?: number;
    siteId?: string;
    gatewayId?: string;
    type?: string;
    status?: string;
    search?: string;
  }) {
    const { skip = 0, take = 10, siteId, gatewayId, type, status, search } = params || {};

    const where: any = { tenantId };

    if (siteId) where.siteId = siteId;
    if (gatewayId) where.gatewayId = gatewayId;
    if (type) where.type = type;
    if (status) where.status = status;

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { manufacturer: { contains: search } },
        { model: { contains: search } },
      ];
    }

    const [devices, total] = await Promise.all([
      this.prisma.device.findMany({
        where,
        skip,
        take,
        include: {
          site: {
            select: {
              id: true,
              name: true,
            },
          },
          gateway: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
          _count: {
            select: {
              metrics: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.device.count({ where }),
    ]);

    return {
      data: devices,
      total,
      page: Math.floor(skip / take) + 1,
      pageSize: take,
      totalPages: Math.ceil(total / take),
    };
  }

  /**
   * 디바이스 단일 조회
   */
  async findOne(id: string, tenantId: string) {
    const device = await this.prisma.device.findFirst({
      where: { id, tenantId },
      include: {
        site: true,
        gateway: true,
        metrics: {
          select: {
            id: true,
            key: true,
            name: true,
            unit: true,
            dataType: true,
          },
        },
      },
    });

    if (!device) {
      throw new NotFoundException(`Device with ID ${id} not found`);
    }

    return device;
  }

  /**
   * 디바이스 생성
   */
  async create(tenantId: string, createDeviceDto: CreateDeviceDto) {
    // Site 존재 확인
    const site = await this.prisma.site.findFirst({
      where: { id: createDeviceDto.siteId, tenantId },
    });

    if (!site) {
      throw new BadRequestException('Site not found');
    }

    // Gateway 존재 확인 (선택)
    if (createDeviceDto.gatewayId) {
      const gateway = await this.prisma.gateway.findFirst({
        where: { id: createDeviceDto.gatewayId, tenantId },
      });

      if (!gateway) {
        throw new BadRequestException('Gateway not found');
      }
    }

    const device = await this.prisma.device.create({
      data: {
        ...createDeviceDto,
        tenantId,
      },
    });

    return device;
  }

  /**
   * 디바이스 수정
   */
  async update(id: string, tenantId: string, updateDeviceDto: UpdateDeviceDto) {
    await this.findOne(id, tenantId);

    const device = await this.prisma.device.update({
      where: { id },
      data: updateDeviceDto,
    });

    return device;
  }

  /**
   * 디바이스 삭제
   */
  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    // 연결된 Metric이 있는지 확인
    const metricCount = await this.prisma.metric.count({
      where: { deviceId: id },
    });

    if (metricCount > 0) {
      throw new BadRequestException(
        'Cannot delete device with active metrics',
      );
    }

    await this.prisma.device.delete({
      where: { id },
    });

    return { message: 'Device deleted successfully' };
  }

  /**
   * 디바이스 상태 업데이트
   */
  async updateStatus(id: string, tenantId: string, status: string) {
    await this.findOne(id, tenantId);

    const device = await this.prisma.device.update({
      where: { id },
      data: {
        status,
        lastSeenAt: new Date(),
      },
    });

    return device;
  }

  /**
   * 디바이스 최근 측정값
   */
  async getLatestMeasurements(id: string, tenantId: string) {
    const device = await this.findOne(id, tenantId);

    const measurements = await this.prisma.measurement.findMany({
      where: {
        metric: {
          deviceId: id,
        },
      },
      include: {
        metric: {
          select: {
            key: true,
            name: true,
            unit: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 10,
    });

    return measurements;
  }
}