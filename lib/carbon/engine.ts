/**
 * lib/carbon/engine.ts — 탄소 배출량 계산 엔진
 *
 * 원칙:
 *   1. 모든 계산은 계산 엔진 버전(CalcEngineVersion) + 배출계수(EmissionFactor)를 명시
 *   2. 결과는 EmissionsRecord에 불변 저장 (Overwrite 금지)
 *   3. 재계산 시 기존 레코드를 archived 처리 후 신규 생성
 *
 * GHG Protocol 기준:
 *   Scope 1 = 연료 직접 연소 (자체 보유 장비)
 *   Scope 2 = 구매 전력 (Location-based method)
 *   Scope 3 = 공급망/운송/폐기물 등 간접 배출
 *
 * 배출량 (tCO₂eq) = 활동 데이터 × 배출계수
 */

import { prisma } from '@/lib/db/prisma';
import { Decimal } from '@prisma/client/runtime/library';

// ──────────────────────────────────────────────────────────────
// 타입 정의
// ──────────────────────────────────────────────────────────────

export interface CalcInput {
  tenantId:        string;
  siteId?:         string;
  period:          string;          // 'YYYY-MM'
  scope:           'scope1' | 'scope2' | 'scope3';
  sourceType:      string;          // 'electricity' | 'natural_gas' | 'diesel' | ...
  activityData:    number;          // 소비량 (숫자값)
  activityUnit:    string;          // 'kWh' | 'L' | 'kg' | 'km' | ...
  engineVersionId: string;
  emissionFactorId: string;
  createdBy?:      string;
}

export interface CalcResult {
  recordId:           string;
  emissions:          number;       // tCO₂eq
  emissionFactorValue: number;
  emissionFactorUnit:  string;
  engineVersion:       string;
  factorSource:        string;
  factorYear:          number;
}

export interface PeriodSummary {
  period:      string;
  scope1:      number;
  scope2:      number;
  scope3:      number;
  total:       number;
  recordCount: number;
  engineVersionId: string;
  calculatedAt:    Date;
}

// ──────────────────────────────────────────────────────────────
// 계산 엔진 버전 조회
// ──────────────────────────────────────────────────────────────

/**
 * 현재 활성 계산 엔진 버전 조회.
 * 없으면 기본값(v1.0.0) 레코드를 생성.
 */
export async function getActiveEngineVersion() {
  let engine = await prisma.calcEngineVersion.findFirst({
    where: { isActive: true },
    orderBy: { releasedAt: 'desc' },
  });

  if (!engine) {
    engine = await prisma.calcEngineVersion.create({
      data: {
        version: '1.0.0',
        name: 'GHG Protocol 기본 계산 엔진',
        description: 'K-MRV 및 GHG Protocol 기반 기본 계산 로직',
        methodology: 'GHG Protocol',
        formula: {
          scope1: 'activityData(L or kg) × emissionFactor(tCO2eq/unit)',
          scope2: 'electricityConsumption(kWh) × gridEmissionFactor(tCO2eq/kWh)',
          scope3: 'transportDistance(km) × loadFactor × emissionFactor',
        },
        parameters: {
          electricityUnit: 'kWh',
          fuelUnit:        'L',
          emissionUnit:    'tCO2eq',
        },
        isActive:   true,
        releasedAt: new Date(),
        changelog: '초기 버전 — 환경부 2024 배출계수 기준',
      },
    });
  }

  return engine;
}

// ──────────────────────────────────────────────────────────────
// 배출계수 조회
// ──────────────────────────────────────────────────────────────

/**
 * sourceType + region + year 기준 최신 배출계수 조회.
 * 테넌트 전용 계수 우선, 없으면 글로벌 기본값 사용.
 */
export async function findEmissionFactor(opts: {
  tenantId: string;
  category: string;       // 'electricity' | 'fuel' | 'transport'
  sourceType: string;
  year?: number;
  region?: string;
}) {
  const { tenantId, category, sourceType, year = new Date().getFullYear(), region = 'KR' } = opts;

  // 테넌트 전용 계수 우선
  const tenantFactor = await prisma.emissionFactor.findFirst({
    where: {
      tenantId,
      category,
      sourceType: { contains: sourceType },
      year: { lte: year },
      OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
    },
    orderBy: { year: 'desc' },
  });

  if (tenantFactor) return tenantFactor;

  // 글로벌 기본값
  const globalFactor = await prisma.emissionFactor.findFirst({
    where: {
      tenantId: null,
      category,
      sourceType: { contains: sourceType },
      region,
      year: { lte: year },
      OR: [{ validTo: null }, { validTo: { gte: new Date() } }],
    },
    orderBy: { year: 'desc' },
  });

  return globalFactor;
}

