/**
 * CarbonESGBridgeService
 *
 * 탄소 거래 이벤트 → ESG 보고서 자동 연동 플러그인
 *
 * 책임:
 * 1. RETIRE_CARBON_CREDIT 이벤트 수신
 * 2. 테넌트의 활성 ESG 보고서 draft 확인
 * 3. 탄소 상쇄 클레임을 ReportAuditLog에 기록 (데이터 계보 추적)
 * 4. ESG 보고서 메타데이터에 상쇄 합계 업데이트 (선택적)
 *
 * 통합 포인트:
 * - CarbonPluginRegistry.register(new CarbonESGBridgeService())
 * - RETIRE 이벤트 → draft ESG 보고서에 offsetClaim 자동 기록
 *
 * 향후 확장:
 * - CSRD E1-7: GHG removals & carbon credits 자동 채움
 * - SEC S3: Scope 3 offset 자동 계산
 * - TCFD 4a: GHG emissions + offset 자동 반영
 */

import { prisma } from '@/lib/db/prisma';
import type { ICarbonPlugin } from '../../plugin-registry';
import type { CarbonDomainEvent, RetireCarbonCreditEvent } from '../../events';

const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

// ─── 상쇄 클레임 레코드 ───────────────────────────────────────────────

export interface CarbonOffsetClaim {
  /** ESG 보고서 ID */
  reportId: string;
  tenantId: string;
  /** 소각 원장 ID (추적용) */
  ledgerEntryId: string;
  /** 소각 인증서 ID (RET-YYYYMMDD-NNNNN) */
  retirementId: string;
  /** 소각량 (tCO2e) */
  quantity: number;
  /** 적용 스코프 */
  offsetScope?: 'scope1' | 'scope2' | 'scope3';
  /** 준수 기간 */
  compliancePeriod?: string;
  /** 소각 레지스트리 */
  registry: string;
  /** 프로젝트 ID */
  projectId: string;
  /** 처리 시각 */
  processedAt: string;
}

// ─── 브릿지 서비스 ────────────────────────────────────────────────────

export class CarbonESGBridgeService implements ICarbonPlugin {
  readonly name = 'carbon-esg-bridge';

  /**
   * 도메인 이벤트 핸들러
   * - RETIRE 이벤트만 처리
   * - 나머지 이벤트는 즉시 반환 (overhead 없음)
   */
  async onEvent(event: CarbonDomainEvent): Promise<void> {
    if (event.type !== 'RETIRE_CARBON_CREDIT') return;
    await this._processRetirement(event as RetireCarbonCreditEvent);
  }

