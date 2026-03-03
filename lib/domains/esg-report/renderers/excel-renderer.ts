/**
 * ESG Report Excel Renderer
 * ExcelJS 기반 구조화된 ESG 데이터 워크북 생성
 * Big4 감사 대응: 원본 데이터 + 스냅샷 시트 포함
 */

import type { ESGReportDetailDTO } from '../dtos/esg-report.dto';
import { getTemplate } from '../templates';
import type { ESGStandard } from '../types/esg-report.types';

// ─── Excel Renderer ───────────────────────────────────────────────

export class ESGExcelRenderer {
  private report: ESGReportDetailDTO;

  constructor(report: ESGReportDetailDTO) {
    this.report = report;
  }

  async render(): Promise<Buffer> {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();

    workbook.creator = '탄소이음 EMS';
    workbook.lastModifiedBy = this.report.metadata.generatedBy;
    workbook.created = this.report.metadata.createdAt;
    workbook.modified = new Date();

    // ─── 시트 1: 표지 & 요약 ───────────────────────────────────
    this.addSummarySheet(workbook);

    // ─── 시트 2: 섹션별 상세 ─────────────────────────────────
    this.addDetailSheet(workbook);

    // ─── 시트 3: 배출계수 스냅샷 ─────────────────────────────
    this.addEmissionFactorsSheet(workbook);

    // ─── 시트 4: 활동 데이터 스냅샷 ─────────────────────────
    this.addActivityDataSheet(workbook);

    // ─── 시트 5: 계산 방식 & 경계 설정 ───────────────────────
    this.addMethodologySheet(workbook);

    // ─── 시트 6: 감사 무결성 ─────────────────────────────────
    this.addAuditIntegritySheet(workbook);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ─── 시트 구현 ────────────────────────────────────────────────

  private addSummarySheet(workbook: import('exceljs').Workbook): void {
    const ws = workbook.addWorksheet('요약', {
      properties: { tabColor: { argb: 'FF10b981' } },
    });

    const { metadata, summary } = this.report;

    // 보고서 헤더
    ws.mergeCells('A1:F1');
    ws.getCell('A1').value = 'ESG 탄소 배출량 보고서';
    ws.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF1f2937' } };
    ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf0fdf4' } };

    // 보고서 정보
    const infoRows: [string, string][] = [
      ['보고서 번호', metadata.reportNo],
      ['보고 표준', metadata.standard],
      ['보고 기간', metadata.period],
      ['보고 연도', String(metadata.reportYear)],
      ['보고서 유형', metadata.reportType],
      ['상태', metadata.status],
      ['데이터 완전성', `${metadata.completenessScore ?? '-'}%`],
      ['불변 보호', metadata.isImmutable ? '✓ 승인 완료 (불변)' : '미승인'],
      ['생성일', new Date(metadata.createdAt).toLocaleDateString('ko-KR')],
    ];

    infoRows.forEach(([label, value], i) => {
      const row = ws.getRow(i + 3);
      row.getCell(1).value = label;
      row.getCell(1).font = { bold: true, color: { argb: 'FF4b5563' } };
      row.getCell(2).value = value;
      if (label === '불변 보호' && value.startsWith('✓')) {
        row.getCell(2).font = { color: { argb: 'FF10b981' }, bold: true };
      }
    });

    // 배출량 요약 테이블
    const summaryStartRow = 15;
    ws.getCell(`A${summaryStartRow}`).value = '배출량 요약';
    ws.getCell(`A${summaryStartRow}`).font = { size: 13, bold: true };

    const summaryHeaders = ['구분', '설명', '배출량 (tCO₂eq)', '비율 (%)'];
    const headerRow = ws.getRow(summaryStartRow + 2);
    summaryHeaders.forEach((h, i) => {
      headerRow.getCell(i + 1).value = h;
      headerRow.getCell(i + 1).font = { bold: true, color: { argb: 'FFffffff' } };
      headerRow.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1f2937' } };
    });

    const summaryData = [
      ['Scope 1', '직접 배출 (연료 연소)', summary.scope1],
      ['Scope 2 (Location)', '전력 간접 배출 (지역기반)', summary.scope2Location],
      ...(summary.scope2Market != null
        ? [['Scope 2 (Market)', '전력 간접 배출 (시장기반)', summary.scope2Market]]
        : []),
      ['Scope 3', '기타 간접 배출', summary.scope3],
      ['합계', 'Scope 1 + 2 + 3', summary.totalEmissions],
    ];

    summaryData.forEach(([scope, desc, value], i) => {
      const row = ws.getRow(summaryStartRow + 3 + i);
      const pct = summary.totalEmissions > 0
        ? ((Number(value) / summary.totalEmissions) * 100).toFixed(1)
        : '0.0';

      row.getCell(1).value = String(scope);
      row.getCell(2).value = String(desc);
      row.getCell(3).value = Number(value);
      row.getCell(3).numFmt = '#,##0.000';
      row.getCell(4).value = scope === '합계' ? 100 : Number(pct);
      row.getCell(4).numFmt = '0.0"%"';

      if (String(scope) === '합계') {
        [1, 2, 3, 4].forEach((col) => {
          row.getCell(col).font = { bold: true, color: { argb: 'FF10b981' } };
          row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf0fdf4' } };
        });
      } else if (i % 2 === 0) {
        [1, 2, 3, 4].forEach((col) => {
          row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf9fafb' } };
        });
      }
    });

    // 컬럼 너비
    ws.getColumn(1).width = 22;
    ws.getColumn(2).width = 30;
    ws.getColumn(3).width = 22;
    ws.getColumn(4).width = 15;
  }

  private addDetailSheet(workbook: import('exceljs').Workbook): void {
    const ws = workbook.addWorksheet('섹션 상세', {
      properties: { tabColor: { argb: 'FF3b82f6' } },
    });

    const template = getTemplate(this.report.metadata.standard as ESGStandard);
    const ctx = {
      tenantId: '',
      tenantName: '',
      period: this.report.metadata.period,
      reportYear: this.report.metadata.reportYear,
      summary: this.report.summary,
      emissionFactors: this.report.snapshots.emissionFactors,
      boundary: this.report.snapshots.boundary,
      calculationMethod: this.report.snapshots.calculationMethod,
      activityData: this.report.snapshots.activityData,
      countryCode: this.report.metadata.countryCode,
    };
    const sections = template.buildSections(ctx);

    let rowIdx = 1;

    // 헤더
    const headerRow = ws.getRow(rowIdx++);
    ['섹션', '필드 ID', '항목', '값', '단위', '필수여부', 'XBRL 요소', '비고'].forEach((h, i) => {
      headerRow.getCell(i + 1).value = h;
      headerRow.getCell(i + 1).font = { bold: true, color: { argb: 'FFffffff' } };
      headerRow.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
    });

    for (const section of sections) {
      // 섹션 구분선
      const sectionRow = ws.getRow(rowIdx++);
      ws.mergeCells(`A${rowIdx - 1}:H${rowIdx - 1}`);
      sectionRow.getCell(1).value = section.title;
      sectionRow.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF10b981' } };
      sectionRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf0fdf4' } };

      for (const field of section.fields) {
        const row = ws.getRow(rowIdx++);
        row.getCell(1).value = section.sectionId;
        row.getCell(2).value = field.fieldId;
        row.getCell(3).value = field.label;
        row.getCell(4).value = field.value ?? '';
        if (typeof field.value === 'number') {
          row.getCell(4).numFmt = '#,##0.000000';
        }
        row.getCell(5).value = field.unit ?? '';
        row.getCell(6).value = field.required ? '필수' : '선택';
        row.getCell(7).value = field.xbrlElement ?? '';
        row.getCell(8).value = field.notes ?? '';

        if (field.required) {
          row.getCell(6).font = { color: { argb: 'FFef4444' }, bold: true };
        }
      }
    }

    ws.getColumn(1).width = 20;
    ws.getColumn(2).width = 22;
    ws.getColumn(3).width = 35;
    ws.getColumn(4).width = 20;
    ws.getColumn(5).width = 12;
    ws.getColumn(6).width = 10;
    ws.getColumn(7).width = 35;
    ws.getColumn(8).width = 40;
  }

  private addEmissionFactorsSheet(workbook: import('exceljs').Workbook): void {
    const ws = workbook.addWorksheet('배출계수 스냅샷', {
      properties: { tabColor: { argb: 'FFf59e0b' } },
    });

    const headers = ['코드', '카테고리', '배출원', '계수', '단위', '입력단위', '버전', '출처', '연도', '유효시작', '유효종료', '커스텀'];
    const headerRow = ws.getRow(1);
    headers.forEach((h, i) => {
      headerRow.getCell(i + 1).value = h;
      headerRow.getCell(i + 1).font = { bold: true, color: { argb: 'FFffffff' } };
      headerRow.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFd97706' } };
    });

    this.report.snapshots.emissionFactors.forEach((f, i) => {
      const row = ws.getRow(i + 2);
      row.getCell(1).value = f.code;
      row.getCell(2).value = f.category;
      row.getCell(3).value = f.sourceType;
      row.getCell(4).value = f.factor;
      row.getCell(4).numFmt = '0.00000000';
      row.getCell(5).value = f.unit;
      row.getCell(6).value = '';
      row.getCell(7).value = `v${f.version}`;
      row.getCell(8).value = f.source;
      row.getCell(9).value = f.year;
      row.getCell(10).value = f.validFrom;
      row.getCell(11).value = f.validTo ?? '—';
      row.getCell(12).value = f.isCustom ? '커스텀' : '표준';

      if (i % 2 === 0) {
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].forEach((col) => {
          row.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFfef3c7' } };
        });
      }
    });

    [20, 15, 20, 15, 15, 12, 10, 30, 8, 12, 12, 10].forEach((w, i) => {
      ws.getColumn(i + 1).width = w;
    });
  }