// ──────────────────────────────────────────────────────────────
// 핵심: 단일 배출량 계산 + 불변 기록 저장
// ──────────────────────────────────────────────────────────────

/**
 * 배출량 계산 후 EmissionsRecord에 저장.
 * 모든 계산은 engineVersionId + emissionFactorId를 반드시 포함.
 */
export async function calculateAndRecord(input: CalcInput): Promise<CalcResult> {
  // 배출계수 조회
  const factor = await prisma.emissionFactor.findUnique({
    where: { id: input.emissionFactorId },
  });
  if (!factor) {
    throw new Error(`배출계수 없음: ${input.emissionFactorId}`);
  }

  // 엔진 버전 조회
  const engine = await prisma.calcEngineVersion.findUnique({
    where: { id: input.engineVersionId },
  });
  if (!engine) {
    throw new Error(`계산 엔진 버전 없음: ${input.engineVersionId}`);
  }

  // 배출량 계산 (tCO₂eq = 활동량 × 배출계수)
  const factorValue = Number(factor.factor);
  const emissions   = input.activityData * factorValue;

  // 불변 레코드 저장
  const record = await prisma.emissionsRecord.create({
    data: {
      tenantId:           input.tenantId,
      siteId:             input.siteId ?? null,
      engineVersionId:    input.engineVersionId,
      emissionFactorId:   input.emissionFactorId,
      emissionFactorValue: new Decimal(factorValue),
      emissionFactorUnit:  factor.unit,
      scope:              input.scope,
      sourceType:         input.sourceType,
      activityData:       new Decimal(input.activityData),
      activityUnit:       input.activityUnit,
      emissions:          new Decimal(emissions),
      unit:               'tCO2eq',
      period:             input.period,
      createdBy:          input.createdBy ?? null,
      isArchived:         false,
    },
  });

  // 감사 로그
  await prisma.auditLog.create({
    data: {
      tenantId:     input.tenantId,
      userId:       input.createdBy ?? null,
      action:       'EMISSIONS_CALCULATED',
      resourceType: 'emissions_record',
      resourceId:   record.id,
      changes: {
        scope:           input.scope,
        period:          input.period,
        activityData:    input.activityData,
        activityUnit:    input.activityUnit,
        emissionFactor:  factorValue,
        emissions,
        engineVersion:   engine.version,
        factorSource:    factor.source,
      },
    },
  }).catch(() => null); // 감사 로그 실패해도 계산 결과는 유지

  return {
    recordId:            record.id,
    emissions,
    emissionFactorValue: factorValue,
    emissionFactorUnit:  factor.unit,
    engineVersion:       engine.version,
    factorSource:        factor.source,
    factorYear:          factor.year,
  };
}

// ──────────────────────────────────────────────────────────────
// 재계산 (배출계수/엔진 변경 시)
// ──────────────────────────────────────────────────────────────

export interface RecalcOptions {
  tenantId:           string;
  period:             string;
  newEngineVersionId: string;
  newEmissionFactorId?: string;
  reason:             string;
  requestedBy:        string;
}

export interface RecalcResult {
  archivedCount:  number;
  newRecordCount: number;
  periodSummary:  PeriodSummary;
}

/**
 * 특정 기간 배출량 재계산.
 *
 * 처리:
 *   1. 기존 활성 레코드 → isArchived = true (원본 보존)
 *   2. 동일 활동 데이터로 신규 엔진/계수 적용해 재계산
 *   3. 감사 로그 기록
 */
