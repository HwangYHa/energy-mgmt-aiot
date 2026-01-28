// app/api/src/modules/auth/guards/subscription.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 필요한 구독 상태 확인
    const requiredStatus = this.reflector.get<string[]>(
      'subscriptionStatus',
      context.getHandler(),
    );

    if (!requiredStatus) {
      return true; // 구독 상태 체크 불필요
    }

    const request = context.switchToHttp().getRequest();
    const tenantId = request.tenantId;

    // 현재 구독 조회
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        tenantId,
        status: {
          in: ['ACTIVE', 'EXPIRE_SOON', 'EXPIRED'],
        },
      },
      orderBy: { endDate: 'desc' },
    });

    if (!subscription) {
      throw new ForbiddenException('No active subscription');
    }

    // 상태 체크
    if (!requiredStatus.includes(subscription.status)) {
      throw new ForbiddenException(
        `Subscription status '${subscription.status}' is not allowed. Required: ${requiredStatus.join(', ')}`
      );
    }

    return true;
  }
}

// 사용 예시
@Post('control')
@UseGuards(SubscriptionGuard)
@SetMetadata('subscriptionStatus', ['ACTIVE', 'EXPIRE_SOON'])
async executeControl(@TenantId() tenantId: string, @Body() dto: ControlDto) {
  // ACTIVE 또는 EXPIRE_SOON 상태만 실행 가능
}