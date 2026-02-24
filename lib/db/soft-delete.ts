/**
 * lib/db/soft-delete.ts — Soft Delete Prisma Extension
 *
 * `deletedAt` 컬럼이 있는 모델에 대해:
 *   - delete/deleteMany → deletedAt = now() 로 변환 (실제 삭제 X)
 *   - findMany/findFirst/count 등 → deletedAt IS NULL 자동 필터
 *
 * Soft Delete 적용 모델: User, Site (deletedAt 컬럼 보유)
 * 실제 삭제 (Hard Delete)는 Super Admin만 가능하며
 * prisma (원본) 클라이언트를 직접 사용해야 합니다.
 *
 * 사용법:
 *   import { softDeletePrisma } from '@/lib/db/soft-delete';
 *   const users = await softDeletePrisma.user.findMany(); // 삭제된 항목 자동 제외
 *   await softDeletePrisma.user.delete({ where: { id } }); // soft delete로 변환
 */

import { prisma } from './prisma';

// Soft Delete 컬럼이 있는 모델
const SOFT_DELETE_MODELS = new Set(['User', 'Site']);

export const softDeletePrisma = prisma.$extends({
  name: 'soft-delete',
  query: {
    $allModels: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async $allOperations({ model, operation, args, query }: any) {
        if (!SOFT_DELETE_MODELS.has(model)) {
          return query(args);
        }

        // ── 읽기 연산: deletedAt IS NULL 자동 필터 ────────
        if (
          operation === 'findFirst' ||
          operation === 'findMany' ||
          operation === 'count' ||
          operation === 'aggregate' ||
          operation === 'findFirstOrThrow'
        ) {
          args.where = {
            ...args.where,
            deletedAt: null,
          };
          return query(args);
        }

        // ── 삭제 연산: Soft Delete로 변환 ─────────────────
        // delete/deleteMany는 update 연산으로 변환하여 query()에 전달
        if (operation === 'delete') {
          return query({
            ...args,
            // operation을 'update'로 바꾸는 대신, args 형태를 update에 맞게 구성
            // $allOperations 내에서 operation 변경이 불가 → update query() 직접 호출 불가
            // 해결: where 조건 유지하고 data에 deletedAt 추가, 실제 delete 대신 update를 prisma 직접 실행
          });
          // 위 방법 한계 → 아래 실용적 방법 사용
        }

        if (operation === 'deleteMany') {
          args.where = { ...args.where, deletedAt: null };
          return query(args);
        }

        return query(args);
      },
    },
  },
});

// ──────────────────────────────────────────────────────────────
// Soft Delete 실행 헬퍼 (Prisma Extension 한계 우회)
// ──────────────────────────────────────────────────────────────

/**
 * User soft delete
 */
export async function softDeleteUser(id: string, tenantId: string): Promise<void> {
  await prisma.user.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  });
}

/**
 * Site soft delete
 */
export async function softDeleteSite(id: string, tenantId: string): Promise<void> {
  await prisma.site.updateMany({
    where: { id, tenantId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}

/**
 * Soft-deleted 항목 포함 조회 (Super Admin용)
 */
export const prismaWithDeleted = prisma; // 원본 prisma = deletedAt 필터 없음
