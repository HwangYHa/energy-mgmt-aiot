// lib\db\prisma.ts
import { Injectable, OnModuleInit, INestApplicationContext } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super({
      log: ['query', 'error', 'warn'],
    });

    // ==========================================
    // Prisma Middleware: 자동 tenantId 주입
    // ==========================================
    this.$use(async (params, next) => {
      // tenantId를 컨텍스트에서 가져옴 (AsyncLocalStorage 또는 Request Context)
      const tenantId = this.getTenantId();

      if (!tenantId) {
        // tenantId가 없으면 그대로 진행 (시스템 작업 또는 인증 전)
        return next(params);
      }

      // ==========================================
      // Create/Update: tenantId 자동 주입
      // ==========================================
      if (params.action === 'create') {
        if (params.model && this.isTenantModel(params.model)) {
          params.args.data = {
            ...params.args.data,
            tenantId,
          };
        }
      }

      if (params.action === 'createMany') {
        if (params.model && this.isTenantModel(params.model)) {
          if (Array.isArray(params.args.data)) {
            params.args.data = params.args.data.map((data: any) => ({
              ...data,
              tenantId,
            }));
          } else {
            params.args.data = {
              ...params.args.data,
              tenantId,
            };
          }
        }
      }

      // ==========================================
      // Read: tenantId 필터 자동 추가
      // ==========================================
      if (
        params.action === 'findUnique' ||
        params.action === 'findFirst' ||
        params.action === 'findMany' ||
        params.action === 'count' ||
        params.action === 'aggregate'
      ) {
        if (params.model && this.isTenantModel(params.model)) {
          params.args.where = {
            ...params.args.where,
            tenantId,
          };
        }
      }

      // ==========================================
      // Update/Delete: tenantId 필터 자동 추가
      // ==========================================
      if (
        params.action === 'update' ||
        params.action === 'updateMany' ||
        params.action === 'delete' ||
        params.action === 'deleteMany'
      ) {
        if (params.model && this.isTenantModel(params.model)) {
          params.args.where = {
            ...params.args.where,
            tenantId,
          };
        }
      }

      return next(params);
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplicationContext) {
    this.$on('beforeExit', async () => {
      await app.close();
    });
  }

  /**
   * tenantId를 가져오는 메서드 (AsyncLocalStorage 또는 Request Context)
   * 실제 구현은 프로젝트에 맞게 수정 필요
   */
  private getTenantId(): string | null {
    // TODO: AsyncLocalStorage 또는 Request Context에서 tenantId 가져오기
    // 예: return AsyncLocalStorage.getStore()?.tenantId;
    return null;
  }

  /**
   * Tenant 격리가 필요한 모델인지 확인
   */
  private isTenantModel(model: string): boolean {
    const tenantModels = [
      'User',
      'Site',
      'Gateway',
      'Device',
      'Metric',
      'Measurement',
      'Subscription',
      'AlertRule',
      'AuditLog',
      'DrEvent',
      'EmissionsData',
      'RegulationReport',
      'ControlLog',
    ];

    return tenantModels.includes(model);
  }

  /**
   * tenantId를 명시적으로 설정하는 메서드
   * (테스트 또는 특수한 경우)
   */
  setTenantId(tenantId: string) {
    // TODO: AsyncLocalStorage에 tenantId 저장
  }

  /**
   * tenantId를 초기화하는 메서드
   */
  clearTenantId() {
    // TODO: AsyncLocalStorage에서 tenantId 제거
  }
}