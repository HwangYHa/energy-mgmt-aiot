/**
 * GET /api/carbon/xbrl-export
 *
 * 탄소 거래 데이터 → XBRL 요소 내보내기
 *
 * 지원 택소노미:
 * - GHG_PROTOCOL : GHG Protocol Corporate Standard (기본값)
 * - CDP          : CDP Climate Questionnaire (C4~C6)
 * - ESRS_E1      : EU CSRD ESRS E1 (E1-6, E1-7)
 * - SEC_CLIMATE  : US SEC Climate Disclosure Rules 2024
 * - IFRS_S2      : ISSB IFRS S2 Climate-related Disclosures
 *
 * 쿼리 파라미터:
 * - taxonomy   : 택소노미 (기본: GHG_PROTOCOL)
 * - taxonomies : 콤마 구분 복수 (예: ESRS_E1,SEC_CLIMATE)
 * - period     : 보고 기간 "YYYY" (기본: 당해 연도)
 * - format     : json (기본) | summary
 *
 * 멀티테넌트: tenantId 기반 원장/인증서 격리
 */

import { type NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';
import {
  CarbonXBRLMapper,
  type XBRLTaxonomy,
  type XBRLEntityInfo,
} from '@/lib/domains/carbon-trading/extensions/xbrl/carbon-xbrl-mapper';
import type { LedgerEntry, RetirementCertificate } from '@/lib/domains/carbon-trading';

const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

const ALL_TAXONOMIES: XBRLTaxonomy[] = [
  'GHG_PROTOCOL', 'CDP', 'ESRS_E1', 'SEC_CLIMATE', 'IFRS_S2',
];

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  const { searchParams } = req.nextUrl;

  // 택소노미 파싱
  const taxonomyParam  = searchParams.get('taxonomy');
  const taxonomiesParam = searchParams.get('taxonomies');
  let taxonomies: XBRLTaxonomy[] = [];

  if (taxonomiesParam) {
    taxonomies = taxonomiesParam.split(',').map((t) => t.trim().toUpperCase()) as XBRLTaxonomy[];
  } else if (taxonomyParam) {
    taxonomies = [taxonomyParam.toUpperCase() as XBRLTaxonomy];
  } else {
    taxonomies = ['GHG_PROTOCOL'];
  }

  const invalid = taxonomies.filter((t) => !ALL_TAXONOMIES.includes(t));
  if (invalid.length) {
    return errorResponse('VALIDATION_ERROR', {
      status: 400,
      details: {
        message: `유효하지 않은 택소노미: ${invalid.join(', ')}`,
        validValues: ALL_TAXONOMIES,
      },
    });
  }

  // 보고 기간
  const period   = searchParams.get('period') ?? new Date().getFullYear().toString();
  const format   = searchParams.get('format') ?? 'json';
  const yearNum  = Number(period);
  if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
    return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: `유효하지 않은 보고 기간: ${period}` } });
  }

  const periodStart = new Date(`${yearNum}-01-01T00:00:00.000Z`);
  const periodEnd   = new Date(`${yearNum}-12-31T23:59:59.999Z`);

  try {
    // 1. 원장 엔트리 조회 (기간 필터)
    const rawEntries = await db.carbonLedgerEntry.findMany({
      where: {
        tenantId: auth.tenantId,
        createdAt: { gte: periodStart, lte: periodEnd },
        eventType: { in: ['BUY', 'RETIRE'] },
      },
      include: {
        registry: { select: { registry: true, projectId: true, creditType: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 2. 소각 인증서 조회
    const rawCerts = await db.carbonRetirementCertificate.findMany({
      where: {
        tenantId: auth.tenantId,
        retirementDate: { gte: periodStart, lte: periodEnd },
      },
      include: {
        registry: { select: { registry: true, projectId: true, creditType: true, vintageYear: true } },
      },
    });

    // 3. 타입 매핑
    const entries: LedgerEntry[] = rawEntries.map((e: any) => ({
      id: e.id,
      tenantId: e.tenantId,
      registryId: e.registryId,
      eventType: e.eventType,
      quantity: Number(e.quantity),
      unitPrice: Number(e.unitPrice),
      totalAmount: Number(e.totalAmount),
      currency: e.currency,
      counterparty: e.counterparty ?? undefined,
      paymentStatus: e.paymentStatus,
      settlementStatus: e.settlementStatus,
      idempotencyKey: e.idempotencyKey ?? undefined,
      hashSignature: e.hashSignature,
      prevHash: e.prevHash ?? undefined,
      memo: e.memo ?? undefined,
      createdAt: e.createdAt.toISOString(),
    }));

    const certs: RetirementCertificate[] = rawCerts.map((c: any) => ({
      id: c.id,
      retirementId: c.retirementId,
      tenantId: c.tenantId,
      registry: c.registry?.registry ?? 'OTHER',
      projectId: c.registry?.projectId ?? '',
      creditType: c.registry?.creditType ?? 'OFFSET',
      vintageYear: c.registry?.vintageYear ?? yearNum,
      serialNumbers: JSON.parse(c.serialNumbers ?? '[]'),
      retiredQuantity: Number(c.retiredQuantity),
      retirementReason: c.retirementReason,
      beneficiaryCompany: c.beneficiaryCompany,
      retirementDate: c.retirementDate.toISOString(),
      registryReference: c.registryReference ?? undefined,
      offsetScope: c.offsetScope ?? undefined,
      compliancePeriod: c.compliancePeriod ?? undefined,
      createdAt: c.createdAt.toISOString(),
    }));

    // 4. 테넌트 정보 조회 (entity info)
    const tenant = await db.tenant.findUnique({
      where: { id: auth.tenantId },
      select: { name: true, businessNumber: true },
    });

    const entityInfo: XBRLEntityInfo = {
      entityName: tenant?.name ?? auth.tenantId,
      entityIdentifier: tenant?.businessNumber ?? auth.tenantId,
      reportingPeriodStart: `${yearNum}-01-01`,
      reportingPeriodEnd: `${yearNum}-12-31`,
      currency: 'KRW',
    };

    // 5. XBRL 매핑
    if (taxonomies.length === 1) {
      // 단일 택소노미
      const taxonomy = taxonomies[0]!;
      const ledgerElements = CarbonXBRLMapper.mapLedgerToXBRL(entries, taxonomy, entityInfo);
      const certElements   = CarbonXBRLMapper.mapRetirementToXBRL(certs, taxonomy, entityInfo);
      const doc = CarbonXBRLMapper.buildDocument(
        [...ledgerElements, ...certElements],
        taxonomy,
        entityInfo
      );

      if (format === 'summary') {
        return successResponse({
          taxonomy,
          period,
          entityName: entityInfo.entityName,
          totalElements: doc.elements.length,
          elements: doc.elements.map((el) => ({
            qualifiedName: el.qualifiedName,
            value: el.value,
            unitRef: el.unitRef,
            label: el.label,
            disclosureRef: el.disclosureRef,
          })),
          generatedAt: doc.generatedAt,
        });
      }

      return successResponse(doc);
    }

    // 멀티 택소노미
    const multiDocs = CarbonXBRLMapper.mapToMultipleTaxonomies(
      entries,
      certs,
      taxonomies,
      entityInfo
    );

    const result: Record<string, unknown> = {};
    multiDocs.forEach((doc, taxonomy) => {
      result[taxonomy] = format === 'summary'
        ? {
            taxonomy,
            totalElements: doc.elements.length,
            elements: doc.elements.map((el) => ({
              qualifiedName: el.qualifiedName,
              value: el.value,
              unitRef: el.unitRef,
              label: el.label,
            })),
          }
        : doc;
    });

    return successResponse({
      period,
      entityName: entityInfo.entityName,
      taxonomies: result,
      generatedAt: new Date().toISOString(),
      note: 'iXBRL 패키징은 향후 /api/carbon/xbrl-export?format=ixbrl 에서 지원 예정',
    });
  } catch (e) {
    console.error('[carbon/xbrl-export GET]', e);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}