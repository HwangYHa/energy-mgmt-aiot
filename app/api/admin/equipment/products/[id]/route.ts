/**
 * GET    /api/admin/equipment/products/[id]  - 제품 상세 조회
 * PATCH  /api/admin/equipment/products/[id]  - 제품 수정 (super_admin)
 * DELETE /api/admin/equipment/products/[id]  - 제품 비활성화 / 삭제 (soft delete)
 *
 * prisma generate EPERM 회피: $queryRawUnsafe / $executeRawUnsafe 사용
 */

import { NextRequest } from 'next/server';
import { verifyAuth, isSuperAdmin } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/api/response';

export const dynamic = 'force-dynamic';

// ─── 유효 값 ─────────────────────────────────────────────────────

const VALID_CATEGORIES   = ['gateway','sensor','controller','meter','display','accessory'];
const VALID_DIFFICULTIES = ['easy','medium','hard'];

// ─── DB 행 → 응답 객체 ───────────────────────────────────────────

function mapProduct(row: any) {
  return {
    id:                row.id,
    code:              row.code,
    name:              row.name,
    modelNumber:       row.model_number,
    manufacturer:      row.manufacturer,
    category:          row.category,
    facilityTypes:     typeof row.facility_types === 'string'
      ? JSON.parse(row.facility_types) : (row.facility_types ?? []),
    specs:             typeof row.specs === 'string'
      ? JSON.parse(row.specs) : (row.specs ?? {}),
    protocols:         typeof row.protocols === 'string'
      ? JSON.parse(row.protocols) : (row.protocols ?? []),
    unitPrice:         row.unit_price !== null ? Number(row.unit_price) : null,
    description:       row.description  ?? null,
    imageUrl:          row.image_url    ?? null,
    installDifficulty: row.install_difficulty,
    warrantyMonths:    row.warranty_months,
    isActive:          Boolean(row.is_active),
    createdAt:         row.created_at,
    updatedAt:         row.updated_at,
  };
}

// ─── GET ─────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!isSuperAdmin(auth)) return forbiddenResponse();

    const { id } = await params;
    const rows = await prisma.$queryRawUnsafe<any[]>(
      'SELECT * FROM equipment_product WHERE id = ?', id,
    );
    if (!rows.length) return notFoundResponse('제품을 찾을 수 없습니다');

    return successResponse(mapProduct(rows[0]));
  } catch (error) {
    console.error('[제품] 상세 조회 오류:', error);
    return serverErrorResponse();
  }
}

// ─── PATCH ───────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!isSuperAdmin(auth)) return forbiddenResponse();

    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) return errorResponse('VALIDATION_ERROR', { details: { message: '요청 바디가 없습니다' } });

    // 존재 확인
    const existRows = await prisma.$queryRawUnsafe<any[]>(
      'SELECT id, model_number FROM equipment_product WHERE id = ?', id,
    );
    if (!existRows.length) return notFoundResponse('제품을 찾을 수 없습니다');
    const existing = existRows[0];

    // category 유효성
    if (body.category !== undefined && !VALID_CATEGORIES.includes(body.category)) {
      return errorResponse('VALIDATION_ERROR', {
        details: { message: `유효하지 않은 category. 허용값: ${VALID_CATEGORIES.join(', ')}` },
      });
    }
    // installDifficulty 유효성
    if (body.installDifficulty !== undefined && !VALID_DIFFICULTIES.includes(body.installDifficulty)) {
      return errorResponse('VALIDATION_ERROR', {
        details: { message: 'installDifficulty는 easy | medium | hard 중 하나여야 합니다' },
      });
    }

    // modelNumber 변경 시 중복 체크
    if (body.modelNumber && body.modelNumber !== existing.model_number) {
      const dupRows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
        'SELECT COUNT(*) AS cnt FROM equipment_product WHERE model_number = ? AND id != ?',
        body.modelNumber, id,
      );
      if (Number(dupRows[0]?.cnt) > 0) {
        return errorResponse('RESOURCE_CONFLICT', { details: { message: '이미 존재하는 모델 번호입니다' } });
      }
    }

    const now = new Date();
    const setParts: string[] = ['updated_at = ?'];
    const setArgs: unknown[] = [now];

    const addField = (col: string, val: unknown) => {
      setParts.push(`${col} = ?`);
      setArgs.push(val);
    };

    if (body.name              !== undefined) addField('name',               body.name);
    if (body.modelNumber       !== undefined) addField('model_number',        body.modelNumber);
    if (body.manufacturer      !== undefined) addField('manufacturer',         body.manufacturer);
    if (body.category          !== undefined) addField('category',             body.category);
    if (body.facilityTypes     !== undefined) addField('facility_types',       JSON.stringify(body.facilityTypes));
    if (body.specs             !== undefined) addField('specs',                JSON.stringify(body.specs));
    if (body.protocols         !== undefined) addField('protocols',            JSON.stringify(body.protocols));
    if (body.unitPrice         !== undefined) addField('unit_price',           body.unitPrice ?? null);
    if (body.description       !== undefined) addField('description',          body.description  ?? null);
    if (body.imageUrl          !== undefined) addField('image_url',            body.imageUrl     ?? null);
    if (body.installDifficulty !== undefined) addField('install_difficulty',   body.installDifficulty);
    if (body.warrantyMonths    !== undefined) addField('warranty_months',      body.warrantyMonths);
    if (body.isActive          !== undefined) addField('is_active',            body.isActive ? 1 : 0);

    await prisma.$executeRawUnsafe(
      `UPDATE equipment_product SET ${setParts.join(', ')} WHERE id = ?`,
      ...setArgs, id,
    );

    const rows = await prisma.$queryRawUnsafe<any[]>(
      'SELECT * FROM equipment_product WHERE id = ?', id,
    );
    console.info(`[제품] 수정 완료: ${rows[0]?.model_number}`);
    return successResponse(mapProduct(rows[0]));
  } catch (error) {
    console.error('[제품] 수정 오류:', error);
    return serverErrorResponse();
  }
}

// ─── DELETE ──────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!isSuperAdmin(auth)) return forbiddenResponse();

    const { id } = await params;
    const existRows = await prisma.$queryRawUnsafe<any[]>(
      'SELECT id, model_number FROM equipment_product WHERE id = ?', id,
    );
    if (!existRows.length) return notFoundResponse('제품을 찾을 수 없습니다');
    const existing = existRows[0];

    // 출고 이력 확인
    const inUseRows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      'SELECT COUNT(*) AS cnt FROM equipment_lot_item WHERE product_id = ?', id,
    );
    const inUse = Number(inUseRows[0]?.cnt ?? 0);

    if (inUse > 0) {
      // 출고 이력 있으면 soft delete (비활성화)
      await prisma.$executeRawUnsafe(
        'UPDATE equipment_product SET is_active = 0, updated_at = ? WHERE id = ?',
        new Date(), id,
      );
      console.info(`[제품] 비활성화 (출고 이력 ${inUse}건): ${existing.model_number}`);
      return successResponse({
        deleted: false, deactivated: true,
        message: `출고 이력이 있는 제품은 비활성화되었습니다 (${inUse}건)`,
      });
    }

    // 이력 없으면 실제 삭제
    await prisma.$executeRawUnsafe(
      'DELETE FROM equipment_product WHERE id = ?', id,
    );
    console.info(`[제품] 삭제 완료: ${existing.model_number}`);
    return successResponse({ deleted: true, deactivated: false, message: '제품이 삭제되었습니다' });
  } catch (error) {
    console.error('[제품] 삭제 오류:', error);
    return serverErrorResponse();
  }
}
