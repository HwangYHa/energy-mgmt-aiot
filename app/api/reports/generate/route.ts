// app/api/reports/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getServerSession } from 'next-auth';
import puppeteer from 'puppeteer';
import ExcelJS from 'exceljs';

/**
 * 📄 리포트 생성 API
 * 
 * 역할:
 * - 일일/주간/월간 리포트 생성
 * - PDF 생성 (Puppeteer)
 * - Excel 생성 (ExcelJS)
 */

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, period, startDate, endDate, siteId, format } = body;

    // 리포트 데이터 생성
    const reportData = await generateReportData({
      tenantId: session.user.tenantId,
      type,
      period,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      siteId,
    });

    // 리포트 DB 저장
    const report = await prisma.report.create({
      data: {
        tenantId: session.user.tenantId,
        type,
        period,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        siteId,
        generatedBy: session.user.id,
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
  const { tenantId, type, period, startDate, endDate, siteId } = params;

  // 에너지 사용량
  const energyQuery = `
    SELECT 
      DATE(timestamp) as date,
      SUM(CAST(value AS DECIMAL(10,2))) as total_energy
    FROM measurement m
    JOIN metric mt ON m.metricId = mt.id
    WHERE m.tenantId = ?
      AND mt.key = 'energy'
      AND m.timestamp BETWEEN ? AND ?
      ${siteId ? 'AND mt.siteId = ?' : ''}
    GROUP BY date
    ORDER BY date ASC
  `;

  const params_array = [tenantId, startDate, endDate];
  if (siteId) params_array.push(siteId);

  const energyData = await prisma.$queryRawUnsafe(energyQuery, ...params_array);

  // 피크 전력
  const peakQuery = `
    SELECT 
      MAX(CAST(value AS DECIMAL(10,2))) as peak_power,
      AVG(CAST(value AS DECIMAL(10,2))) as avg_power
    FROM measurement m
    JOIN metric mt ON m.metricId = mt.id
    WHERE m.tenantId = ?
      AND mt.key = 'power'
      AND m.timestamp BETWEEN ? AND ?
      ${siteId ? 'AND mt.siteId = ?' : ''}
  `;

  const peakData = await prisma.$queryRawUnsafe(peakQuery, ...params_array);

  // 비용 계산 (간단 버전)
  const totalEnergy = (energyData as any[]).reduce((sum, row) => sum + parseFloat(row.total_energy), 0);
  const estimatedCost = totalEnergy * 120; // 평균 단가 120원/kWh

  // 알람 통계
  const alerts = await prisma.alertEvent.groupBy({
    by: ['severity'],
    where: {
      tenantId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    _count: {
      id: true,
    },
  });

  return {
    period: `${startDate.toLocaleDateString()} ~ ${endDate.toLocaleDateString()}`,
    summary: {
      totalEnergy: Math.round(totalEnergy * 10) / 10,
      peakPower: (peakData as any)[0]?.peak_power || 0,
      avgPower: (peakData as any)[0]?.avg_power || 0,
      estimatedCost,
    },
    dailyData: energyData,
    alerts: alerts.reduce((acc, alert) => {
      acc[alert.severity] = alert._count.id;
      return acc;
    }, {} as Record<string, number>),
  };
}

/**
 * PDF 생성
 */
async function generatePDF(reportId: string, data: any): Promise<string> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // HTML 템플릿
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: 'Noto Sans KR', Arial, sans-serif;
          padding: 40px;
          color: #333;
        }
        h1 {
          color: #1e40af;
          border-bottom: 3px solid #1e40af;
          padding-bottom: 10px;
        }
        .summary {
          background-color: #f3f4f6;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .summary-item {
          display: flex;
          justify-content: space-between;
          margin: 10px 0;
          padding: 10px;
          background-color: white;
          border-radius: 4px;
        }
        .label {
          font-weight: bold;
          color: #6b7280;
        }
        .value {
          font-size: 1.2em;
          color: #1e40af;
          font-weight: bold;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        th, td {
          border: 1px solid #e5e7eb;
          padding: 12px;
          text-align: left;
        }
        th {
          background-color: #1e40af;
          color: white;
        }
        tr:nth-child(even) {
          background-color: #f9fafb;
        }
      </style>
    </head>
    <body>
      <h1>⚡ 에너지 리포트</h1>
      <p><strong>기간:</strong> ${data.period}</p>
      
      <div class="summary">
        <h2>요약</h2>
        <div class="summary-item">
          <span class="label">총 에너지 사용량</span>
          <span class="value">${data.summary.totalEnergy.toLocaleString()} kWh</span>
        </div>
        <div class="summary-item">
          <span class="label">피크 전력</span>
          <span class="value">${data.summary.peakPower.toLocaleString()} kW</span>
        </div>
        <div class="summary-item">
          <span class="label">평균 전력</span>
          <span class="value">${data.summary.avgPower.toLocaleString()} kW</span>
        </div>
        <div class="summary-item">
          <span class="label">예상 비용</span>
          <span class="value">₩${data.summary.estimatedCost.toLocaleString()}</span>
        </div>
      </div>

      <h2>일별 사용량</h2>
      <table>
        <thead>
          <tr>
            <th>날짜</th>
            <th>사용량 (kWh)</th>
          </tr>
        </thead>
        <tbody>
          ${data.dailyData.map((row: any) => `
            <tr>
              <td>${new Date(row.date).toLocaleDateString()}</td>
              <td>${parseFloat(row.total_energy).toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h2>알람 통계</h2>
      <table>
        <thead>
          <tr>
            <th>심각도</th>
            <th>건수</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(data.alerts).map(([severity, count]) => `
            <tr>
              <td>${severity}</td>
              <td>${count}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <footer style="margin-top: 40px; text-align: center; color: #6b7280; font-size: 0.9em;">
        <p>© 2026 Energy Management System</p>
      </footer>
    </body>
    </html>
  `;

  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20px',
      bottom: '20px',
      left: '20px',
      right: '20px',
    },
  });

  await browser.close();

  // 파일 저장 (실제로는 S3/CDN 업로드)
  const fileName = `report-${reportId}.pdf`;
  const filePath = `/tmp/${fileName}`;
  
  const fs = require('fs');
  fs.writeFileSync(filePath, pdfBuffer);

  // 임시로 로컬 URL 반환 (실제로는 S3 URL)
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
  const fileName = `report-${reportId}.xlsx`;
  const filePath = `/tmp/${fileName}`;
  
  await workbook.xlsx.writeFile(filePath);

  return `/api/reports/download/${fileName}`;
}