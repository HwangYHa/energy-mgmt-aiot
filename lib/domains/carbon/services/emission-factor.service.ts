/**
 * EmissionFactorService
 * 배출계수 관리 도메인 서비스 (Big4 감사 대응)
 *
 * 핵심 기능:
 * 1. 3단계 배출계수 조회 (테넌트 커스텀 → 글로벌 기본값 → Error)
 * 2. Semantic Versioning 기반 버전 생성 (승인 대기 → 승인 → 활성화)
 * 3. 배출계수 승인/폐지 워크플로우
 * 4. 모든 변경 → EmissionFactorAuditService.recordChange() 트리거
 *
 * 원칙:
 * - Append-only: 기존 레코드 값 직접 수정 금지 (parentVersionId로 버전 체인)
 * - Deterministic: 동일 입력 → 항상 동일 배출계수
 * - Tamper-evident: 모든 변경 = Audit Log + Hash Chain
 */

import { prisma } from '@/lib/db/prisma';
import { EmissionFactorAuditService } from './emission-factor-audit.service';
import {
  type FindEffectiveEmissionFactorInput,
  type EmissionFactorDTO,
  type CreateEmissionFactorInput,
  type ApproveEmissionFactorInput,
  mapEmissionFactorToDTO,
  calculateNextVersion,
} from '../dtos/emission-factor.dto';

// ─── 조회 결과 타입 ─────────────────────────────────────────────────────────

