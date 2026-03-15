/**
 * CarbonRetirementService
 *
 * 탄소 크레딧 소각(상계) 처리:
 * 1. availableQuantity 감소 + retiredQuantity 증가 (원자적 트랜잭션)
 * 2. 원장 RETIRE 이벤트 기록 (Append-only)
 * 3. 소각 인증서 (RetirementCertificate) 생성
 * 4. 소각은 절대 취소 불가 (규제 요구사항)
 *
 * K-ETS 규정: 소각된 크레딧 정보는 환경부 K-ETS 시스템에 보고
 */

import { createHash } from 'crypto';
import { prisma } from '@/lib/db/prisma';
import type { RetireInput, RetirementResult } from '../types';
import { CarbonPluginRegistry } from '../plugin-registry';
import type { RetireCarbonCreditEvent } from '../events';

const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

/** RET-YYYYMMDD-NNNNN 형식 채번 */
async function generateRetirementId(tenantId: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `RET-${today}`;
  const count = await db.carbonRetirementCertificate.count({
    where: { tenantId, retirementId: { startsWith: prefix } },
  });
  const seq = String(count + 1).padStart(5, '0');
  return `${prefix}-${seq}`;
}

function buildRetireHash(data: {
  tenantId: string;
  registryId: string;
  quantity: number;
  retirementId: string;
  prevHash?: string;
}): string {
  const payload = [
    data.tenantId,
    data.registryId,
    data.quantity.toFixed(6),
    data.retirementId,
    data.prevHash ?? 'genesis',
  ].join('|');
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

async function getLastEntryHash(tenantId: string): Promise<string | undefined> {
  const last = await db.carbonLedgerEntry.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    select: { hashSignature: true },
  });
  return last?.hashSignature;
}

export class CarbonRetirementService {

  /**
   * 소각 실행 — 취소 불가 (규제)
   */
  static async retire(input: RetireInput): Promise<RetirementResult> {
    // 멱등성 검사: 동일 키로 이미 처리된 요청이면 기존 결과 반환
    const existing = await db.carbonLedgerEntry.findFirst({
      where: { tenantId: input.tenantId, idempotencyKey: input.idempotencyKey, eventType: 'RETIRE' },
      select: { id: true, metadata: true },
    });
    if (existing) {
      // 기존 cert 반환
      const retirementId = (existing.metadata as any)?.retirementId as string | undefined;
      const cert = retirementId
        ? await db.carbonRetirementCertificate.findFirst({
            where: { retirementId, tenantId: input.tenantId },
            include: { registry: true },
          })
        : null;
      if (cert) {
        return {
          ledgerEntryId: existing.id,
          certificate: {
            id: cert.id, retirementId: cert.retirementId, tenantId: cert.tenantId,
            registry: cert.registry.registry, projectId: cert.registry.projectId,
            creditType: cert.registry.creditType, vintageYear: cert.registry.vintageYear,
            serialNumbers: JSON.parse(cert.serialNumbers ?? '[]'),
            retiredQuantity: Number(cert.retiredQuantity),
            retirementReason: cert.retirementReason, beneficiaryCompany: cert.beneficiaryCompany,
            retirementDate: cert.retirementDate.toISOString(),
            registryReference: cert.registryReference ?? undefined,
            certificatePdfUrl: cert.certificatePdfUrl ?? undefined,
            offsetScope: cert.offsetScope ?? undefined,
            compliancePeriod: cert.compliancePeriod ?? undefined,
            createdAt: cert.createdAt.toISOString(),
          },
        };
      }
    }

    return db.$transaction(async (tx: any) => {
      // 1. 레지스트리 조회 및 수량 검증
      const registry = await tx.carbonCreditRegistry.findFirst({
        where: { id: input.registryId, tenantId: input.tenantId, status: 'active' },
      });

      if (!registry) throw new Error('크레딧을 찾을 수 없거나 비활성 상태입니다');

      const available = Number(registry.availableQuantity);
      if (available < input.quantity) {
        throw new Error(`가용 수량(${available.toFixed(1)} tCO₂) 부족. 요청: ${input.quantity}`);
      }

      // 2. 낙관적 잠금으로 수량 업데이트
      const updated = await tx.carbonCreditRegistry.updateMany({
        where: { id: registry.id, version: registry.version },
        data: {
          availableQuantity: { decrement: input.quantity },
          retiredQuantity:   { increment: input.quantity },
          version: { increment: 1 },
          // 전량 소각 시 status → retired
          ...(available - input.quantity <= 0 ? { status: 'retired' } : {}),
        },
      });

      if (updated.count === 0) {
        throw new Error('동시 소각 충돌이 발생했습니다. 다시 시도해주세요');
      }

      // 3. 소각 인증서 ID 채번
      const retirementId = await generateRetirementId(input.tenantId);
      const retirementDate = new Date();
      const prevHash = await getLastEntryHash(input.tenantId);

      const hashSignature = buildRetireHash({
        tenantId: input.tenantId,
        registryId: registry.id,
        quantity: input.quantity,
        retirementId,
        prevHash,
      });

      // 4. 원장 RETIRE 이벤트 기록 (Append-only)
      const ledgerEntry = await tx.carbonLedgerEntry.create({
        data: {
          tenantId: input.tenantId,
          registryId: registry.id,
          eventType: 'RETIRE',
          quantity: input.quantity,
          unitPrice: 0,
          totalAmount: 0,
          currency: 'KRW',
          paymentStatus: 'N/A',
          settlementStatus: 'N/A',
          idempotencyKey: input.idempotencyKey,
          hashSignature,
          prevHash: prevHash ?? null,
          memo: input.memo,
          metadata: {
            retirementId,
            offsetScope: input.offsetScope,
            compliancePeriod: input.compliancePeriod,
          },
        },
      });

      // 5. 소각 인증서 생성
      // 일련번호: serialNumberStart ~ serialNumberEnd 범위에서 비례 배분
      const serialNumbers = JSON.stringify([
        `${registry.serialNumberStart}-${retirementId}`,
      ]);

      const cert = await tx.carbonRetirementCertificate.create({
        data: {
          tenantId: input.tenantId,
          ledgerEntryId: ledgerEntry.id,
          registryId: registry.id,
          retirementId,
          serialNumbers,
          retiredQuantity: input.quantity,
          retirementReason: input.retirementReason,
          beneficiaryCompany: input.beneficiaryCompany,
          retirementDate,
          registryReference: input.registryReference,
          offsetScope: input.offsetScope,
          compliancePeriod: input.compliancePeriod,
        },
      });

      const result: RetirementResult = {
        ledgerEntryId: ledgerEntry.id,
        certificate: {
          id: cert.id,
          retirementId: cert.retirementId,
          tenantId: cert.tenantId,
          registry: registry.registry,
          projectId: registry.projectId,
          creditType: registry.creditType,
          vintageYear: registry.vintageYear,
          serialNumbers: JSON.parse(serialNumbers),
          retiredQuantity: Number(cert.retiredQuantity),
          retirementReason: cert.retirementReason,
          beneficiaryCompany: cert.beneficiaryCompany,
          retirementDate: cert.retirementDate.toISOString(),
          registryReference: cert.registryReference ?? undefined,
          certificatePdfUrl: cert.certificatePdfUrl ?? undefined,
          offsetScope: cert.offsetScope ?? undefined,
          compliancePeriod: cert.compliancePeriod ?? undefined,
          createdAt: cert.createdAt.toISOString(),
        },
      };
      return result;
    }).then((result: RetirementResult) => {
      // 트랜잭션 완료 후 Fire-and-forget 이벤트 발행
      const event: RetireCarbonCreditEvent = {
        type: 'RETIRE_CARBON_CREDIT',
        tenantId: input.tenantId,
        registryId: input.registryId,
        ledgerEntryId: result.ledgerEntryId,
        quantity: input.quantity,
        retirementId: result.certificate.retirementId,
        retirementReason: input.retirementReason,
        beneficiaryCompany: input.beneficiaryCompany,
        offsetScope: input.offsetScope,
        compliancePeriod: input.compliancePeriod,
        registryReference: input.registryReference,
        registry: result.certificate.registry,
        projectId: result.certificate.projectId,
        creditType: result.certificate.creditType,
        vintageYear: result.certificate.vintageYear,
        performedBy: input.performedBy,
        hashSignature: result.certificate.retirementId, // 소각 cert ID를 해시로 사용
        occurredAt: new Date().toISOString(),
      };
      CarbonPluginRegistry.emit(event).catch((err) =>
        console.error('[CarbonPlugin] RETIRE emit 실패', err)
      );
      return result;
    });
  }