  private addActivityDataSheet(workbook: import('exceljs').Workbook): void {
    const ws = workbook.addWorksheet('활동 데이터', {
      properties: { tabColor: { argb: 'FF8b5cf6' } },
    });

    const activityData = this.report.snapshots.activityData;
    if (!activityData) {
      ws.getCell('A1').value = '활동 데이터 없음';
      return;
    }

    // Scope 1 데이터
    ws.getCell('A1').value = 'Scope 1 활동 데이터';
    ws.getCell('A1').font = { bold: true, size: 12 };

    const s1Headers = ['배출원', '활동량', '단위', '배출계수', '배출량 (tCO₂eq)'];
    s1Headers.forEach((h, i) => {
      ws.getCell(2, i + 1).value = h;
      ws.getCell(2, i + 1).font = { bold: true };
      ws.getCell(2, i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFfee2e2' } };
    });

    activityData.scope1.sourceBreakdown.forEach((s, i) => {
      const row = i + 3;
      ws.getCell(row, 1).value = s.sourceType;
      ws.getCell(row, 2).value = s.activityData;
      ws.getCell(row, 3).value = s.unit;
      ws.getCell(row, 4).value = s.emissionsFactor;
      ws.getCell(row, 5).value = s.emissions;
      ws.getCell(row, 5).numFmt = '#,##0.000';
    });

    // Scope 3 카테고리
    const s3Start = activityData.scope1.sourceBreakdown.length + 5;
    ws.getCell(`A${s3Start}`).value = 'Scope 3 카테고리';
    ws.getCell(`A${s3Start}`).font = { bold: true, size: 12 };

    const s3Headers = ['카테고리 번호', '카테고리명', '배출량 (tCO₂eq)'];
    s3Headers.forEach((h, i) => {
      ws.getCell(s3Start + 1, i + 1).value = h;
      ws.getCell(s3Start + 1, i + 1).font = { bold: true };
      ws.getCell(s3Start + 1, i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFfef3c7' } };
    });

    activityData.scope3.categories.forEach((c, i) => {
      const row = s3Start + 2 + i;
      ws.getCell(row, 1).value = c.categoryNo;
      ws.getCell(row, 2).value = c.categoryName;
      ws.getCell(row, 3).value = c.emissions;
      ws.getCell(row, 3).numFmt = '#,##0.000';
    });

    [1, 2, 3, 4, 5].forEach((col) => { ws.getColumn(col).width = 25; });
  }

  private addMethodologySheet(workbook: import('exceljs').Workbook): void {
    const ws = workbook.addWorksheet('방법론 & 경계설정', {
      properties: { tabColor: { argb: 'FF6366f1' } },
    });

    const { calculationMethod, boundary } = this.report.snapshots;

    ws.getCell('A1').value = '계산 방식 스냅샷';
    ws.getCell('A1').font = { bold: true, size: 12 };

    const methodRows: [string, string][] = [
      ['Scope 2 계산 방식', calculationMethod.scope2Method],
      ['Scope 3 계산 방식', calculationMethod.scope3Method],
      ['데이터 갭 처리', calculationMethod.dataGapFillingMethod],
      ['불확실성 수준', calculationMethod.uncertaintyLevel],
      ['검증 상태', calculationMethod.verificationStatus],
      ['소수점 자리', String(calculationMethod.emissionsRoundingPrecision)],
    ];

    methodRows.forEach(([label, value], i) => {
      ws.getCell(i + 3, 1).value = label;
      ws.getCell(i + 3, 1).font = { bold: true, color: { argb: 'FF4b5563' } };
      ws.getCell(i + 3, 2).value = value;
    });

    ws.getCell('A12').value = '조직 경계 설정';
    ws.getCell('A12').font = { bold: true, size: 12 };

    const boundaryRows: [string, string][] = [
      ['경계 접근법', boundary.organizationalBoundary.approach],
      ['통합 방식', boundary.organizationalBoundary.consolidationMethod],
      ['포함 사업장', boundary.organizationalBoundary.includedEntities.join(', ')],
      ['보고 연도', String(boundary.reportingYear)],
      ['기준연도', String(boundary.baseYear)],
      ['Scope 1 포함', boundary.operationalBoundary.scope1Included ? 'O' : 'X'],
      ['Scope 2 방식', boundary.operationalBoundary.scope2Method],
      ['Scope 3 카테고리', boundary.operationalBoundary.scope3Categories.map((n) => `Cat.${n}`).join(', ')],
    ];

    boundaryRows.forEach(([label, value], i) => {
      ws.getCell(i + 13, 1).value = label;
      ws.getCell(i + 13, 1).font = { bold: true, color: { argb: 'FF4b5563' } };
      ws.getCell(i + 13, 2).value = value;
    });

    ws.getColumn(1).width = 25;
    ws.getColumn(2).width = 50;
  }

  private addAuditIntegritySheet(workbook: import('exceljs').Workbook): void {
    const ws = workbook.addWorksheet('감사 무결성', {
      properties: { tabColor: { argb: 'FFef4444' } },
    });

    const { metadata } = this.report;

    ws.mergeCells('A1:D1');
    ws.getCell('A1').value = '⭐ 감사 무결성 정보 (Audit Integrity)';
    ws.getCell('A1').font = { size: 14, bold: true, color: { argb: 'FF1f2937' } };
    ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFfef3c7' } };

    const rows: [string, string][] = [
      ['보고서 번호', metadata.reportNo],
      ['표준', metadata.standard],
      ['보고 기간', metadata.period],
      ['불변 보호 상태', metadata.isImmutable ? '✓ 불변 (승인 완료)' : '⚠ 미승인 (수정 가능)'],
      ['보고서 상태', metadata.status],
      ['개정 번호', `v${metadata.revisionNumber}`],
      ['생성 일시', new Date(metadata.createdAt).toLocaleString('ko-KR')],
      ['', ''],
      ['Hash 보호 방식', 'SHA-256'],
      [
        '설명',
        '이 보고서의 핵심 내용(배출량, 배출계수, 엔진 버전, 경계 설정)은 생성 시점에 SHA-256 해시로 서명됩니다. ' +
        '승인 후 내용이 변조되면 해시가 불일치하여 감지할 수 있습니다.',
      ],
    ];

    rows.forEach(([label, value], i) => {
      if (!label) return;
      const row = ws.getRow(i + 3);
      row.getCell(1).value = label;
      row.getCell(1).font = { bold: true, color: { argb: 'FF4b5563' } };
      row.getCell(2).value = value;

      if (label === '불변 보호 상태') {
        const isImmutable = value.startsWith('✓');
        row.getCell(2).font = {
          bold: true,
          color: { argb: isImmutable ? 'FF10b981' : 'FFf59e0b' },
        };
      }
    });

    ws.getColumn(1).width = 22;
    ws.getColumn(2).width = 70;
  }
}