export interface ListEmissionFactorsQuery {
  tenantId?: string | null;
  category?: string;
  sourceType?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ListEmissionFactorsResult {
  items: EmissionFactorDTO[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Prisma 선택 필드 ────────────────────────────────────────────────────────

const FACTOR_SELECT = {
  id: true,
  code: true,
  version: true,
  factor: true,
  unit: true,
  inputUnit: true,
  validFrom: true,
  validTo: true,
  source: true,
  year: true,
  region: true,
  isActive: true,
  isCustom: true,
  isDefault: true,
  parentId: true,
  approvedBy: true,
  approvedAt: true,
  createdBy: true,
  createdAt: true,
  category: true,
  sourceType: true,
  tenantId: true,
} as const;

// ─── 서비스 ──────────────────────────────────────────────────────────────────

export class EmissionFactorService {
  /**
   * 유효한 배출계수 조회 (3단계 Fallback)
   *
   * 1단계: 테넌트 커스텀 배출계수 (tenantId 매칭 + 승인됨 + 유효기간 내)
   * 2단계: 글로벌 기본값 (tenantId=null + 승인됨 + 유효기간 내)
   * 3단계: throw Error (Big4 감사 기준: 불명확한 계수 사용 금지)
   *
   * @throws Error 유효한 배출계수를 찾을 수 없는 경우
   */
  static async findEffective(
    input: FindEffectiveEmissionFactorInput
  ): Promise<EmissionFactorDTO> {
    const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    const validAsOf = input.validAsOf ?? new Date();

    const validityWhere = {
      validFrom: { lte: validAsOf },
      OR: [
        { validTo: null },
        { validTo: { gte: validAsOf } },
      ],
    };

    // ── 1단계: 테넌트 커스텀 ──
    const tenantFactor = await db.emissionFactor.findFirst({
      where: {
        tenantId: input.tenantId,
        code: input.code,
        isActive: true,
        approvedAt: { not: null },
        ...validityWhere,
      },
      orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
      select: {
        ...FACTOR_SELECT,
        children: input.requireVersion
          ? { select: FACTOR_SELECT, orderBy: { createdAt: 'asc' as const } }
          : false,
      },
    });

    if (tenantFactor) {
      return mapEmissionFactorToDTO(tenantFactor, input.requireVersion);
    }

    // ── 2단계: 글로벌 기본값 ──
    const globalFactor = await db.emissionFactor.findFirst({
      where: {
        tenantId: null,
        code: input.code,
        isActive: true,
        approvedAt: { not: null },
        ...validityWhere,
      },
      orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
      select: {
        ...FACTOR_SELECT,
        children: input.requireVersion
          ? { select: FACTOR_SELECT, orderBy: { createdAt: 'asc' as const } }
          : false,
      },
    });

    if (globalFactor) {
      return mapEmissionFactorToDTO(globalFactor, input.requireVersion);
    }

    // ── 3단계: 배출계수 없음 → 에러 ──
    throw new Error(
      `유효한 배출계수를 찾을 수 없습니다. code=${input.code}, tenantId=${input.tenantId}, validAsOf=${validAsOf.toISOString()}`
    );
  }

  /**
   * 신규 배출계수 버전 생성 (승인 대기 상태로 저장)
   *
   * Semantic Versioning:
   * - parentVersionId 없음 → '1.0.0'
   * - 값(factor) 변경 → minor 증가 (1.0.0 → 1.1.0)
   * - 메타 변경 → patch 증가 (1.0.0 → 1.0.1)
   *
   * @throws Error 입력 검증 실패 또는 유효기간 충돌
   */
  static async createVersion(
    input: CreateEmissionFactorInput,
    requestedBy: string
  ): Promise<EmissionFactorDTO> {
    const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    // ── 입력 검증 ──
    if (input.factor <= 0) {
      throw new Error(`배출계수는 양수여야 합니다. 입력값: ${input.factor}`);
    }

    if (input.validTo && input.validFrom >= input.validTo) {
      throw new Error(
        `validFrom(${input.validFrom.toISOString()})은 validTo(${input.validTo.toISOString()})보다 이전이어야 합니다.`
      );
    }

    // ── 유효기간 중복 확인 ──
    await EmissionFactorService._checkValidityOverlap(
      db,
      input.code,
      input.tenantId ?? null,
      input.validFrom,
      input.validTo ?? null,
      input.parentVersionId // 부모 버전이면 중복 허용 (교체 시나리오)
    );

    // ── Semantic Version 계산 ──
    let version = '1.0.0';
    let isValueChange = true;

    if (input.parentVersionId) {
      const parent = await db.emissionFactor.findUnique({
        where: { id: input.parentVersionId },
        select: { version: true, factor: true },
      });

      if (!parent) {
        throw new Error(`부모 버전을 찾을 수 없습니다. parentVersionId=${input.parentVersionId}`);
      }

      isValueChange = Number(parent.factor) !== input.factor;
      version = calculateNextVersion(parent.version, isValueChange);
    }

    // ── 트랜잭션: 배출계수 생성 + 감사 로그 ──
    const newFactor = await prisma.$transaction(async (tx) => {
      const txDb = tx as any; // eslint-disable-line @typescript-eslint/no-explicit-any

      const created = await txDb.emissionFactor.create({
        data: {
          code: input.code,
          category: input.category,
          sourceType: input.sourceType,
          factor: input.factor,
          unit: input.unit,
          inputUnit: input.inputUnit,
          validFrom: input.validFrom,
          validTo: input.validTo ?? null,
          source: input.source,
          year: input.year,
          region: input.region,
          version,
          isActive: false,    // 승인 전까지 비활성
          isCustom: input.tenantId != null,
          isDefault: input.tenantId == null,
          parentId: input.parentVersionId ?? null,
          tenantId: input.tenantId ?? null,
          createdBy: requestedBy,
          changeReason: input.changeReason ?? null,
          approvedBy: null,
          approvedAt: null,
        },
        select: FACTOR_SELECT,
      });

      return created;
    });

    // ── 감사 로그 기록 (트랜잭션 외부, Append-only) ──
    await EmissionFactorAuditService.recordChange({
      emissionFactorId: newFactor.id,
      changeType: 'CREATED',
      oldValue: null,
      newValue: Number(newFactor.factor),
      changeReason: input.changeReason,
      requestedBy,
    });

    return mapEmissionFactorToDTO(newFactor, false);
  }

  /**
   * 배출계수 승인 (isActive=true로 활성화)
   *
   * 승인 후:
   * - isActive = true
   * - approvedBy, approvedAt 설정
   * - 감사 로그: APPROVED
   *
   * @throws Error 이미 승인된 경우 또는 레코드 없는 경우
   */
  static async approve(input: ApproveEmissionFactorInput): Promise<void> {
    const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    const factor = await db.emissionFactor.findUnique({
      where: { id: input.factorId },
      select: { id: true, isActive: true, approvedAt: true, factor: true },
    });

    if (!factor) {
      throw new Error(`배출계수를 찾을 수 없습니다. factorId=${input.factorId}`);
    }

    if (factor.approvedAt !== null) {
      throw new Error(`이미 승인된 배출계수입니다. factorId=${input.factorId}`);
    }

    const approvedAt = new Date();

    await prisma.$transaction(async (tx) => {
      const txDb = tx as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      await txDb.emissionFactor.update({
        where: { id: input.factorId },
        data: {
          isActive: true,
          approvedBy: input.approvedBy,
          approvedAt,
        },
      });
    });

    await EmissionFactorAuditService.recordChange({
      emissionFactorId: input.factorId,
      changeType: 'APPROVED',
      newValue: Number(factor.factor),
      changeReason: input.approvalReason,
      requestedBy: input.approvedBy,
      approvedBy: input.approvedBy,
      requestedAt: approvedAt,
    });
  }

  /**
   * 배출계수 폐지 (isActive=false로 비활성화)
   *
   * @throws Error 레코드 없는 경우
   */
  static async deprecate(factorId: string, reason: string, requestedBy: string): Promise<void> {
    const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    const factor = await db.emissionFactor.findUnique({
      where: { id: factorId },
      select: { id: true, factor: true },
    });

    if (!factor) {
      throw new Error(`배출계수를 찾을 수 없습니다. factorId=${factorId}`);
    }

    await prisma.$transaction(async (tx) => {
      const txDb = tx as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      await txDb.emissionFactor.update({
        where: { id: factorId },
        data: { isActive: false },
      });
    });

    await EmissionFactorAuditService.recordChange({
      emissionFactorId: factorId,
      changeType: 'DEPRECATED',
      oldValue: Number(factor.factor),
      changeReason: reason,
      requestedBy,
    });
  }

  /**
   * 배출계수 목록 조회 (필터 + 페이지네이션)
   */
  static async list(query: ListEmissionFactorsQuery = {}): Promise<ListEmissionFactorsResult> {
    const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (query.tenantId !== undefined) where.tenantId = query.tenantId;
    if (query.category) where.category = query.category;
    if (query.sourceType) where.sourceType = query.sourceType;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const [factors, total] = await Promise.all([
      db.emissionFactor.findMany({
        where,
        orderBy: [{ code: 'asc' }, { validFrom: 'desc' }],
        skip,
        take: pageSize,
        select: FACTOR_SELECT,
      }),
      db.emissionFactor.count({ where }),
    ]);

    return {
      items: factors.map((f: any) => mapEmissionFactorToDTO(f, false)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * ID로 단건 조회
   */
  static async findById(
    factorId: string,
    includeVersionChain = false
  ): Promise<EmissionFactorDTO | null> {
    const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    const factor = await db.emissionFactor.findUnique({
      where: { id: factorId },
      select: {
        ...FACTOR_SELECT,
        children: includeVersionChain
          ? { select: FACTOR_SELECT, orderBy: { createdAt: 'asc' as const } }
          : false,
      },
    });

    return factor ? mapEmissionFactorToDTO(factor, includeVersionChain) : null;
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /**
   * 유효기간 중복 확인
   * 동일 code + tenantId에 대해 겹치는 활성 배출계수가 있는지 체크
   */
  private static async _checkValidityOverlap(
    db: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    code: string,
    tenantId: string | null,
    validFrom: Date,
    validTo: Date | null,
    excludeParentId?: string
  ): Promise<void> {
    // 겹침 조건: 기존 [a, b] 와 신규 [c, d]가 겹치려면:
    //   a <= d AND b >= c (null=무한대)
    const overlapWhere: Record<string, unknown> = {
      code,
      tenantId,
      isActive: true,
      // validFrom <= validTo (신규)
      validFrom: validTo ? { lte: validTo } : undefined,
      // validTo >= validFrom (신규) || validTo = null (무한대)
      OR: [
        { validTo: null },
        { validTo: { gte: validFrom } },
      ],
    };

    if (excludeParentId) {
      overlapWhere.NOT = { id: excludeParentId };
    }

    const overlapping = await db.emissionFactor.findFirst({
      where: overlapWhere,
      select: { id: true, version: true, validFrom: true, validTo: true },
    });

    if (overlapping) {
      throw new Error(
        `유효기간이 겹치는 배출계수가 이미 존재합니다. ` +
        `code=${code}, 기존 버전=${overlapping.version}, ` +
        `기간=[${overlapping.validFrom?.toISOString() ?? '?'}, ${overlapping.validTo?.toISOString() ?? '∞'}]`
      );
    }
  }
}
