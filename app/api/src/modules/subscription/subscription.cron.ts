// app/api/src/modules/subscription/subscription.cron.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { addDays } from 'date-fns';

@Injectable()
export class SubscriptionCron {
  constructor(private prisma: PrismaService) {}

  // 매일 자정 실행
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkSubscriptionStatus() {
    const now = new Date();
    const expireSoonDate = addDays(now, 7); // 7일 전

    // EXPIRE_SOON 처리
    await this.prisma.subscription.updateMany({
      where: {
        status: 'ACTIVE',
        endDate: {
          lte: expireSoonDate,
          gte: now,
        },
      },
      data: {
        status: 'EXPIRE_SOON',
      },
    });

    // EXPIRED 처리
    await this.prisma.subscription.updateMany({
      where: {
        status: {
          in: ['ACTIVE', 'EXPIRE_SOON'],
        },
        endDate: {
          lt: now,
        },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    // 알림 발송 (EXPIRE_SOON)
    const expiringSoon = await this.prisma.subscription.findMany({
      where: { status: 'EXPIRE_SOON' },
      include: { tenant: true },
    });

    for (const sub of expiringSoon) {
      // TODO: 이메일/SMS 발송
      console.log(`[알림] ${sub.tenant.name} 구독 만료 임박: ${sub.endDate}`);
    }
  }
}