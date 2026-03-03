/**
 * ESG Report Service
 * 보고서 CRUD + 승인 워크플로우 + 무결성 검증
 */

import { prisma } from '@/lib/db/prisma';
import { ReportEngine } from '../engine/report-engine';
import { getTemplate } from '../templates';
import type {
  GenerateESGReportInput,
  GenerateESGReportOutput,
  IntegrityVerificationResult,
  ESGStandard,
} from '../types/esg-report.types';
import type {
  ESGReportListItemDTO,
  ESGReportDetailDTO,
  ESGReportListQueryDTO,
  ESGTemplateDTO,
} from '../dtos/esg-report.dto';
import type { TemplateContext } from '../templates/base.template';
import { EmissionFactorSnapshot, EngineVersionSnapshot, BoundarySnapshot, CalculationMethodSnapshot, ActivityDataSnapshot } from '../types/esg-report.types';

// ─── ESG Report Service ───────────────────────────────────────────

export class ESGReportService {
  /**
   * 보고서 생성 (Deterministic Engine 사용)
   */
  static async generate(input: GenerateESGReportInput): Promise<GenerateESGReportOutput> {
    return ReportEngine.generate(input);
  }

  /**
   * 보고서 목록 조회
   */
  static async list(
    tenantId: string,
    query: ESGReportListQueryDTO
  ): Promise<{ items: ESGReportListItemDTO[]; total: number }> {
    const { reportYear, standard, status, reportType, page = 1, pageSize = 20 } = query;

    const where = {
      tenantId,
      ...(reportYear && { reportYear }),
      ...(standard && { standard }),
      ...(status && { status }),
      ...(reportType && { reportType }),
    };

    const [total, items] = await Promise.all([
      (prisma as any).eSGReport.count({ where }),
      (prisma as any).eSGReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          reportNo: true,
          reportType: true,
          standard: true,
          period: true,
          reportYear: true,
          status: true,
          totalEmissions: true,
          scope1: true,
          scope2Location: true,
          scope2Market: true,
          scope3: true,
          completenessScore: true,
          isImmutable: true,
          pdfUrl: true,
          excelUrl: true,
          generatedBy: true,
          approvedBy: true,
          approvedAt: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      items: items.map(toListItemDTO),
      total,
    };
  }

  /**
   * 보고서 상세 조회 (스냅샷 포함)
   */
  static async getDetail(reportId: string, tenantId: string): Promise<ESGReportDetailDTO> {
    const report = await (prisma as any).eSGReport.findFirst({
      where: { id: reportId, tenantId },
      include: {
        previousReport: {
          select: {
            id: true,
            reportNo: true,
            reportType: true,
            standard: true,
            period: true,
            reportYear: true,
            status: true,
            totalEmissions: true,
            scope1: true,
            scope2Location: true,
            scope2Market: true,
            scope3: true,
            completenessScore: true,
            isImmutable: true,
            pdfUrl: true,
            excelUrl: true,
            generatedBy: true,
            approvedBy: true,
            approvedAt: true,
            createdAt: true,
          },
        },
      },
    });

    if (!report) {
      throw new Error('보고서를 찾을 수 없습니다.');
    }

    return {
      metadata: {
        id: report.id,
        reportNo: report.reportNo,
        reportType: report.reportType as 'compliance' | 'sustainability' | 'annual' | 'interim',
        standard: report.standard as ESGStandard,
        countryCode: report.countryCode,
        period: report.period,
        periodType: report.periodType as 'annual' | 'quarterly' | 'monthly',
        reportYear: report.reportYear,
        status: report.status as 'draft' | 'in_review' | 'approved' | 'published' | 'withdrawn',
        isImmutable: report.isImmutable,
        completenessScore: report.completenessScore ? Number(report.completenessScore) : undefined,
        applicableStandards: report.applicableStandards,
        revisionNumber: report.revisionNumber,
        generatedBy: report.generatedBy,
        approvedBy: report.approvedBy ?? undefined,
        createdAt: report.createdAt,
        approvedAt: report.approvedAt ?? undefined,
      },
      summary: {
        totalEmissions: Number(report.totalEmissions),
        scope1: Number(report.scope1),
        scope2Location: Number(report.scope2Location),
        scope2Market: report.scope2Market != null ? Number(report.scope2Market) : undefined,
        scope3: Number(report.scope3),
        emissionsUnit: 'tCO2eq',
      },
      snapshots: {
        emissionFactors: (report.emissionFactorsSnapshot as EmissionFactorSnapshot[]) ?? [],
        engineVersion: (report.engineVersionSnapshot as EngineVersionSnapshot) ?? {},
        calculationMethod: (report.calculationMethodSnapshot as CalculationMethodSnapshot) ?? {},
        boundary: (report.boundarySnapshot as BoundarySnapshot) ?? {},
        activityData: (report.activityDataSnapshot as ActivityDataSnapshot) ?? undefined,
      },
      files: {
        pdfUrl: report.pdfUrl ?? undefined,
        excelUrl: report.excelUrl ?? undefined,
        xbrlUrl: report.xbrlExportUrl ?? undefined,
      },
      revisionHistory: report.previousReport ? [toListItemDTO(report.previousReport as any)] : [],
    };
  }

  /**
   * 보고서 승인 (isImmutable = true)
   */
  static async approve(reportId: string, tenantId: string, approvedBy: string): Promise<void> {
    const report = await (prisma as any).eSGReport.findFirst({
      where: { id: reportId, tenantId },
    });
    if (!report) throw new Error('보고서를 찾을 수 없습니다.');

    await ReportEngine.approve(reportId, approvedBy);
  }

  /**
   * 보고서 검토 상태 전환 (draft → in_review)
   */
  static async submitForReview(
    reportId: string,
    tenantId: string,
    reviewedBy: string
  ): Promise<void> {
    const report = await (prisma as any).eSGReport.findFirst({
      where: { id: reportId, tenantId },
    });
    if (!report) throw new Error('보고서를 찾을 수 없습니다.');
    if (report.isImmutable) throw new Error('불변 보고서는 상태를 변경할 수 없습니다.');
    if (report.status !== 'draft') {
      throw new Error(`초안(draft) 상태에서만 검토 제출이 가능합니다. 현재: ${report.status}`);
    }

    await (prisma as any).eSGReport.update({
      where: { id: reportId },
      data: {
        status: 'in_review',
        reviewedBy,
        reviewedAt: new Date(),
      },
    });
  }

  /**
   * 보고서 발행 (approved → published)
   */
  static async publish(reportId: string, tenantId: string): Promise<void> {
    const report = await (prisma as any).eSGReport.findFirst({
      where: { id: reportId, tenantId },
    });
    if (!report) throw new Error('보고서를 찾을 수 없습니다.');
    if (report.status !== 'approved') {
      throw new Error('승인된 보고서만 발행할 수 있습니다.');
    }

    await (prisma as any).eSGReport.update({
      where: { id: reportId },
      data: { status: 'published' },
    });
  }

  /**
   * 보고서 철회
   */
  static async withdraw(reportId: string, tenantId: string): Promise<void> {
    const report = await (prisma as any).eSGReport.findFirst({
      where: { id: reportId, tenantId },
    });
    if (!report) throw new Error('보고서를 찾을 수 없습니다.');
    if (report.status === 'approved' && report.isImmutable) {
      throw new Error('승인된 불변 보고서는 철회할 수 없습니다. 관리자 승인이 필요합니다.');
    }

    await (prisma as any).eSGReport.update({
      where: { id: reportId },
      data: { status: 'withdrawn' },
    });
  }

  /**
   * 보고서 재발행 (승인된 보고서의 수정 버전 생성)
   * 원본은 유지, 새로운 draft 생성
   */
  static async reissue(
    reportId: string,
    tenantId: string,
    input: GenerateESGReportInput,
    reason: string
  ): Promise<GenerateESGReportOutput> {
    const original = await (prisma as any).eSGReport.findFirst({
      where: { id: reportId, tenantId },
    });
    if (!original) throw new Error('원본 보고서를 찾을 수 없습니다.');
    if (!original.isImmutable && original.status !== 'approved') {
      throw new Error('승인된 보고서만 재발행할 수 있습니다.');
    }

    // 새 보고서 생성 (원본 참조 포함)
    const result = await ReportEngine.generate({
      ...input,
      methodologyNotes: `${reason}\n\n원본 보고서: ${original.reportNo}`,
    });

    // previousReportId 설정
    await (prisma as any).eSGReport.update({
      where: { id: result.reportId },
      data: {
        previousReportId: reportId,
        revisionNumber: original.revisionNumber + 1,
      },
    });

    return result;
  }

  /**
   * 무결성 검증 (Hash 비교)
   */
  static async verifyIntegrity(
    reportId: string,
    tenantId: string
  ): Promise<IntegrityVerificationResult> {
    const report = await (prisma as any).eSGReport.findFirst({
      where: { id: reportId, tenantId },
    });
    if (!report) throw new Error('보고서를 찾을 수 없습니다.');

    return ReportEngine.verifyIntegrity(reportId);
  }

  /**
   * PDF URL 업데이트 (Renderer 완료 후 호출)
   */
  static async updatePdfUrl(reportId: string, pdfUrl: string): Promise<void> {
    await (prisma as any).eSGReport.update({
      where: { id: reportId },
      data: { pdfUrl },
    });
  }

  /**
   * Excel URL 업데이트 (Renderer 완료 후 호출)
   */
  static async updateExcelUrl(reportId: string, excelUrl: string): Promise<void> {
    await (prisma as any).eSGReport.update({
      where: { id: reportId },
      data: { excelUrl },
    });
  }

  /**
   * 표준별 템플릿 DTO 반환 (데이터 없는 빈 구조)
   */
  static getTemplateStructure(standard: ESGStandard): ESGTemplateDTO {
    const template = getTemplate(standard);

    // 빈 컨텍스트로 섹션 구조만 반환
    const emptyCtx: TemplateContext = {
      tenantId: '',
      tenantName: '',
      period: String(new Date().getFullYear()),
      reportYear: new Date().getFullYear(),
      summary: {
        totalEmissions: 0,
        scope1: 0,
        scope2Location: 0,
        scope3: 0,
        emissionsUnit: 'tCO2eq',
      },
      emissionFactors: [],
      boundary: {
        organizationalBoundary: {
          approach: 'operational-control',
          consolidationMethod: '',
          includedEntities: [],
          excludedEntities: [],
        },
        operationalBoundary: {
          scope1Included: true,
          scope2Method: 'location-based',
          scope3Categories: [],
          exclusions: [],
        },
        reportingYear: new Date().getFullYear(),
        baseYear: 2020,
      },
      calculationMethod: {
        scope2Method: 'location-based',
        scope3Method: 'activity-based',
        electricityConversionFactor: 0.001,
        emissionsRoundingPrecision: 6,
        dataGapFillingMethod: 'estimation',
        uncertaintyLevel: 'low',
        verificationStatus: 'self-declared',
      },
      countryCode: 'KR',
    };

    return template.toDTO(emptyCtx);
  }
}

// ─── 헬퍼 ─────────────────────────────────────────────────────────

function toListItemDTO(report: {
  id: string; reportNo: string; reportType: string; standard: string;
  period: string; reportYear: number; status: string;
  totalEmissions: { toNumber?: () => number } | number;
  scope1: { toNumber?: () => number } | number;
  scope2Location: { toNumber?: () => number } | number;
  scope2Market?: { toNumber?: () => number } | number | null;
  scope3: { toNumber?: () => number } | number;
  completenessScore?: { toNumber?: () => number } | number | null;
  isImmutable: boolean; pdfUrl?: string | null; excelUrl?: string | null;
  generatedBy: string; approvedBy?: string | null; approvedAt?: Date | null;
  createdAt: Date;
}): ESGReportListItemDTO {
  const toNum = (v: { toNumber?: () => number } | number | null | undefined) =>
    v == null ? 0 : typeof v === 'number' ? v : v.toNumber ? v.toNumber() : Number(v);

  return {
    id: report.id,
    reportNo: report.reportNo,
    reportType: report.reportType as ESGReportListItemDTO['reportType'],
    standard: report.standard as ESGStandard,
    period: report.period,
    reportYear: report.reportYear,
    status: report.status as ESGReportListItemDTO['status'],
    totalEmissions: toNum(report.totalEmissions),
    scope1: toNum(report.scope1),
    scope2Location: toNum(report.scope2Location),
    scope2Market: report.scope2Market != null ? toNum(report.scope2Market) : undefined,
    scope3: toNum(report.scope3),
    completenessScore: report.completenessScore != null ? toNum(report.completenessScore) : undefined,
    isImmutable: report.isImmutable,
    pdfUrl: report.pdfUrl ?? undefined,
    excelUrl: report.excelUrl ?? undefined,
    generatedBy: report.generatedBy,
    approvedBy: report.approvedBy ?? undefined,
    approvedAt: report.approvedAt?.toISOString(),
    createdAt: report.createdAt.toISOString(),
  };
}
