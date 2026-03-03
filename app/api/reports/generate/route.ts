// app/api/reports/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import ExcelJS from 'exceljs';
import { logActivity, MENU_CODES, ACTION_TYPES } from '@/lib/services/activity-log.service';
import { generateDownloadFilename } from '@/lib/utils/filename';
import path from 'path';
import fs from 'fs';
import os from 'os';

// ── 한글 폰트 탐색 ──────────────────────────────────────────────
const FONT_CANDIDATES = [
  path.join(process.cwd(), 'public/fonts/NanumGothic.ttf'),
  'C:\\Windows\\Fonts\\malgun.ttf',
  'C:\\Windows\\Fonts\\NanumGothic.ttf',
  '/usr/share/fonts/truetype/nanum/NanumGothic.ttf',
  '/usr/share/fonts/nanum/NanumGothic.ttf',
  '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
  '/System/Library/Fonts/AppleSDGothicNeo.ttc',
];

function findKoreanFont(): string | null {
  for (const p of FONT_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * 리포트 생성 API
 *
 * 역할:
 * - 일일/주간/월간 리포트 생성
 * - PDF 생성 (PDFKit - 순수 JS, Chrome 불필요)
 * - Excel 생성 (ExcelJS)
 */

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, period, startDate, endDate, siteId, format } = body;

    // 날짜 유효성 검증
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const daysDiff = (endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff < 0) {
      return NextResponse.json({ error: 'startDate must be before endDate' }, { status: 400 });
    }
    if (daysDiff > 365) {
      return NextResponse.json({ error: '조회 기간은 최대 365일입니다' }, { status: 400 });
    }

    // siteId 테넌트 소유권 검증 (다른 테넌트의 siteId로 데이터 조회 방지)
    if (siteId) {
      const site = await prisma.site.findFirst({
        where: { id: siteId, tenantId: auth.tenantId, deletedAt: null },
      });
      if (!site) {
        return NextResponse.json({ error: '유효하지 않은 사이트입니다' }, { status: 400 });
      }
    }

    // 리포트 데이터 생성
    const reportData = await generateReportData({
      tenantId: auth.tenantId,
      type,
      period,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      siteId,
    });

    // 리포트 DB 저장
    const report = await prisma.report.create({
      data: {
        tenantId: auth.tenantId,
        type,
        period,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        siteId,
        generatedBy: auth.userId,
        data: reportData as any,
      },
    });

    // 포맷별 생성
    let fileUrl: string;
    
    if (format === 'pdf') {
      fileUrl = await generatePDF(report.id, reportData);
    } else if (format === 'excel') {
      fileUrl = await generateExcel(report.id, reportData);
    } else {
      throw new Error('Invalid format');
    }

    // 리포트 업데이트
    await prisma.report.update({
      where: { id: report.id },
      data: { fileUrl },
    });

    // 활동 이력 기록 (fire-and-forget)
    logActivity({
      tenantId: auth.tenantId,
      menuCode: MENU_CODES.REPORT_GEN,
      actionType: ACTION_TYPES.GENERATE,
      actionLabel: '보고서 생성',
      resourceType: 'report',
      resourceId: report.id,
      resourceName: `${type} ${period} 보고서 (${format.toUpperCase()})`,
      afterData: { type, period, format, startDate, endDate, siteId },
      metadata: { fileUrl },
      userId: auth.userId,
      userEmail: auth.email,
      userRole: auth.role,
      request,
    });

    return NextResponse.json({
      reportId: report.id,
      fileUrl,
      message: 'Report generated successfully',
    });

  } catch (error) {
    console.error('Report generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}

/**
 * 리포트 데이터 생성
 */
async function generateReportData(params: {
  tenantId: string;
  type: string;
  period: string;
  startDate: Date;
  endDate: Date;
  siteId?: string;
}) {
  const { tenantId, type: _type, period: _period, startDate, endDate, siteId } = params;

  // 에너지 사용량 (실제 DB 컬럼명 사용: time, tenant_id, metric_id)
  const energyQuery = `
    SELECT
      DATE(m.time) as date,
      SUM(CAST(m.value AS DECIMAL(10,2))) as total_energy
    FROM measurement m
    JOIN metric mt ON m.metric_id = mt.id
    ${siteId ? 'JOIN device d ON mt.device_id = d.id' : ''}
    WHERE m.tenant_id = ?
      AND mt.\`key\` = 'energy'
      AND m.time BETWEEN ? AND ?
      ${siteId ? 'AND d.site_id = ?' : ''}
    GROUP BY DATE(m.time)
    ORDER BY date ASC
  `;

  const params_array: (string | Date)[] = [tenantId, startDate, endDate];
  if (siteId) params_array.push(siteId);

  let energyData: any[];
  try {
    energyData = await prisma.$queryRawUnsafe(energyQuery, ...params_array) as any[];
  } catch {
    energyData = [];
  }

  // 피크 전력
  const peakQuery = `
    SELECT
      MAX(CAST(m.value AS DECIMAL(10,2))) as peak_power,
      AVG(CAST(m.value AS DECIMAL(10,2))) as avg_power
    FROM measurement m
    JOIN metric mt ON m.metric_id = mt.id
    ${siteId ? 'JOIN device d ON mt.device_id = d.id' : ''}
    WHERE m.tenant_id = ?
      AND mt.\`key\` = 'power'
      AND m.time BETWEEN ? AND ?
      ${siteId ? 'AND d.site_id = ?' : ''}
  `;

  let peakData: any[];
  try {
    peakData = await prisma.$queryRawUnsafe(peakQuery, ...params_array) as any[];
  } catch {
    peakData = [{ peak_power: 0, avg_power: 0 }];
  }

  // 비용 계산 (간단 버전)
  const totalEnergy = energyData.reduce((sum, row) => sum + parseFloat(row.total_energy || '0'), 0);
  const estimatedCost = totalEnergy * 120; // 평균 단가 120원/kWh

  return {
    period: `${startDate.toLocaleDateString()} ~ ${endDate.toLocaleDateString()}`,
    summary: {
      totalEnergy: Math.round(totalEnergy * 10) / 10,
      peakPower: peakData[0]?.peak_power || 0,
      avgPower: peakData[0]?.avg_power || 0,
      estimatedCost,
    },
    dailyData: energyData,
    alerts: {} as Record<string, number>,
  };
}

/**
 * PDF 생성 (PDFKit — 순수 JS, Chrome 불필요, 한국어 지원)
 */
async function generatePDF(reportId: string, data: any): Promise<string> {
  const fileName = generateDownloadFilename('에너지보고서', reportId, 'pdf');
  const filePath = path.join(os.tmpdir(), fileName);

  const pdfBuffer = await generateReportPdfBuffer(data);
  fs.writeFileSync(filePath, pdfBuffer);

  return `/api/reports/download/${encodeURIComponent(fileName)}`;
}

/**
 * PDFKit으로 에너지 리포트 버퍼 생성
 */
function generateReportPdfBuffer(data: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfkitMod = require('pdfkit');
    const PDFDocument: typeof import('pdfkit') = pdfkitMod.default ?? pdfkitMod;

    const fontPath = findKoreanFont();
    const MARGIN = 50;
    const PAGE_W = 595.28;
    const CONTENT_W = PAGE_W - MARGIN * 2;
    const PRIMARY = '#1e40af';
    const MUTED = '#64748b';
    const TEXT = '#1e293b';
    const BORDER = '#e2e8f0';
    const BG_ALT = '#f8fafc';

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: MARGIN + 20, left: MARGIN, right: MARGIN },
      info: {
        Title: '에너지 사용 리포트',
        Author: '탄소이음',
        Subject: '에너지 관리 분석 보고서',
      },
    });

    const FONT = 'Body';
    const BOLD = 'Bold';
    if (fontPath) {
      doc.registerFont(FONT, fontPath);
      doc.registerFont(BOLD, fontPath);
    } else {
      doc.registerFont(FONT, 'Helvetica');
      doc.registerFont(BOLD, 'Helvetica-Bold');
    }

    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── 헤더 바 ────────────────────────────────────────────────
    doc.rect(MARGIN, MARGIN, CONTENT_W, 70).fill(PRIMARY);
    doc.font(BOLD).fontSize(18).fillColor('#ffffff')
      .text('에너지 사용 리포트', MARGIN + 16, MARGIN + 12, { width: CONTENT_W - 32 });
    doc.font(FONT).fontSize(9).fillColor('rgba(255,255,255,0.85)')
      .text(`분석 기간: ${data.period}`, MARGIN + 16, MARGIN + 38, { width: CONTENT_W - 32 });
    doc.font(FONT).fontSize(8).fillColor('rgba(255,255,255,0.7)')
      .text(`생성일시: ${new Date().toLocaleString('ko-KR')}`, MARGIN + 16, MARGIN + 54, { width: CONTENT_W - 32 });

    doc.y = MARGIN + 82;

    // ── 요약 섹션 제목 ───────────────────────────────────────
    doc.rect(MARGIN, doc.y, 4, 18).fill(PRIMARY);
    doc.font(BOLD).fontSize(13).fillColor(TEXT)
      .text('요약 (Summary)', MARGIN + 10, doc.y, { width: CONTENT_W });
    doc.moveDown(0.8);

    // ── KPI 카드 (2×2 그리드) ────────────────────────────────
    const kpiItems = [
      { label: '총 에너지 사용량', value: `${Number(data.summary.totalEnergy).toLocaleString('ko-KR')} kWh` },
      { label: '피크 전력', value: `${Number(data.summary.peakPower).toLocaleString('ko-KR')} kW` },
      { label: '평균 전력', value: `${Number(data.summary.avgPower).toLocaleString('ko-KR')} kW` },
      { label: '예상 전기요금', value: `₩${Number(data.summary.estimatedCost).toLocaleString('ko-KR')}` },
    ];

    const cardW = (CONTENT_W - 12) / 2;
    const cardH = 56;
    const startY = doc.y;

    kpiItems.forEach((item, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = MARGIN + col * (cardW + 12);
      const y = startY + row * (cardH + 8);

      doc.rect(x, y, cardW, cardH).fill(BG_ALT);
      doc.rect(x, y, cardW, cardH).strokeColor(BORDER).lineWidth(1).stroke();
      doc.font(FONT).fontSize(8).fillColor(MUTED)
        .text(item.label, x + 10, y + 10, { width: cardW - 20 });
      doc.font(BOLD).fontSize(14).fillColor(PRIMARY)
        .text(item.value, x + 10, y + 26, { width: cardW - 20 });
    });

    doc.y = startY + 2 * (cardH + 8) + 16;

    // ── 구분선 ────────────────────────────────────────────────
    doc.moveTo(MARGIN, doc.y).lineTo(PAGE_W - MARGIN, doc.y)
      .strokeColor(BORDER).lineWidth(1).stroke();
    doc.moveDown(0.8);

    // ── 일별 사용량 섹션 ─────────────────────────────────────
    doc.rect(MARGIN, doc.y, 4, 18).fill(PRIMARY);
    doc.font(BOLD).fontSize(13).fillColor(TEXT)
      .text('일별 사용량 (Daily Usage)', MARGIN + 10, doc.y, { width: CONTENT_W });
    doc.moveDown(0.6);

    // 테이블 헤더
    const tableStartY = doc.y;
    const col1W = CONTENT_W * 0.55;
    const col2W = CONTENT_W * 0.45;

    doc.rect(MARGIN, tableStartY, CONTENT_W, 22).fill(PRIMARY);
    doc.font(BOLD).fontSize(9).fillColor('#ffffff')
      .text('날짜', MARGIN + 8, tableStartY + 6, { width: col1W });
    doc.font(BOLD).fontSize(9).fillColor('#ffffff')
      .text('사용량 (kWh)', MARGIN + col1W, tableStartY + 6, { width: col2W, align: 'right' });

    let rowY = tableStartY + 22;

    const rows: any[] = data.dailyData && data.dailyData.length > 0
      ? data.dailyData.slice(0, 25)
      : [];

    if (rows.length === 0) {
      doc.rect(MARGIN, rowY, CONTENT_W, 22).fill(BG_ALT);
      doc.font(FONT).fontSize(9).fillColor(MUTED)
        .text('데이터 없음', MARGIN, rowY + 6, { width: CONTENT_W, align: 'center' });
      rowY += 22;
    } else {
      rows.forEach((row: any, i: number) => {
        if (rowY > 740) {
          doc.addPage();
          rowY = MARGIN;
        }
        if (i % 2 === 0) {
          doc.rect(MARGIN, rowY, CONTENT_W, 20).fill(BG_ALT);
        }
        doc.rect(MARGIN, rowY, CONTENT_W, 20).strokeColor(BORDER).lineWidth(0.5).stroke();
        doc.font(FONT).fontSize(9).fillColor(TEXT)
          .text(new Date(row.date).toLocaleDateString('ko-KR'), MARGIN + 8, rowY + 5, { width: col1W });
        doc.font(FONT).fontSize(9).fillColor(TEXT)
          .text(parseFloat(row.total_energy || '0').toLocaleString('ko-KR'), MARGIN + col1W, rowY + 5, { width: col2W - 8, align: 'right' });
        rowY += 20;
      });
    }

    doc.y = rowY + 16;

    // ── 푸터 ─────────────────────────────────────────────────
    doc.moveTo(MARGIN, doc.y).lineTo(PAGE_W - MARGIN, doc.y)
      .strokeColor(BORDER).lineWidth(1).stroke();
    doc.moveDown(0.4);
    doc.font(FONT).fontSize(8).fillColor(MUTED)
      .text('탄소이음 | 에너지 데이터로 세상을 잇다', MARGIN, doc.y, {
        width: CONTENT_W / 2,
        align: 'left',
        continued: true,
      })
      .text('© 2026 탄소이음. All rights reserved.', {
        width: CONTENT_W / 2,
        align: 'right',
      });

    doc.end();
  });
}

