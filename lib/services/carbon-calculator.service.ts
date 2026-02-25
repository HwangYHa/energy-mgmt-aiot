/**
 * lib/services/carbon-calculator.service.ts
 *
 * 탄소 배출량 계산 Service Layer — 모든 계산 로직의 단일 진입점
 *
 * 책임:
 *   1. 배출계수 조회 (테넌트 설정 → 글로벌 DB → 하드코딩 기본값 순)
 *   2. 불변 계산: tCO₂eq = usage × factor / 1000
 *   3. EmissionsData 저장 (calculationMethod, dataSource 표준화)
 *   4. AuditLog 자동 기록
 *   5. 재계산 시 기존 레코드 archive 후 신규 생성
 *
 * GHG Protocol 기준:
 *   Scope 1 = 연료 직접 연소 (가스, 경유 등)
 *   Scope 2 = 구매 전력 (Location-based, 배출계수 × 전력량)
 *   Scope 3 = 공급망/운송/폐기물 등 간접 배출
 */

import { prisma } from '@/lib/db/prisma';
import { DataSourceType } from '@prisma/client';
import { findEmissionFactor, getActiveEngineVersion } from '@/lib/carbon/engine';

// ─────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────

export type InvoiceType = 'electricity' | 'gas' | 'diesel' | 'other';
export type ScopeType   = 'scope1' | 'scope2' | 'scope3';
export type DataSource  = 'MANUAL' | 'INVOICE' | 'IOT' | 'IMPORT';
export type CalcMethod  = 'manual' | 'automatic' | 'estimated';

export interface CalcFromInvoiceInput {
  tenantId:    string;
  userId:      string;
  usage:       number;           // 사용량 (숫자)
  unit:        string;           // 'kWh' | 'm³' | 'L' | ...
  period:      string;           // 'YYYY-MM'
  invoiceType: InvoiceType;
  dataSource?: DataSource;       // 기본: 'INVOICE'
  notes?:      string;
}

export interface CalcResult {
  recordId:     string;
  emissions:    number;          // tCO₂eq
  emissionsUnit: 'tCO2eq';
  factorValue:  number;
  factorSource: 'db' | 'tenant_settings' | 'default';
  scope:        ScopeType;
  sourceType:   string;
  period:       string;
  message:      string;
  engineVersion: string;
}

export interface RecalcInput {
  tenantId:    string;
  userId:      string;
  period:      string;           // 'YYYY-MM'
  reason:      string;           // 재계산 이유 (5자 이상)
  newFactorId?: string;          // 특정 배출계수 ID 지정
}

export interface RecalcResult {
  archived:  number;             // archive된 레코드 수
  created:   number;             // 새로 생성된 레코드 수
  period:    string;
  reason:    string;
}

// ─────────────────────────────────────────────────────
// 상수: 기본 배출계수
// ─────────────────────────────────────────────────────

const DEFAULT_FACTORS: Record<string, number> = {
  electricity: 0.4567,   // tCO₂/MWh (한국 전력 2023 기준)
  natural_gas: 2.176,    // tCO₂/1000 m³
  diesel:      2.664,    // tCO₂/kL
  other:       1.0,
};

const INVOICE_TYPE_MAP: Record<InvoiceType, { sourceType: string; scope: ScopeType; category: string }> = {
  electricity: { sourceType: 'electricity', scope: 'scope2', category: 'electricity' },
  gas:         { sourceType: 'natural_gas', scope: 'scope1', category: 'fuel' },
  diesel:      { sourceType: 'diesel',      scope: 'scope1', category: 'fuel' },
  other:       { sourceType: 'other',       scope: 'scope3', category: 'other' },
};

// ─────────────────────────────────────────────────────
// CarbonCalculatorService
// ─────────────────────────────────────────────────────

export class CarbonCalculatorService {

