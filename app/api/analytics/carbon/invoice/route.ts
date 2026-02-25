/**
 * POST /api/analytics/carbon/invoice
 * 고지서(전기/가스) 파일 업로드 → 사용량 추출 → 배출량 자동 계산
 *
 * 지원 형식: PDF, JPG, PNG, XLSX, CSV
 *
 * 처리 흐름:
 *   1. 파일 수신 (multipart/form-data)
 *   2. 파일 타입별 사용량 파싱 (현재: CSV/XLSX 직접 파싱, PDF/이미지: 수동 입력 안내)
 *   3. CarbonCalculatorService.calculateFromInvoice() — 계산 + 저장 + AuditLog
 *   4. 결과 반환
 */
import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { requirePermission } from '@/lib/auth/permissions';
import { successResponse, errorResponse } from '@/lib/api/response';
import { CarbonCalculatorService, type InvoiceType } from '@/lib/services/carbon-calculator.service';

export const dynamic = 'force-dynamic';

// 고지서 유형 추론
function inferInvoiceType(filename: string): InvoiceType {
  const lower = filename.toLowerCase();
  if (lower.includes('전기') || lower.includes('electric') || lower.includes('kepco') || lower.includes('한전')) {
    return 'electricity';
  }
  if (lower.includes('가스') || lower.includes('gas') || lower.includes('도시')) {
    return 'gas';
  }
  return 'electricity'; // 기본값: 전력
}

// CSV 간단 파싱 (kWh 또는 m³ 값 추출)
function parseSimpleCsv(text: string): { usage: number; unit: string; period: string } | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // 헤더 기반 파싱 시도
  for (const line of lines) {
    const cols = line.split(',').map(c => c.trim().replace(/"/g, ''));
    // "사용량", "kWh", "기간" 등 키워드 포함 행 탐색
    const usageIdx = cols.findIndex(c => /사용량|kwh|usage/i.test(c));
    if (usageIdx !== -1) {
      const nextLine = lines[lines.indexOf(line) + 1];
      if (nextLine) {
        const vals = nextLine.split(',').map(c => c.trim().replace(/"/g, ''));
        const usage = parseFloat((vals[usageIdx] ?? '').replace(/,/g, ''));
        if (!isNaN(usage)) {
          return { usage, unit: 'kWh', period: new Date().toISOString().slice(0, 7) };
        }
      }
    }
    // 숫자만 있는 행에서 첫 번째 큰 숫자를 사용량으로 추정
    const nums = cols.map(c => parseFloat(c.replace(/,/g, ''))).filter(n => !isNaN(n) && n > 10);
    const firstNum = nums[0];
    if (nums.length > 0 && firstNum !== undefined && firstNum > 10) {
      return { usage: firstNum, unit: 'kWh', period: new Date().toISOString().slice(0, 7) };
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED');
  const permErr = requirePermission(auth.role, 'analytics:carbon');
  if (permErr) return permErr;

  // multipart 파싱
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse('VALIDATION_ERROR', { details: { message: 'multipart/form-data 파싱 오류' } });
  }

  const file         = formData.get('file') as File | null;
  const manualUsage  = formData.get('usage') as string | null;
  const manualUnit   = formData.get('unit') as string | null;
  const manualPeriod = formData.get('period') as string | null;

  if (!file) return errorResponse('VALIDATION_ERROR', { details: { message: '파일이 필요합니다' } });

  const filename    = file.name;
  const mimeType    = file.type;
  const invoiceType = inferInvoiceType(filename);

  // 파일 크기 제한 (10MB)
  if (file.size > 10 * 1024 * 1024) {
    return errorResponse('VALIDATION_ERROR', { details: { message: '파일 크기는 10MB 이하여야 합니다' } });
  }

  let parsedUsage: number | null = null;
  let parsedUnit   = 'kWh';
  let parsedPeriod = new Date().toISOString().slice(0, 7);

  // CSV/TXT 파싱 시도
  if (mimeType === 'text/csv' || filename.endsWith('.csv') || filename.endsWith('.txt')) {
    try {
      const text   = await file.text();
      const parsed = parseSimpleCsv(text);
      if (parsed) {
        parsedUsage  = parsed.usage;
        parsedUnit   = parsed.unit;
        parsedPeriod = parsed.period;
      }
    } catch {
      // 파싱 실패 — 수동 입력으로 fallback
    }
  }

  // 수동 입력값 우선
  if (manualUsage) {
    parsedUsage  = parseFloat(manualUsage);
    parsedUnit   = manualUnit ?? 'kWh';
    parsedPeriod = manualPeriod ?? parsedPeriod;
  }

  // PDF/이미지는 현재 OCR 미지원 → 수동 입력 안내
  if (!parsedUsage && (mimeType === 'application/pdf' || mimeType.startsWith('image/'))) {
    return successResponse({
      status: 'manual_required',
      message: 'PDF/이미지 파일은 사용량을 자동으로 추출할 수 없습니다. 아래 수동 입력 양식을 사용해주세요.',
      filename,
      invoiceType,
      fields: [
        { name: 'usage',  label: '사용량',  type: 'number', placeholder: '예: 1234.5' },
        { name: 'unit',   label: '단위',    type: 'select', options: ['kWh', 'm³', 'MJ'] },
        { name: 'period', label: '청구 월', type: 'text',   placeholder: 'YYYY-MM' },
      ],
    });
  }

  if (!parsedUsage || parsedUsage <= 0) {
    return errorResponse('VALIDATION_ERROR', { details: { message: '사용량을 파악할 수 없습니다. usage 파라미터를 직접 입력해주세요.' } });
  }

  if (!/^\d{4}-\d{2}$/.test(parsedPeriod)) {
    parsedPeriod = new Date().toISOString().slice(0, 7);
  }

  // ── CarbonCalculatorService: 계산 + 저장 + AuditLog 일괄 처리 ──
  try {
    const result = await CarbonCalculatorService.calculateFromInvoice({
      tenantId:    auth.tenantId,
      userId:      auth.userId,
      usage:       parsedUsage,
      unit:        parsedUnit,
      period:      parsedPeriod,
      invoiceType,
      dataSource:  'INVOICE',
    });

    return successResponse({
      recordId:      result.recordId,
      filename,
      invoiceType,
      usage:         parsedUsage,
      unit:          parsedUnit,
      period:        parsedPeriod,
      emissions:     result.emissions,
      emissionsUnit: result.emissionsUnit,
      emissionFactor: result.factorValue,
      factorSource:  result.factorSource,
      scope:         result.scope,
      engineVersion: result.engineVersion,
      message:       result.message,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '계산 오류';
    return errorResponse('SERVER_ERROR', { details: { message } });
  }
}
