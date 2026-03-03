/**
 * ESG Report PDF Renderer
 * PDFKit 기반 Big4 감사 대응 전문 보고서 생성
 * 기존 compliance-report/pdf/route.ts 패턴 준수
 */

import type { ESGReportDetailDTO } from '../dtos/esg-report.dto';
import type { ReportSection } from '../templates/base.template';
import { getTemplate } from '../templates';
import type { ESGStandard } from '../types/esg-report.types';
import type { TemplateContext } from '../templates/base.template';

// ─── 색상 상수 ────────────────────────────────────────────────────
const COLORS = {
  primary: '#10b981',     // Emerald-500
  dark: '#1f2937',        // Gray-800
  medium: '#4b5563',      // Gray-600
  light: '#9ca3af',       // Gray-400
  bg: '#f9fafb',          // Gray-50
  border: '#e5e7eb',      // Gray-200
  scope1: '#ef4444',      // Red-500
  scope2: '#3b82f6',      // Blue-500
  scope3: '#f59e0b',      // Amber-500
  white: '#ffffff',
  warning: '#f59e0b',
  success: '#10b981',
};

// ─── 한국어 폰트 후보 ─────────────────────────────────────────────
const FONT_CANDIDATES = [
  'C:/Windows/Fonts/malgun.ttf',    // Windows Malgun Gothic
  '/usr/share/fonts/truetype/nanum/NanumGothic.ttf',  // Linux
  '/public/fonts/NanumGothic.ttf', // Next.js public dir
];

async function loadKoreanFont(doc: PDFKit.PDFDocument): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  for (const fontPath of FONT_CANDIDATES) {
    const absPath = fontPath.startsWith('/public/')
      ? path.join(process.cwd(), fontPath)
      : fontPath;

    if (fs.existsSync(absPath)) {
      doc.registerFont('Korean', absPath);
      return;
    }
  }
  // 폰트 없으면 기본 Helvetica 사용 (한국어 깨질 수 있음)
}

// ─── ESG PDF Renderer ─────────────────────────────────────────────

export class ESGPDFRenderer {
  private doc!: PDFKit.PDFDocument;
  private report: ESGReportDetailDTO;
  private sections: ReportSection[];
  private fontName = 'Korean';

  constructor(report: ESGReportDetailDTO) {
    this.report = report;

    // 템플릿으로 섹션 생성
    const template = getTemplate(report.metadata.standard as ESGStandard);
    const ctx = this.buildTemplateContext();
    this.sections = template.buildSections(ctx);
  }

