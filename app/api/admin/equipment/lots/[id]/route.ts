/**
 * GET   /api/admin/equipment/lots/[id]  - 로트 상세 조회
 * PATCH /api/admin/equipment/lots/[id]  - 로트 상태/정보 수정
 *
 * prisma generate EPERM 회피: $queryRawUnsafe / $executeRawUnsafe 사용
 */

import { NextRequest } from 'next/server';
import { verifyAuth, isSuperAdmin } from '@/lib/auth/verify';
import { prisma } from '@/lib/db/prisma';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/api/response';

export const dynamic = 'force-dynamic';

// ─── 헬퍼 ───────────────────────────────────────────────────────

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
    deviceId:      row.device_id   ?? null,
    gatewayId:     row.gateway_id  ?? null,
    defectNote:    row.defect_note ?? null,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
    product: {
      id:          row.product_id,
      name:        row.product_name,
      modelNumber: row.product_model_number,
      category:    row.product_category,
      unitPrice:   row.product_unit_price,
      installDifficulty: row.product_install_difficulty,
    },
  };
}

async function fetchLotWithItems(id: string) {
  const lotRows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT l.*, t.name AS tenant_name, t.industry_type AS tenant_industry_type,
            t.status AS tenant_status
     FROM equipment_lot l
     JOIN tenant t ON l.tenant_id = t.id
     WHERE l.id = ?`,
    id,
  );
  if (!lotRows.length) return null;

  const lot = lotRows[0];
  const itemRows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT i.*,
            p.name AS product_name, p.model_number AS product_model_number,
            p.category AS product_category, p.unit_price AS product_unit_price,
            p.install_difficulty AS product_install_difficulty
     FROM equipment_lot_item i
     JOIN equipment_product p ON i.product_id = p.id
     WHERE i.lot_id = ?
     ORDER BY i.created_at ASC`,
    id,
  );

  const items = itemRows.map(mapItem);

  return {
    id:              lot.id,
    tenantId:        lot.tenant_id,
    lotNumber:       lot.lot_number,
    facilityType:    lot.facility_type,
    status:          lot.status,
    orderedAt:       lot.ordered_at   ?? null,
    shippedAt:       lot.shipped_at   ?? null,
    deliveredAt:     lot.delivered_at ?? null,
    installedAt:     lot.installed_at ?? null,
    technicianName:  lot.technician_name  ?? null,
    technicianPhone: lot.technician_phone ?? null,
    siteId:          lot.site_id      ?? null,
    siteAddress:     lot.site_address ?? null,
    siteContact:     lot.site_contact ?? null,
    notes:           lot.notes        ?? null,
    metadata:        lot.metadata     ?? null,
    createdAt:       lot.created_at,
    updatedAt:       lot.updated_at,
    tenant: {
      id:           lot.tenant_id,
      name:         lot.tenant_name,
      industryType: lot.tenant_industry_type,
      status:       lot.tenant_status,
    },
    items,
    totalItems: items.reduce((s: number, i: any) => s + (i.quantity ?? 0), 0),
  };
}

// ─── GET ─────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!isSuperAdmin(auth)) return forbiddenResponse();

    const { id } = await params;
    const lot = await fetchLotWithItems(id);
    if (!lot) return notFoundResponse('로트를 찾을 수 없습니다');

    return successResponse(lot);
  } catch (error) {
    console.error('[로트] 상세 조회 오류:', error);
    return serverErrorResponse();
  }
}

// ─── PATCH ───────────────────────────────────────────────────────

const VALID_STATUSES = ['pending','shipped','delivered','installing','installed','active','returned'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!isSuperAdmin(auth)) return forbiddenResponse();

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // 존재 확인
    const existRows = await prisma.$queryRawUnsafe<any[]>(
      'SELECT id, status, shipped_at, delivered_at, installed_at, lot_number FROM equipment_lot WHERE id = ?',
      id,
    );
    if (!existRows.length) return notFoundResponse('로트를 찾을 수 없습니다');
    const existing = existRows[0];

    // 상태 유효성 검사
    if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
      return notFoundResponse(`유효하지 않은 상태: ${body.status}`);
    }

    // 상태 변경 시 날짜 자동 설정
    const now = new Date();
    const setParts: string[] = ['updated_at = ?'];
    const setArgs: unknown[] = [now];

    const addField = (col: string, val: unknown) => {
      setParts.push(`${col} = ?`);
      setArgs.push(val);
    };

    if (body.status       !== undefined) addField('status',           body.status);
    if (body.facilityType !== undefined) addField('facility_type',    body.facilityType);
    if (body.technicianName  !== undefined) addField('technician_name',  body.technicianName  ?? null);
    if (body.technicianPhone !== undefined) addField('technician_phone', body.technicianPhone ?? null);
    if (body.siteAddress  !== undefined) addField('site_address',    body.siteAddress  ?? null);
    if (body.siteContact  !== undefined) addField('site_contact',    body.siteContact  ?? null);
    if (body.notes        !== undefined) addField('notes',           body.notes        ?? null);
    if (body.orderedAt    !== undefined) addField('ordered_at',   body.orderedAt   ? new Date(body.orderedAt)   : null);
    if (body.shippedAt    !== undefined) addField('shipped_at',   body.shippedAt   ? new Date(body.shippedAt)   : null);
    if (body.deliveredAt  !== undefined) addField('delivered_at', body.deliveredAt ? new Date(body.deliveredAt) : null);
    if (body.installedAt  !== undefined) addField('installed_at', body.installedAt ? new Date(body.installedAt) : null);

    // 상태 전환 시 자동 날짜 (기존 날짜 없을 때만)
    if (body.status === 'shipped'   && !existing.shipped_at)   addField('shipped_at',   now);
    if (body.status === 'delivered' && !existing.delivered_at) addField('delivered_at', now);
    if (body.status === 'installed' && !existing.installed_at) addField('installed_at', now);

    await prisma.$executeRawUnsafe(
      `UPDATE equipment_lot SET ${setParts.join(', ')} WHERE id = ?`,
      ...setArgs, id,
    );

    // 품목 개별 상태 업데이트
    if (Array.isArray(body.itemUpdates)) {
      for (const upd of body.itemUpdates) {
        if (!upd.id) continue;
        const itemParts: string[] = ['updated_at = ?'];
        const itemArgs: unknown[] = [now];

        if (upd.status    !== undefined) { itemParts.push('status = ?');     itemArgs.push(upd.status); }
        if (upd.deviceId  !== undefined) { itemParts.push('device_id = ?');  itemArgs.push(upd.deviceId  ?? null); }
        if (upd.gatewayId !== undefined) { itemParts.push('gateway_id = ?'); itemArgs.push(upd.gatewayId ?? null); }
        if (upd.defectNote !== undefined) { itemParts.push('defect_note = ?'); itemArgs.push(upd.defectNote ?? null); }

        await prisma.$executeRawUnsafe(
          `UPDATE equipment_lot_item SET ${itemParts.join(', ')} WHERE id = ?`,
          ...itemArgs, upd.id,
        );
      }
    }

    const updated = await fetchLotWithItems(id);
    console.info(`[로트] 수정 완료: ${existing.lot_number} → ${body.status ?? existing.status}`);
    return successResponse(updated);
  } catch (error) {
    console.error('[로트] 수정 오류:', error);
    return serverErrorResponse();
  }
}
