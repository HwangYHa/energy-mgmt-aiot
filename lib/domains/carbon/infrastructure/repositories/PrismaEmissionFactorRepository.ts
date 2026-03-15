/**
 * PrismaEmissionFactorRepository
 * IEmissionFactorRepository의 Prisma 구현체
 *
 * 원칙:
 * - UPDATE 금지: factorValue 등 핵심 필드는 절대 수정 불가
 * - 승인 상태만 예외적으로 UPDATE 허용 (approve/reject)
 * - 모든 조회는 tenantId 격리 보장
 */

import { prisma } from '@/lib/db/prisma';
import type {
  IEmissionFactorRepository,
  EmissionFactorRecord,
  FindEffectiveQuery,
  FindVersionChainQuery,
  ListFactorsQuery,
  ListFactorsResult,
  CreateFactorData,
} from '../../domain/repositories/IEmissionFactorRepository';
import { toDomainRecord } from '../mappers/EmissionFactorMapper';

// Prisma select 필드 (v2 신규 필드 포함)
const FACTOR_SELECT = {
  id: true,
  tenantId: true,
  factorCode: true,
  code: true,
  category: true,
  sourceType: true,
  countryCode: true,
  energyType: true,
  calculationType: true,
  factor: true,
  unit: true,
  inputUnit: true,
  source: true,
  sourceName: true,
  sourceVersion: true,
  sourceUrl: true,
  factorSourceType: true,
  year: true,
  region: true,
  version: true,
  parentId: true,
  isActive: true,
  isCustom: true,
  isDefault: true,
  approvalStatus: true,
  validFrom: true,
  validTo: true,
  approvedBy: true,
  approvedAt: true,
  rejectedBy: true,
  rejectedAt: true,
  rejectionReason: true,
  createdBy: true,
  createdAt: true,
  changeReason: true,
  recordHash: true,
} as const;

export class PrismaEmissionFactorRepository implements IEmissionFactorRepository {
  private get db(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return prisma as any;
  }

  async findEffective(query: FindEffectiveQuery): Promise<EmissionFactorRecord | null> {
    const asOf = query.asOf;

    const validityWhere = {
      validFrom: { lte: asOf },
      OR: [{ validTo: null }, { validTo: { gte: asOf } }],
    };

    const approvedWhere = {
      isActive: true,
      approvalStatus: 'APPROVED',
    };

    // 검색 조건 빌드 (factorCode 우선, 없으면 분류 조건)
    const classificationWhere = query.factorCode
      ? { factorCode: query.factorCode }
      : query.code
      ? { code: query.code }
      : {
          ...(query.countryCode && { countryCode: query.countryCode }),
          ...(query.energyType && { energyType: query.energyType }),
          ...(query.calculationType && { calculationType: query.calculationType }),
        };

    // 1순위: 테넌트 커스텀
    const tenantFactor = await this.db.emissionFactor.findFirst({
      where: {
        tenantId: query.tenantId,
        ...classificationWhere,
        ...approvedWhere,
        ...validityWhere,
      },
      orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
      select: FACTOR_SELECT,
    });

    if (tenantFactor) return toDomainRecord(tenantFactor);

    // 2순위: 글로벌 공식 계수
    const globalFactor = await this.db.emissionFactor.findFirst({
      where: {
        tenantId: null,
        ...classificationWhere,
        ...approvedWhere,
        ...validityWhere,
      },
      orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
      select: FACTOR_SELECT,
    });

    if (globalFactor) return toDomainRecord(globalFactor);

    // 3순위: 찾지 못함
    return null;
  }

  async findVersionChain(query: FindVersionChainQuery): Promise<EmissionFactorRecord[]> {
    const factors = await this.db.emissionFactor.findMany({
      where: {
        factorCode: query.factorCode,
        tenantId: query.tenantId,
      },
      orderBy: { createdAt: 'asc' },
      take: query.limit ?? 50,
      select: FACTOR_SELECT,
    });

    return factors.map(toDomainRecord);
  }