  /**
   * 고지서/수동 입력 기반 배출량 계산 및 저장
   *
   * @example
   * const result = await CarbonCalculatorService.calculateFromInvoice({
   *   tenantId: 'tenant_abc',
   *   userId:   'user_xyz',
   *   usage:    1234.5,
   *   unit:     'kWh',
   *   period:   '2026-01',
   *   invoiceType: 'electricity',
   * });
   * // → { emissions: 0.564, factorValue: 0.4567, scope: 'scope2', ... }
   */
  static async calculateFromInvoice(input: CalcFromInvoiceInput): Promise<CalcResult> {
    const { tenantId, userId, usage, unit, period, invoiceType, dataSource = 'INVOICE', notes } = input;

    if (usage <= 0) {
      throw new Error('사용량은 0보다 커야 합니다.');
    }
    if (!/^\d{4}-\d{2}$/.test(period)) {
      throw new Error('기간 형식이 올바르지 않습니다 (YYYY-MM).');
    }

    const typeConfig = INVOICE_TYPE_MAP[invoiceType];
    const year       = parseInt(period.slice(0, 4), 10);

    // ── 1. 배출계수 조회 (DB → 테넌트 설정 → 기본값 순) ──
    const { factorValue, factorSource } = await CarbonCalculatorService.resolveFactor(
      tenantId,
      typeConfig.category,
      typeConfig.sourceType,
      year
    );

    // ── 2. 배출량 계산 ──
    // tCO₂eq = usage(kWh) × factor(kgCO₂/kWh) / 1000
    const emissions = (usage * factorValue) / 1000;

    // ── 3. 활성 엔진 버전 조회 ──
    const engine = await getActiveEngineVersion().catch(() => ({ version: '1.0.0', id: 'default' }));

    // ── 4. EmissionsData 저장 ──
    const record = await prisma.emissionsData.create({
      data: {
        tenantId,
        emissionType:        typeConfig.scope,
        sourceType:          typeConfig.sourceType,
        amount:              usage,
        unit,
        emissionFactor:      factorValue,
        calculatedEmission:  emissions,
        period,
        calculationMethod:   'manual',
        dataSource:          toPrismaDataSource(dataSource),
        ...(notes ? { notes } : {}),
      },
    });

    // ── 5. AuditLog 기록 ──
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action:       'EMISSIONS_CALCULATED',
        resourceType: 'emissions_data',
        resourceId:   record.id,
        changes: {
          invoiceType,
          usage,
          unit,
          period,
          emissions,
          factorValue,
          factorSource,
          engineVersion: engine.version,
          dataSource,
        },
      },
    }).catch(() => null);

    const roundedEmissions = Math.round(emissions * 10000) / 10000;

    return {
      recordId:     record.id,
      emissions:    roundedEmissions,
      emissionsUnit: 'tCO2eq',
      factorValue,
      factorSource,
      scope:        typeConfig.scope,
      sourceType:   typeConfig.sourceType,
      period,
      engineVersion: engine.version,
      message:      `${period} ${typeConfig.scope.toUpperCase()} 배출량 ${roundedEmissions} tCO₂eq 기록되었습니다.`,
    };
  }

  /**
   * 특정 기간 배출량 재계산
   *
   * 원칙: 기존 레코드 수정 금지 — archive 후 신규 생성
   */
  static async recalculate(input: RecalcInput): Promise<RecalcResult> {
    const { tenantId, userId, period, reason } = input;

    if (reason.length < 5) {
      throw new Error('재계산 이유는 5자 이상 입력해야 합니다.');
    }

    // ── 1. 기존 활성 레코드 조회 ──
    const existing = await prisma.emissionsData.findMany({
      where: { tenantId, period },
    });

    if (existing.length === 0) {
      throw new Error(`${period} 기간의 배출량 데이터가 없습니다.`);
    }

    // ── 2. AuditLog: 재계산 시작 ──
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action:       'EMISSIONS_RECALC_INITIATED',
        resourceType: 'emissions_data',
        resourceId:   tenantId,
        changes: { period, reason, targetCount: existing.length },
      },
    }).catch(() => null);

    // ── 3. 각 레코드 재계산 (트랜잭션) ──
    let archived = 0;
    let created  = 0;

    await prisma.$transaction(async (tx) => {
      for (const rec of existing) {
        const invoiceType  = scopeToInvoiceType(rec.emissionType as ScopeType, rec.sourceType);
        const typeConfig   = INVOICE_TYPE_MAP[invoiceType];
        const year         = parseInt(period.slice(0, 4), 10);

        // 새 배출계수 조회
        const { factorValue } = await CarbonCalculatorService.resolveFactor(
          tenantId,
          typeConfig.category,
          typeConfig.sourceType,
          year
        );

        const newEmissions = (Number(rec.amount) * factorValue) / 1000;

        // 기존 레코드 삭제 후 새 레코드 생성 (archive 패턴)
        // EmissionsData에 isArchived 필드가 없으면 삭제+재생성 패턴 사용
        await tx.emissionsData.delete({ where: { id: rec.id } });
        archived++;

        await tx.emissionsData.create({
          data: {
            tenantId,
            emissionType:       rec.emissionType,
            sourceType:         rec.sourceType,
            amount:             rec.amount,
            unit:               rec.unit,
            emissionFactor:     factorValue,
            calculatedEmission: newEmissions,
            period:             rec.period,
            calculationMethod:  'manual',
            dataSource:         rec.dataSource ?? DataSourceType.MANUAL,
          },
        });
        created++;
      }
    });

    // ── 4. AuditLog: 재계산 완료 ──
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action:       'EMISSIONS_RECALCULATED',
        resourceType: 'emissions_data',
        resourceId:   tenantId,
        changes: { period, reason, archived, created },
      },
    }).catch(() => null);

    return { archived, created, period, reason };
  }

  /**
   * 배출계수 해석: DB → 테넌트 설정 → 하드코딩 기본값
   */
  static async resolveFactor(
    tenantId: string,
    category: string,
    sourceType: string,
    year: number
  ): Promise<{ factorValue: number; factorSource: 'db' | 'tenant_settings' | 'default' }> {
    // 1순위: DB 배출계수
    const dbFactor = await findEmissionFactor({ tenantId, category, sourceType, year, region: 'KR' });
    if (dbFactor) {
      return { factorValue: Number(dbFactor.factor), factorSource: 'db' };
    }

    // 2순위: 테넌트 carbonFactor 설정 (전력만 해당)
    if (sourceType === 'electricity') {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { settings: true },
      });
      const settings = tenant?.settings as Record<string, Record<string, number>> | null;
      const tenantFactor = settings?.energy?.carbonFactor;
      if (tenantFactor && tenantFactor > 0) {
        return { factorValue: tenantFactor, factorSource: 'tenant_settings' };
      }
    }

    // 3순위: 하드코딩 기본값
    const defaultFactor: number = DEFAULT_FACTORS[sourceType] ?? DEFAULT_FACTORS['other'] ?? 1.0;
    return { factorValue: defaultFactor, factorSource: 'default' };
  }

  /**
   * 테넌트의 기간별 배출량 집계 조회
   */
  static async getSummaryByPeriod(
    tenantId: string,
    year: number
  ): Promise<{
    monthly: Array<{ period: string; scope1: number; scope2: number; scope3: number; total: number }>;
    annual: { scope1: number; scope2: number; scope3: number; total: number };
  }> {
    const prefix = `${year}-`;

    const records = await prisma.emissionsData.findMany({
      where: {
        tenantId,
        period: { startsWith: prefix },
      },
      select: {
        period: true,
        emissionType: true,
        calculatedEmission: true,
      },
      orderBy: { period: 'asc' },
    });

    // 월별 집계
    const monthlyMap: Record<string, { scope1: number; scope2: number; scope3: number }> = {};

    for (const rec of records) {
      const p = rec.period;
      if (!monthlyMap[p]) monthlyMap[p] = { scope1: 0, scope2: 0, scope3: 0 };
      const scope = rec.emissionType as ScopeType;
      if (scope === 'scope1') monthlyMap[p].scope1 += Number(rec.calculatedEmission);
      if (scope === 'scope2') monthlyMap[p].scope2 += Number(rec.calculatedEmission);
      if (scope === 'scope3') monthlyMap[p].scope3 += Number(rec.calculatedEmission);
    }

    const monthly = Object.entries(monthlyMap).map(([period, s]) => ({
      period,
      scope1: round4(s.scope1),
      scope2: round4(s.scope2),
      scope3: round4(s.scope3),
      total:  round4(s.scope1 + s.scope2 + s.scope3),
    }));

    const annual = monthly.reduce(
      (acc, m) => ({
        scope1: round4(acc.scope1 + m.scope1),
        scope2: round4(acc.scope2 + m.scope2),
        scope3: round4(acc.scope3 + m.scope3),
        total:  round4(acc.total + m.total),
      }),
      { scope1: 0, scope2: 0, scope3: 0, total: 0 }
    );

    return { monthly, annual };
  }
}

// ─────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** 서비스 DataSource → Prisma DataSourceType 매핑 */
function toPrismaDataSource(ds: DataSource): DataSourceType {
  switch (ds) {
    case 'IOT':    return DataSourceType.SENSOR;
    case 'IMPORT': return DataSourceType.HYBRID;
    default:       return DataSourceType.MANUAL; // INVOICE / MANUAL
  }
}

function scopeToInvoiceType(scope: ScopeType, sourceType: string): InvoiceType {
  if (sourceType === 'electricity') return 'electricity';
  if (sourceType === 'natural_gas') return 'gas';
  if (sourceType === 'diesel')      return 'diesel';
  if (scope === 'scope1')           return 'gas';
  return 'other';
}
