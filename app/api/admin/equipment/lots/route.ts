/**
 * GET  /api/admin/equipment/lots   - 전체 납품 로트 목록 (super_admin)
 * POST /api/admin/equipment/lots   - 신규 로트 등록
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

export const dynamic = 'force-dynamic';

// ─── 로트 번호 자동 채번 (LOT-YYYYMMDD-NNNN) ──────────────────────

async function generateLotNumber(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `LOT-${today}-`;

  const rows = await prisma.$queryRawUnsafe<{ lot_number: string }[]>(
    `SELECT lot_number FROM equipment_lot
     WHERE lot_number LIKE ?
     ORDER BY lot_number DESC LIMIT 1`,
    `${prefix}%`,
  );

  const seq = rows.length > 0 && rows[0]
    ? parseInt(rows[0].lot_number.slice(prefix.length), 10) + 1
    : 1;

  return `${prefix}${String(seq).padStart(4, '0')}`;
}

// ─── 로트 행 → 응답 객체 변환 ────────────────────────────────────

function mapLot(row: any, items: any[] = []) {
  return {
    id:              row.id,
    tenantId:        row.tenant_id,
    lotNumber:       row.lot_number,
    facilityType:    row.facility_type,
    status:          row.status,
    orderedAt:       row.ordered_at   ?? null,
    shippedAt:       row.shipped_at   ?? null,
    deliveredAt:     row.delivered_at ?? null,
    installedAt:     row.installed_at ?? null,
    technicianName:  row.technician_name  ?? null,
    technicianPhone: row.technician_phone ?? null,
    siteId:          row.site_id      ?? null,
    siteAddress:     row.site_address ?? null,
    siteContact:     row.site_contact ?? null,
    notes:           row.notes        ?? null,
    metadata:        row.metadata     ?? null,
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
    tenant: {
      id:           row.tenant_id,
      name:         row.tenant_name,
      industryType: row.tenant_industry_type,
    },
    items,
    totalItems: items.reduce((s: number, i: any) => s + (i.quantity ?? 0), 0),
  };
}

function mapItem(row: any) {
  return {
    id:            row.id,
    lotId:         row.lot_id,
    productId:     row.product_id,
    quantity:      row.quantity,
    serialNumbers: typeof row.serial_numbers === 'string'
      ? JSON.parse(row.serial_numbers)
      : (row.serial_numbers ?? []),
    status:        row.status,
    deviceId:      row.device_id  ?? null,
    gatewayId:     row.gateway_id ?? null,
    defectNote:    row.defect_note ?? null,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
    product: row.product_id ? {
      id:          row.product_id,
      name:        row.product_name,
      modelNumber: row.product_model_number,
      category:    row.product_category,
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
    const tenantId     = searchParams.get('tenantId');
    const status       = searchParams.get('status');
    const facilityType = searchParams.get('facilityType');
    const skip = parseInt(searchParams.get('skip') || '0');
    const take = Math.min(parseInt(searchParams.get('take') || '20'), 100);

    // WHERE 절 동적 구성
    const conditions: string[] = ['1=1'];
    const args: unknown[] = [];

    if (tenantId)     { conditions.push('l.tenant_id = ?');     args.push(tenantId); }
    if (status)       { conditions.push('l.status = ?');         args.push(status); }
    if (facilityType) { conditions.push('l.facility_type = ?'); args.push(facilityType); }

    const where = conditions.join(' AND ');

    const [lots, countRows] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT l.id, l.tenant_id, l.lot_number, l.facility_type, l.status,
                l.ordered_at, l.shipped_at, l.delivered_at, l.installed_at,
                l.technician_name, l.technician_phone, l.site_id,
                l.site_address, l.site_contact, l.notes, l.metadata,
                l.created_at, l.updated_at,
                t.name AS tenant_name, t.industry_type AS tenant_industry_type
         FROM equipment_lot l
         JOIN tenant t ON l.tenant_id = t.id
         WHERE ${where}
         ORDER BY l.created_at DESC
         LIMIT ? OFFSET ?`,
        ...args, take, skip,
      ),
      prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
        `SELECT COUNT(*) AS cnt FROM equipment_lot l WHERE ${where}`,
        ...args,
      ),
    ]);

    const total = Number(countRows[0]?.cnt ?? 0);

    // 로트에 속한 품목 일괄 조회
    let itemsByLot: Record<string, any[]> = {};
    if (lots.length > 0) {
      const lotIds = lots.map((l: any) => l.id);
      const placeholders = lotIds.map(() => '?').join(',');
      const itemRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT i.id, i.lot_id, i.product_id, i.quantity, i.serial_numbers,
                i.status, i.device_id, i.gateway_id, i.defect_note,
                i.created_at, i.updated_at,
                p.name AS product_name, p.model_number AS product_model_number,
                p.category AS product_category
         FROM equipment_lot_item i
         JOIN equipment_product p ON i.product_id = p.id
         WHERE i.lot_id IN (${placeholders})
         ORDER BY i.created_at ASC`,
        ...lotIds,
      );

      for (const item of itemRows) {
        const lotId: string = item.lot_id;
        if (!itemsByLot[lotId]) itemsByLot[lotId] = [];
        itemsByLot[lotId]!.push(mapItem(item));
      }
    }

    return successResponse({
      lots: lots.map((l: any) => mapLot(l, itemsByLot[l.id] ?? [])),
      pagination: { total, skip, take },
    });
  } catch (error) {
    console.error('[로트] 목록 조회 오류:', error);
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
    if (!body?.tenantId || !body?.facilityType) {
      return errorResponse('VALIDATION_ERROR', { details: { message: 'tenantId, facilityType 필수' } });
    }

    // 테넌트 존재 확인
    const tenantRows = await prisma.$queryRawUnsafe<{ id: string; name: string }[]>(
      'SELECT id, name FROM tenant WHERE id = ?',
      body.tenantId,
    );
    if (!tenantRows.length) {
      return errorResponse('VALIDATION_ERROR', { details: { message: '존재하지 않는 테넌트입니다' } });
    }

    const lotNumber = await generateLotNumber();
    const id  = randomUUID();
    const now = new Date();

    const toDate = (v: unknown) => (v ? new Date(v as string) : null);

    await prisma.$executeRawUnsafe(
      `INSERT INTO equipment_lot
         (id, tenant_id, lot_number, facility_type, status,
          ordered_at, shipped_at, delivered_at, installed_at,
          technician_name, technician_phone, site_id,
          site_address, site_contact, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      body.tenantId,
      lotNumber,
      body.facilityType,
      body.status ?? 'pending',
      toDate(body.orderedAt),
      toDate(body.shippedAt),
      toDate(body.deliveredAt),
      toDate(body.installedAt),
      body.technicianName  ?? null,
      body.technicianPhone ?? null,
      body.siteId          ?? null,
      body.siteAddress     ?? null,
      body.siteContact     ?? null,
      body.notes           ?? null,
      now,
      now,
    );

    // 품목 등록
    const VALID_LOT_STATUSES = ['pending','shipped','delivered','installing','installed','active','returned'];
    const createdItems: any[] = [];
    if (Array.isArray(body.items) && body.items.length > 0) {
      for (const item of body.items) {
        // productId 필수
        if (!item.productId) continue;

        // 수량 유효성 검사: 1 이상 정수
        const qty = Number(item.quantity ?? 1);
        if (!Number.isInteger(qty) || qty < 1) {
          return errorResponse('VALIDATION_ERROR', { details: { message: `품목 수량은 1 이상의 정수여야 합니다 (입력값: ${item.quantity})` } });
        }

        // productId 존재 확인
        const pExists = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
          'SELECT COUNT(*) AS cnt FROM equipment_product WHERE id = ? AND is_active = 1',
          item.productId,
        );
        if (Number(pExists[0]?.cnt ?? 0) === 0) {
          return errorResponse('VALIDATION_ERROR', { details: { message: `존재하지 않거나 비활성인 제품 ID: ${item.productId}` } });
        }

        const itemId = randomUUID();
        await prisma.$executeRawUnsafe(
          `INSERT INTO equipment_lot_item
             (id, lot_id, product_id, quantity, serial_numbers, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          itemId,
          id,
          item.productId,
          qty,
          JSON.stringify(Array.isArray(item.serialNumbers) ? item.serialNumbers : []),
          VALID_LOT_STATUSES.includes(item.status) ? item.status : 'pending',
          now,
          now,
        );

        const pRows = await prisma.$queryRawUnsafe<any[]>(
          'SELECT id, name, model_number, category FROM equipment_product WHERE id = ?',
          item.productId,
        );
        createdItems.push({
          id: itemId, lotId: id, productId: item.productId,
          quantity: qty,
          serialNumbers: Array.isArray(item.serialNumbers) ? item.serialNumbers : [],
          status: VALID_LOT_STATUSES.includes(item.status) ? item.status : 'pending',
          deviceId: null, gatewayId: null, defectNote: null,
          createdAt: now, updatedAt: now,
          product: pRows[0] ? {
            id: pRows[0].id, name: pRows[0].name,
            modelNumber: pRows[0].model_number, category: pRows[0].category,
          } : null,
        });
      }
    }

    const lot = {
      id, lotNumber, facilityType: body.facilityType, status: body.status ?? 'pending',
      tenantId: body.tenantId,
      orderedAt: toDate(body.orderedAt), shippedAt: toDate(body.shippedAt),
      deliveredAt: toDate(body.deliveredAt), installedAt: toDate(body.installedAt),
      technicianName: body.technicianName ?? null, technicianPhone: body.technicianPhone ?? null,
      siteId: body.siteId ?? null, siteAddress: body.siteAddress ?? null,
      siteContact: body.siteContact ?? null, notes: body.notes ?? null,
      createdAt: now, updatedAt: now,
      tenant: { id: body.tenantId, name: tenantRows[0]!.name },
      items: createdItems,
      totalItems: createdItems.reduce((s, i) => s + i.quantity, 0),
    };

    console.info(`[로트] 신규 로트 등록: ${lotNumber} (테넌트: ${body.tenantId})`);
    return successResponse(lot, { status: 201 });
  } catch (error) {
    console.error('[로트] 등록 오류:', error);
    return serverErrorResponse();
  }
}
