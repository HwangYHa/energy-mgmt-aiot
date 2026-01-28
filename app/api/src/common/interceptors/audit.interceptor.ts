// app/api/src/common/interceptors/audit.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body } = request;
    const tenantId = request.tenantId;
    const userId = request.userId;

    // 민감한 정보 제거
    const sanitizedBody = { ...body };
    delete sanitizedBody.password;
    delete sanitizedBody.token;

    return next.handle().pipe(
      tap({
        next: (data) => {
          // 성공 로그
          this.logAudit({
            tenantId,
            userId,
            action: `${method} ${url}`,
            changes: sanitizedBody,
            result: 'success',
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          });
        },
        error: (error) => {
          // 실패 로그
          this.logAudit({
            tenantId,
            userId,
            action: `${method} ${url}`,
            changes: sanitizedBody,
            result: 'failure',
            errorMessage: error.message,
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          });
        },
      }),
    );
  }

  private async logAudit(data: any) {
    try {
      await this.prisma.auditLog.create({ data });
    } catch (error) {
      console.error('Failed to create audit log:', error);
    }
  }
}