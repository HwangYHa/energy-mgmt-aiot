// app/api/src/modules/alert/alert.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';

/**
 * 🔔 알람 작업 프로세서
 * 
 * 역할:
 * - BullMQ 큐에서 알람 작업 처리
 * - 알람 이벤트 DB 저장
 * - 알림 발송 (이메일/SMS/웹훅)
 */

interface AlertJob {
  ruleId: string;
  tenantId: string;
  metricId: string;
  value: number;
  severity: string;
  message: string;
  notificationChannels?: string[];
  recipients?: string[];
}

@Processor('alerts')
export class AlertProcessor extends WorkerHost {
  private readonly logger = new Logger(AlertProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {
    super();
  }

  async process(job: Job<AlertJob>): Promise<void> {
    const { ruleId, tenantId, metricId, value, severity, message, notificationChannels, recipients } = job.data;

    this.logger.log(`Processing alert: ${message}`);

    try {
      // 1. 알람 이벤트 DB 저장
      const alertEvent = await this.prisma.alertEvent.create({
        data: {
          tenantId,
          ruleId,
          severity,
          message,
          value: value.toString(),
          status: 'triggered',
        },
      });

      // 2. 알림 발송
      if (notificationChannels && notificationChannels.length > 0) {
        for (const channel of notificationChannels) {
          try {
            await this.sendNotification(
              channel,
              severity,
              message,
              recipients || [],
            );
          } catch (error) {
            this.logger.error(`Failed to send notification via ${channel}:`, error);
          }
        }
      }

      // 3. 알람 이벤트 상태 업데이트
      await this.prisma.alertEvent.update({
        where: { id: alertEvent.id },
        data: {
          status: 'sent',
          sentAt: new Date(),
        },
      });

      this.logger.log(`Alert processed successfully: ${alertEvent.id}`);
    } catch (error) {
      this.logger.error('Failed to process alert:', error);
      throw error;
    }
  }

  /**
   * 채널별 알림 발송
   */
  private async sendNotification(
    channel: string,
    severity: string,
    message: string,
    recipients: string[],
  ): Promise<void> {
    switch (channel) {
      case 'email':
        await this.notificationService.sendEmail({
          to: recipients,
          subject: `[${severity.toUpperCase()}] EMS 알람`,
          template: 'alert',
          context: {
            severity,
            message,
            timestamp: new Date().toISOString(),
          },
        });
        break;

      case 'sms':
        await this.notificationService.sendSMS({
          to: recipients,
          message: `[${severity.toUpperCase()}] ${message}`,
        });
        break;

      case 'webhook':
        await this.notificationService.sendWebhook({
          url: recipients[0], // Webhook URL
          payload: {
            severity,
            message,
            timestamp: new Date().toISOString(),
          },
        });
        break;

      default:
        this.logger.warn(`Unknown notification channel: ${channel}`);
    }
  }
}