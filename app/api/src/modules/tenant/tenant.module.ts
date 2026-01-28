import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Tenant Context를 Request에 주입하는 Middleware
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // JWT Guard를 통과한 경우 user 정보가 있음
    const user = (req as any).user;

    if (user && user.tenantId) {
      // Tenant 정보 조회
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: {
          id: true,
          name: true,
          status: true,
          settings: true,
        },
      });

      if (!tenant) {
        throw new UnauthorizedException('Tenant not found');
      }

      if (tenant.status !== 'active') {
        throw new UnauthorizedException('Tenant is not active');
      }

      // Request에 tenant 정보 추가
      (req as any).tenant = tenant;
    }

    next();
  }
}

/**
 * Decorator: Tenant ID 가져오기
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.tenantId;
  },
);

export const Tenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenant;
  },
);