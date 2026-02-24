/**
 * lib/db/tenant-prisma.ts — 테넌트 격리 Prisma Extension
 *
 * Row-Level 멀티테넌트 보안 계층.
 * 모든 쿼리에 tenantId 필터를 자동 주입하여
 * 테넌트 간 데이터 유출을 원천 차단합니다.
 *
 * 사용법:
 *   const tp = withTenant(auth.tenantId);
 *   const sites = await tp.site.findMany(); // tenantId 자동 필터
 *   await tp.site.create({ data: { name: '...' } }); // tenantId 자동 주입
 *
 * ⚠️  Super Admin이 cross-tenant 쿼리가 필요할 때는 prisma (원본) 사용
 */

import { prisma } from './prisma';

// ──────────────────────────────────────────────────────────────
// tenantId 컬럼이 있는 모델 목록
// Plan, MenuGroup, MenuItem 등 공통 테이블은 제외
// ──────────────────────────────────────────────────────────────

const TENANT_SCOPED_MODELS = new Set([
  'User',
  'Site',
  'Gateway',
  'Device',
  'Sensor',
  'Metric',
  'Measurement',
  'Subscription',
  'AlertRule',
  'AuditLog',
  'Report',
  'ForecastResult',
  'PaymentHistory',
  'NotificationRule',
  'ApiKey',
  'PhysicalSpace',
  'TwinNode',
  'CarbonCredit',
  'CarbonTrade',
  'EmissionsData',
  'DrEvent',
]);

// findUnique/findUniqueOrThrow 결과 후검증용
// (where 절에 tenantId 추가 불가 - 복합 unique key 아니므로)
const READ_AFTER_VERIFY = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirstOrThrow',
]);

// tenantId where 자동 주입 대상 연산
const FILTER_OPERATIONS = new Set([
  'findFirst',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
]);

// ──────────────────────────────────────────────────────────────
// withTenant: 테넌트 스코프 Prisma 클라이언트 반환
// ──────────────────────────────────────────────────────────────

export function withTenant(tenantId: string) {
  if (!tenantId) throw new Error('[TenantPrisma] tenantId가 없습니다.');

  return prisma.$extends({
    name: `tenant-scope-${tenantId}`,
    query: {
      $allModels: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async $allOperations({ model, operation, args, query }: any) {
          // ── 공통 테이블은 패스 ───────────────────────
          if (!TENANT_SCOPED_MODELS.has(model)) {
            return query(args);
          }

          // ── 쓰기: tenantId 자동 삽입 ─────────────────
          if (operation === 'create') {
            args.data = { ...args.data, tenantId };
          }

          if (operation === 'createMany') {
            if (Array.isArray(args.data)) {
              args.data = args.data.map((d: Record<string, unknown>) => ({
                ...d,
                tenantId,
              }));
            }
          }

          if (operation === 'upsert') {
            args.create = { ...args.create, tenantId };
            // update는 tenantId 변경 방지
            delete args.update?.tenantId;
            // where에도 tenantId 포함
            args.where = { ...args.where, tenantId };
          }

          // ── 읽기/수정/삭제: where에 tenantId 자동 필터 ──
          if (FILTER_OPERATIONS.has(operation)) {
            args.where = { ...args.where, tenantId };
          }

          // ── findUnique 류: 결과 후검증 ──────────────────
          if (READ_AFTER_VERIFY.has(operation)) {
            const result = await query(args);
            // 결과가 있고 tenantId 필드가 있을 때 검증
            if (result && typeof result === 'object' && 'tenantId' in result) {
              if ((result as Record<string, unknown>).tenantId !== tenantId) {
                console.error('[TenantPrisma] 테넌트 격리 위반:', {
                  model,
                  operation,
                  expected: tenantId,
                  actual: (result as Record<string, unknown>).tenantId,
                });
                // findUniqueOrThrow / findFirstOrThrow 처럼 not-found 반환
                if (operation.endsWith('OrThrow')) {
                  throw new Error(`Record not found`);
                }
                return null;
              }
            }
            return result;
          }

          return query(args);
        },
      },
    },
  });
}

// ──────────────────────────────────────────────────────────────
// 소유권 검증 헬퍼 (ID로 레코드가 해당 테넌트 것인지 확인)
// ──────────────────────────────────────────────────────────────

type TenantScopedModel = {
  findFirst: (args: { where: Record<string, unknown>; select: Record<string, unknown> }) => Promise<{ id: string } | null>;
};

/**
 * 레코드가 해당 테넌트 소유인지 확인.
 *
 * ```ts
 * const ok = await verifyOwnership(prisma.site, { id: siteId, tenantId });
 * if (!ok) return forbiddenResponse();
 * ```
 */
export async function verifyOwnership(
  model: TenantScopedModel,
  where: { id: string; tenantId: string }
): Promise<boolean> {
  const record = await model.findFirst({
    where: where as Record<string, unknown>,
    select: { id: true },
  });
  return record !== null;
}
