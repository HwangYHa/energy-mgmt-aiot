// app/api/reports/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyAuth } from '@/lib/auth/verify';
import PDFDocument from 'pdfkit';
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
 * PDF 생성 (PDFKit - Chrome 불필요)
 */
async function generatePDF(reportId: string, data: any): Promise<string> {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const fileName = generateDownloadFilename('에너지보고서', reportId, 'pdf');
    const filePath = path.join(os.tmpdir(), fileName);
    const writeStream = fs.createWriteStream(filePath);

    doc.pipe(writeStream);

    // 헤더
    doc.fontSize(24).fillColor('#1e40af').text('Energy Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#6b7280').text(`Period: ${data.period}`, { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(9).text(`Generated: ${new Date().toLocaleString('ko-KR')}`, { align: 'center' });

    // 구분선
    doc.moveDown(1);
    doc.strokeColor('#1e40af').lineWidth(2)
      .moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(1);

    // 요약 섹션
    doc.fontSize(16).fillColor('#1e40af').text('Summary');
    doc.moveDown(0.5);

    const summaryItems = [
      ['Total Energy', `${Number(data.summary.totalEnergy).toLocaleString()} kWh`],
      ['Peak Power', `${Number(data.summary.peakPower).toLocaleString()} kW`],
      ['Avg Power', `${Number(data.summary.avgPower).toLocaleString()} kW`],
      ['Est. Cost', `KRW ${Number(data.summary.estimatedCost).toLocaleString()}`],
    ];

    summaryItems.forEach(([label, value]) => {
      const y = doc.y;
      doc.fontSize(10).fillColor('#6b7280').text(String(label), 50, y);
      doc.fontSize(12).fillColor('#1e40af').text(String(value), 300, y, { align: 'right', width: 245 });
      doc.moveDown(0.3);
      doc.strokeColor('#e5e7eb').lineWidth(0.5)
        .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);
    });

    // 일별 사용량 테이블
    doc.moveDown(1);
    doc.fontSize(16).fillColor('#1e40af').text('Daily Usage');
    doc.moveDown(0.5);

    // 테이블 헤더
    const tableTop = doc.y;
    doc.rect(50, tableTop, 495, 22).fill('#1e40af');
    doc.fontSize(10).fillColor('#ffffff')
      .text('Date', 60, tableTop + 6)
      .text('Usage (kWh)', 300, tableTop + 6, { align: 'right', width: 235 });
    doc.moveDown(0.3);

    let currentY = tableTop + 22;

    if (data.dailyData && data.dailyData.length > 0) {
      data.dailyData.forEach((row: any, index: number) => {
        if (currentY > 720) {
          doc.addPage();
          currentY = 40;
        }

        const bgColor = index % 2 === 0 ? '#f9fafb' : '#ffffff';
        doc.rect(50, currentY, 495, 20).fill(bgColor);
        doc.fontSize(9).fillColor('#333333')
          .text(new Date(row.date).toLocaleDateString('ko-KR'), 60, currentY + 5)
          .text(parseFloat(row.total_energy || '0').toLocaleString(), 300, currentY + 5, { align: 'right', width: 235 });
        currentY += 20;
      });
    } else {
      doc.rect(50, currentY, 495, 20).fill('#f9fafb');
      doc.fontSize(9).fillColor('#6b7280').text('No data available', 60, currentY + 5);
      currentY += 20;
    }

    // 푸터
    doc.moveDown(3);
    doc.fontSize(8).fillColor('#9ca3af').text(
      '(c) 2026 EnergyAI Platform. All rights reserved.',
      { align: 'center' }
    );

    doc.end();

    writeStream.on('finish', () => resolve(`/api/reports/download/${fileName}`));
    writeStream.on('error', reject);
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
  const filePath = `/tmp/${fileName}`;
  
  await workbook.xlsx.writeFile(filePath);

  return `/api/reports/download/${fileName}`;
}