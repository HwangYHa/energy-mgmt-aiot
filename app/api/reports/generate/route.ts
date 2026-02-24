// app/api/reports/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import ExcelJS from 'exceljs';
import { generateDownloadFilename } from '@/lib/utils/filename';

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
 * PDF 생성 (Puppeteer — 한국어 완전 지원)
 */
async function generatePDF(reportId: string, data: any): Promise<string> {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const os = require('os') as typeof import('os');

  const fileName = generateDownloadFilename('에너지보고서', reportId, 'pdf');
  const filePath = path.join(os.tmpdir(), fileName);

  // 일별 데이터 행 HTML 생성
  const rowsHtml = (data.dailyData && data.dailyData.length > 0)
    ? data.dailyData.map((row: any, i: number) => `
        <tr style="background:${i % 2 === 0 ? '#f8fafc' : '#fff'}">
          <td style="padding:7px 12px;border-bottom:1px solid #e2e8f0;font-size:10pt;color:#334155">
            ${new Date(row.date).toLocaleDateString('ko-KR')}
          </td>
          <td style="padding:7px 12px;border-bottom:1px solid #e2e8f0;font-size:10pt;color:#334155;text-align:right">
            ${parseFloat(row.total_energy || '0').toLocaleString('ko-KR')} kWh
          </td>
        </tr>`).join('')
    : `<tr><td colspan="2" style="padding:12px;text-align:center;color:#94a3b8;font-size:10pt">데이터 없음</td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
    font-size: 11pt;
    color: #1e293b;
    background: #fff;
    padding: 20mm 15mm;
  }
  .header-bar {
    background: linear-gradient(135deg, #1e40af, #0369a1);
    color: #fff;
    padding: 20px 24px;
    border-radius: 8px;
    margin-bottom: 24px;
  }
  .header-bar h1 { font-size: 20pt; font-weight: bold; margin-bottom: 4px; }
  .header-bar p { font-size: 10pt; opacity: 0.85; }
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-bottom: 28px;
  }
  .kpi-card {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 14px 16px;
    background: #f8fafc;
  }
  .kpi-label { font-size: 9pt; color: #64748b; margin-bottom: 4px; }
  .kpi-value { font-size: 16pt; font-weight: bold; color: #1e40af; }
  .kpi-unit { font-size: 10pt; color: #64748b; font-weight: normal; margin-left: 4px; }
  h2 {
    font-size: 14pt;
    color: #0f172a;
    border-left: 4px solid #1e40af;
    padding-left: 10px;
    margin: 24px 0 12px 0;
  }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #1e40af; color: #fff; }
  thead th { padding: 9px 12px; font-size: 10pt; text-align: left; }
  thead th:last-child { text-align: right; }
  .footer {
    margin-top: 32px;
    padding-top: 10px;
    border-top: 1px solid #e2e8f0;
    font-size: 8pt;
    color: #94a3b8;
    display: flex;
    justify-content: space-between;
  }
  @page { margin: 15mm; }
</style>
</head>
<body>
  <div class="header-bar">
    <h1>에너지 사용 리포트</h1>
    <p>분석 기간: ${data.period}</p>
    <p>생성일시: ${new Date().toLocaleString('ko-KR')}</p>
  </div>

  <h2>요약 (Summary)</h2>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">총 에너지 사용량</div>
      <div class="kpi-value">${Number(data.summary.totalEnergy).toLocaleString('ko-KR')}<span class="kpi-unit">kWh</span></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">피크 전력</div>
      <div class="kpi-value">${Number(data.summary.peakPower).toLocaleString('ko-KR')}<span class="kpi-unit">kW</span></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">평균 전력</div>
      <div class="kpi-value">${Number(data.summary.avgPower).toLocaleString('ko-KR')}<span class="kpi-unit">kW</span></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">예상 전기요금</div>
      <div class="kpi-value">${Number(data.summary.estimatedCost).toLocaleString('ko-KR')}<span class="kpi-unit">원</span></div>
    </div>
  </div>

  <h2>일별 사용량 (Daily Usage)</h2>
  <table>
    <thead>
      <tr>
        <th>날짜</th>
        <th style="text-align:right">사용량 (kWh)</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>

  <div class="footer">
    <span>탄소이음 | 에너지 데이터로 세상을 잇다</span>
    <span>© 2026 탄소이음. All rights reserved.</span>
  </div>
</body>
</html>`;

  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });
    fs.writeFileSync(filePath, pdfBuffer);
  } finally {
    await browser.close();
  }

  return `/api/reports/download/${fileName}`;
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
  const filePath = `/tmp/${fileName}`;
  
  await workbook.xlsx.writeFile(filePath);

  return `/api/reports/download/${fileName}`;
}