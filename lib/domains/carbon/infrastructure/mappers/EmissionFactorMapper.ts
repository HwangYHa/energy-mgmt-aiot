/**
 * EmissionFactorMapper
 * Prisma DB 레코드 ↔ Domain Entity 변환
 *
 * 목적:
 * - DB 컬럼명 변경이 도메인 코드에 영향 없도록 격리
 * - 타입 변환 (Decimal → number, Date 정규화)
 * - null 처리 일관성
 */

import type { EmissionFactorRecord } from '../../domain/repositories/IEmissionFactorRepository';

/**
 * Prisma raw 레코드 → Domain EmissionFactorRecord
 * (prisma as any) 패턴으로 반환된 객체를 도메인 타입으로 변환
 */
export function toDomainRecord(raw: any): EmissionFactorRecord {
  // factorCode: v2 신규 필드 없으면 code 사용 (하위호환)
  const factorCode = raw.factorCode ?? raw.factor_code ?? raw.code;
  const countryCode = raw.countryCode ?? raw.country_code ?? raw.region ?? 'KR';
  const energyType = raw.energyType ?? raw.energy_type ?? raw.category ?? '';
  const calculationType = raw.calculationType ?? raw.calculation_type ?? 'location';
  const sourceName = raw.sourceName ?? raw.source_name ?? raw.source ?? '';
  const factorSourceType = raw.factorSourceType ?? raw.factor_source_type ??
    (raw.tenantId ? 'tenant_custom' : 'official');

  return {
    id: raw.id,
    tenantId: raw.tenantId ?? raw.tenant_id ?? null,
    factorCode,
    code: raw.code,
    category: raw.category,
    countryCode,
    energyType,
    calculationType,
    factorValue: Number(raw.factor ?? raw.factorValue ?? raw.factor_value),
    unit: raw.unit,
    inputUnit: raw.inputUnit ?? raw.input_unit ?? 'kWh',
    sourceName,
    sourceVersion: raw.sourceVersion ?? raw.source_version ?? null,
    sourceUrl: raw.sourceUrl ?? raw.source_url ?? null,
    factorSourceType,
    version: raw.version ?? '1.0.0',
    parentId: raw.parentId ?? raw.parent_id ?? null,
    isActive: raw.isActive ?? raw.is_active ?? false,
    isCustom: raw.isCustom ?? raw.is_custom ?? false,
    isDefault: raw.isDefault ?? raw.is_default ?? false,
    approvalStatus: raw.approvalStatus ?? raw.approval_status ?? 'APPROVED',
    validFrom: new Date(raw.validFrom ?? raw.valid_from),
    validTo: raw.validTo ?? raw.valid_to ? new Date(raw.validTo ?? raw.valid_to) : null,
    approvedBy: raw.approvedBy ?? raw.approved_by ?? null,
    approvedAt: raw.approvedAt ?? raw.approved_at ? new Date(raw.approvedAt ?? raw.approved_at) : null,
    rejectedBy: raw.rejectedBy ?? raw.rejected_by ?? null,
    rejectedAt: raw.rejectedAt ?? raw.rejected_at ? new Date(raw.rejectedAt ?? raw.rejected_at) : null,
    rejectionReason: raw.rejectionReason ?? raw.rejection_reason ?? null,
    createdBy: raw.createdBy ?? raw.created_by ?? 'system',
    createdAt: new Date(raw.createdAt ?? raw.created_at),
    changeReason: raw.changeReason ?? raw.change_reason ?? null,
    recordHash: raw.recordHash ?? raw.record_hash ?? null,
  };
}

/**
 * Domain EmissionFactorRecord → API 응답 DTO
 * (감사 민감 필드 제외, 클라이언트 안전)
 */
export function toResponseDTO(record: EmissionFactorRecord) {
  return {
    id: record.id,
    factorCode: record.factorCode,
    code: record.code,
    category: record.category,
    countryCode: record.countryCode,
    energyType: record.energyType,
    calculationType: record.calculationType,
    factorValue: record.factorValue,
    unit: record.unit,
    inputUnit: record.inputUnit,
    sourceName: record.sourceName,
    sourceVersion: record.sourceVersion,
    sourceUrl: record.sourceUrl,
    factorSourceType: record.factorSourceType,
    version: record.version,
    parentId: record.parentId,
    isActive: record.isActive,
    isCustom: record.isCustom,
    approvalStatus: record.approvalStatus,
    validFrom: record.validFrom.toISOString().split('T')[0],
    validTo: record.validTo?.toISOString().split('T')[0] ?? null,
    approvedBy: record.approvedBy,
    approvedAt: record.approvedAt?.toISOString() ?? null,
    createdBy: record.createdBy,
    createdAt: record.createdAt.toISOString(),
  };
}
