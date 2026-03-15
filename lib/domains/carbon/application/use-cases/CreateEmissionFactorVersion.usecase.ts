/**
 * CreateEmissionFactorVersion UseCase
 * 새 배출계수 버전 생성 (승인 대기 상태로 저장)
 *
 * 비즈니스 규칙:
 * 1. factor > 0 (양수만 허용)
 * 2. validFrom < validTo (또는 validTo=null)
 * 3. 동일 factorCode + tenantId 내 유효기간 중복 불허
 * 4. 부모 버전 존재 시 Semantic Versioning 자동 계산
 * 5. 생성 즉시 DRAFT 상태 → 별도 approve UseCase 필요
 * 6. 모든 생성 → Hash-chain AuditLog 자동 기록
 */

import type { IEmissionFactorRepository } from '../../domain/repositories/IEmissionFactorRepository';
import { EmissionFactorAuditService } from '../../services/emission-factor-audit.service';
import { ValidityPeriod, FactorVersion, RecordHash } from '../../domain/value-objects';
import {
  EmissionFactorOverlapError,
  EmissionFactorNotFoundError,
  CalculationValidationError,
} from '../../domain/errors';
import type { EmissionFactorRecord } from '../../domain/repositories/IEmissionFactorRepository';

// ─── Input / Output ──────────────────────────────────────────────────────────

export interface CreateEmissionFactorVersionInput {
  tenantId: string | null;

  // 분류
  factorCode?: string;         // 표준 식별자 (없으면 code 기반 생성)
  code: string;
  category: string;
  sourceType: string;
  countryCode?: string;        // 없으면 region 사용
  energyType?: string;         // 없으면 category 사용
  calculationType?: string;    // location|market|activity|spend

  // 계수 값
  factorValue: number;
  unit: string;
  inputUnit: string;

  // 출처
  sourceName?: string;         // 없으면 source 사용
  sourceVersion?: string;
  sourceUrl?: string;
  factorSourceType?: string;   // official|international|tenant_custom
  source: string;
  year: number;
  region?: string;

  // 버전 체인
  parentVersionId?: string;
  changeReason?: string;
  isValueChange?: boolean;     // true=minor 증가, false=patch 증가 (명시 지정)

  // 유효기간
  validFrom: Date;
  validTo: Date | null;

  // 요청자
  requestedBy: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateEmissionFactorVersionOutput {
  factor: EmissionFactorRecord;
  auditLogId: string;
  version: string;
  message: string;
}

// ─── UseCase ─────────────────────────────────────────────────────────────────

export class CreateEmissionFactorVersionUseCase {
  constructor(private readonly repo: IEmissionFactorRepository) {}

  async execute(input: CreateEmissionFactorVersionInput): Promise<CreateEmissionFactorVersionOutput> {
    // 1. 입력 검증
    this._validate(input);

    // 2. 유효기간 값 객체 생성 (불변식 검증 포함)
    const validity = ValidityPeriod.of(input.validFrom, input.validTo);

    // 3. factorCode 생성 (없으면 code 기반 표준화)
    const factorCode = input.factorCode ?? this._buildFactorCode(input);

    // 4. 유효기간 중복 확인
    const overlap = await this.repo.findOverlapping({
      factorCode,
      tenantId: input.tenantId,
      validFrom: validity.from,
      validTo: validity.to,
      excludeId: input.parentVersionId,
    });

    if (overlap) {
      throw new EmissionFactorOverlapError(
        factorCode,
        { from: overlap.validFrom, to: overlap.validTo },
        { from: validity.from, to: validity.to }
      );
    }

    // 5. Semantic Version 계산
    let version = FactorVersion.initial();
    if (input.parentVersionId) {
      const parent = await this.repo.findById(input.parentVersionId);
      if (!parent) {
        throw new EmissionFactorNotFoundError({ tenantId: input.tenantId ?? 'global', code: `parent:${input.parentVersionId}` });
      }
      const parentVer = FactorVersion.of(parent.version);
      const isValueChange = input.isValueChange ?? (parent.factorValue !== input.factorValue);
      version = isValueChange ? parentVer.bumpMinor() : parentVer.bumpPatch();
    }

    // 6. 레코드 Hash 계산 (무결성 기준)
    const createdAt = new Date();
    const recordHash = RecordHash.compute({
      factorValue: input.factorValue,
      unit: input.unit,
      inputUnit: input.inputUnit,
      validFrom: validity.from,
      validTo: validity.to,
      sourceName: input.sourceName ?? input.source,
      sourceVersion: input.sourceVersion,
      createdBy: input.requestedBy,
      createdAt,
    });

    // 7. DB 저장 (Append-only)
    const created = await this.repo.create({
      tenantId: input.tenantId,
      factorCode,
      code: input.code,
      category: input.category,
      sourceType: input.sourceType,
      countryCode: input.countryCode ?? input.region ?? 'KR',
      energyType: input.energyType ?? input.category,
      calculationType: input.calculationType ?? 'activity',
      factorValue: input.factorValue,
      unit: input.unit,
      inputUnit: input.inputUnit,
      source: input.source,
      sourceName: input.sourceName ?? input.source,
      sourceVersion: input.sourceVersion ?? null,
      sourceUrl: input.sourceUrl ?? null,
      factorSourceType: input.factorSourceType ?? (input.tenantId ? 'tenant_custom' : 'official'),
      year: input.year,
      region: input.region ?? input.countryCode ?? 'KR',
      version: version.toString(),
      parentId: input.parentVersionId ?? null,
      isActive: false,             // 승인 전 비활성
      isCustom: input.tenantId !== null,
      isDefault: input.tenantId === null,
      approvalStatus: 'DRAFT',     // 승인 대기
      validFrom: validity.from,
      validTo: validity.to,
      createdBy: input.requestedBy,
      changeReason: input.changeReason ?? null,
      recordHash: recordHash.toString(),
    });

    // 8. 감사 로그 (Hash-chain)
    const auditResult = await EmissionFactorAuditService.recordChange({
      emissionFactorId: created.id,
      changeType: 'CREATED',
      oldValue: null,
      newValue: input.factorValue,
      changeReason: input.changeReason,
      requestedBy: input.requestedBy,
    });

    return {
      factor: created,
      auditLogId: auditResult.id,
      version: version.toString(),
      message: `배출계수 v${version} 생성 완료 (승인 대기 중). factorCode=${factorCode}`,
    };
  }

  private _validate(input: CreateEmissionFactorVersionInput): void {
    const errors: string[] = [];
    if (input.factorValue <= 0) errors.push('factorValue는 양수여야 합니다');
    if (!input.code) errors.push('code는 필수입니다');
    if (!input.unit) errors.push('unit은 필수입니다');
    if (!input.source) errors.push('source는 필수입니다');
    if (!input.requestedBy) errors.push('requestedBy는 필수입니다');
    if (errors.length > 0) throw new CalculationValidationError(errors);
  }

  private _buildFactorCode(input: CreateEmissionFactorVersionInput): string {
    const country = (input.countryCode ?? input.region ?? 'kr').toLowerCase();
    const energy = (input.energyType ?? input.category ?? '').toLowerCase().replace(/_/g, '-');
    const calcType = (input.calculationType ?? 'activity').toLowerCase();
    return `${country}-${energy}-${calcType}`;
  }
}
