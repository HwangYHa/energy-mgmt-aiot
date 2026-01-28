import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantId;
  },
);

// 사용 예시
@Get('devices')
async getDevices(@TenantId() tenantId: string) {
  return this.prisma.device.findMany({
    where: { tenantId }, // 자동으로 필터링
  });
}