  /**
   * 소각 인증서 목록
   */
  static async listCertificates(
    tenantId: string,
    options: { compliancePeriod?: string; page?: number; limit?: number } = {}
  ) {
    const page  = Math.max(1, options.page  ?? 1);
    const limit = Math.min(100, options.limit ?? 20);
    const skip  = (page - 1) * limit;

    const where: Record<string, unknown> = { tenantId };
    if (options.compliancePeriod) where.compliancePeriod = options.compliancePeriod;

    const [items, total] = await Promise.all([
      db.carbonRetirementCertificate.findMany({
        where,
        orderBy: { retirementDate: 'desc' },
        skip,
        take: limit,
        include: {
          registry: {
            select: { registry: true, projectId: true, creditType: true, vintageYear: true },
          },
        },
      }),
      db.carbonRetirementCertificate.count({ where }),
    ]);

    return {
      items: items.map((c: any) => ({
        id: c.id,
        retirementId: c.retirementId,
        retiredQuantity: Number(c.retiredQuantity),
        retirementReason: c.retirementReason,
        beneficiaryCompany: c.beneficiaryCompany,
        retirementDate: c.retirementDate,
        offsetScope: c.offsetScope,
        compliancePeriod: c.compliancePeriod,
        certificatePdfUrl: c.certificatePdfUrl,
        ketsSubmissionId: c.ketsSubmissionId,
        createdAt: c.createdAt,
        registry: c.registry,
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * 인증서 단건 조회
   */
  static async getCertificate(certId: string, tenantId: string) {
    const cert = await db.carbonRetirementCertificate.findFirst({
      where: { id: certId, tenantId },
      include: {
        registry: true,
        ledgerEntry: { select: { hashSignature: true, createdAt: true } },
      },
    });
    if (!cert) return null;
    return {
      ...cert,
      retiredQuantity: Number(cert.retiredQuantity),
      serialNumbers: JSON.parse(cert.serialNumbers ?? '[]'),
    };
  }
}