  /**
   * 소각 이벤트 처리
   * 1. 테넌트의 draft/in_review ESG 보고서 조회
   * 2. ReportAuditLog에 상쇄 클레임 기록 (데이터 계보)
   * 3. 보고서 메타데이터에 offsetClaims 배열 업데이트
   */
  private async _processRetirement(event: RetireCarbonCreditEvent): Promise<void> {
    // 현재 연도 draft 또는 in_review 보고서 조회
    const currentYear = new Date().getFullYear().toString();
    const activePeriod = event.compliancePeriod ?? currentYear;

    const activeReports = await db.eSGReport.findMany({
      where: {
        tenantId: event.tenantId,
        status: { in: ['draft', 'in_review'] },
        period: activePeriod,
      },
      select: { id: true, metadata: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    if (activeReports.length === 0) {
      // draft 보고서 없음 — 클레임만 로깅
      console.info(
        `[ESGBridge] RETIRE 이벤트 수신 (연결할 draft 보고서 없음) — ` +
        `tenantId=${event.tenantId}, retirementId=${event.retirementId}`
      );
      return;
    }

    const claim: CarbonOffsetClaim = {
      reportId: activeReports[0].id,
      tenantId: event.tenantId,
      ledgerEntryId: event.ledgerEntryId,
      retirementId: event.retirementId,
      quantity: event.quantity,
      offsetScope: event.offsetScope,
      compliancePeriod: event.compliancePeriod,
      registry: event.registry,
      projectId: event.projectId,
      processedAt: new Date().toISOString(),
    };

    // 가장 최근 draft 보고서에 감사 로그 추가
    await Promise.allSettled(
      activeReports.map((report: { id: string; metadata: any }) =>
        this._recordAuditLog(report.id, event, claim)
      )
    );

    // 최우선 보고서 메타데이터 업데이트
    await this._updateReportOffsets(activeReports[0], claim);
  }

  /**
   * ReportAuditLog Append-only 기록
   * - 소각 이벤트 ↔ ESG 보고서 연결 추적
   * - Big4 감사 시 데이터 계보 증빙
   */
  private async _recordAuditLog(
    reportId: string,
    event: RetireCarbonCreditEvent,
    claim: CarbonOffsetClaim
  ): Promise<void> {
    await db.reportAuditLog.create({
      data: {
        reportId,
        tenantId: event.tenantId,
        action: 'carbon_offset_applied',
        fromStatus: null,
        toStatus: null,
        performedBy: event.performedBy,
        note: `탄소 상쇄 자동 반영 — ${event.retirementId} (${event.quantity.toFixed(2)} tCO₂e, ${event.registry})`,
        metadata: {
          ledgerEntryId: event.ledgerEntryId,
          retirementId: event.retirementId,
          quantity: event.quantity,
          offsetScope: event.offsetScope,
          compliancePeriod: event.compliancePeriod,
          registry: event.registry,
          projectId: event.projectId,
          hashSignature: event.hashSignature,
          processedAt: claim.processedAt,
        },
      },
    });
  }

  /**
   * ESG 보고서 metadata.offsetClaims 배열에 클레임 추가
   * - 보고서 생성 시 누적된 상쇄 클레임을 자동 반영
   */
  private async _updateReportOffsets(
    report: { id: string; metadata: any },
    claim: CarbonOffsetClaim
  ): Promise<void> {
    const existingMeta = (report.metadata as Record<string, unknown>) ?? {};
    const existingClaims = Array.isArray(existingMeta.offsetClaims)
      ? existingMeta.offsetClaims
      : [];

    // 중복 방지 (같은 retirementId가 이미 기록된 경우)
    const alreadyRecorded = existingClaims.some(
      (c: unknown) =>
        typeof c === 'object' &&
        c !== null &&
        (c as Record<string, unknown>).retirementId === claim.retirementId
    );
    if (alreadyRecorded) return;

    const updatedClaims = [...existingClaims, claim];
    const totalOffset = updatedClaims.reduce(
      (sum: number, c: unknown) =>
        sum +
        (typeof c === 'object' && c !== null
          ? Number((c as Record<string, unknown>).quantity ?? 0)
          : 0),
      0
    );

    await db.eSGReport.update({
      where: { id: report.id },
      data: {
        metadata: {
          ...existingMeta,
          offsetClaims: updatedClaims,
          totalCarbonOffset: totalOffset,
          lastOffsetUpdatedAt: new Date().toISOString(),
        },
      },
    });
  }

  // ─── 조회 유틸 ───────────────────────────────────────────────────────

  /**
   * ESG 보고서에 연결된 탄소 상쇄 클레임 목록 조회
   */
  static async getOffsetClaims(
    reportId: string,
    tenantId: string
  ): Promise<CarbonOffsetClaim[]> {
    const report = await db.eSGReport.findFirst({
      where: { id: reportId, tenantId },
      select: { metadata: true },
    });

    if (!report?.metadata) return [];

    const meta = report.metadata as Record<string, unknown>;
    return Array.isArray(meta.offsetClaims) ? (meta.offsetClaims as CarbonOffsetClaim[]) : [];
  }

  /**
   * 테넌트의 기간별 총 탄소 상쇄량 집계
   * (ESG 보고서 자동 채움용)
   */
  static async getTotalOffsetForPeriod(
    tenantId: string,
    period: string
  ): Promise<{ total: number; byScope: Record<string, number>; claimCount: number }> {
    const auditLogs = await db.reportAuditLog.findMany({
      where: {
        tenantId,
        action: 'carbon_offset_applied',
        metadata: {
          path: '$.compliancePeriod',
          equals: period,
        },
      },
      select: { metadata: true },
    });

    let total = 0;
    const byScope: Record<string, number> = {};

    for (const log of auditLogs) {
      const meta = log.metadata as Record<string, unknown>;
      const qty = Number(meta?.quantity ?? 0);
      const scope = String(meta?.offsetScope ?? 'unspecified');

      total += qty;
      byScope[scope] = (byScope[scope] ?? 0) + qty;
    }

    return { total, byScope, claimCount: auditLogs.length };
  }
}
