// app/api/src/modules/control/schedule.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ControlService } from './control.service';

export interface CreateScheduleDto {
  name: string;
  description?: string;
  deviceId: string;
  command: string;
  value?: any;
  cronExpression: string;
  timezone?: string;
  isActive?: boolean;
  startDate?: Date;
  endDate?: Date;
}

export interface UpdateScheduleDto {
  name?: string;
  description?: string;
  command?: string;
  value?: any;
  cronExpression?: string;
  timezone?: string;
  isActive?: boolean;
  startDate?: Date;
  endDate?: Date;
}

/**
 * 📅 스케줄 제어 서비스
 * 
 * 역할:
 * - Cron 기반 스케줄 관리
 * - 자동 제어 실행
 * - 스케줄 이력 기록
 */

@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly controlService: ControlService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    this.loadSchedules();
  }

  /**
   * 앱 시작 시 활성 스케줄 로드
   */
  async loadSchedules() {
    const schedules = await this.prisma.controlSchedule.findMany({
      where: {
        isActive: true,
        OR: [
          { endDate: null },
          { endDate: { gte: new Date() } },
        ],
      },
    });

    for (const schedule of schedules) {
      await this.registerCronJob(schedule);
    }

    console.log(`✅ Loaded ${schedules.length} active schedules`);
  }

  /**
   * Cron Job 등록
   */
  private async registerCronJob(schedule: any) {
    try {
      const job = new CronJob(
        schedule.cronExpression,
        () => this.executeScheduledControl(schedule.id),
        null,
        true,
        schedule.timezone || 'Asia/Seoul',
      );

      this.schedulerRegistry.addCronJob(schedule.id, job);
      console.log(`✅ Registered schedule: ${schedule.name} (${schedule.cronExpression})`);
    } catch (error) {
      console.error(`❌ Failed to register schedule ${schedule.id}:`, error);
    }
  }

  /**
   * 스케줄 실행
   */
  async executeScheduledControl(scheduleId: string) {
    const schedule = await this.prisma.controlSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        device: true,
      },
    });

    if (!schedule || !schedule.isActive) {
      return;
    }

    // 종료일 체크
    if (schedule.endDate && new Date() > schedule.endDate) {
      await this.disableSchedule(scheduleId);
      return;
    }

    try {
      // 제어 명령 생성 및 실행
      const controlLog = await this.controlService.createCommand(
        'system', // 시스템 사용자 (스케줄러)
        schedule.tenantId,
        {
          deviceId: schedule.deviceId,
          command: schedule.command,
          value: schedule.value ? JSON.parse(schedule.value) : null,
          reason: `Scheduled control: ${schedule.name}`,
          requiresApproval: false, // 스케줄은 자동 실행
        },
      );

      // 스케줄 실행 이력 기록
      await this.prisma.controlScheduleLog.create({
        data: {
          scheduleId: schedule.id,
          controlLogId: controlLog.id,
          executedAt: new Date(),
          status: 'success',
        },
      });

      // 마지막 실행 시간 업데이트
      await this.prisma.controlSchedule.update({
        where: { id: scheduleId },
        data: {
          lastExecutedAt: new Date(),
          executionCount: { increment: 1 },
        },
      });

      console.log(`✅ Executed schedule: ${schedule.name}`);
    } catch (error) {
      // 실패 로그
      await this.prisma.controlScheduleLog.create({
        data: {
          scheduleId: schedule.id,
          executedAt: new Date(),
          status: 'failed',
          error: error.message,
        },
      });

      console.error(`❌ Failed to execute schedule ${schedule.id}:`, error);
    }
  }

  /**
   * 스케줄 생성
   */
  async createSchedule(
    tenantId: string,
    userId: string,
    createDto: CreateScheduleDto,
  ) {
    // 디바이스 존재 확인
    const device = await this.prisma.device.findFirst({
      where: {
        id: createDto.deviceId,
        tenantId,
      },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Cron 표현식 검증
    try {
      new CronJob(createDto.cronExpression, () => {});
    } catch (error) {
      throw new Error(`Invalid cron expression: ${error.message}`);
    }

    // 스케줄 생성
    const schedule = await this.prisma.controlSchedule.create({
      data: {
        ...createDto,
        tenantId,
        createdBy: userId,
        value: createDto.value ? JSON.stringify(createDto.value) : null,
        isActive: createDto.isActive !== false, // 기본값 true
      },
    });

    // Cron Job 등록
    if (schedule.isActive) {
      await this.registerCronJob(schedule);
    }

    return schedule;
  }

  /**
   * 스케줄 목록 조회
   */
  async findAll(tenantId: string, params?: {
    skip?: number;
    take?: number;
    deviceId?: string;
    isActive?: boolean;
  }) {
    const { skip = 0, take = 10, deviceId, isActive } = params || {};

    const where: any = { tenantId };
    if (deviceId) where.deviceId = deviceId;
    if (typeof isActive === 'boolean') where.isActive = isActive;

    const [schedules, total] = await Promise.all([
      this.prisma.controlSchedule.findMany({
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
          creator: {
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
      this.prisma.controlSchedule.count({ where }),
    ]);

    return {
      data: schedules,
      total,
      page: Math.floor(skip / take) + 1,
      pageSize: take,
      totalPages: Math.ceil(total / take),
    };
  }

  /**
   * 스케줄 단일 조회
   */
  async findOne(id: string, tenantId: string) {
    const schedule = await this.prisma.controlSchedule.findFirst({
      where: { id, tenantId },
      include: {
        device: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            logs: true,
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return schedule;
  }

  /**
   * 스케줄 수정
   */
  async update(
    id: string,
    tenantId: string,
    updateDto: UpdateScheduleDto,
  ) {
    const schedule = await this.findOne(id, tenantId);

    // Cron Job 제거
    if (this.schedulerRegistry.doesExist('cron', id)) {
      this.schedulerRegistry.deleteCronJob(id);
    }

    // 스케줄 업데이트
    const updated = await this.prisma.controlSchedule.update({
      where: { id },
      data: {
        ...updateDto,
        value: updateDto.value ? JSON.stringify(updateDto.value) : undefined,
      },
    });

    // 활성화 상태면 Cron Job 재등록
    if (updated.isActive) {
      await this.registerCronJob(updated);
    }

    return updated;
  }

  /**
   * 스케줄 삭제
   */
  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);

    // Cron Job 제거
    if (this.schedulerRegistry.doesExist('cron', id)) {
      this.schedulerRegistry.deleteCronJob(id);
    }

    await this.prisma.controlSchedule.delete({
      where: { id },
    });

    return { message: 'Schedule deleted successfully' };
  }

  /**
   * 스케줄 활성화/비활성화
   */
  async toggleSchedule(id: string, tenantId: string, isActive: boolean) {
    const schedule = await this.findOne(id, tenantId);

    if (isActive) {
      // 활성화 → Cron Job 등록
      await this.registerCronJob(schedule);
    } else {
      // 비활성화 → Cron Job 제거
      if (this.schedulerRegistry.doesExist('cron', id)) {
        this.schedulerRegistry.deleteCronJob(id);
      }
    }

    return this.prisma.controlSchedule.update({
      where: { id },
      data: { isActive },
    });
  }

  /**
   * 스케줄 비활성화 (종료일 초과 시)
   */
  private async disableSchedule(id: string) {
    if (this.schedulerRegistry.doesExist('cron', id)) {
      this.schedulerRegistry.deleteCronJob(id);
    }

    await this.prisma.controlSchedule.update({
      where: { id },
      data: { isActive: false },
    });

    console.log(`⏸️ Disabled schedule: ${id} (end date reached)`);
  }

  /**
   * 스케줄 실행 이력
   */
  async getScheduleLogs(scheduleId: string, tenantId: string, params?: {
    skip?: number;
    take?: number;
  }) {
    const { skip = 0, take = 10 } = params || {};

    // 스케줄 소유권 확인
    await this.findOne(scheduleId, tenantId);

    const [logs, total] = await Promise.all([
      this.prisma.controlScheduleLog.findMany({
        where: { scheduleId },
        skip,
        take,
        include: {
          controlLog: {
            select: {
              id: true,
              command: true,
              status: true,
            },
          },
        },
        orderBy: {
          executedAt: 'desc',
        },
      }),
      this.prisma.controlScheduleLog.count({
        where: { scheduleId },
      }),
    ]);

    return {
      data: logs,
      total,
      page: Math.floor(skip / take) + 1,
      pageSize: take,
      totalPages: Math.ceil(total / take),
    };
  }
}