  async render(): Promise<Buffer> {
    const PDFDocument = (await import('pdfkit')).default ?? (await import('pdfkit'));
    this.doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });

    await loadKoreanFont(this.doc);
    if (!this.doc.font) {
      this.fontName = 'Helvetica';
    }

    const chunks: Buffer[] = [];
    this.doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    // ─── 페이지 1: 표지 ─────────────────────────────────────────
    this.renderCoverPage();

    // ─── 페이지 2: 배출량 요약 ──────────────────────────────────
    this.doc.addPage();
    this.renderSummaryPage();

    // ─── 페이지 3+: 섹션별 상세 ─────────────────────────────────
    for (const section of this.sections) {
      this.doc.addPage();
      this.renderSectionPage(section);
    }

    // ─── 페이지 N: 스냅샷 및 감사 선언 ──────────────────────────
    this.doc.addPage();
    this.renderSnapshotPage();

    this.doc.addPage();
    this.renderAuditDeclarationPage();

    // 페이지 번호
    this.addPageNumbers();

    return new Promise((resolve) => {
      this.doc.on('end', () => resolve(Buffer.concat(chunks)));
      this.doc.end();
    });
  }

  // ─── 표지 ─────────────────────────────────────────────────────

  private renderCoverPage(): void {
    const { doc } = this;
    const { metadata, summary } = this.report;

    // 헤더 배너
    doc.rect(0, 0, 595, 180).fill(COLORS.dark);

    // 로고/브랜드명
    doc.font(this.fontName).fontSize(14).fillColor(COLORS.primary)
      .text('탄소이음 ESG', 50, 40);
    doc.fontSize(28).fillColor(COLORS.white)
      .text('ESG 보고서', 50, 65);
    doc.fontSize(16).fillColor('#9ca3af')
      .text(metadata.standard.replace('_', ' '), 50, 100);
    doc.fontSize(12).fillColor('#6b7280')
      .text(`버전: v${metadata.revisionNumber} | ${metadata.period}`, 50, 130);

    // 보고서 번호
    doc.fontSize(10).fillColor('#6b7280')
      .text(`보고서 번호: ${metadata.reportNo}`, 400, 155, { align: 'right', width: 145 });

    // 배출량 카드 (Scope 1/2/3)
    const cardY = 210;
    const cards = [
      { label: 'Scope 1 (직접)', value: summary.scope1, color: COLORS.scope1 },
      { label: 'Scope 2 (전력)', value: summary.scope2Location, color: COLORS.scope2 },
      { label: 'Scope 3 (간접)', value: summary.scope3, color: COLORS.scope3 },
    ];

    cards.forEach((card, i) => {
      const x = 50 + i * 170;
      doc.rect(x, cardY, 155, 80).fill(COLORS.bg);
      doc.rect(x, cardY, 5, 80).fill(card.color);
      doc.fontSize(9).fillColor(COLORS.light).text(card.label, x + 15, cardY + 12);
      doc.fontSize(18).fillColor(COLORS.dark)
        .text(formatEmissions(card.value), x + 15, cardY + 30);
      doc.fontSize(9).fillColor(COLORS.light).text('tCO₂eq', x + 15, cardY + 55);
    });

    // 총 배출량
    doc.rect(50, 310, 495, 60).fill(COLORS.primary);
    doc.fontSize(12).fillColor(COLORS.white).text('총 배출량 (Scope 1+2+3)', 70, 325);
    doc.fontSize(24).fillColor(COLORS.white)
      .text(`${formatEmissions(summary.totalEmissions)} tCO₂eq`, 70, 342);

    // 보고서 정보 테이블
    const infoY = 400;
    const infoRows: [string, string][] = [
      ['보고 표준', formatStandard(metadata.standard)],
      ['보고 기간', metadata.period],
      ['보고서 상태', formatStatus(metadata.status)],
      ['데이터 완전성', `${metadata.completenessScore ?? '-'}%`],
      ['생성 일시', new Date(metadata.createdAt as Date | string).toLocaleDateString('ko-KR')],
      ...(metadata.approvedAt
        ? [['승인 일시', new Date(metadata.approvedAt as Date | string).toLocaleDateString('ko-KR')] as [string, string]]
        : []),
    ];

    doc.fontSize(11).fillColor(COLORS.dark).text('보고서 정보', 50, infoY);
    doc.moveTo(50, infoY + 16).lineTo(545, infoY + 16).strokeColor(COLORS.border).stroke();

    infoRows.forEach(([label, value], i) => {
      const rowY = infoY + 25 + i * 22;
      if (i % 2 === 0) doc.rect(50, rowY - 2, 495, 22).fill('#f3f4f6');
      doc.fontSize(9).fillColor(COLORS.medium).text(label, 60, rowY + 4, { width: 150 });
      doc.fontSize(9).fillColor(COLORS.dark).text(value, 220, rowY + 4, { width: 375 });
    });

    // 불변 인증 배지
    if (metadata.isImmutable) {
      const badgeY = 720;
      doc.rect(50, badgeY, 495, 30).fill('#d1fae5');
      doc.fontSize(10).fillColor('#065f46')
        .text('✓ 이 보고서는 승인 완료된 불변 보고서입니다. 데이터 변조를 방지하기 위해 SHA-256 해시로 보호됩니다.', 60, badgeY + 9);
    }
  }

  // ─── 배출량 요약 페이지 ───────────────────────────────────────

  private renderSummaryPage(): void {
    const { doc } = this;
    const { summary, snapshots } = this.report;

    this.renderPageHeader('배출량 요약');

    let y = 120;

    // Scope 1/2/3 테이블
    const rows = [
      { scope: 'Scope 1', description: '직접 배출 (연료 연소)', value: summary.scope1, color: COLORS.scope1 },
      { scope: 'Scope 2 (Location)', description: '전력 간접 배출 (지역기반)', value: summary.scope2Location, color: COLORS.scope2 },
      ...(summary.scope2Market != null
        ? [{ scope: 'Scope 2 (Market)', description: '전력 간접 배출 (시장기반)', value: summary.scope2Market, color: COLORS.scope2 }]
        : []),
      { scope: 'Scope 3', description: '기타 간접 배출', value: summary.scope3, color: COLORS.scope3 },
      { scope: '합계', description: 'Scope 1 + 2 + 3', value: summary.totalEmissions, color: COLORS.primary },
    ];

    // 테이블 헤더
    doc.rect(50, y, 495, 25).fill(COLORS.dark);
    doc.fontSize(10).fillColor(COLORS.white)
      .text('구분', 60, y + 7, { width: 120 })
      .text('설명', 185, y + 7, { width: 200 })
      .text('배출량 (tCO₂eq)', 390, y + 7, { width: 145, align: 'right' });

    y += 25;
    rows.forEach((row, i) => {
      const isTotal = row.scope === '합계';
      const bg = isTotal ? '#f0fdf4' : i % 2 === 0 ? COLORS.white : COLORS.bg;
      doc.rect(50, y, 495, 28).fill(bg);
      doc.rect(50, y, 4, 28).fill(row.color);

      doc.fontSize(9)
        .font(this.fontName)
        .fillColor(isTotal ? COLORS.primary : COLORS.dark)
        .text(row.scope, 60, y + 9, { width: 120 })
        .text(row.description, 185, y + 9, { width: 200 })
        .text(formatEmissions(row.value), 390, y + 9, { width: 145, align: 'right' });

      y += 28;
    });

    // 데이터 품질 요약
    y += 30;
    if (snapshots.activityData?.dataQualitySummary) {
      const q = snapshots.activityData.dataQualitySummary;
      doc.fontSize(11).fillColor(COLORS.dark).text('데이터 품질 요약', 50, y);
      y += 20;

      const qualityRows: [string, string][] = [
        ['총 데이터 포인트', String(q.totalDataPoints)],
        ['센서 자동 수집', `${q.sensorData}개`],
        ['수동 입력', `${q.manualData}개`],
        ['데이터 완전성', `${q.completenessScore}%`],
      ];

      qualityRows.forEach(([label, value], i) => {
        if (i % 2 === 0) doc.rect(50, y, 495, 20).fill(COLORS.bg);
        doc.fontSize(9).fillColor(COLORS.medium).text(label, 60, y + 5, { width: 200 });
        doc.fontSize(9).fillColor(COLORS.dark).text(value, 260, y + 5);
        y += 20;
      });
    }
  }

  // ─── 섹션 페이지 ─────────────────────────────────────────────

  private renderSectionPage(section: ReportSection): void {
    const { doc } = this;
    this.renderPageHeader(section.title);

    let y = 120;

    // 필드 테이블
    doc.rect(50, y, 495, 25).fill('#374151');
    doc.fontSize(9).fillColor(COLORS.white)
      .text('항목', 60, y + 8, { width: 250 })
      .text('값', 315, y + 8, { width: 100 })
      .text('단위', 420, y + 8, { width: 80, align: 'right' });
    y += 25;

    for (const field of section.fields) {
      if (y > 720) {
        doc.addPage();
        this.renderPageHeader(section.title + ' (계속)');
        y = 120;
      }

      const rowBg = field.required ? '#fef3c7' : (y % 2 === 0 ? COLORS.white : COLORS.bg);
      doc.rect(50, y, 495, 28).fill(rowBg);

      const labelColor = field.value === null ? COLORS.light : COLORS.dark;
      doc.fontSize(9).fillColor(labelColor)
        .text(field.label, 60, y + 9, { width: 250 })
        .text(String(field.value ?? '—'), 315, y + 9, { width: 100 })
        .text(field.unit ?? '', 420, y + 9, { width: 80, align: 'right' });

      if (field.required && field.value === null) {
        doc.fontSize(7).fillColor('#ef4444').text('필수', 60, y + 20, { width: 40 });
      }

      if (field.notes) {
        y += 28;
        doc.fontSize(7).fillColor(COLORS.light)
          .text(`  ↳ ${field.notes}`, 70, y, { width: 475 });
      }

      y += 28;
    }
  }

  // ─── 스냅샷 페이지 ───────────────────────────────────────────

  private renderSnapshotPage(): void {
    const { doc } = this;
    const { snapshots } = this.report;

    this.renderPageHeader('감사 스냅샷 (Audit Evidence)');

    let y = 120;
    doc.fontSize(9).fillColor(COLORS.medium)
      .text(
        '이 페이지의 정보는 보고서 생성 시점에 불변 기록으로 저장된 스냅샷입니다. Big4 감사 및 ESG 검증에 활용됩니다.',
        50, y, { width: 495 }
      );
    y += 30;

    // 계산 엔진 정보
    doc.fontSize(11).fillColor(COLORS.dark).text('계산 엔진', 50, y);
    y += 20;

    const engine = snapshots.engineVersion;
    const engineRows: [string, string][] = [
      ['엔진 버전', engine.version],
      ['방법론', engine.methodology],
      ['엔진명', engine.name],
      ['출시일', new Date(engine.releasedAt).toLocaleDateString('ko-KR')],
    ];

    engineRows.forEach(([label, value], i) => {
      if (i % 2 === 0) doc.rect(50, y, 495, 20).fill(COLORS.bg);
      doc.fontSize(9).fillColor(COLORS.medium).text(label, 60, y + 5, { width: 150 });
      doc.fontSize(9).fillColor(COLORS.dark).text(value, 215, y + 5, { width: 330 });
      y += 20;
    });

    y += 20;

    // 배출계수 목록
    doc.fontSize(11).fillColor(COLORS.dark).text('사용된 배출계수', 50, y);
    y += 20;

    if (snapshots.emissionFactors.length > 0) {
      doc.rect(50, y, 495, 22).fill(COLORS.dark);
      doc.fontSize(8).fillColor(COLORS.white)
        .text('코드', 60, y + 7, { width: 100 })
        .text('출처', 165, y + 7, { width: 100 })
        .text('계수', 270, y + 7, { width: 80 })
        .text('단위', 355, y + 7, { width: 80 })
        .text('버전', 440, y + 7, { width: 50 });
      y += 22;

      snapshots.emissionFactors.forEach((f, i) => {
        if (y > 720) {
          doc.addPage();
          this.renderPageHeader('감사 스냅샷 (계속)');
          y = 120;
        }
        const bg = i % 2 === 0 ? COLORS.white : COLORS.bg;
        doc.rect(50, y, 495, 20).fill(bg);
        doc.fontSize(8).fillColor(COLORS.dark)
          .text(f.code, 60, y + 6, { width: 100 })
          .text(f.source.slice(0, 15), 165, y + 6, { width: 100 })
          .text(String(f.factor), 270, y + 6, { width: 80 })
          .text(f.unit, 355, y + 6, { width: 80 })
          .text(`v${f.version}`, 440, y + 6, { width: 50 });
        y += 20;
      });
    } else {
      doc.fontSize(9).fillColor(COLORS.light).text('배출계수 없음', 60, y);
      y += 20;
    }
  }

  // ─── 감사 선언 페이지 ────────────────────────────────────────

  private renderAuditDeclarationPage(): void {
    const { doc } = this;
    const { metadata } = this.report;

    this.renderPageHeader('검증 및 선언');

    let y = 120;

    // 자체 선언 박스
    doc.rect(50, y, 495, 120).fill(COLORS.bg);
    doc.rect(50, y, 5, 120).fill(COLORS.primary);
    doc.fontSize(12).fillColor(COLORS.dark).text('자체 선언 (Self-Declaration)', 65, y + 15);
    doc.fontSize(9).fillColor(COLORS.medium).text(
      '본 보고서에 포함된 온실가스 배출량 정보는 GHG Protocol Corporate Standard 및 적용 가능한 ' +
      '규제 기준에 따라 작성되었으며, 내부 검토 절차를 거쳐 정확성을 확인하였습니다.',
      65, y + 40, { width: 465 }
    );
    doc.fontSize(9).fillColor(COLORS.medium).text(
      '보고 기간 내 모든 주요 배출원을 포함하였으며, 제외된 배출원에 대해서는 해당 섹션에 사유를 명시하였습니다.',
      65, y + 75, { width: 465 }
    );

    y += 140;

    // 서명란
    const signatureRows = [
      { title: '보고서 생성자', name: metadata.generatedBy, date: new Date(metadata.createdAt as Date | string).toLocaleDateString('ko-KR') },
      ...(metadata.approvedAt
        ? [{ title: '승인자', name: metadata.approvedBy ?? metadata.reportNo, date: new Date(metadata.approvedAt as Date | string).toLocaleDateString('ko-KR') }]
        : [{ title: '승인자', name: '(미승인)', date: '-' }]),
    ];

    signatureRows.forEach((row) => {
      doc.rect(50, y, 495, 70).fill(COLORS.white).strokeColor(COLORS.border).stroke();
      doc.fontSize(9).fillColor(COLORS.medium).text(row.title, 60, y + 10);
      doc.fontSize(10).fillColor(COLORS.dark).text(row.name, 60, y + 28);
      doc.fontSize(8).fillColor(COLORS.light).text(`일시: ${row.date}`, 400, y + 50, { width: 135, align: 'right' });
      y += 85;
    });

    // 해시 정보 (SHA-256)
    y += 20;
    doc.rect(50, y, 495, 60).fill('#1f2937');
    doc.fontSize(9).fillColor(COLORS.primary).text('데이터 무결성 (SHA-256)', 60, y + 10);
    doc.fontSize(7).fillColor('#9ca3af').text(
      `보고서 번호: ${metadata.reportNo}`,
      60, y + 28, { width: 475 }
    );
    doc.fontSize(7).fillColor('#6b7280').text(
      `이 보고서는 SHA-256 해시로 보호되며, 승인 후 내용 변경 시 해시가 불일치하여 변조를 탐지할 수 있습니다.`,
      60, y + 44, { width: 475 }
    );
  }

  // ─── 헬퍼 ─────────────────────────────────────────────────────

  private renderPageHeader(title: string): void {
    const { doc } = this;
    doc.rect(0, 0, 595, 70).fill(COLORS.dark);
    doc.fontSize(16).fillColor(COLORS.white).font(this.fontName).text(title, 50, 25);
    doc.fontSize(9).fillColor('#6b7280')
      .text(this.report.metadata.reportNo, 400, 35, { width: 145, align: 'right' });
    doc.moveTo(50, 80).lineTo(545, 80).strokeColor(COLORS.border).stroke();
  }

  private addPageNumbers(): void {
    const pages = this.doc.bufferedPageRange();
    for (let i = pages.start; i < pages.start + pages.count; i++) {
      this.doc.switchToPage(i);
      this.doc.fontSize(8).fillColor(COLORS.light)
        .text(
          `${i + 1} / ${pages.count}`,
          0, 810, { align: 'center', width: 595 }
        );
    }
  }

  private buildTemplateContext(): TemplateContext {
    const { metadata, summary, snapshots } = this.report;
    return {
      tenantId: '',
      tenantName: '',
      period: metadata.period,
      reportYear: metadata.reportYear,
      summary,
      emissionFactors: snapshots.emissionFactors,
      boundary: snapshots.boundary,
      calculationMethod: snapshots.calculationMethod,
      activityData: snapshots.activityData,
      countryCode: metadata.countryCode,
    };
  }
}

// ─── 유틸 ─────────────────────────────────────────────────────────

function formatEmissions(value: number): string {
  return value.toLocaleString('ko-KR', { maximumFractionDigits: 3, minimumFractionDigits: 0 });
}

function formatStandard(standard: string): string {
  const map: Record<string, string> = {
    GHG_PROTOCOL: 'GHG Protocol Corporate Standard',
    K_MRV: '한국 온실가스 명세서 (K-MRV)',
    CDP: 'CDP 기후변화 질의서',
    ISSB: 'ISSB IFRS S2 기후 관련 공시',
    ISO_14064: 'KS I ISO 14064-1',
    K_ETS: '한국 배출권 거래제 (K-ETS)',
  };
  return map[standard] ?? standard;
}

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    draft: '초안',
    in_review: '검토 중',
    approved: '승인 완료',
    published: '공개 발표',
    withdrawn: '철회',
  };
  return map[status] ?? status;
}
