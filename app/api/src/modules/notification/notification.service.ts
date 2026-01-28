// app/api/src/modules/notification/notification.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * 📨 알림 서비스
 * 
 * 역할:
 * - 이메일 발송 (SMTP)
 * - SMS 발송 (선택)
 * - 웹훅 발송
 */

interface EmailOptions {
  to: string[];
  subject: string;
  template: string;
  context: any;
}

interface SMSOptions {
  to: string[];
  message: string;
}

interface WebhookOptions {
  url: string;
  payload: any;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    // SMTP 설정
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST', 'smtp.gmail.com'),
      port: this.configService.get('SMTP_PORT', 587),
      secure: false, // TLS
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASSWORD'),
      },
    });
  }

  /**
   * 이메일 발송
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const html = this.renderTemplate(options.template, options.context);

      const mailOptions = {
        from: this.configService.get('SMTP_FROM', 'EMS System <noreply@ems.com>'),
        to: options.to.join(', '),
        subject: options.subject,
        html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent: ${info.messageId}`);
    } catch (error) {
      this.logger.error('Failed to send email:', error);
      throw error;
    }
  }

  /**
   * 이메일 템플릿 렌더링
   */
  private renderTemplate(template: string, context: any): string {
    switch (template) {
      case 'alert':
        return this.alertTemplate(context);
      default:
        return this.defaultTemplate(context);
    }
  }

  /**
   * 알람 이메일 템플릿
   */
  private alertTemplate(context: any): string {
    const severityColor = {
      critical: '#dc2626',
      warning: '#f59e0b',
      info: '#3b82f6',
    };

    const color = severityColor[context.severity] || '#6b7280';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${color}; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9fafb; padding: 20px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
          .badge { display: inline-block; background-color: ${color}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 EMS 알람</h1>
          </div>
          <div class="content">
            <p><span class="badge">${context.severity.toUpperCase()}</span></p>
            <h2>${context.message}</h2>
            <p><strong>발생 시간:</strong> ${new Date(context.timestamp).toLocaleString('ko-KR')}</p>
          </div>
          <div class="footer">
            <p>이 메일은 자동으로 발송되었습니다.</p>
            <p>© 2026 Energy Management System</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * 기본 템플릿
   */
  private defaultTemplate(context: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <body>
        <h2>알림</h2>
        <p>${JSON.stringify(context)}</p>
      </body>
      </html>
    `;
  }

  /**
   * SMS 발송 (선택 - 외부 서비스 연동 필요)
   */
  async sendSMS(options: SMSOptions): Promise<void> {
    try {
      // TODO: SMS 서비스 연동 (Twilio, AWS SNS, 알리고 등)
      this.logger.log(`SMS would be sent to: ${options.to.join(', ')}`);
      this.logger.log(`Message: ${options.message}`);
      
      // 실제 구현 예시 (Twilio)
      // const client = twilio(accountSid, authToken);
      // for (const recipient of options.to) {
      //   await client.messages.create({
      //     body: options.message,
      //     from: '+1234567890',
      //     to: recipient,
      //   });
      // }
    } catch (error) {
      this.logger.error('Failed to send SMS:', error);
      throw error;
    }
  }

  /**
   * 웹훅 발송
   */
  async sendWebhook(options: WebhookOptions): Promise<void> {
    try {
      const response = await fetch(options.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options.payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.statusText}`);
      }

      this.logger.log(`Webhook sent to: ${options.url}`);
    } catch (error) {
      this.logger.error('Failed to send webhook:', error);
      throw error;
    }
  }

  /**
   * SMTP 연결 테스트
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified');
      return true;
    } catch (error) {
      this.logger.error('SMTP connection failed:', error);
      return false;
    }
  }
}