export async function recalculatePeriod(opts: RecalcOptions): Promise<RecalcResult> {
  const { tenantId, period, newEngineVersionId, reason, requestedBy } = opts;

  // 현재 활성 레코드 조회
  const existing = await prisma.emissionsRecord.findMany({
    where: { tenantId, period, isArchived: false },
  });

  if (existing.length === 0) {
    throw new Error(`재계산할 레코드 없음: ${period}`);
  }

  const now = new Date();
  const newRecords: CalcResult[] = [];

  // 트랜잭션으로 원자 처리
  await prisma.$transaction(async (tx) => {
    // 1. 기존 레코드 아카이브
    await tx.emissionsRecord.updateMany({
      where: { tenantId, period, isArchived: false },
      data: {
        isArchived:    true,
        archivedAt:    now,
        archivedBy:    requestedBy,
        archiveReason: reason,
      },
    });

    // 2. 동일 활동 데이터로 신규 계산 (새 계수/엔진 적용)
    for (const rec of existing) {
      const factorId = opts.newEmissionFactorId ?? rec.emissionFactorId;

      const factor = await tx.emissionFactor.findUnique({ where: { id: factorId } });
      if (!factor) continue;

      const newEmissions = Number(rec.activityData) * Number(factor.factor);

      const newRec = await tx.emissionsRecord.create({
        data: {
          tenantId:            tenantId,
          siteId:              rec.siteId,
          engineVersionId:     newEngineVersionId,
          emissionFactorId:    factorId,
          emissionFactorValue: factor.factor,
          emissionFactorUnit:  factor.unit,
          scope:               rec.scope,
          sourceType:          rec.sourceType,
          activityData:        rec.activityData,
          activityUnit:        rec.activityUnit,
          emissions:           new Decimal(newEmissions),
          unit:                'tCO2eq',
          period:              period,
          parentId:            rec.id,  // 원본 레코드 참조
          createdBy:           requestedBy,
          isArchived:          false,
        },
      });

      newRecords.push({
        recordId:            newRec.id,
        emissions:           newEmissions,
        emissionFactorValue: Number(factor.factor),
        emissionFactorUnit:  factor.unit,
        engineVersion:       newEngineVersionId,
        factorSource:        factor.source,
        factorYear:          factor.year,
      });
    }

    // 3. 재계산 감사 로그
    await tx.auditLog.create({
      data: {
        tenantId,
        userId:       requestedBy,
        action:       'EMISSIONS_RECALCULATED',
        resourceType: 'emissions_record',
        resourceId:   tenantId,
        changes: {
          period,
          reason,
          archivedCount:  existing.length,
          newRecordCount: newRecords.length,
          newEngineVersionId,
          newEmissionFactorId: opts.newEmissionFactorId ?? '(원본 유지)',
        },
      },
    });
  });

  // 4. 기간 요약
  const summary = await getPeriodSummary(tenantId, period);

  return {
    archivedCount:  existing.length,
    newRecordCount: newRecords.length,
    periodSummary:  summary,
  };
}

// ──────────────────────────────────────────────────────────────
// 기간 배출량 집계
// ──────────────────────────────────────────────────────────────

/**
 * 특정 기간 Scope별 배출량 집계 (활성 레코드만).
 */
export async function getPeriodSummary(tenantId: string, period: string): Promise<PeriodSummary> {
  const records = await prisma.emissionsRecord.findMany({
    where: { tenantId, period, isArchived: false },
    select: {
      scope:          true,
      emissions:      true,
      engineVersionId: true,
      createdAt:      true,
    },
  });

  let scope1 = 0, scope2 = 0, scope3 = 0;
  let latestEngineId = '';
  let latestAt = new Date(0);

  for (const r of records) {
    const em = Number(r.emissions);
    if (r.scope === 'scope1') scope1 += em;
    else if (r.scope === 'scope2') scope2 += em;
    else if (r.scope === 'scope3') scope3 += em;

    if (r.createdAt > latestAt) {
      latestAt       = r.createdAt;
      latestEngineId = r.engineVersionId;
    }
  }

  return {
    period,
    scope1: Math.round(scope1 * 1000) / 1000,
    scope2: Math.round(scope2 * 1000) / 1000,
    scope3: Math.round(scope3 * 1000) / 1000,
    total:  Math.round((scope1 + scope2 + scope3) * 1000) / 1000,
    recordCount:     records.length,
    engineVersionId: latestEngineId,
    calculatedAt:    latestAt,
  };
}

/**
 * 연간 월별 배출량 집계 (Scope 구분).
 */
export async function getYearlySummary(tenantId: string, year: number) {
  const months: PeriodSummary[] = [];

  for (let m = 1; m <= 12; m++) {
    const period = `${year}-${String(m).padStart(2, '0')}`;
    const summary = await getPeriodSummary(tenantId, period);
    months.push(summary);
  }

  const total = months.reduce(
    (acc, m) => ({
      scope1: acc.scope1 + m.scope1,
      scope2: acc.scope2 + m.scope2,
      scope3: acc.scope3 + m.scope3,
      total:  acc.total  + m.total,
    }),
    { scope1: 0, scope2: 0, scope3: 0, total: 0 }
  );

  return { year, months, annual: total };
}
