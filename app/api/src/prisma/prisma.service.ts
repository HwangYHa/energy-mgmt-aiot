// app/api/src/prisma/prisma.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();

    // Middleware: 모든 쿼리에 tenantId 자동 추가
    this.$use(async (params, next) => {
      // tenantId가 필요한 모델 목록
      const modelsWithTenant = [
        'Device',
        'Site',
        'Gateway',
        'Metric',
        'Measurement',
        'AlertRule',
      ];

      if (modelsWithTenant.includes(params.model)) {
        if (params.action === 'findMany' || params.action === 'findFirst') {
          params.args.where = {
            ...params.args.where,
            tenantId: params.args.tenantId || params.args.where?.tenantId,
          };
        }

        if (params.action === 'create' || params.action === 'update') {
          if (!params.args.data.tenantId) {
            throw new Error(`tenantId is required for ${params.model}`);
          }
        }
      }

      return next(params);
    });
  }
}