/**
 * Excel 생성
 */
async function generateExcel(reportId: string, data: any): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  
  workbook.creator = 'EMS System';
  workbook.created = new Date();

  // 요약 시트
  const summarySheet = workbook.addWorksheet('요약');
  
  summarySheet.columns = [
    { header: '항목', key: 'item', width: 30 },
    { header: '값', key: 'value', width: 20 },
  ];

  summarySheet.addRows([
    { item: '기간', value: data.period },
    { item: '총 에너지 사용량 (kWh)', value: data.summary.totalEnergy },
    { item: '피크 전력 (kW)', value: data.summary.peakPower },
    { item: '평균 전력 (kW)', value: data.summary.avgPower },
    { item: '예상 비용 (원)', value: data.summary.estimatedCost },
  ]);

  // 헤더 스타일
  summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  summarySheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E40AF' },
  };

  // 일별 데이터 시트
  const dailySheet = workbook.addWorksheet('일별 사용량');
  
  dailySheet.columns = [
    { header: '날짜', key: 'date', width: 15 },
    { header: '사용량 (kWh)', key: 'energy', width: 20 },
  ];

  data.dailyData.forEach((row: any) => {
    dailySheet.addRow({
      date: new Date(row.date).toLocaleDateString(),
      energy: parseFloat(row.total_energy),
    });
  });

  dailySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  dailySheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E40AF' },
  };

  // 파일 저장
  const fileName = generateDownloadFilename('에너지보고서', reportId, 'xlsx');
  const filePath = path.join(os.tmpdir(), fileName);

  await workbook.xlsx.writeFile(filePath);

  return `/api/reports/download/${encodeURIComponent(fileName)}`;
}