/**
 * prisma/seed-demo-extra.ts
 * 탄소이음 EMS AIoT — 데모 계정 대량 추가 데이터
 *
 * 대상 메뉴 화면:
 *  - 대시보드 (KpiSnapshot 12개월)
 *  - 탄소 분석 (EmissionsData 12개월 Scope1/2/3, ESGReport)
 *  - 배출권 거래소 (CarbonCreditRegistry, CarbonLedgerEntry, CarbonRetirementCertificate)
 *  - 탄소중립 로드맵 (Milestone)
 *  - DR 참여 (DrEvent 15건)
 *  - 스케줄 제어 (ControlSchedule 20건)
 *  - 규제 리포트 (Report 20건)
 *  - 감사 추적 (AuditLog 150건)
 *  - AI 예측 (ForecastResult 12건)
 *  - 알림 (NotificationLog 80건)
 *  - 자원 관리 (EquipmentLot 15건)
 *  - 로그인 이력 (LoginHistory 100건)
 *  - 활동 로그 (ActivityLog 200건)
 *  - 규제 컴플라이언스 설정 (TenantComplianceSetting)
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// 유틸 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

/** days일 전 Date 반환 */
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

/** days일 후 Date 반환 */
function daysLater(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

/** 월 시작일 (현재 기준 monthOffset개월 전) */
function monthStart(monthOffset: number): Date {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthOffset);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 월 종료일 */
function monthEnd(monthOffset: number): Date {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthOffset + 1);
  d.setDate(0); // 해당 월 마지막 날
  d.setHours(23, 59, 59, 999);
  return d;
}

