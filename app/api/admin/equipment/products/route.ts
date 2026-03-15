/**
 * GET  /api/admin/equipment/products  - 제품 카탈로그 목록
 * POST /api/admin/equipment/products  - 제품 등록 (super_admin)
 *
 * prisma generate EPERM 회피: $queryRawUnsafe / $executeRawUnsafe 사용
 */

import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { verifyAuth, isSuperAdmin } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
} from '@/lib/api/response';
import { generateSeqNo } from '@/lib/utils/sequence';

export const dynamic = 'force-dynamic';

// ─── 유효 값 목록 ─────────────────────────────────────────────────

const VALID_CATEGORIES    = ['gateway','sensor','controller','meter','display','accessory'];
const VALID_DIFFICULTIES  = ['easy','medium','hard'];

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

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!isSuperAdmin(auth)) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const category     = searchParams.get('category');
    const facilityType = searchParams.get('facilityType');
    const isActiveParam = searchParams.get('isActive');

    const conditions: string[] = [];
    const args: unknown[] = [];

    if (category) {
      conditions.push('category = ?');
      args.push(category);
    }
    // isActive 필터: 명시적 'false'가 아니면 active만 조회
    // 파라미터 없으면 전체(isActive 무관)
    if (isActiveParam !== null) {
      conditions.push('is_active = ?');
      args.push(isActiveParam !== 'false' ? 1 : 0);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    let products = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM equipment_product ${where} ORDER BY category ASC, name ASC`,
      ...args,
    );

    // facilityType 필터 (JSON 배열 — DB 레벨 필터 어려우므로 JS에서 처리)
    if (facilityType) {
      products = products.filter((p) => {
        const types: string[] = typeof p.facility_types === 'string'
          ? JSON.parse(p.facility_types)
          : (p.facility_types ?? []);
        return types.includes(facilityType);
      });
    }

    return successResponse({ products: products.map(mapProduct), total: products.length });
  } catch (error) {
    console.error('[제품] 목록 조회 오류:', error);
    return serverErrorResponse();
  }
}

// ─── POST ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!isSuperAdmin(auth)) return forbiddenResponse();

    const body = await request.json().catch(() => null);
    if (!body?.name || !body?.modelNumber || !body?.manufacturer || !body?.category) {
      return errorResponse('VALIDATION_ERROR', { details: { message: 'name, modelNumber, manufacturer, category 필수' } });
    }

    if (!VALID_CATEGORIES.includes(body.category)) {
      return errorResponse('VALIDATION_ERROR', {
        details: { message: `유효하지 않은 category. 허용값: ${VALID_CATEGORIES.join(', ')}` },
      });
    }

    const difficulty = body.installDifficulty ?? 'medium';
    if (!VALID_DIFFICULTIES.includes(difficulty)) {
      return errorResponse('VALIDATION_ERROR', {
        details: { message: `유효하지 않은 installDifficulty. 허용값: easy, medium, hard` },
      });
    }

    // modelNumber 중복 체크
    const dupRows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      'SELECT COUNT(*) AS cnt FROM equipment_product WHERE model_number = ?',
      body.modelNumber,
    );
    if (Number(dupRows[0]?.cnt) > 0) {
      return errorResponse('RESOURCE_CONFLICT', { details: { message: '이미 존재하는 모델 번호입니다' } });
    }

    const id   = randomUUID();
    const code = await generateSeqNo('EQUIPMENT_PRODUCT');
    const now  = new Date();

    await prisma.$executeRawUnsafe(
      `INSERT INTO equipment_product
         (id, code, name, model_number, manufacturer, category,
          facility_types, specs, protocols, unit_price, description, image_url,
          install_difficulty, warranty_months, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      id,
      code,
      body.name,
      body.modelNumber,
      body.manufacturer,
      body.category,
      JSON.stringify(body.facilityTypes     ?? []),
      JSON.stringify(body.specs             ?? {}),
      JSON.stringify(body.protocols         ?? []),
      body.unitPrice    ?? null,
      body.description  ?? null,
      body.imageUrl     ?? null,
      difficulty,
      body.warrantyMonths ?? 12,
      now,
      now,
    );

    const rows = await prisma.$queryRawUnsafe<any[]>(
      'SELECT * FROM equipment_product WHERE id = ?', id,
    );

    console.info(`[제품] 신규 등록: ${body.modelNumber} (${body.category})`);
    return successResponse(mapProduct(rows[0]), { status: 201 });
  } catch (error) {
    console.error('[제품] 등록 오류:', error);
    return serverErrorResponse();
  }
}
