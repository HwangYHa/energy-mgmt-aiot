/**
 * GET /api/analytics/carbon/compliance-report/pdf
 *
 * K-MRV 기준 온실가스 명세서 PDF 자동 생성 (PDFKit)
 * - 환경부 온실가스 배출량 및 에너지 소비량 보고 (K-GHG MRV)
 * - Scope 1 (직접배출) / Scope 2 (간접배출) / Scope 3 (기타) 구분
 *
 * 쿼리 파라미터:
 *   year   — 보고 연도 (기본: 이전 연도)
 *   siteId — 특정 사업장만
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { verifyAuth } from '@/lib/auth/verify';
import { generateDownloadFilename, contentDispositionHeader } from '@/lib/utils/filename';
import { prisma } from '@/lib/db/prisma';
import { EmissionsService } from '@/lib/services/emissions.service';
import { ALL_EMISSION_FACTORS } from '@/lib/constants/emission-factors';

export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────────────────────
// 한글 폰트 탐색
// ──────────────────────────────────────────────────────────────

const FONT_CANDIDATES = [
  path.join(process.cwd(), 'public/fonts/NanumGothic.ttf'),
  'C:\\Windows\\Fonts\\malgun.ttf',
  'C:\\Windows\\Fonts\\NanumGothic.ttf',
  '/usr/share/fonts/truetype/nanum/NanumGothic.ttf',
  '/usr/share/fonts/nanum/NanumGothic.ttf',
  '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
];

function findKoreanFont(): string | null {
  for (const p of FONT_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// ──────────────────────────────────────────────────────────────
// 색상 / 레이아웃 상수
// ──────────────────────────────────────────────────────────────

const C = {
  primary:    '#10b981', // 탄소이음 그린
  accent:     '#0891b2', // 시안
  dark:       '#1e293b',
  muted:      '#64748b',
  border:     '#e2e8f0',
  scope1:     '#f59e0b', // Scope 1 amber
  scope2:     '#3b82f6', // Scope 2 blue
  scope3:     '#8b5cf6', // Scope 3 purple
  tableHead:  '#f8fafc',
  white:      '#ffffff',
  danger:     '#dc2626',
  success:    '#16a34a',
};

const MARGIN = 50;
const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const CONT_W = PAGE_W - MARGIN * 2;

// ──────────────────────────────────────────────────────────────
// PDF 생성 함수
// ──────────────────────────────────────────────────────────────

interface ReportData {
  year: number;
  tenant: { name: string; industryType: string };
  scope1Total: number;
  scope2Total: number;
  scope3Total: number;
  grandTotal: number;
  prevTotal: number;
  scope1Sources: Array<{
    id: string; sourceType: string; period: string;
    amount: number; unit: string; emissionFactor: number;
    calculatedEmission: number; calculationMethod: string; dataSource: string;
  }>;
  scope3Sources: Array<{
    id: string; sourceType: string; period: string;
    amount: number; unit: string; emissionFactor: number;
    calculatedEmission: number; dataSource: string;
  }>;
  elecFactor: number;
  elecFactorVersion: string;
  monthlyData: Array<{
    month: number; scope1: number; scope2: number; scope3: number; total: number;
  }>;
  factorsUsed: Array<{
    category: string; sourceType: string; factor: number; unit: string;
    version: string; source: string;
  }>;
}

function generateCompliancePdf(fontPath: string | null, data: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfkitMod = require('pdfkit');
    // Next.js ESM 환경에서 pdfkit은 { default: Constructor } 형태로 export됨
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PDFDocument = (pdfkitMod.default ?? pdfkitMod) as typeof import('pdfkit');
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: MARGIN + 20, left: MARGIN, right: MARGIN },
      bufferPages: true,
      info: {
        Title: `온실가스 배출량 명세서 ${data.year}`,
        Author: '탄소이음',
        Subject: 'K-MRV 온실가스 배출량 보고서',
        Keywords: '온실가스, Scope1, Scope2, 탄소중립, K-MRV',
        CreationDate: new Date(),
      },
    });

    const FONT      = 'Body';
    const FONT_BOLD = 'Bold';
    if (fontPath) {
      doc.registerFont(FONT, fontPath);
      doc.registerFont(FONT_BOLD, fontPath);
    } else {
      doc.registerFont(FONT, 'Helvetica');
      doc.registerFont(FONT_BOLD, 'Helvetica-Bold');
    }

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const generatedAt = new Date().toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    // ── Helper 함수들 ─────────────────────────────────────────

    function sectionTitle(title: string) {
      doc.moveDown(0.5);
      // 제목 배경박스
      doc.rect(MARGIN, doc.y, CONT_W, 22).fill(C.primary);
      doc.font(FONT_BOLD).fontSize(11).fillColor(C.white)
        .text(title, MARGIN + 8, doc.y - 18, { width: CONT_W - 16 });
      doc.moveDown(0.8);
    }

    function subTitle(title: string) {
      doc.font(FONT_BOLD).fontSize(10).fillColor(C.dark)
        .text(title);
      doc.moveDown(0.3);
    }

    function drawHLine(color = C.border, width = 1) {
      doc.moveTo(MARGIN, doc.y)
        .lineTo(PAGE_W - MARGIN, doc.y)
        .strokeColor(color).lineWidth(width).stroke();
      doc.moveDown(0.3);
    }

    function kv(label: string, value: string, labelWidth = 120) {
      const y = doc.y;
      doc.font(FONT_BOLD).fontSize(9).fillColor(C.muted)
        .text(label, MARGIN, y, { width: labelWidth, continued: false });
      doc.font(FONT).fontSize(9).fillColor(C.dark)
        .text(value, MARGIN + labelWidth, y, { width: CONT_W - labelWidth });
    }

    function tableRow(
      cols: string[],
      widths: number[],
      isHeader = false,
      rowColor?: string
    ) {
      const y = doc.y;
      const rowH = 16;
      if (rowColor) {
        doc.rect(MARGIN, y, CONT_W, rowH).fill(rowColor);
      }
      let x = MARGIN;
      cols.forEach((col, i) => {
        const colW = widths[i] ?? 80;
        doc
          .font(isHeader ? FONT_BOLD : FONT)
          .fontSize(8)
          .fillColor(C.dark)
          .text(col, x + 3, y + 3, { width: colW - 6, lineBreak: false });
        x += colW;
      });
      doc.y = y + rowH;
      // 행 구분선
      doc.moveTo(MARGIN, doc.y)
        .lineTo(PAGE_W - MARGIN, doc.y)
        .strokeColor(C.border).lineWidth(0.5).stroke();
    }

    function tco2(val: number) {
      return val.toFixed(3);
    }

    const yoyPct = data.prevTotal > 0
      ? ((data.grandTotal - data.prevTotal) / data.prevTotal * 100)
      : 0;
    const yoyStr = data.prevTotal > 0
      ? `${yoyPct >= 0 ? '+' : ''}${yoyPct.toFixed(1)}%`
      : '해당없음';

    // ══════════════════════════════════════════════════════════
    // 1. 표지
    // ══════════════════════════════════════════════════════════

    // 상단 컬러 배너
    doc.rect(0, 0, PAGE_W, 8).fill(C.primary);

    doc.moveDown(1.5);
    doc.font(FONT_BOLD).fontSize(7).fillColor(C.muted)
      .text('K-MRV 온실가스 배출량 보고서', { align: 'center' });
    doc.moveDown(0.5);
    doc.font(FONT_BOLD).fontSize(26).fillColor(C.dark)
      .text(`온실가스 배출량 명세서`, { align: 'center' });
    doc.moveDown(0.2);
    doc.font(FONT_BOLD).fontSize(18).fillColor(C.primary)
      .text(`${data.year}년도`, { align: 'center' });
    doc.moveDown(1);
    doc.moveTo(MARGIN + 80, doc.y).lineTo(PAGE_W - MARGIN - 80, doc.y)
      .strokeColor(C.primary).lineWidth(2).stroke();
    doc.moveDown(1.5);

    // 보고 기관 정보
    const infoBoxY = doc.y;
    doc.rect(MARGIN, infoBoxY, CONT_W, 90).fill('#f8fafc')
      .rect(MARGIN, infoBoxY, 4, 90).fill(C.primary);

    doc.font(FONT_BOLD).fontSize(13).fillColor(C.dark)
      .text(data.tenant.name, MARGIN + 16, infoBoxY + 12, { width: CONT_W - 20 });
    doc.font(FONT).fontSize(9).fillColor(C.muted)
      .text(
        `보고 기간: ${data.year}-01-01 ~ ${data.year}-12-31\n` +
        `산업 유형: ${data.tenant.industryType}\n` +
        `표준: K-MRV (환경부 온실가스 배출량 보고 기준)\n` +
        `생성일: ${generatedAt}`,
        MARGIN + 16, infoBoxY + 32, { width: CONT_W - 24 }
      );

    doc.y = infoBoxY + 100;
    doc.moveDown(1.5);

    // 총배출량 하이라이트 카드
    const cardY = doc.y;
    const cardW = (CONT_W - 8) / 3;
    const cardH = 65;

    const cards = [
      { label: 'Scope 1 직접배출', val: tco2(data.scope1Total), color: C.scope1 },
      { label: 'Scope 2 간접배출', val: tco2(data.scope2Total), color: C.scope2 },
      { label: '총 배출량', val: tco2(data.grandTotal), color: C.primary },
    ];

    cards.forEach((card, i) => {
      const cx = MARGIN + i * (cardW + 4);
      doc.rect(cx, cardY, cardW, cardH).fill('#f8fafc');
      doc.rect(cx, cardY, cardW, 4).fill(card.color);
      doc.font(FONT).fontSize(8).fillColor(C.muted)
        .text(card.label, cx + 8, cardY + 12, { width: cardW - 16 });
      doc.font(FONT_BOLD).fontSize(16).fillColor(C.dark)
        .text(card.val, cx + 8, cardY + 26, { width: cardW - 16 });
      doc.font(FONT).fontSize(7).fillColor(C.muted)
        .text('tCO₂eq', cx + 8, cardY + 48, { width: cardW - 16 });
    });

    doc.y = cardY + cardH + 12;
    doc.moveDown(0.5);

    // 전년대비
    doc.font(FONT).fontSize(9).fillColor(yoyPct > 0 ? C.danger : C.success)
      .text(
        `전년 대비: ${yoyStr}  (전년 총계: ${tco2(data.prevTotal)} tCO₂eq)`,
        { align: 'center' }
      );

    // 하단 컬러 배너
    doc.rect(0, PAGE_H - 8, PAGE_W, 8).fill(C.primary);

    // ══════════════════════════════════════════════════════════
    // 2. 배출량 요약
    // ══════════════════════════════════════════════════════════

    doc.addPage();
    sectionTitle('1. 온실가스 배출량 요약');

    kv('보고 기관', data.tenant.name);
    kv('보고 연도', `${data.year}년 (${data.year}-01-01 ~ ${data.year}-12-31)`);
    kv('적용 기준', 'K-MRV 온실가스 배출량 보고 지침 (환경부)');
    kv('배출량 단위', 'tCO₂eq (이산화탄소 환산톤)');
    doc.moveDown(0.8);
    drawHLine();

    // 요약 테이블
    subTitle('배출 범위별 요약');
    const sumCols = ['배출 범위', '배출원', '배출량 (tCO₂eq)', '비율 (%)'];
    const sumW = [120, 160, 120, 95];
    tableRow(sumCols, sumW, true, C.tableHead);

    const grandNz = data.grandTotal || 1;
    tableRow([
      'Scope 1 (직접)',
      '연료 연소, 냉매 누출',
      tco2(data.scope1Total),
      `${(data.scope1Total / grandNz * 100).toFixed(1)}%`,
    ], sumW, false, '#fffbeb');

    tableRow([
      'Scope 2 (간접)',
      '구매 전력, 스팀',
      tco2(data.scope2Total),
      `${(data.scope2Total / grandNz * 100).toFixed(1)}%`,
    ], sumW, false, '#eff6ff');

    tableRow([
      'Scope 3 (기타)',
      '운송, 폐기물, 출장',
      tco2(data.scope3Total),
      `${(data.scope3Total / grandNz * 100).toFixed(1)}%`,
    ], sumW, false, '#f5f3ff');

    tableRow([
      '총계',
      '',
      tco2(data.grandTotal),
      '100%',
    ], sumW, true, '#f1f5f9');

    doc.moveDown(1);

    // 전년 대비
    subTitle('전년 대비 변화');
    const yoyRow = [
      `${data.year - 1}년 배출량`,
      `${data.year}년 배출량`,
      '증감량',
      '변화율',
    ];
    const yoyW = [120, 120, 120, 135];
    tableRow(yoyRow, yoyW, true, C.tableHead);
    tableRow([
      `${tco2(data.prevTotal)} tCO₂eq`,
      `${tco2(data.grandTotal)} tCO₂eq`,
      `${yoyPct >= 0 ? '+' : ''}${tco2(data.grandTotal - data.prevTotal)} tCO₂eq`,
      yoyStr,
    ], yoyW, false, data.grandTotal < data.prevTotal ? '#f0fdf4' : '#fef2f2');

    // ══════════════════════════════════════════════════════════
    // 3. Scope 1 상세
    // ══════════════════════════════════════════════════════════

    doc.addPage();
    sectionTitle('2. Scope 1 — 직접 온실가스 배출');

    doc.font(FONT).fontSize(9).fillColor(C.muted)
      .text(
        'Scope 1은 사업장에서 직접 발생하는 온실가스 배출량입니다. ' +
        '연료 연소(경유, LNG, LPG 등), 공정 배출, 냉매 누출 등이 포함됩니다.',
        { width: CONT_W }
      );
    doc.moveDown(0.8);

    if (data.scope1Sources.length === 0) {
      doc.font(FONT).fontSize(9).fillColor(C.muted)
        .text('등록된 Scope 1 배출 데이터가 없습니다. 탄소 분석 페이지에서 연료 사용량을 입력하세요.');
    } else {
      const s1Cols = ['기간', '배출원 유형', '사용량', '단위', '배출계수', '배출량 (tCO₂eq)', '산정 방법'];
      const s1W   = [50, 80, 55, 35, 60, 90, 125];
      tableRow(s1Cols, s1W, true, C.tableHead);

      data.scope1Sources.forEach((s, i) => {
        tableRow([
          s.period,
          s.sourceType,
          s.amount.toFixed(2),
          s.unit,
          s.emissionFactor.toFixed(4),
          tco2(s.calculatedEmission),
          s.calculationMethod === 'auto' ? 'Tier 2 (배출계수법)' : '직접 측정',
        ], s1W, false, i % 2 === 0 ? '#fffbeb' : C.white);
      });

      doc.moveDown(0.5);
      doc.font(FONT_BOLD).fontSize(9).fillColor(C.dark)
        .text(`Scope 1 합계: ${tco2(data.scope1Total)} tCO₂eq`, { align: 'right' });
    }

    doc.moveDown(1);
    subTitle('Scope 1 산정 방법론');
    doc.font(FONT).fontSize(9).fillColor(C.muted)
      .text(
        '• 산정 방식: Tier 2 (연료 특성 배출계수법) — GHG Protocol Corporate Standard 준수\n' +
        '• 배출계수 출처: 환경부 고시 배출계수 (국내 고정연소 기준)\n' +
        '• 공식: 배출량 = 활동 데이터 × 배출계수 × GWP (CO₂ = 1)',
        { width: CONT_W }
      );

    // ══════════════════════════════════════════════════════════
    // 4. Scope 2 상세
    // ══════════════════════════════════════════════════════════

    doc.addPage();
    sectionTitle('3. Scope 2 — 간접 온실가스 배출 (전력)');

    doc.font(FONT).fontSize(9).fillColor(C.muted)
      .text(
        'Scope 2는 사업장에서 구매·소비한 전력, 스팀, 열 등에서 간접적으로 발생하는 배출량입니다. ' +
        '전력계량기 자동 수집 데이터 × 한국전력 계통 배출계수로 산정합니다.',
        { width: CONT_W }
      );
    doc.moveDown(0.8);

    const s2Cols = ['항목', '값'];
    const s2W   = [200, 295];
    tableRow(s2Cols, s2W, true, C.tableHead);
    tableRow(['배출량 (tCO₂eq)', tco2(data.scope2Total)], s2W, false, '#eff6ff');
    tableRow(['전력 배출계수', `${data.elecFactor} tCO₂/MWh`], s2W, false, C.white);
    tableRow(['배출계수 기준 연도', data.elecFactorVersion], s2W, false, '#eff6ff');
    tableRow(['배출계수 출처', '한국 국가 전력망 평균 배출계수 (환경부/에너지공단)'], s2W, false, C.white);
    tableRow(['산정 방법', 'Location-Based Method (GHG Protocol Scope 2 Guidance)'], s2W, false, '#eff6ff');
    tableRow(['데이터 수집', '전력계량기 IoT 게이트웨이 자동 수집'], s2W, false, C.white);

    doc.moveDown(1);

    // Scope 2 월별 추이
    subTitle('월별 Scope 2 배출량 추이');
    const m2Cols = ['월', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    const m2W = [60, ...Array(12).fill(Math.floor((CONT_W - 60) / 12))];
    tableRow(m2Cols, m2W, true, C.tableHead);
    tableRow(
      ['Scope 2\n(tCO₂eq)', ...data.monthlyData.map((m) => tco2(m.scope2))],
      m2W, false, '#eff6ff'
    );

    // ══════════════════════════════════════════════════════════
    // 5. Scope 3 상세
    // ══════════════════════════════════════════════════════════

    doc.addPage();
    sectionTitle('4. Scope 3 — 기타 간접 배출');

    doc.font(FONT).fontSize(9).fillColor(C.muted)
      .text(
        'Scope 3는 가치 사슬 전반에서 발생하는 간접 배출로, 운송·배송, 폐기물, 출장 등이 포함됩니다. ' +
        '본 명세서는 Category 4 (상품 운송 및 배송) 데이터를 포함합니다.',
        { width: CONT_W }
      );
    doc.moveDown(0.8);

    if (data.scope3Sources.length === 0) {
      doc.font(FONT).fontSize(9).fillColor(C.muted)
        .text('등록된 Scope 3 배출 데이터가 없습니다. 탄소 분석 페이지에서 운송 데이터를 입력하세요.');
    } else {
      const s3Cols = ['기간', '운송 수단', '거리(km)', '단위', '배출계수', '배출량 (tCO₂eq)'];
      const s3W   = [55, 90, 60, 40, 70, 180];
      tableRow(s3Cols, s3W, true, C.tableHead);

      data.scope3Sources.forEach((s, i) => {
        tableRow([
          s.period,
          s.sourceType,
          s.amount.toFixed(1),
          s.unit,
          s.emissionFactor.toFixed(5),
          tco2(s.calculatedEmission),
        ], s3W, false, i % 2 === 0 ? '#f5f3ff' : C.white);
      });

      doc.moveDown(0.5);
      doc.font(FONT_BOLD).fontSize(9).fillColor(C.dark)
        .text(`Scope 3 합계: ${tco2(data.scope3Total)} tCO₂eq`, { align: 'right' });
    }

    // ══════════════════════════════════════════════════════════
    // 6. 월별 배출량 추이
    // ══════════════════════════════════════════════════════════

    doc.addPage();
    sectionTitle('5. 월별 온실가스 배출량 추이');

    // 월별 테이블
    const months = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
    const mW = [60, ...Array(12).fill(Math.floor((CONT_W - 60) / 12))];

    tableRow(['구분', ...months], mW, true, C.tableHead);
    tableRow(
      ['Scope 1', ...data.monthlyData.map((m) => tco2(m.scope1))],
      mW, false, '#fffbeb'
    );
    tableRow(
      ['Scope 2', ...data.monthlyData.map((m) => tco2(m.scope2))],
      mW, false, '#eff6ff'
    );
    tableRow(
      ['Scope 3', ...data.monthlyData.map((m) => tco2(m.scope3))],
      mW, false, '#f5f3ff'
    );
    tableRow(
      ['합계', ...data.monthlyData.map((m) => tco2(m.total))],
      mW, true, C.tableHead
    );

    doc.moveDown(1);

    // 연간 소계
    subTitle('분기별 배출량 소계');
    const qW = [100, 120, 120, 120, 135];
    tableRow(['분기', 'Scope 1', 'Scope 2', 'Scope 3', '합계'], qW, true, C.tableHead);

    const quarters = [
      [0,1,2], [3,4,5], [6,7,8], [9,10,11]
    ];
    quarters.forEach((idxs, qi) => {
      const qData = idxs.map((i) => data.monthlyData[i] || { scope1:0, scope2:0, scope3:0, total:0 });
      const s1 = qData.reduce((a, m) => a + m.scope1, 0);
      const s2 = qData.reduce((a, m) => a + m.scope2, 0);
      const s3 = qData.reduce((a, m) => a + m.scope3, 0);
      tableRow(
        [`${qi+1}분기`, tco2(s1), tco2(s2), tco2(s3), tco2(s1+s2+s3)],
        qW, false, qi % 2 === 0 ? '#f8fafc' : C.white
      );
    });

    // ══════════════════════════════════════════════════════════
    // 7. 사용 배출계수
    // ══════════════════════════════════════════════════════════

    doc.addPage();
    sectionTitle('6. 적용 배출계수 목록');

    doc.font(FONT).fontSize(9).fillColor(C.muted)
      .text('본 명세서 산정에 적용된 배출계수 목록입니다. (환경부 고시 및 국제 기준)', { width: CONT_W });
    doc.moveDown(0.5);

    const fCols = ['범주', '배출원', '배출계수', '단위', '기준 연도', '출처'];
    const fW   = [80, 90, 70, 70, 60, 125];
    tableRow(fCols, fW, true, C.tableHead);

    data.factorsUsed.forEach((f, i) => {
      tableRow([
        f.category,
        f.sourceType,
        f.factor.toFixed(5),
        f.unit,
        f.version,
        f.source.substring(0, 30),
      ], fW, false, i % 2 === 0 ? '#f8fafc' : C.white);
    });

    doc.moveDown(1);
    subTitle('배출계수 참고 기준');
    doc.font(FONT).fontSize(9).fillColor(C.muted)
      .text(
        '• 한국 전력 계통 배출계수: 환경부 국가 고유 배출계수 고시 (연도별 갱신)\n' +
        '• 연료 연소 배출계수: 환경부 온실가스 배출량 산정 지침 (2023년 개정)\n' +
        '• 운송 배출계수: 국가 인벤토리 보고서 (NIR) — 이동 연소 부문\n' +
        '• GWP 값: IPCC AR5 (CO₂=1, CH₄=28, N₂O=265)',
        { width: CONT_W }
      );

    // ══════════════════════════════════════════════════════════
    // 8. 검증 및 서명
    // ══════════════════════════════════════════════════════════

    doc.addPage();
    sectionTitle('7. 검증 및 선언');

    doc.font(FONT).fontSize(9).fillColor(C.dark)
      .text(
        `${data.tenant.name}은(는) ${data.year}년도 온실가스 배출량을 환경부 온실가스 ` +
        `배출량 보고 지침(K-MRV)에 따라 산정하였으며, 그 결과는 다음과 같습니다:\n\n` +
        `• 총 온실가스 배출량: ${tco2(data.grandTotal)} tCO₂eq\n` +
        `• Scope 1 (직접배출): ${tco2(data.scope1Total)} tCO₂eq\n` +
        `• Scope 2 (간접배출): ${tco2(data.scope2Total)} tCO₂eq\n` +
        `• Scope 3 (기타간접): ${tco2(data.scope3Total)} tCO₂eq\n\n` +
        `본 명세서의 정보는 탄소이음 플랫폼이 수집한 데이터를 기반으로 자동 산정되었으며, ` +
        `정확성 향상을 위해 제3자 검증기관의 검증을 권고합니다.`,
        { width: CONT_W }
      );

    doc.moveDown(1.5);
    drawHLine(C.border, 0.5);
    doc.moveDown(0.5);

    // 자기 선언 박스
    const declY = doc.y;
    doc.rect(MARGIN, declY, CONT_W, 70).fill('#f8fafc')
      .rect(MARGIN, declY, 4, 70).fill(C.primary);

    doc.font(FONT_BOLD).fontSize(9).fillColor(C.dark)
      .text('자기 선언 (Self-Declaration)', MARGIN + 12, declY + 10, { width: CONT_W - 20 });
    doc.font(FONT).fontSize(8).fillColor(C.muted)
      .text(
        `본 ${data.year}년도 온실가스 배출량 명세서는 탄소이음 플랫폼에서 자동 생성되었습니다. ` +
        `KS I ISO 14064-1 및 GHG Protocol Corporate Standard에 따른 자기 선언이며, ` +
        `제3자 검증을 받지 않은 내부 용도의 참고 자료입니다.`,
        MARGIN + 12, declY + 28, { width: CONT_W - 24 }
      );

    doc.y = declY + 78;
    doc.moveDown(1.5);

    // 서명란
    const sigY = doc.y;
    doc.font(FONT).fontSize(9).fillColor(C.muted)
      .text('작성 기관: 탄소이음  |  작성 시스템: 탄소이음 EMS Platform', MARGIN, sigY);
    doc.font(FONT).fontSize(9).fillColor(C.muted)
      .text(`생성일시: ${new Date().toLocaleString('ko-KR')}`, MARGIN, sigY + 14);

    // 서명 박스 × 2
    const boxW = (CONT_W - 20) / 2;
    const boxY = sigY + 35;
    doc.rect(MARGIN, boxY, boxW, 50).stroke(C.border);
    doc.rect(MARGIN + boxW + 20, boxY, boxW, 50).stroke(C.border);
    doc.font(FONT).fontSize(8).fillColor(C.muted)
      .text('환경 담당자 확인', MARGIN + 8, boxY + 6)
      .text('경영진 승인', MARGIN + boxW + 28, boxY + 6);

    // ── 페이지 번호 (bufferPages 사용) ────────────────────────
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.font(FONT).fontSize(7).fillColor(C.muted)
        .text(
          `탄소이음 온실가스 명세서 ${data.year}년도  |  Page ${i + 1} / ${totalPages}`,
          MARGIN, PAGE_H - 30, { width: CONT_W, align: 'center' }
        );
    }

    doc.end();
  });
}

// ──────────────────────────────────────────────────────────────
// GET 핸들러
// ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) {
    return NextResponse.json({ success: false, error: '인증 필요' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year    = parseInt(searchParams.get('year') || String(new Date().getFullYear() - 1));
  const siteId  = searchParams.get('siteId') || undefined;
  const tenantId = auth.tenantId;

  try {
    // ── 테넌트 ──────────────────────────────────────────────
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, industryType: true },
    });
    if (!tenant) {
      return NextResponse.json({ success: false, error: '테넌트 없음' }, { status: 404 });
    }

    // ── Scope 1 데이터 ────────────────────────────────────
    const scope1Data = await prisma.emissionsData.findMany({
      where: {
        tenantId,
        emissionType: 'scope1',
        period: { gte: `${year}-01`, lte: `${year}-12` },
      },
      select: {
        id: true,
        sourceType: true,
        amount: true,
        unit: true,
        emissionFactor: true,
        calculatedEmission: true,
        period: true,
        calculationMethod: true,
        dataSource: true,
      },
      orderBy: [{ period: 'asc' }],
    });

    // ── Scope 3 데이터 ────────────────────────────────────
    const scope3Data = await prisma.emissionsData.findMany({
      where: {
        tenantId,
        emissionType: 'scope3',
        period: { gte: `${year}-01`, lte: `${year}-12` },
      },
      select: {
        id: true,
        sourceType: true,
        amount: true,
        unit: true,
        emissionFactor: true,
        calculatedEmission: true,
        period: true,
        dataSource: true,
      },
      orderBy: [{ period: 'asc' }],
    });

    // ── Scope 2 (전력) ────────────────────────────────────
    const scope2Total = await EmissionsService.calculateScope2Electricity(
      tenantId, new Date(year, 0, 1), new Date(year, 11, 31), siteId
    );

    const elecFactor = ALL_EMISSION_FACTORS.find(
      (f) => f.category === 'electricity' && f.sourceType === 'grid' && f.version === String(year)
    ) ?? ALL_EMISSION_FACTORS.find(
      (f) => f.category === 'electricity' && f.sourceType === 'grid'
    );

    // ── 이전 연도 비교 ─────────────────────────────────────
    const py = year - 1;
    const [prevS1, prevS2, prevS3] = await Promise.all([
      EmissionsService.calculateScope1Fuel(tenantId, new Date(py, 0, 1), new Date(py, 11, 31)),
      EmissionsService.calculateScope2Electricity(tenantId, new Date(py, 0, 1), new Date(py, 11, 31)),
      EmissionsService.calculateScope3Transport(tenantId, new Date(py, 0, 1), new Date(py, 11, 31)),
    ]);

    const scope1Total = scope1Data.reduce((s, d) => s + parseFloat(d.calculatedEmission.toString()), 0);
    const scope3Total = scope3Data.reduce((s, d) => s + parseFloat(d.calculatedEmission.toString()), 0);
    const grandTotal  = scope1Total + scope2Total + scope3Total;
    const prevTotal   = prevS1 + prevS2 + prevS3;

    // ── 월별 추이 ─────────────────────────────────────────
    const monthlyRaw = await EmissionsService.getMonthlyEmissions(tenantId, year, siteId);
    // 12개 월 보장
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const m = monthlyRaw.find((x) => x.month === i + 1);
      return { month: i + 1, scope1: m?.scope1 ?? 0, scope2: m?.scope2 ?? 0, scope3: m?.scope3 ?? 0, total: m?.total ?? 0 };
    });

    // ── 사용 배출계수 ──────────────────────────────────────
    const usedSourceTypes = new Set([
      ...scope1Data.map((d) => `fuel:${d.sourceType}`),
      ...scope3Data.map((d) => `transport:${d.sourceType}`),
      'electricity:grid',
    ]);

    const factorsUsed = ALL_EMISSION_FACTORS
      .filter((f) => usedSourceTypes.has(`${f.category}:${f.sourceType}`))
      .map((f) => ({
        category: f.category,
        sourceType: f.sourceType,
        factor: f.factor,
        unit: f.unit,
        version: f.version,
        source: f.source,
      }));

    // ── PDF 생성 ───────────────────────────────────────────
    const fontPath = findKoreanFont();
    if (!fontPath) {
      console.warn('[CompliancePDF] 한글 폰트 없음 — public/fonts/NanumGothic.ttf를 배치하세요.');
    }

    const reportData: ReportData = {
      year,
      tenant: { name: tenant.name, industryType: tenant.industryType },
      scope1Total, scope2Total, scope3Total, grandTotal, prevTotal,
      scope1Sources: scope1Data.map((d) => ({
        id: d.id,
        sourceType: d.sourceType,
        period: d.period,
        amount: parseFloat(d.amount.toString()),
        unit: d.unit,
        emissionFactor: parseFloat(d.emissionFactor.toString()),
        calculatedEmission: parseFloat(d.calculatedEmission.toString()),
        calculationMethod: d.calculationMethod,
        dataSource: d.dataSource,
      })),
      scope3Sources: scope3Data.map((d) => ({
        id: d.id,
        sourceType: d.sourceType,
        period: d.period,
        amount: parseFloat(d.amount.toString()),
        unit: d.unit,
        emissionFactor: parseFloat(d.emissionFactor.toString()),
        calculatedEmission: parseFloat(d.calculatedEmission.toString()),
        dataSource: d.dataSource,
      })),
      elecFactor: elecFactor?.factor ?? 0.4593,
      elecFactorVersion: elecFactor?.version ?? '2024',
      monthlyData,
      factorsUsed,
    };

    const pdfBuffer = await generateCompliancePdf(fontPath, reportData);

    const filename = generateDownloadFilename('온실가스명세서', auth.tenantId.slice(0, 8), 'pdf');

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDispositionHeader(filename),
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[CompliancePDF] 오류:', error);
    return NextResponse.json(
      { success: false, error: 'PDF 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