  async findById(id: string): Promise<EmissionFactorRecord | null> {
    const raw = await this.db.emissionFactor.findUnique({
      where: { id },
      select: FACTOR_SELECT,
    });
    return raw ? toDomainRecord(raw) : null;
  }

  async list(query: ListFactorsQuery): Promise<ListFactorsResult> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (query.tenantId !== undefined) where.tenantId = query.tenantId;
    if (query.countryCode) where.countryCode = query.countryCode;
    if (query.energyType) where.energyType = query.energyType;
    if (query.calculationType) where.calculationType = query.calculationType;
    if (query.category) where.category = query.category;
    if (query.approvalStatus) where.approvalStatus = query.approvalStatus;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const [raws, total] = await Promise.all([
      this.db.emissionFactor.findMany({
        where,
        orderBy: [{ factorCode: 'asc' }, { validFrom: 'desc' }],
        skip,
        take: pageSize,
        select: FACTOR_SELECT,
      }),
      this.db.emissionFactor.count({ where }),
    ]);

    return {
      items: raws.map(toDomainRecord),
      total,
      page,
      pageSize,
    };
  }

  async findOverlapping(params: {
    factorCode: string;
    tenantId: string | null;
    validFrom: Date;
    validTo: Date | null;
    excludeId?: string;
  }): Promise<EmissionFactorRecord | null> {
    const where: Record<string, unknown> = {
      factorCode: params.factorCode,
      tenantId: params.tenantId,
      isActive: true,
      // 겹침: existing.validFrom <= new.validTo AND existing.validTo >= new.validFrom
      validFrom: params.validTo ? { lte: params.validTo } : undefined,
      OR: [{ validTo: null }, { validTo: { gte: params.validFrom } }],
    };

    if (params.excludeId) {
      where.NOT = { id: params.excludeId };
    }

    const raw = await this.db.emissionFactor.findFirst({
      where,
      select: FACTOR_SELECT,
    });

    return raw ? toDomainRecord(raw) : null;
  }

  async create(data: CreateFactorData): Promise<EmissionFactorRecord> {
    const raw = await this.db.emissionFactor.create({
      data: {
        tenantId: data.tenantId,
        factorCode: data.factorCode,
        code: data.code,
        category: data.category,
        sourceType: data.sourceType,
        countryCode: data.countryCode,
        energyType: data.energyType,
        calculationType: data.calculationType,
        factor: data.factorValue,
        unit: data.unit,
        inputUnit: data.inputUnit,
        source: data.source,
        sourceName: data.sourceName,
        sourceVersion: data.sourceVersion,
        sourceUrl: data.sourceUrl,
        factorSourceType: data.factorSourceType,
        year: data.year,
        region: data.region,
        version: data.version,
        parentId: data.parentId,
        isActive: data.isActive,
        isCustom: data.isCustom,
        isDefault: data.isDefault,
        approvalStatus: data.approvalStatus,
        validFrom: data.validFrom,
        validTo: data.validTo,
        createdBy: data.createdBy,
        changeReason: data.changeReason,
        recordHash: data.recordHash,
      },
      select: FACTOR_SELECT,
    });

    return toDomainRecord(raw);
  }

  async updateApprovalStatus(params: {
    id: string;
    approvalStatus: string;
    isActive: boolean;
    approvedBy?: string;
    approvedAt?: Date;
    rejectedBy?: string;
    rejectedAt?: Date;
    rejectionReason?: string;
  }): Promise<void> {
    await this.db.emissionFactor.update({
      where: { id: params.id },
      data: {
        approvalStatus: params.approvalStatus,
        isActive: params.isActive,
        approvedBy: params.approvedBy ?? undefined,
        approvedAt: params.approvedAt ?? undefined,
        rejectedBy: params.rejectedBy ?? undefined,
        rejectedAt: params.rejectedAt ?? undefined,
        rejectionReason: params.rejectionReason ?? undefined,
      },
    });
  }
}
