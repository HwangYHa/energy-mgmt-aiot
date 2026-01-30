// app/api/src/modules/alert/alert.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface CreateAlertRuleDto {
  name: string;
  description?: string;
  category: string;
  severity: string;
  metricId?: string;
  deviceId?: string;
  siteId?: string;
  condition: {
    operator: string; // '>', '<', '>=', '<=', '==', '!='
    threshold: number;
    duration?: number; // 지속 시간 (초)
  };
  cooldownMinutes?: number;
  isActive?: boolean;
  notificationChannels?: string[]; // ['email', 'sms', 'webhook']
  recipients?: string[]; // 이메일 주소 또는 전화번호
}

export interface UpdateAlertRuleDto {
  name?: string;
  description?: string;
  category?: string;
  severity?: string;
  condition?: any;
  cooldownMinutes?: number;
  isActive?: boolean;
  notificationChannels?: string[];
  recipients?: string[];
}

@Injectable()
export class AlertService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('alerts') private readonly alertQueue: Queue,
  ) {}

  /**
   * 알람 규칙 목록 조회
   */
  async findAllRules(tenantId: string, params?: {
    skip?: number;
    take?: number;
    category?: string;
    severity?: string;
    isActive?: boolean;
  }) {
    const { skip = 0, take = 10, category, severity, isActive } = params || {};

    const where: any = { tenantId };
    if (category) where.category = category;
    if (severity) where.severity = severity;
    if (typeof isActive === 'boolean') where.isActive = isActive;

    const [rules, total] = await Promise.all([
      this.prisma.alertRule.findMany({
        where,
        skip,
        take,
        include: {
          metric: {
            select: {
              id: true,
              key: true,
              name: true,
              unit: true,
            },
          },
          device: {
            select: {
              id: true,
              name: true,
            },
          },
          site: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.alertRule.count({ where }),
    ]);

    return {
      data: rules,
      total,
      page: Math.floor(skip / take) + 1,
      pageSize: take,
      totalPages: Math.ceil(total / take),
    };
  }

  /**
   * 알람 규칙 단일 조회
   */
  async findOneRule(id: string, tenantId: string) {
    const rule = await this.prisma.alertRule.findFirst({
      where: { id, tenantId },
      include: {
        metric: true,
        device: true,
        site: true,
      },
    });

    if (!rule) {
      throw new NotFoundException(`Alert rule with ID ${id} not found`);
    }

    return rule;
  }

  /**
   * 알람 규칙 생성
   */
  async createRule(tenantId: string, createDto: CreateAlertRuleDto) {
    // Metric, Device, Site 존재 확인
    if (createDto.metricId) {
      const metric = await this.prisma.metric.findFirst({
        where: { id: createDto.metricId, tenantId },
      });
      if (!metric) {
        throw new BadRequestException('Metric not found');
      }
    }

    if (createDto.deviceId) {
      const device = await this.prisma.device.findFirst({
        where: { id: createDto.deviceId, tenantId },
      });
      if (!device) {
        throw new BadRequestException('Device not found');
      }
    }

    if (createDto.siteId) {
      const site = await this.prisma.site.findFirst({
        where: { id: createDto.siteId, tenantId },
      });
      if (!site) {
        throw new BadRequestException('Site not found');
      }
    }

    const rule = await this.prisma.alertRule.create({
      data: {
        ...createDto,
        tenantId,
        condition: createDto.condition as any,
        notificationChannels: createDto.notificationChannels as any,
        recipients: createDto.recipients as any,
      },
    });

    return rule;
  }

  /**
   * 알람 규칙 수정
   */
  async updateRule(id: string, tenantId: string, updateDto: UpdateAlertRuleDto) {
    await this.findOneRule(id, tenantId);

    const rule = await this.prisma.alertRule.update({
      where: { id },
      data: {
        ...updateDto,
        condition: updateDto.condition ? (updateDto.condition as any) : undefined,
        notificationChannels: updateDto.notificationChannels as any,
        recipients: updateDto.recipients as any,
      },
    });

    return rule;
  }

  /**
   * 알람 규칙 삭제
   */
  async removeRule(id: string, tenantId: string) {
    await this.findOneRule(id, tenantId);

    await this.prisma.alertRule.delete({
      where: { id },
    });

    return { message: 'Alert rule deleted successfully' };
  }

  /**
   * 알람 규칙 활성화/비활성화
   */
  async toggleRule(id: string, tenantId: string, isActive: boolean) {
    await this.findOneRule(id, tenantId);

    const rule = await this.prisma.alertRule.update({
      where: { id },
      data: { isActive },
    });

    return rule;
  }

  /**
   * 측정값에 대한 알람 규칙 평가
   */
  async evaluateRules(tenantId: string, metricId: string, value: number) {
    // 활성화된 알람 규칙 조회
    const rules = await this.prisma.alertRule.findMany({
      where: {
        tenantId,
        metricId,
        isActive: true,
      },
    });

    const triggeredRules = [];

    for (const rule of rules) {
      // 쿨다운 체크
      if (rule.lastTriggeredAt && rule.cooldownMinutes) {
        const cooldownEnd = new Date(rule.lastTriggeredAt);
        cooldownEnd.setMinutes(cooldownEnd.getMinutes() + rule.cooldownMinutes);
        
        if (new Date() < cooldownEnd) {
          continue; // 쿨다운 중이면 건너뛰기
        }
      }

      // 조건 평가
      const condition = rule.condition as any;
      const isTriggered = this.evaluateCondition(
        value,
        condition.operator,
        condition.threshold,
      );

      if (isTriggered) {
        triggeredRules.push(rule);

        // 알람 이벤트 생성 (BullMQ로 비동기 처리)
        await this.alertQueue.add('send-alert', {
          ruleId: rule.id,
          tenantId,
          metricId,
          value,
          severity: rule.severity,
          message: `${rule.name}: 현재 값 ${value}이(가) 임계값 ${condition.threshold}을(를) 초과했습니다.`,
          notificationChannels: rule.notificationChannels,
          recipients: rule.recipients,
        });

        // 규칙 업데이트 (마지막 트리거 시간, 카운트)
        await this.prisma.alertRule.update({
          where: { id: rule.id },
          data: {
            lastTriggeredAt: new Date(),
            triggerCount: { increment: 1 },
          },
        });
      }
    }

    return triggeredRules;
  }

  /**
   * 조건 평가
   */
  private evaluateCondition(
    value: number,
    operator: string,
    threshold: number,
  ): boolean {
    switch (operator) {
      case '>':
        return value > threshold;
      case '<':
        return value < threshold;
      case '>=':
        return value >= threshold;
      case '<=':
        return value <= threshold;
      case '==':
        return value === threshold;
      case '!=':
        return value !== threshold;
      default:
        return false;
    }
  }

  /**
   * 알람 이력 조회
   */
  async getAlertHistory(tenantId: string, params?: {
    skip?: number;
    take?: number;
    ruleId?: string;
    severity?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const { skip = 0, take = 10, ruleId, severity, startDate, endDate } = params || {};

    const where: any = { tenantId };
    if (ruleId) where.ruleId = ruleId;
    if (severity) where.severity = severity;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [alerts, total] = await Promise.all([
      this.prisma.alertEvent.findMany({
        where,
        skip,
        take,
        include: {
          rule: {
            select: {
              id: true,
              name: true,
              category: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.alertEvent.count({ where }),
    ]);

    return {
      data: alerts,
      total,
      page: Math.floor(skip / take) + 1,
      pageSize: take,
      totalPages: Math.ceil(total / take),
    };
  }

  /**
   * 알람 통계
   */
  async getAlertStats(tenantId: string, days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.setDate() - days);

    const [total, critical, warning, info, recentAlerts] = await Promise.all([
      this.prisma.alertEvent.count({
        where: {
          tenantId,
          createdAt: { gte: startDate },
        },
      }),
      this.prisma.alertEvent.count({
        where: {
          tenantId,
          severity: 'critical',
          createdAt: { gte: startDate },
        },
      }),
      this.prisma.alertEvent.count({
        where: {
          tenantId,
          severity: 'warning',
          createdAt: { gte: startDate },
        },
      }),
      this.prisma.alertEvent.count({
        where: {
          tenantId,
          severity: 'info',
          createdAt: { gte: startDate },
        },
      }),
      this.prisma.alertEvent.findMany({
        where: {
          tenantId,
          createdAt: { gte: startDate },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,
        include: {
          rule: {
            select: {
              name: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      bySeverity: {
        critical,
        warning,
        info,
      },
      recentAlerts,
    };
  }
}