/** "YYYY-MM" 문자열 (현재 기준 monthOffset개월 전) */
function periodStr(monthOffset: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthOffset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** SHA-256 해시 (간단한 체인 서명용) */
function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/** min~max 사이 랜덤 정수 */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** min~max 사이 랜덤 실수 (소수 n자리) */
function randFloat(min: number, max: number, decimals = 2): number {
  const v = Math.random() * (max - min) + min;
  return Math.round(v * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

// ─────────────────────────────────────────────────────────────────────────────
// 월별 에너지 기준값 (계절성 반영, 단위: kWh)
// ─────────────────────────────────────────────────────────────────────────────

const MONTHLY_KWH = [
  210_000, // 1월 (동계 냉난방 증가)
  198_000, // 2월
  180_000, // 3월
  172_000, // 4월
  168_000, // 5월
  185_000, // 6월
  215_000, // 7월 (하계 냉방 증가)
  225_000, // 8월 (하계 최대)
  192_000, // 9월
  175_000, // 10월
  185_000, // 11월
  205_000, // 12월
];

/** monthOffset 기준 현재연도 월 인덱스 → 기준 kWh (±8% 랜덤) */
function monthlyKwh(monthOffset: number): number {
  const d = new Date();
  d.setMonth(d.getMonth() - monthOffset);
  const idx = d.getMonth(); // 0~11
  const base = MONTHLY_KWH[idx] ?? 185_000;
  return Math.round(base * (0.92 + Math.random() * 0.16));
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인 시딩 함수
// ─────────────────────────────────────────────────────────────────────────────

export async function seedDemoExtra(
  prisma: PrismaClient,
  tenantId: string,
  userId: string,
  siteIds: string[],
  deviceIds: string[],
) {
  const site1 = siteIds[0] ?? '';
  const site2 = siteIds[1] ?? '';
  const site3 = siteIds[2] ?? '';

  // ── 1. TenantComplianceSetting ───────────────────────────────────────────
  console.log('\n📦 [Extra] TenantComplianceSetting');
  const exCS = await (prisma.tenantComplianceSetting as any).findUnique({ where: { tenantId } });
  if (!exCS) {
    await (prisma.tenantComplianceSetting as any).create({
      data: {
        tenantId,
        region: 'KR',
        reportingStandard: 'GHG Protocol',
        factorSource: '환경부 고시 2024-39호',
        electricityFactor: 0.4567,
        baseYear: 2020,
        targetReductionPct: 40.0,
        reportingFrequency: 'monthly',
        fiscalYearStart: 1,
      },
    });
    console.log('  ✅ TenantComplianceSetting 생성');
  } else {
    console.log('  ✅ TenantComplianceSetting 이미 존재');
  }

  // ── 2. KpiSnapshot — 12개월 (기존 6개월 → 12개월 확장) ─────────────────
  console.log('\n📦 [Extra] KpiSnapshot (12개월)');
  let kpiCount = 0;
  for (let mo = 11; mo >= 0; mo--) {
    const period = periodStr(mo);
    const kwh    = monthlyKwh(mo);
    const ex     = await (prisma.kpiSnapshot as any).findFirst({ where: { tenantId, period } });
    if (!ex) {
      await (prisma.kpiSnapshot as any).create({
        data: {
          tenantId,
          period,
          totalKwh:        kwh,
          peakKw:          kwh / (720 * 0.38),
          baselineKwh:     kwh * 1.09,
          savedKwh:        kwh * 0.09,
          totalCo2Kg:      kwh * 0.4567,
          savedCo2Kg:      kwh * 0.09 * 0.4567,
          energyCostKrw:   kwh * 120.5,
          savedCostKrw:    kwh * 0.09 * 120.5,
          investmentKrw:   5_000_000,
          roiPercent:      randFloat(12, 18, 1),
          paybackMonths:   randInt(20, 28),
        },
      });
      kpiCount++;
    }
    process.stdout.write('.');
  }
  console.log(`\n  ✅ KpiSnapshot ${kpiCount}건 추가`);

  // ── 3. EmissionsData — 12개월 Scope1/2/3 전체 ──────────────────────────
  console.log('\n📦 [Extra] EmissionsData (12개월 Scope1/2/3)');
  const emissionTypes: Array<{
    type: string; sourceType: string; unit: string; factor: number; method: string;
    baseAmt: (kwh: number) => number;
  }> = [
    { type: 'scope1', sourceType: 'natural_gas',   unit: 'm3',  factor: 2.176, method: 'manual',
      baseAmt: () => randFloat(1200, 1800) },
    { type: 'scope1', sourceType: 'diesel',         unit: 'L',   factor: 2.640, method: 'manual',
      baseAmt: () => randFloat(300, 600) },
    { type: 'scope1', sourceType: 'lpg',            unit: 'kg',  factor: 2.996, method: 'manual',
      baseAmt: () => randFloat(150, 280) },
    { type: 'scope2', sourceType: 'electricity',    unit: 'kWh', factor: 0.4567, method: 'auto',
      baseAmt: (kwh) => kwh },
    { type: 'scope3', sourceType: 'business_travel',unit: 'km',  factor: 0.21,  method: 'manual',
      baseAmt: () => randFloat(5000, 12000) },
    { type: 'scope3', sourceType: 'employee_commute',unit: 'km', factor: 0.14,  method: 'manual',
      baseAmt: () => randFloat(8000, 18000) },
    { type: 'scope3', sourceType: 'waste',          unit: 'ton', factor: 0.49,  method: 'manual',
      baseAmt: () => randFloat(2, 8) },
  ];

  let emCount = 0;
  for (let mo = 11; mo >= 0; mo--) {
    const period = periodStr(mo);
    const kwh    = monthlyKwh(mo);
    for (const et of emissionTypes) {
      const ex = await (prisma.emissionsData as any).findFirst({
        where: { tenantId, period, emissionType: et.type, sourceType: et.sourceType },
      });
      if (!ex) {
        const amt = et.baseAmt(kwh);
        await (prisma.emissionsData as any).create({
          data: {
            tenantId,
            emissionType:       et.type,
            sourceType:         et.sourceType,
            amount:             amt,
            unit:               et.unit,
            emissionFactor:     et.factor,
            calculatedEmission: (amt * et.factor) / 1000,
            period,
            calculationMethod:  et.method,
            dataSource:         et.method === 'auto' ? 'SENSOR' : 'MANUAL',
          },
        });
        emCount++;
      }
    }
    process.stdout.write('.');
  }
  console.log(`\n  ✅ EmissionsData ${emCount}건 추가`);

  // ── 4. Milestones (탄소중립 로드맵) ────────────────────────────────────
  console.log('\n📦 [Extra] Milestone (탄소중립 로드맵)');
  const milestones = [
    { year: 2024, title: '기준연도 온실가스 인벤토리 구축 및 제3자 검증 완료', status: 'achieved',    order: 1 },
    { year: 2024, title: 'ISO 50001 에너지경영시스템 인증 획득',               status: 'achieved',    order: 2 },
    { year: 2025, title: '스코프2 전력 RE100 전환율 30% 달성',                 status: 'in_progress', order: 3 },
    { year: 2025, title: '에너지 사용량 기준연도 대비 10% 절감',               status: 'in_progress', order: 4 },
    { year: 2025, title: 'K-ETS 배출권 관리 시스템 고도화',                    status: 'in_progress', order: 5 },
    { year: 2026, title: '탄소중립 전략 로드맵 수립 및 이사회 승인',           status: 'pending',     order: 6 },
    { year: 2027, title: '스코프1·2 배출량 2020년 대비 40% 감축',              status: 'pending',     order: 7 },
    { year: 2027, title: '재생에너지 전환율 60% 달성 (RE100)',                 status: 'pending',     order: 8 },
    { year: 2028, title: '스코프3 공급망 배출량 인벤토리 완성',                status: 'pending',     order: 9 },
    { year: 2030, title: 'NDC 목표: 2018년 대비 배출량 40% 감축',              status: 'pending',     order: 10 },
    { year: 2035, title: '스코프1·2 탄소중립(Net-Zero) 달성',                  status: 'pending',     order: 11 },
    { year: 2040, title: '스코프3 포함 전체 가치사슬 Net-Zero 달성',           status: 'pending',     order: 12 },
    { year: 2050, title: 'SBTi 1.5°C 경로 준수 — 완전 탄소중립 달성',         status: 'pending',     order: 13 },
  ];

  let msCount = 0;
  for (const ms of milestones) {
    const ex = await (prisma.milestone as any).findFirst({ where: { tenantId, title: ms.title } });
    if (!ex) {
      await (prisma.milestone as any).create({
        data: { tenantId, year: ms.year, title: ms.title, status: ms.status, displayOrder: ms.order },
      });
      msCount++;
    }
    process.stdout.write('.');
  }
  console.log(`\n  ✅ Milestone ${msCount}건 추가`);

  // ── 5. CarbonCreditRegistry + LedgerEntry + RetirementCert ─────────────
  console.log('\n📦 [Extra] CarbonCreditRegistry + LedgerEntry + RetirementCert');

  const registryDefs = [
    { registry: 'K-ETS',       project: 'KAU24-001', sn: 'KAU24-001-001', snEnd: 'KAU24-001-500',  vintage: 2024, type: 'KAU',    cert: '환경부 온실가스종합정보센터', qty: 500,  avail: 350, retired:  80, buyCnt: 3, sellCnt: 1 },
    { registry: 'K-ETS',       project: 'KCU23-002', sn: 'KCU23-002-001', snEnd: 'KCU23-002-300',  vintage: 2023, type: 'KCU',    cert: '환경부',                     qty: 300,  avail: 220, retired:  30, buyCnt: 2, sellCnt: 1 },
    { registry: 'K-ETS',       project: 'KAU23-003', sn: 'KAU23-003-001', snEnd: 'KAU23-003-200',  vintage: 2023, type: 'KAU',    cert: '환경부',                     qty: 200,  avail:  80, retired: 100, buyCnt: 1, sellCnt: 0 },
    { registry: 'Verra',       project: 'VCS-1234',  sn: 'VCS-1234-A001', snEnd: 'VCS-1234-A200',  vintage: 2023, type: 'VER',    cert: 'Verra',                      qty: 200,  avail: 150, retired:  25, buyCnt: 2, sellCnt: 0 },
    { registry: 'GoldStandard',project: 'GS-5678',   sn: 'GS-5678-B001',  snEnd: 'GS-5678-B100',   vintage: 2024, type: 'GS-VER', cert: 'Gold Standard Foundation',   qty: 100,  avail:  75, retired:  10, buyCnt: 1, sellCnt: 0 },
    { registry: 'K-ETS',       project: 'OFFSET-024',sn: 'OFFS-024-001',  snEnd: 'OFFS-024-150',   vintage: 2024, type: 'OFFSET', cert: '환경부',                     qty: 150,  avail: 120, retired:   0, buyCnt: 1, sellCnt: 0 },
  ];

  const regIds: string[] = [];
  let ledgerCount = 0;
  let retireCount = 0;

  for (const rd of registryDefs) {
    // Registry 생성/조회
    let reg = await (prisma.carbonCreditRegistry as any).findFirst({
      where: { tenantId, projectId: rd.project },
    });
    if (!reg) {
      const regId = crypto.randomUUID();
      reg = await (prisma.carbonCreditRegistry as any).create({
        data: {
          id: regId,
          tenantId,
          registry:          rd.registry,
          projectId:         rd.project,
          serialNumberStart: rd.sn,
          serialNumberEnd:   rd.snEnd,
          vintageYear:       rd.vintage,
          creditType:        rd.type,
          certificationBody: rd.cert,
          issuanceDate:      daysAgo(randInt(200, 500)),
          totalQuantity:     rd.qty,
          availableQuantity: rd.avail,
          retiredQuantity:   rd.retired,
          lockedQuantity:    0,
          status:            rd.retired >= rd.qty ? 'retired' : 'active',
        },
      });
    }
    regIds.push(reg.id);

    // 매수(BUY) Ledger Entry 생성
    const existingBuy = await (prisma.carbonLedgerEntry as any).findFirst({
      where: { tenantId, registryId: reg.id, eventType: 'BUY' },
    });
    if (!existingBuy) {
      for (let b = 0; b < rd.buyCnt; b++) {
        const buyQty   = Math.round(rd.qty / rd.buyCnt);
        const buyPrice = rd.type === 'KAU' ? randFloat(13000, 16000) : randFloat(8000, 12000);
        const prevHash = b === 0 ? null : sha256(`${reg.id}-buy-${b - 1}`);
        const hash     = sha256(`${reg.id}-buy-${b}-${buyQty}-${buyPrice}`);
        await (prisma.carbonLedgerEntry as any).create({
          data: {
            id:               crypto.randomUUID(),
            tenantId,
            registryId:       reg.id,
            eventType:        'BUY',
            quantity:         buyQty,
            unitPrice:        buyPrice,
            totalAmount:      buyQty * buyPrice,
            currency:         'KRW',
            counterparty:     ['한국거래소', 'KB증권', '미래에셋증권', '삼성증권'][randInt(0, 3)],
            paymentStatus:    'SETTLED',
            settlementStatus: 'SETTLED',
            hashSignature:    hash,
            prevHash,
            memo:             `${rd.type} ${rd.vintage}년 빈티지 ${buyQty}톤 매수`,
            createdAt:        daysAgo(randInt(30, 365)),
          },
        });
        ledgerCount++;
      }
    }

    // 매도(SELL) Ledger Entry 생성
    if (rd.sellCnt > 0) {
      const existingSell = await (prisma.carbonLedgerEntry as any).findFirst({
        where: { tenantId, registryId: reg.id, eventType: 'SELL' },
      });
      if (!existingSell) {
        const sellQty   = Math.round(rd.qty * 0.1);
        const sellPrice = rd.type === 'KAU' ? randFloat(14000, 17000) : randFloat(9000, 13000);
        await (prisma.carbonLedgerEntry as any).create({
          data: {
            id:               crypto.randomUUID(),
            tenantId,
            registryId:       reg.id,
            eventType:        'SELL',
            quantity:         sellQty,
            unitPrice:        sellPrice,
            totalAmount:      sellQty * sellPrice,
            currency:         'KRW',
            counterparty:     '포스코',
            paymentStatus:    'SETTLED',
            settlementStatus: 'SETTLED',
            hashSignature:    sha256(`${reg.id}-sell-${sellQty}`),
            prevHash:         null,
            memo:             `${rd.type} ${sellQty}톤 매도`,
            createdAt:        daysAgo(randInt(10, 90)),
          },
        });
        ledgerCount++;
      }
    }

    // 소각(RETIRE) Ledger Entry + RetirementCert 생성
    if (rd.retired > 0) {
      const existingRetire = await (prisma.carbonLedgerEntry as any).findFirst({
        where: { tenantId, registryId: reg.id, eventType: 'RETIRE' },
      });
      if (!existingRetire) {
        const retireDate = daysAgo(randInt(30, 180));
        const ledger = await (prisma.carbonLedgerEntry as any).create({
          data: {
            id:               crypto.randomUUID(),
            tenantId,
            registryId:       reg.id,
            eventType:        'RETIRE',
            quantity:         rd.retired,
            unitPrice:        0,
            totalAmount:      0,
            currency:         'KRW',
            counterparty:     null,
            paymentStatus:    'N/A',
            settlementStatus: 'SETTLED',
            hashSignature:    sha256(`${reg.id}-retire-${rd.retired}`),
            prevHash:         null,
            memo:             `${rd.type} ${rd.retired}톤 자발적 소각 — 스코프2 상쇄`,
            createdAt:        retireDate,
          },
        });
        ledgerCount++;

        // RetirementCert 생성
        const exCert = await (prisma.carbonRetirementCertificate as any).findFirst({
          where: { tenantId, registryId: reg.id },
        });
        if (!exCert) {
          const certYear   = retireDate.getFullYear();
          const certMon    = String(retireDate.getMonth() + 1).padStart(2, '0');
          const certDay    = String(retireDate.getDate()).padStart(2, '0');
          const retireId   = `RET-${certYear}${certMon}${certDay}-${String(retireCount + 1).padStart(5, '0')}`;
          await (prisma.carbonRetirementCertificate as any).create({
            data: {
              id:                  crypto.randomUUID(),
              tenantId,
              ledgerEntryId:       ledger.id,
              registryId:          reg.id,
              retirementId:        retireId,
              serialNumbers:       JSON.stringify([`${rd.sn}`, `${rd.snEnd}`]),
              retiredQuantity:     rd.retired,
              retirementReason:    '자발적 탄소 상쇄 — 전력 사용 Scope2 상쇄 목적',
              beneficiaryCompany:  '탄소이음 Demo',
              retirementDate:      retireDate,
              offsetScope:         'scope2',
              compliancePeriod:    String(certYear),
              createdAt:           retireDate,
            },
          });
          retireCount++;
        }
      }
    }
    process.stdout.write('.');
  }
  console.log(`\n  ✅ Registry ${regIds.length}개, LedgerEntry ${ledgerCount}건, RetirementCert ${retireCount}건`);

  // ── 6. ESGReport (연간 + 분기별) ─────────────────────────────────────
  console.log('\n📦 [Extra] ESGReport (연간 3년 + 분기 2년)');
  const curYear = new Date().getFullYear();

  const esgReports: Array<{
    no: string; type: string; std: string; period: string; periodType: string;
    year: number; status: string; s1: number; s2: number; s3: number;
  }> = [];

  // 연간 보고서 3년
  for (let y = 2; y >= 0; y--) {
    const yr  = curYear - y;
    const kwh = MONTHLY_KWH.reduce((a, b) => a + b, 0);
    const s1  = randFloat(180, 240, 3);  // tCO2eq
    const s2  = (kwh * 0.4567) / 1000;  // tCO2eq
    const s3  = randFloat(80, 120, 3);
    esgReports.push({
      no:         `ESG-${yr}-0001`,
      type:       'annual',
      std:        'GHG_PROTOCOL',
      period:     String(yr),
      periodType: 'annual',
      year:       yr,
      status:     y > 0 ? 'published' : 'approved',
      s1, s2, s3,
    });
  }

  // 분기 보고서 (최근 8분기)
  for (let q = 7; q >= 0; q--) {
    const qDate  = new Date();
    qDate.setMonth(qDate.getMonth() - q * 3);
    const yr  = qDate.getFullYear();
    const qtr = Math.floor(qDate.getMonth() / 3) + 1;
    const kwh = (MONTHLY_KWH.reduce((a, b) => a + b, 0) / 4) * (0.9 + Math.random() * 0.2);
    esgReports.push({
      no:         `ESG-${yr}-Q${qtr}`,
      type:       'interim',
      std:        'K_MRV',
      period:     `${yr}-Q${qtr}`,
      periodType: 'quarterly',
      year:       yr,
      status:     q > 0 ? 'published' : 'in_review',
      s1: randFloat(40, 70, 3),
      s2: (kwh * 0.4567) / 1000,
      s3: randFloat(18, 35, 3),
    });
  }

  let esgCount = 0;
  for (const er of esgReports) {
    const ex = await (prisma.eSGReport as any).findFirst({ where: { tenantId, reportNo: er.no } });
    if (!ex) {
      const total = er.s1 + er.s2 + er.s3;
      await (prisma.eSGReport as any).create({
        data: {
          id:               crypto.randomUUID(),
          tenantId,
          reportNo:         er.no,
          reportType:       er.type,
          standard:         er.std,
          countryCode:      'KR',
          period:           er.period,
          periodType:       er.periodType,
          reportYear:       er.year,
          totalEmissions:   total,
          scope1:           er.s1,
          scope2Location:   er.s2,
          scope2Market:     er.s2 * 0.95,
          scope3:           er.s3,
          emissionsUnit:    'tCO2eq',
          emissionFactorsSnapshot: { electricityFactor: 0.4567, source: '환경부 고시 2024-39호' },
          engineVersionSnapshot:   { version: '2.0.0', engine: 'EMS-CalcEngine' },
          calculationMethodSnapshot: { scope1: 'tier2', scope2: 'location-based', scope3: 'spend-based' },
          boundarySnapshot: { operationalControl: true, sites: ['서울 상암 공장', '판교 R&D 센터', '인천 물류 창고'] },
          activityDataSnapshot: {
            electricity_kwh:  er.s2 * 1000 / 0.4567,
            natural_gas_m3:   er.s1 * 1000 / 2.176,
            diesel_L:         randFloat(300, 600),
          },
          applicableStandards: 'GHG Protocol Corporate Standard; K-ETS 배출량 보고 지침',
          methodologyNotes:    'Scope2는 위치기반(Location-based) 방법론 적용. 한국 국가 평균 배출계수 적용.',
          completenessScore:   randFloat(88, 98, 1),
          dataHash:            sha256(`${er.no}-${total}-${er.year}`),
          isImmutable:         er.status === 'published',
          status:              er.status,
          generatedBy:         userId,
          reviewedBy:          er.status !== 'in_review' ? userId : null,
          reviewedAt:          er.status !== 'in_review' ? daysAgo(randInt(5, 30)) : null,
          approvedBy:          er.status === 'published' ? userId : null,
          approvedAt:          er.status === 'published' ? daysAgo(randInt(1, 10)) : null,
          revisionNumber:      1,
        },
      });
      esgCount++;
    }
    process.stdout.write('.');
  }
  console.log(`\n  ✅ ESGReport ${esgCount}건 추가`);

  // ── 7. DR 이벤트 (월 1~2건, 15건) ────────────────────────────────────
  console.log('\n📦 [Extra] DrEvent (15건)');
  const drDefs: Array<{ title: string; dAgo: number; durH: number; kw: number; status: string }> = [
    { title: '2024-07 하계 피크수요 1차 감축',   dAgo: 270, durH: 2, kw: 100, status: 'completed' },
    { title: '2024-07 하계 피크수요 2차 감축',   dAgo: 260, durH: 3, kw: 130, status: 'completed' },
    { title: '2024-08 폭염 긴급 DR',             dAgo: 240, durH: 4, kw: 150, status: 'completed' },
    { title: '2024-08 하계 수요반응 정기',        dAgo: 230, durH: 2, kw: 90,  status: 'completed' },
    { title: '2024-09 추석 연휴 수요조정',        dAgo: 210, durH: 6, kw: 70,  status: 'completed' },
    { title: '2024-11 동계 예비율 확보',          dAgo: 160, durH: 3, kw: 110, status: 'completed' },
    { title: '2024-12 동계 피크 1차 감축',        dAgo: 120, durH: 3, kw: 120, status: 'completed' },
    { title: '2024-12 한파 긴급 DR 발령',         dAgo: 110, durH: 4, kw: 160, status: 'completed' },
    { title: '2025-01 신년 동계 수요반응',        dAgo:  85, durH: 2, kw: 95,  status: 'completed' },
    { title: '2025-01 혹한기 DR 정기 참여',       dAgo:  75, durH: 3, kw: 115, status: 'completed' },
    { title: '2025-02 동계 마지막 DR',            dAgo:  50, durH: 2, kw: 85,  status: 'completed' },
    { title: '2025-03 봄철 수요조정 테스트',      dAgo:  30, durH: 1, kw: 60,  status: 'completed' },
    { title: '2025-04 예비율 지원 DR',            dAgo:  10, durH: 2, kw: 75,  status: 'completed' },
    { title: '2025-05 하계 대비 DR 사전 테스트',  dAgo:  -3, durH: 2, kw: 80,  status: 'scheduled' },
    { title: '2025-06 하계 피크 대비 예비 DR',    dAgo: -20, durH: 4, kw: 140, status: 'scheduled' },
  ];

  let drCount = 0;
  for (const dr of drDefs) {
    const ex = await (prisma.drEvent as any).findFirst({ where: { tenantId, title: dr.title } });
    if (!ex) {
      const start = daysAgo(dr.dAgo);
      const end   = new Date(start.getTime() + dr.durH * 3_600_000);
      const done  = dr.status === 'completed';
      await (prisma.drEvent as any).create({
        data: {
          tenantId,
          title:              dr.title,
          startTime:          start,
          endTime:            end,
          targetReductionKw:  dr.kw,
          actualReductionKw:  done ? dr.kw * randFloat(0.82, 1.05) : null,
          revenue:            done ? dr.kw * dr.durH * randFloat(130, 180) : null,
          status:             dr.status,
        },
      });
      drCount++;
    }
    process.stdout.write('.');
  }
  console.log(`\n  ✅ DrEvent ${drCount}건 추가`);

  // ── 8. ControlSchedule (20건) ─────────────────────────────────────────
  console.log('\n📦 [Extra] ControlSchedule (20건)');
  const schedDefs = deviceIds.slice(0, 8).flatMap((devId, i) => [
    {
      name:         `공조기 ${i + 1}호기 — 업무시간 자동제어`,
      action:       'setpoint',
      params:       { targetTemp: 22, mode: 'cooling' },
      type:         'daily',
      cronExpr:     '0 8 * * 1-5',
      startAt:      daysAgo(30),
      enabled:      true,
      status:       'active',
      priority:     3,
    },
    {
      name:         `설비 ${i + 1}호기 — 야간 절전 모드`,
      action:       'stop',
      params:       { mode: 'standby', setback: 5 },
      type:         'daily',
      cronExpr:     '0 20 * * *',
      startAt:      daysAgo(60),
      enabled:      true,
      status:       'active',
      priority:     4,
    },
  ]).slice(0, 20);

  // 추가 특수 스케줄
  const specialScheds = [
    { name: '주말 전체 설비 절전 — 토/일 심야', action: 'stop', type: 'cron', cronExpr: '0 22 * * 5',   startAt: daysAgo(90), enabled: true,  status: 'active',   priority: 2 },
    { name: '하계 피크 사전 예냉 (10:00전 완료)', action: 'setpoint', type: 'cron', cronExpr: '0 7 * * 1-5', startAt: daysAgo(10), enabled: true,  status: 'active',   priority: 1 },
    { name: 'DR 이벤트 대응 — 비상 부하 차단',  action: 'stop',     type: 'once', cronExpr: null,          startAt: daysLater(5), enabled: false, status: 'paused',  priority: 1 },
    { name: '압축기 정기점검 — 일시 정지',      action: 'stop',     type: 'once', cronExpr: null,          startAt: daysLater(15), enabled: true, status: 'active',  priority: 5 },
  ];

  let schedCount = 0;
  const allScheds = [...schedDefs, ...specialScheds].slice(0, 20);
  for (const sd of allScheds) {
    const ex = await (prisma.controlSchedule as any).findFirst({ where: { tenantId, name: sd.name } });
    if (!ex && deviceIds.length > 0) {
      const devId = deviceIds[randInt(0, Math.min(deviceIds.length - 1, 7))];
      await (prisma.controlSchedule as any).create({
        data: {
          tenantId,
          deviceId:      devId,
          name:          sd.name,
          description:   `자동 생성 스케줄 — ${sd.name}`,
          action:        sd.action,
          parameters:    sd.params ?? { mode: 'standby' },
          scheduleType:  sd.type,
          cronExpr:      (sd as any).cronExpr ?? null,
          startAt:       sd.startAt,
          priority:      sd.priority,
          allowOverlap:  false,
          enabled:       sd.enabled,
          status:        sd.status,
          lastRunAt:     sd.status === 'active' ? daysAgo(1) : null,
          nextRunAt:     sd.status === 'active' ? daysLater(1) : null,
          createdBy:     userId,
        },
      });
      schedCount++;
    }
    process.stdout.write('.');
  }
  console.log(`\n  ✅ ControlSchedule ${schedCount}건 추가`);

  // ── 9. ForecastResult (12개월) ─────────────────────────────────────────
  console.log('\n📦 [Extra] ForecastResult (12개월)');
  let fcastCount = 0;
  for (let mo = 11; mo >= 0; mo--) {
    const kwh = monthlyKwh(mo);
    const horizons = ['24h', '7d', '30d'] as const;
    for (const hz of horizons) {
      const ex = await (prisma.forecastResult as any).findFirst({
        where: { tenantId, horizon: hz, createdAt: { gte: monthStart(mo), lte: monthEnd(mo) } },
      });
      if (!ex) {
        const preds = Array.from({ length: hz === '24h' ? 24 : hz === '7d' ? 7 : 30 }, (_, i) => ({
          timestamp: new Date(monthStart(mo).getTime() + i * (hz === '24h' ? 3_600_000 : 86_400_000)).toISOString(),
          value:     Math.round((kwh / (hz === '30d' ? 30 : hz === '7d' ? 7 : 1)) * randFloat(0.88, 1.12)),
          lower:     Math.round((kwh / (hz === '30d' ? 30 : hz === '7d' ? 7 : 1)) * 0.85),
          upper:     Math.round((kwh / (hz === '30d' ? 30 : hz === '7d' ? 7 : 1)) * 1.15),
        }));
        await (prisma.forecastResult as any).create({
          data: {
            tenantId,
            siteId:      site1,
            horizon:     hz,
            predictions: preds,
            accuracy:    randFloat(88, 97, 1),
            model:       'EMS-LocalForecast-v2',
            createdAt:   monthStart(mo),
          },
        });
        fcastCount++;
      }
    }
    process.stdout.write('.');
  }
  console.log(`\n  ✅ ForecastResult ${fcastCount}건 추가`);

  // ── 10. Report (규제·탄소·에너지·종합 각종 보고서 20건) ───────────────
  console.log('\n📦 [Extra] Report (20건)');
  const reportDefs = [
    { type: 'carbon',       period: 'monthly', title: '탄소 배출량 월간 보고서' },
    { type: 'energy',       period: 'monthly', title: '에너지 사용량 월간 보고서' },
    { type: 'cost',         period: 'monthly', title: '전력 비용 분석 월간 보고서' },
    { type: 'comprehensive',period: 'monthly', title: '종합 에너지·탄소 월간 보고서' },
    { type: 'carbon',       period: 'yearly',  title: '탄소 배출량 연간 보고서' },
    { type: 'energy',       period: 'yearly',  title: '에너지 사용량 연간 보고서' },
  ];
  let rptCount = 0;
  for (let mo = 5; mo >= 0; mo--) {
    for (const rd of reportDefs.slice(0, 3)) {
      const ex = await (prisma.report as any).findFirst({
        where: { tenantId, type: rd.type, period: rd.period,
          startDate: { gte: monthStart(mo + 1) }, endDate: { lte: monthEnd(mo) } },
      });
      if (!ex) {
        const kwh = monthlyKwh(mo);
        await (prisma.report as any).create({
          data: {
            tenantId,
            type:        rd.type,
            period:      rd.period,
            startDate:   monthStart(mo),
            endDate:     monthEnd(mo),
            siteId:      null,
            generatedBy: userId,
            data: {
              title:      `${rd.title} (${periodStr(mo)})`,
              period:     periodStr(mo),
              totalKwh:   kwh,
              totalCo2:   (kwh * 0.4567 / 1000).toFixed(2),
              totalCost:  Math.round(kwh * 120.5).toLocaleString(),
              summary:    `${periodStr(mo)} 기간의 ${rd.title} 자동 생성`,
            },
            fileUrl: null,
          },
        });
        rptCount++;
        if (rptCount >= 20) break;
      }
    }
    if (rptCount >= 20) break;
    process.stdout.write('.');
  }
  console.log(`\n  ✅ Report ${rptCount}건 추가`);

  // ── 11. AuditLog (150건) ─────────────────────────────────────────────
  console.log('\n📦 [Extra] AuditLog (150건)');
  const auditActions = [
    { action: 'site.create',    rt: 'site',    result: 'success' },
    { action: 'site.update',    rt: 'site',    result: 'success' },
    { action: 'device.create',  rt: 'device',  result: 'success' },
    { action: 'device.update',  rt: 'device',  result: 'success' },
    { action: 'user.create',    rt: 'user',    result: 'success' },
    { action: 'user.update',    rt: 'user',    result: 'success' },
    { action: 'user.login',     rt: 'user',    result: 'success' },
    { action: 'report.generate',rt: 'report',  result: 'success' },
    { action: 'carbon.register',rt: 'emission',result: 'success' },
    { action: 'dr.create',      rt: 'dr_event',result: 'success' },
    { action: 'schedule.create',rt: 'schedule',result: 'success' },
    { action: 'apikey.create',  rt: 'api_key', result: 'success' },
    { action: 'user.login',     rt: 'user',    result: 'failure' },
    { action: 'device.delete',  rt: 'device',  result: 'success' },
    { action: 'sensor.create',  rt: 'sensor',  result: 'success' },
  ];
  const existingAuditCount = await (prisma.auditLog as any).count({ where: { tenantId } });
  if (existingAuditCount < 50) {
    for (let i = 0; i < 150; i++) {
      const aa  = auditActions[randInt(0, auditActions.length - 1)]!;
      const uid = randInt(0, 3) === 0 ? null : userId;
      await (prisma.auditLog as any).create({
        data: {
          tenantId,
          userId:       uid,
          action:       aa.action,
          resourceType: aa.rt,
          resourceId:   crypto.randomUUID(),
          changes:      aa.action.includes('update') ? { before: { name: 'old' }, after: { name: 'new' } } : null,
          result:       aa.result as any,
          errorMessage: aa.result === 'failure' ? '인증 실패 — 비밀번호 불일치' : null,
          ipAddress:    `192.168.${randInt(1, 10)}.${randInt(1, 254)}`,
          userAgent:    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0',
          createdAt:    daysAgo(randInt(0, 365)),
        },
      });
      if (i % 30 === 0) process.stdout.write('.');
    }
    console.log('\n  ✅ AuditLog 150건 추가');
  } else {
    console.log(`  ✅ AuditLog 이미 충분 (${existingAuditCount}건)`);
  }

  // ── 12. ActivityLog (200건) ─────────────────────────────────────────
  console.log('\n📦 [Extra] ActivityLog (200건)');
  const existingActCount = await (prisma.activityLog as any).count({ where: { tenantId } });
  if (existingActCount < 50) {
    const actTypes = [
      { menu: 'SITE_MGMT',   action: 'CREATE', label: '사이트 생성',       rt: 'site' },
      { menu: 'SITE_MGMT',   action: 'UPDATE', label: '사이트 수정',       rt: 'site' },
      { menu: 'DEVICE_MGMT', action: 'CREATE', label: '설비 등록',         rt: 'device' },
      { menu: 'DEVICE_MGMT', action: 'UPDATE', label: '설비 상태 변경',    rt: 'device' },
      { menu: 'CARBON_FUEL', action: 'CREATE', label: '연료 사용량 등록',  rt: 'emission' },
      { menu: 'SN',          action: 'CREATE', label: '센서 등록',         rt: 'sensor' },
      { menu: 'SN',          action: 'DELETE', label: '센서 삭제',         rt: 'sensor' },
      { menu: 'REPORT',      action: 'GENERATE',label: '보고서 생성',      rt: 'report' },
      { menu: 'DOWNLOAD',    action: 'DOWNLOAD',label: '데이터 다운로드',  rt: 'download' },
      { menu: 'DR_MGMT',     action: 'CREATE', label: 'DR 이벤트 등록',   rt: 'dr_event' },
      { menu: 'SCHEDULE',    action: 'CREATE', label: '스케줄 등록',       rt: 'schedule' },
      { menu: 'AUDIT',       action: 'UPLOAD', label: '감사 문서 업로드',  rt: 'audit' },
    ];
    const roleOptions = ['tenant_admin', 'site_manager', 'operator', 'viewer'];
    for (let i = 0; i < 200; i++) {
      const at  = actTypes[randInt(0, actTypes.length - 1)]!;
      const seq = String(i + 1).padStart(4, '0');
      const d   = daysAgo(randInt(0, 365));
      const ym  = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
      await (prisma.activityLog as any).create({
        data: {
          tenantId,
          logNo:        `${at.menu.substring(0, 2)}-${ym}-${seq}`,
          menuCode:     at.menu,
          actionType:   at.action,
          actionLabel:  at.label,
          resourceType: at.rt,
          resourceId:   crypto.randomUUID(),
          resourceName: `테스트 ${at.rt} #${i + 1}`,
          status:       'success',
          userId,
          userName:     '데모 사용자',
          userEmail:    'demo@carbonieum.com',
          userRole:     roleOptions[randInt(0, 3)],
          ipAddress:    `10.0.${randInt(1, 10)}.${randInt(1, 254)}`,
          createdAt:    d,
        },
      });
      if (i % 40 === 0) process.stdout.write('.');
    }
    console.log('\n  ✅ ActivityLog 200건 추가');
  } else {
    console.log(`  ✅ ActivityLog 이미 충분 (${existingActCount}건)`);
  }

  // ── 13. LoginHistory (100건) ─────────────────────────────────────────
  console.log('\n📦 [Extra] LoginHistory (100건)');
  const existingLoginCount = await (prisma.loginHistory as any).count({ where: { tenantId } });
  if (existingLoginCount < 30) {
    const providers = ['credentials', 'google', 'naver'];
    const uas = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile Safari/604.1',
    ];
    for (let i = 0; i < 100; i++) {
      const success = Math.random() > 0.08; // 92% 성공률
      await (prisma.loginHistory as any).create({
        data: {
          userId,
          tenantId,
          ipAddress:  `211.234.${randInt(1, 255)}.${randInt(1, 254)}`,
          userAgent:  uas[randInt(0, 2)],
          provider:   providers[randInt(0, 2)],
          success,
          failReason: success ? null : ['비밀번호 불일치', '계정 잠금', 'IP 차단'][randInt(0, 2)],
          createdAt:  daysAgo(randInt(0, 365)),
        },
      });
      if (i % 20 === 0) process.stdout.write('.');
    }
    console.log('\n  ✅ LoginHistory 100건 추가');
  } else {
    console.log(`  ✅ LoginHistory 이미 충분 (${existingLoginCount}건)`);
  }

  // ── 14. EquipmentLot (15건) ───────────────────────────────────────────
  console.log('\n📦 [Extra] EquipmentLot (15건)');
  const lotStatuses: Array<{
    status: string; facilityType: string; dAgo: number;
  }> = [
    { status: 'active',     facilityType: 'factory',     dAgo: 365 },
    { status: 'active',     facilityType: 'factory',     dAgo: 300 },
    { status: 'active',     facilityType: 'office',      dAgo: 270 },
    { status: 'installed',  facilityType: 'factory',     dAgo: 180 },
    { status: 'installed',  facilityType: 'building',    dAgo: 150 },
    { status: 'installing', facilityType: 'factory',     dAgo:  30 },
    { status: 'installing', facilityType: 'residential', dAgo:  15 },
    { status: 'delivered',  facilityType: 'factory',     dAgo:   7 },
    { status: 'delivered',  facilityType: 'building',    dAgo:   5 },
    { status: 'shipped',    facilityType: 'factory',     dAgo:   3 },
    { status: 'shipped',    facilityType: 'office',      dAgo:   2 },
    { status: 'pending',    facilityType: 'factory',     dAgo:   0 },
    { status: 'pending',    facilityType: 'building',    dAgo:   0 },
    { status: 'returned',   facilityType: 'factory',     dAgo: 200 },
    { status: 'active',     facilityType: 'building',    dAgo: 400 },
  ];
  const techs = ['김철수(010-1234-5678)', '이영희(010-2345-6789)', '박민준(010-3456-7890)', '최지원(010-4567-8901)'];
  const siteAddrs = ['서울특별시 마포구 상암산로 48', '경기도 성남시 분당구 판교역로 166', '인천광역시 서구 청라국제도시1로 50'];
  let lotCount = 0;
  for (let i = 0; i < lotStatuses.length; i++) {
    const ld = lotStatuses[i]!;
    const d  = daysAgo(ld.dAgo);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const lotNumber = `LOT-${yr}${mo}${dd}-${String(i + 1).padStart(4, '0')}`;
    const ex = await (prisma.equipmentLot as any).findFirst({ where: { tenantId, lotNumber } });
    if (!ex) {
      const ordered  = daysAgo(ld.dAgo + 14);
      const shipped  = ld.dAgo <= 360 ? daysAgo(ld.dAgo + 7)  : null;
      const deliv    = ['delivered', 'installing', 'installed', 'active'].includes(ld.status) ? daysAgo(ld.dAgo) : null;
      const instAt   = ['installed', 'active'].includes(ld.status) ? daysAgo(Math.max(0, ld.dAgo - 7)) : null;
      const siteIdx  = randInt(0, 2);
      await (prisma.equipmentLot as any).create({
        data: {
          tenantId,
          lotNumber,
          facilityType:   ld.facilityType,
          status:         ld.status,
          orderedAt:      ordered,
          shippedAt:      shipped,
          deliveredAt:    deliv,
          installedAt:    instAt,
          technicianName: ['installing', 'installed', 'active'].includes(ld.status) ? techs[randInt(0, 3)] : null,
          siteId:         siteIds[siteIdx] ?? null,
          siteAddress:    siteAddrs[siteIdx],
          siteContact:    `담당자 ${i + 1} (02-${randInt(1000, 9999)}-${randInt(1000, 9999)})`,
          notes:          `LOT-${i + 1}: ${ld.facilityType} 설비 설치 건`,
          metadata: {
            productCount: randInt(1, 8),
            totalPrice:   randInt(1_000_000, 15_000_000),
          },
        },
      });
      lotCount++;
    }
    process.stdout.write('.');
  }
  console.log(`\n  ✅ EquipmentLot ${lotCount}건 추가`);

  // ── 15. NotificationLog (80건) ───────────────────────────────────────
  console.log('\n📦 [Extra] NotificationLog (80건)');
  const existingNotifRules = await (prisma.notificationRule as any).findMany({
    where: { tenantId }, select: { id: true }, take: 8,
  });
  if (existingNotifRules.length > 0) {
    const existingNL = await (prisma.notificationLog as any).count({ where: { rule: { tenantId } } });
    if (existingNL < 20) {
      const subjects = [
        '⚡ 전력 피크 초과 경보',
        '🌡️ 에너지 급증 감지',
        '📡 게이트웨이 오프라인',
        '🌿 탄소 예산 90% 초과',
        '🔔 DR 이벤트 15분 전',
        '💡 실내 CO₂ 농도 경고',
        '💳 구독 만료 7일 전',
        '🔒 보안 이벤트 감지',
      ];
      for (let i = 0; i < 80; i++) {
        const rule    = existingNotifRules[randInt(0, existingNotifRules.length - 1)]!;
        const success = Math.random() > 0.05; // 95% 발송 성공
        await (prisma.notificationLog as any).create({
          data: {
            ruleId:    rule.id,
            channel:   ['email', 'sms', 'push'][randInt(0, 2)],
            recipient: 'demo@carbonieum.com',
            subject:   subjects[randInt(0, subjects.length - 1)],
            body:      `[탄소이음 EMS] 알림 #${i + 1}: 시스템 자동 알림 메시지입니다.`,
            status:    success ? 'sent' : 'failed',
            errorMsg:  success ? null : '수신자 메일서버 응답 없음',
            sentAt:    success ? daysAgo(randInt(0, 180)) : null,
            createdAt: daysAgo(randInt(0, 180)),
          },
        });
        if (i % 20 === 0) process.stdout.write('.');
      }
      console.log('\n  ✅ NotificationLog 80건 추가');
    } else {
      console.log(`  ✅ NotificationLog 이미 충분 (${existingNL}건)`);
    }
  } else {
    console.log('  ⚠️  NotificationRule 없어 건너뜀');
  }

  // ── 16. DownloadHistory (30건) ─────────────────────────────────────
  console.log('\n📦 [Extra] DownloadHistory (30건)');
  const existingDL = await (prisma.downloadHistory as any).count({ where: { tenantId } });
  if (existingDL < 10) {
    const dlTypes = [
      { format: 'csv',  range: 'daily',   dataType: 'measurement', title: '측정 데이터 일별 CSV 다운로드' },
      { format: 'xlsx', range: 'monthly', dataType: 'emission',    title: '탄소 배출량 월간 Excel 다운로드' },
      { format: 'csv',  range: 'weekly',  dataType: 'measurement', title: '주간 에너지 데이터 CSV' },
      { format: 'pdf',  range: 'monthly', dataType: 'report',      title: '월간 리포트 PDF' },
      { format: 'xlsx', range: 'yearly',  dataType: 'kpi',         title: '연간 KPI 데이터 Excel' },
    ];
    for (let i = 0; i < 30; i++) {
      const dl = dlTypes[randInt(0, dlTypes.length - 1)]!;
      const d  = daysAgo(randInt(0, 180));
      await (prisma.downloadHistory as any).create({
        data: {
          tenantId,
          userId,
          title:      dl.title,
          dataType:   dl.dataType,
          format:     dl.format,
          dateRange:  dl.range,
          siteId:     Math.random() > 0.5 ? site1 : null,
          fileSize:   randInt(50_000, 5_000_000),
          recordCount:randInt(100, 50_000),
          filePath:   `/downloads/demo/${d.getFullYear()}/${dl.dataType}-${i + 1}.${dl.format}`,
          status:     'completed',
          createdAt:  d,
        },
      });
      if (i % 10 === 0) process.stdout.write('.');
    }
    console.log('\n  ✅ DownloadHistory 30건 추가');
  } else {
    console.log(`  ✅ DownloadHistory 이미 충분 (${existingDL}건)`);
  }

  console.log('\n🎉 [Extra] 모든 추가 데모 데이터 삽입 완료\n');
}
