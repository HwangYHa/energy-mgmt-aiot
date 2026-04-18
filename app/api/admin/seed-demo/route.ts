/**
 * POST /api/admin/seed-demo
 * 서버 데모 데이터 시딩 — Super Admin 전용
 *
 * 로컬에서 prisma db seed 실행이 불가한 경우(프로덕션 서버),
 * 이 엔드포인트를 호출하면 데모 테넌트(demo@carbonieum.com)에
 * PhysicalSpace, TwinNode, AlertRule, Sensor 등 디지털 트윈/체험판 데이터를 주입합니다.
 *
 * Body (optional):
 *   { tenantId?: string }  // 미지정 시 demo 테넌트 자동 검색
 *
 * ⚠️ 한 번 실행하면 기존 데이터 중복 체크 후 없는 것만 추가 (멱등성 보장)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import { requireSuperAdmin } from '@/lib/auth/permissions';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function ri(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function rf(min: number, max: number, n = 2) { return Math.round((Math.random() * (max - min) + min) * 10 ** n) / 10 ** n; }
function daysAgo(d: number) { return new Date(Date.now() - d * 86_400_000); }
function uid() { return crypto.randomUUID(); }

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });
  const permErr = requireSuperAdmin(auth.role);
  if (permErr) return permErr;

  let body: { tenantId?: string } = {};
  try { body = await request.json(); } catch { /* ignore */ }

  // ── 대상 테넌트 결정 ─────────────────────────────────────────────
  let tenantId = body.tenantId;
  if (!tenantId) {
    // demo 테넌트 자동 검색 (slug 또는 이름 기준)
    const demoTenant = await prisma.tenant.findFirst({
      where: { OR: [{ slug: 'demo' }, { name: { contains: '데모' } }, { name: { contains: 'demo' } }] },
      select: { id: true, name: true },
    });
    if (!demoTenant) {
      return NextResponse.json({ success: false, error: '데모 테넌트를 찾을 수 없습니다. tenantId를 직접 지정하세요.' }, { status: 404 });
    }
    tenantId = demoTenant.id;
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true } });
  if (!tenant) return NextResponse.json({ success: false, error: '테넌트 없음' }, { status: 404 });

  const stats: Record<string, number> = {};

  // ── 1. 사이트 조회 ────────────────────────────────────────────────
  const sites = await prisma.site.findMany({ where: { tenantId }, select: { id: true, name: true }, take: 5 });
  const devices = await prisma.device.findMany({ where: { tenantId }, select: { id: true }, take: 10 });
  const siteId = sites[0]?.id ?? null;

  // ── 2. PhysicalSpace (디지털 트윈 공간 계층) ──────────────────────
  const existingSpaces = await prisma.physicalSpace.count({ where: { tenantId } });
  if (existingSpaces === 0 && siteId) {
    const buildingId = uid();
    const floor1Id   = uid();
    const floor2Id   = uid();
    const zoneA      = uid();
    const zoneB      = uid();

    await prisma.physicalSpace.createMany({
      data: [
        { id: buildingId, tenantId, siteId, name: '메인 공장 건물', type: 'building', level: 1, parentId: null, area: 2400.0, floorPlanX: null, floorPlanY: null, metadata: JSON.stringify({ buildingCode: 'MAIN-01' }) },
        { id: floor1Id,   tenantId, siteId, name: '1층 (생산라인)', type: 'floor',    level: 2, parentId: buildingId, area: 1200.0, floorPlanX: null, floorPlanY: null, metadata: null },
        { id: floor2Id,   tenantId, siteId, name: '2층 (관리동)',   type: 'floor',    level: 2, parentId: buildingId, area: 800.0,  floorPlanX: null, floorPlanY: null, metadata: null },
        { id: zoneA,      tenantId, siteId, name: 'A구역 (압축기실)', type: 'zone',   level: 3, parentId: floor1Id,  area: 300.0,  floorPlanX: 120.0, floorPlanY: 80.0, metadata: JSON.stringify({ zone: 'A', equipType: '압축기' }) },
        { id: zoneB,      tenantId, siteId, name: 'B구역 (생산라인)', type: 'zone',   level: 3, parentId: floor1Id,  area: 600.0,  floorPlanX: 250.0, floorPlanY: 80.0, metadata: JSON.stringify({ zone: 'B', equipType: '생산' }) },
      ],
      skipDuplicates: true,
    });
    stats.physicalSpaces = 5;

    // ── 3. TwinNode (설비 노드) ──────────────────────────────────────
    const twinNodes = [
      { id: uid(), tenantId, spaceId: zoneA, deviceId: devices[0]?.id ?? null, name: '에어 컴프레서 #1',    type: 'equipment', status: 'normal', posX: 130.0, posY: 90.0,  metadata: JSON.stringify({ model: 'ATLAS-GA90', powerKw: 90 }) },
      { id: uid(), tenantId, spaceId: zoneA, deviceId: devices[1]?.id ?? null, name: '에어 컴프레서 #2',    type: 'equipment', status: 'normal', posX: 155.0, posY: 90.0,  metadata: JSON.stringify({ model: 'ATLAS-GA90', powerKw: 90 }) },
      { id: uid(), tenantId, spaceId: zoneA, deviceId: devices[2]?.id ?? null, name: '냉동 건조기',          type: 'equipment', status: 'normal', posX: 140.0, posY: 110.0, metadata: JSON.stringify({ model: 'HIROSS-HPD', powerKw: 15 }) },
      { id: uid(), tenantId, spaceId: zoneB, deviceId: devices[3]?.id ?? null, name: '생산라인 모터 A',      type: 'equipment', status: 'warning', posX: 260.0, posY: 90.0, metadata: JSON.stringify({ model: '삼성-IE4', powerKw: 37, vibration: 12.3 }) },
      { id: uid(), tenantId, spaceId: zoneB, deviceId: devices[4]?.id ?? null, name: '생산라인 모터 B',      type: 'equipment', status: 'normal', posX: 300.0, posY: 90.0,  metadata: JSON.stringify({ model: '삼성-IE4', powerKw: 37 }) },
      { id: uid(), tenantId, spaceId: floor2Id, deviceId: null,                 name: 'LED 조명 시스템',     type: 'sensor',    status: 'normal', posX: 200.0, posY: 150.0, metadata: JSON.stringify({ circuit: 'L-201', powerKw: 8 }) },
      { id: uid(), tenantId, spaceId: floor1Id, deviceId: devices[5]?.id ?? null, name: 'ESS (에너지 저장장치)', type: 'equipment', status: 'normal', posX: 185.0, posY: 60.0, metadata: JSON.stringify({ capacity_kwh: 200, soc: 78 }) },
    ];
    await prisma.twinNode.createMany({ data: twinNodes, skipDuplicates: true });
    stats.twinNodes = twinNodes.length;
  } else {
    stats.physicalSpaces = existingSpaces;
    stats.twinNodes = await prisma.twinNode.count({ where: { tenantId } });
  }

  // ── 4. AlertRule (알람 규칙) ──────────────────────────────────────
  const existingAR = await prisma.alertRule.count({ where: { tenantId } });
  if (existingAR < 5) {
    const alerts = [
      { name: '전력 피크 초과 (500kW)',       category: 'energy', severity: 'critical', condition: { metric: 'power_active_kw', operator: 'gt', threshold: 500 }, channels: ['email', 'sms'] },
      { name: '에너지 사용량 급증 30%',        category: 'energy', severity: 'warning',  condition: { metric: 'energy_kwh', operator: 'pct_change_gt', threshold: 30 }, channels: ['email'] },
      { name: '역률(PF) 85% 미만',            category: 'energy', severity: 'warning',  condition: { metric: 'power_factor', operator: 'lt', threshold: 85 }, channels: ['email'] },
      { name: '게이트웨이 연결 끊김 (30분)',   category: 'device', severity: 'critical', condition: { metric: 'gateway_heartbeat', operator: 'missing', windowMin: 30 }, channels: ['email', 'sms'] },
      { name: '탄소 배출 월간 목표 90% 도달',  category: 'carbon', severity: 'warning',  condition: { metric: 'monthly_co2', operator: 'pct_gte', threshold: 90 }, channels: ['email'] },
    ];
    await prisma.alertRule.createMany({
      data: alerts.map(a => ({
        id: uid(), tenantId, name: a.name,
        category: a.category as any, severity: a.severity as any,
        scope: 'tenant' as any, scopeId: null,
        condition: a.condition as any, channels: a.channels as any,
        recipients: ['demo@carbonieum.com'], isActive: true, cooldownMin: 60,
      })),
      skipDuplicates: true,
    });
    stats.alertRules = alerts.length;
  }

  // ── 5. Sensor (센서 데이터) ──────────────────────────────────────
  const existingSensors = await prisma.sensor.count({ where: { tenantId } });
  if (existingSensors < 5 && devices.length > 0) {
    const sensorTypes = ['temperature', 'humidity', 'power', 'vibration', 'pressure'];
    const sensorData = devices.slice(0, 5).flatMap((dev, i) =>
      sensorTypes.slice(0, 2).map((type, j) => ({
        id: uid(), tenantId, deviceId: dev.id, siteId,
        name: `${type === 'temperature' ? '온도' : '습도'} 센서 ${i + 1}-${j + 1}`,
        type: type as any, unit: type === 'temperature' ? '°C' : '%',
        minValue: type === 'temperature' ? -10.0 : 0.0,
        maxValue: type === 'temperature' ? 80.0 : 100.0,
        isActive: true, calibrationOffset: 0.0,
        lastValue: type === 'temperature' ? rf(18, 35) : rf(40, 80),
        lastReadAt: daysAgo(ri(0, 1)),
      }))
    );
    await prisma.sensor.createMany({ data: sensorData, skipDuplicates: true });
    stats.sensors = sensorData.length;
  }

  // ── 6. EmissionsData (Scope별 배출량 기준 데이터) ────────────────
  const existingEm = await prisma.emissionsData.count({ where: { tenantId } });
  if (existingEm < 6 && siteId) {
    const emData = Array.from({ length: 6 }, (_, i) => {
      const mo = new Date(); mo.setDate(1); mo.setMonth(mo.getMonth() - (5 - i));
      const periodStr = `${mo.getFullYear()}-${String(mo.getMonth() + 1).padStart(2, '0')}`;
      return [
        { id: uid(), tenantId, siteId, scope: 'scope1' as any, category: 'stationary_combustion', activityData: rf(8000, 12000), activityUnit: 'MJ', emissionFactor: 0.0561, co2Equivalent: rf(450, 680), period: periodStr, reportingYear: mo.getFullYear(), dataSource: 'MANUAL' as any, isVerified: i < 4, reportId: null },
        { id: uid(), tenantId, siteId, scope: 'scope2' as any, category: 'purchased_electricity', activityData: rf(80000, 120000), activityUnit: 'kWh', emissionFactor: 0.4589, co2Equivalent: rf(36000, 55000), period: periodStr, reportingYear: mo.getFullYear(), dataSource: 'SENSOR' as any, isVerified: i < 4, reportId: null },
      ];
    }).flat();
    await prisma.emissionsData.createMany({ data: emData, skipDuplicates: true });
    stats.emissionsData = emData.length;
  }

  console.log(`[SeedDemo] 테넌트 ${tenant.name} (${tenantId}) 시딩 완료:`, stats);

  return NextResponse.json({
    success: true,
    tenantId,
    tenantName: tenant.name,
    stats,
    seededAt: new Date().toISOString(),
  });
}
