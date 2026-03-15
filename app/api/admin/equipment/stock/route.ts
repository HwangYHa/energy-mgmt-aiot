/**
 * GET  /api/admin/equipment/stock  - 입고 이력 목록 조회 (super_admin)
 * POST /api/admin/equipment/stock  - 신규 입고 등록
 *
 * equipment_stock 테이블: 창고 입고 이력 추적
 * prisma.$queryRawUnsafe / $executeRawUnsafe 사용 (EPERM 회피)
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

export const dynamic = 'force-dynamic';

function mapStock(row: any) {
  return {
    id:          row.id,
    productId:   row.product_id,
    quantity:    Number(row.quantity),
    receivedAt:  row.received_at,
    supplier:    row.supplier   ?? null,
    unitCost:    row.unit_cost  != null ? Number(row.unit_cost) : null,
    batchNo:     row.batch_no   ?? null,
    notes:       row.notes      ?? null,
    createdBy:   row.created_by ?? null,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
    product: row.product_id ? {
      id:          row.product_id,
      name:        row.product_name,
      modelNumber: row.product_model_number,
      category:    row.product_category,
      code:        row.product_code ?? null,
    } : null,
  };
}

// ─── GET ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!isSuperAdmin(auth)) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const skip = parseInt(searchParams.get('skip') || '0');
    const take = Math.min(parseInt(searchParams.get('take') || '50'), 200);

    const conditions: string[] = ['1=1'];
    const args: unknown[] = [];

    if (productId) { conditions.push('s.product_id = ?'); args.push(productId); }

    const where = conditions.join(' AND ');

    const [rows, countRows] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT s.id, s.product_id, s.quantity, s.received_at,
                s.supplier, s.unit_cost, s.batch_no, s.notes,
                s.created_by, s.created_at, s.updated_at,
                p.name AS product_name, p.model_number AS product_model_number,
                p.category AS product_category, p.code AS product_code
         FROM equipment_stock s
         JOIN equipment_product p ON s.product_id = p.id
         WHERE ${where}
         ORDER BY s.received_at DESC
         LIMIT ? OFFSET ?`,
        ...args, take, skip,
      ),
      prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
        `SELECT COUNT(*) AS cnt FROM equipment_stock s WHERE ${where}`,
        ...args,
      ),
    ]);

    const total = Number(countRows[0]?.cnt ?? 0);

    // 제품별 총 입고량 집계
    const productTotals = await prisma.$queryRawUnsafe<any[]>(
      `SELECT s.product_id,
              p.name AS product_name, p.model_number AS product_model_number,
              p.category AS product_category, p.code AS product_code,
              SUM(s.quantity) AS total_received,
              COUNT(s.id) AS receipt_count,
              MAX(s.received_at) AS last_received_at
       FROM equipment_stock s
       JOIN equipment_product p ON s.product_id = p.id
       GROUP BY s.product_id, p.name, p.model_number, p.category, p.code
       ORDER BY total_received DESC`
    );

    return successResponse({
      stocks: rows.map(mapStock),
      productTotals: productTotals.map((r) => ({
        productId:      r.product_id,
        product: {
          id:          r.product_id,
          name:        r.product_name,
          modelNumber: r.product_model_number,
          category:    r.product_category,
          code:        r.product_code ?? null,
        },
        totalReceived:  Number(r.total_received),
        receiptCount:   Number(r.receipt_count),
        lastReceivedAt: r.last_received_at,
      })),
      pagination: { total, skip, take },
    });
  } catch (error) {
    console.error('[재고 입고] 목록 조회 오류:', error);
    return serverErrorResponse();
  }
}

// ─── POST ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!isSuperAdmin(auth)) return forbiddenResponse();

    const body = await request.json().catch(() => null);
    if (!body?.productId || !body?.quantity) {
      return errorResponse('VALIDATION_ERROR', {
        details: { message: 'productId, quantity 필수' },
      });
    }

    const qty = Number(body.quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      return errorResponse('VALIDATION_ERROR', {
        details: { message: '수량은 1 이상의 정수여야 합니다' },
      });
    }

    // 제품 존재 확인
    const pExists = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
      'SELECT COUNT(*) AS cnt FROM equipment_product WHERE id = ? AND is_active = 1',
      body.productId,
    );
    if (Number(pExists[0]?.cnt ?? 0) === 0) {
      return errorResponse('VALIDATION_ERROR', {
        details: { message: `존재하지 않거나 비활성인 제품 ID: ${body.productId}` },
      });
    }

    const id  = randomUUID();
    const now = new Date();
    const receivedAt = body.receivedAt ? new Date(body.receivedAt) : now;

    await prisma.$executeRawUnsafe(
      `INSERT INTO equipment_stock
         (id, product_id, quantity, received_at, supplier, unit_cost, batch_no, notes, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      body.productId,
      qty,
      receivedAt,
      body.supplier   ?? null,
      body.unitCost   != null ? Number(body.unitCost) : null,
      body.batchNo    ?? null,
      body.notes      ?? null,
      auth.userId,
      now,
      now,
    );

    const pRows = await prisma.$queryRawUnsafe<any[]>(
      'SELECT id, name, model_number, category, code FROM equipment_product WHERE id = ?',
      body.productId,
    );

    const result = {
      id, productId: body.productId, quantity: qty,
      receivedAt, supplier: body.supplier ?? null,
      unitCost: body.unitCost != null ? Number(body.unitCost) : null,
      batchNo: body.batchNo ?? null, notes: body.notes ?? null,
      createdBy: auth.userId, createdAt: now, updatedAt: now,
      product: pRows[0] ? {
        id: pRows[0].id, name: pRows[0].name,
        modelNumber: pRows[0].model_number, category: pRows[0].category,
        code: pRows[0].code ?? null,
      } : null,
    };

    console.info(`[재고 입고] 등록: ${body.productId} × ${qty}개`);
    return successResponse(result, { status: 201 });
  } catch (error) {
    console.error('[재고 입고] 등록 오류:', error);
    return serverErrorResponse();
  }
}
