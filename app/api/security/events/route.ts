/**
 * GET  /api/security/events  — 보안 이벤트 목록 (super_admin / tenant_admin)
 * POST /api/security/events  — IP 차단/해제 + 수동 이벤트 기록
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import {
  getSecurityEvents,
  getSecurityStats,
  blockIp,
  unblockIp,
  getBlockedIps,
  logSecurityEvent,
  SecurityEventType,
  SecuritySeverity,
} from '@/lib/services/security-event.service';

// ── GET: 보안 이벤트 목록 + 통계 + 차단 IP ──────────────────────
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  const isSuperAdmin = auth.role === 'super_admin';
  const isTenantAdmin = auth.role === 'tenant_admin';

  if (!isSuperAdmin && !isTenantAdmin) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const view     = searchParams.get('view') ?? 'events';
  const type     = searchParams.get('type') as SecurityEventType | null;
  const severity = searchParams.get('severity') as SecuritySeverity | null;
  const ip       = searchParams.get('ip') ?? undefined;
  const hours    = Number(searchParams.get('hours') ?? '24');
  const limit    = Math.min(Number(searchParams.get('limit') ?? '50'), 200);
  const offset   = Number(searchParams.get('offset') ?? '0');

  // super_admin은 전체, tenant_admin은 자기 테넌트만
  const tenantId = isSuperAdmin ? undefined : auth.tenantId;
  const since    = new Date(Date.now() - hours * 60 * 60 * 1000);

  if (view === 'stats') {
    const stats = await getSecurityStats(tenantId);
    return NextResponse.json({ success: true, data: stats });
  }

  if (view === 'blocked') {
    if (!isSuperAdmin) {
      return NextResponse.json({ error: '슈퍼관리자만 차단 IP를 조회할 수 있습니다.' }, { status: 403 });
    }
    return NextResponse.json({ success: true, data: getBlockedIps() });
  }

  const { total, events } = await getSecurityEvents({
    tenantId,
    type:     type ?? undefined,
    severity: severity ?? undefined,
    ip,
    since,
    limit,
    offset,
  });

  return NextResponse.json({
    success: true,
    data: { events, pagination: { total, limit, offset } },
  });
}

// ── POST: IP 차단/해제 또는 수동 이벤트 기록 ────────────────────
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }
  if (auth.role !== 'super_admin') {
    return NextResponse.json({ error: '슈퍼관리자만 사용할 수 있습니다.' }, { status: 403 });
  }

  const body = await request.json();
  const { action } = body;

  if (action === 'block_ip') {
    const { ip, reason, durationMinutes = 60 } = body;
    if (!ip) return NextResponse.json({ error: 'ip 필드 필요' }, { status: 400 });
    blockIp(ip, reason ?? '관리자 수동 차단', durationMinutes * 60 * 1000);

    await logSecurityEvent({
      type: 'IP_BLOCKED',
      severity: 'HIGH',
      ip,
      userId: auth.userId,
      tenantId: auth.tenantId,
      details: { reason: reason ?? '관리자 수동 차단', durationMinutes, blockedBy: auth.userId },
    });
    return NextResponse.json({ success: true, message: `${ip} 차단 완료 (${durationMinutes}분)` });
  }

  if (action === 'unblock_ip') {
    const { ip } = body;
    if (!ip) return NextResponse.json({ error: 'ip 필드 필요' }, { status: 400 });
    unblockIp(ip);
    return NextResponse.json({ success: true, message: `${ip} 차단 해제 완료` });
  }

  if (action === 'log_event') {
    await logSecurityEvent({
      type:     body.type,
      severity: body.severity ?? 'MEDIUM',
      ip:       body.ip,
      userId:   auth.userId,
      tenantId: auth.tenantId,
      details:  body.details,
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: '알 수 없는 action' }, { status: 400 });
}
