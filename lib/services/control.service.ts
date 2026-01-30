// app/api/src/modules/control/control.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';

export interface CreateControlCommandDto {
  deviceId: string;
  command: string;
  value?: any;
  reason?: string;
  scheduledAt?: Date;
  requiresApproval?: boolean;
}

export interface ApproveControlDto {
  approved: boolean;
  comment?: string;
}

/**
 * 🎛️ 제어 서비스
 * 
 * 역할:
 * - 수동 제어 실행
 * - 승인 워크플로우
 * - 제어 이력 관리
 * - MQTT 제어 명령 발송
 */

@Injectable()
export class ControlService {
  private mqttClient: mqtt.MqttClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.initializeMqtt();
  }

  /**
   * MQTT 클라이언트 초기화
   */
  private initializeMqtt() {
    const mqttUrl = this.configService.get('MQTT_URL', 'mqtt://localhost:1883');
    
    this.mqttClient = mqtt.connect(mqttUrl, {
      clientId: `ems-control-${Date.now()}`,
      clean: true,
      connectTimeout: 4000,
      reconnectPeriod: 1000,
    });

    this.mqttClient.on('connect', () => {
      console.log('✅ MQTT Control Client connected');
    });

    this.mqttClient.on('error', (error) => {
      console.error('❌ MQTT Control Client error:', error);
    });
  }

  /**
   * 제어 명령 생성
   */
  async createCommand(
    userId: string,
    tenantId: string,
    createDto: CreateControlCommandDto,
  ) {
    // 디바이스 존재 확인
    const device = await this.prisma.device.findFirst({
      where: {
        id: createDto.deviceId,
        tenantId,
      },
      include: {
        gateway: true,
      },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // 제어 가능 상태 확인
    if (device.status !== 'online') {
      throw new BadRequestException('Device is not online');
    }

    // 제어 로그 생성
    const controlLog = await this.prisma.controlLog.create({
      data: {
        tenantId,
        deviceId: createDto.deviceId,
        command: createDto.command,
        value: createDto.value ? JSON.stringify(createDto.value) : null,
        reason: createDto.reason,
        initiatedBy: userId,
        scheduledAt: createDto.scheduledAt,
        status: createDto.requiresApproval ? 'pending_approval' : 'pending',
      },
    });

    // 승인 필요 시 승인 대기 상태로 종료
    if (createDto.requiresApproval) {
      return {
        ...controlLog,
        message: 'Control command created and waiting for approval',
      };
    }

    // 즉시 실행
    return this.executeControl(controlLog.id, userId);
  }

  /**
   * 제어 승인
   */
  async approveControl(
    id: string,
    userId: string,
    tenantId: string,
    approveDto: ApproveControlDto,
  ) {
    const controlLog = await this.prisma.controlLog.findFirst({
      where: {
        id,
        tenantId,
        status: 'pending_approval',
      },
    });

    if (!controlLog) {
      throw new NotFoundException('Control command not found or already processed');
    }

    // 자기 자신이 신청한 제어는 승인 불가
    if (controlLog.initiatedBy === userId) {
      throw new ForbiddenException('Cannot approve your own control command');
    }

    if (approveDto.approved) {
      // 승인 → 실행
      await this.prisma.controlLog.update({
        where: { id },
        data: {
          approvedBy: userId,
          approvedAt: new Date(),
          approvalComment: approveDto.comment,
          status: 'approved',
        },
      });

      return this.executeControl(id, userId);
    } else {
      // 거부
      return this.prisma.controlLog.update({
        where: { id },
        data: {
          approvedBy: userId,
          approvedAt: new Date(),
          approvalComment: approveDto.comment,
          status: 'rejected',
        },
      });
    }
  }

  /**
   * 제어 실행
   */
  async executeControl(id: string, userId: string) {
    const controlLog = await this.prisma.controlLog.findUnique({
      where: { id },
      include: {
        device: {
          include: {
            gateway: true,
          },
        },
      },
    });

    if (!controlLog) {
      throw new NotFoundException('Control command not found');
    }

    try {
      // MQTT 토픽: control/{tenantId}/{gatewayId}/{deviceId}
      const topic = `control/${controlLog.tenantId}/${controlLog.device.gatewayId}/${controlLog.deviceId}`;
      
      const payload = {
        commandId: controlLog.id,
        command: controlLog.command,
        value: controlLog.value ? JSON.parse(controlLog.value) : null,
        timestamp: new Date().toISOString(),
        executedBy: userId,
      };

      // MQTT 발행
      await new Promise((resolve, reject) => {
        this.mqttClient.publish(
          topic,
          JSON.stringify(payload),
          { qos: 1 },
          (error) => {
            if (error) reject(error);
            else resolve(null);
          },
        );
      });

      // 상태 업데이트
      const updatedLog = await this.prisma.controlLog.update({
        where: { id },
        data: {
          status: 'executed',
          executedAt: new Date(),
          executedBy: userId,
        },
      });

      return {
        ...updatedLog,
        message: 'Control command executed successfully',
      };
    } catch (error) {
      // 실패 시
      await this.prisma.controlLog.update({
        where: { id },
        data: {
          status: 'failed',
          error: error.message,
        },
      });

      throw new BadRequestException(`Control execution failed: ${error.message}`);
    }
  }

  /**
   * 제어 이력 조회
   */
  async getControlHistory(tenantId: string, params?: {
    skip?: number;
    take?: number;
    deviceId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const { skip = 0, take = 10, deviceId, status, startDate, endDate } = params || {};

    const where: any = { tenantId };
    if (deviceId) where.deviceId = deviceId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [logs, total] = await Promise.all([
      this.prisma.controlLog.findMany({
        where,
        skip,
        take,
        include: {
          device: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          initiator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          approver: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          executor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.controlLog.count({ where }),
    ]);

    return {
      data: logs,
      total,
      page: Math.floor(skip / take) + 1,
      pageSize: take,
      totalPages: Math.ceil(total / take),
    };
  }

  /**
   * 승인 대기 중인 제어 목록
   */
  async getPendingApprovals(tenantId: string) {
    return this.prisma.controlLog.findMany({
      where: {
        tenantId,
        status: 'pending_approval',
      },
      include: {
        device: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        initiator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * 제어 취소
   */
  async cancelControl(id: string, userId: string, tenantId: string) {
    const controlLog = await this.prisma.controlLog.findFirst({
      where: {
        id,
        tenantId,
        status: {
          in: ['pending', 'pending_approval'],
        },
      },
    });

    if (!controlLog) {
      throw new NotFoundException('Control command not found or already processed');
    }

    // 자기 자신이 신청한 것만 취소 가능
    if (controlLog.initiatedBy !== userId) {
      throw new ForbiddenException('You can only cancel your own control commands');
    }

    return this.prisma.controlLog.update({
      where: { id },
      data: {
        status: 'cancelled',
        error: 'Cancelled by user',
      },
    });
  }

  /**
   * 제어 통계
   */
  async getControlStats(tenantId: string, days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [total, executed, failed, pending] = await Promise.all([
      this.prisma.controlLog.count({
        where: {
          tenantId,
          createdAt: { gte: startDate },
        },
      }),
      this.prisma.controlLog.count({
        where: {
          tenantId,
          status: 'executed',
          createdAt: { gte: startDate },
        },
      }),
      this.prisma.controlLog.count({
        where: {
          tenantId,
          status: 'failed',
          createdAt: { gte: startDate },
        },
      }),
      this.prisma.controlLog.count({
        where: {
          tenantId,
          status: {
            in: ['pending', 'pending_approval'],
          },
        },
      }),
    ]);

    return {
      total,
      executed,
      failed,
      pending,
      successRate: total > 0 ? ((executed / total) * 100).toFixed(1) : 0,
    };
  }
}