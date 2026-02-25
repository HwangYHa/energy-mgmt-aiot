/**
 * POST /api/analytics/carbon/invoice
 * 고지서 업로드 또는 수동 입력 → 배출량 자동 계산 저장
 *
 * 지원 방식:
 *   A) 파일 업로드 (multipart/form-data): PDF, JPG, PNG, CSV, XLSX
 *   B) 수동 입력 (JSON): usage + unit + period + utilityType
 *   C) multipart 수동: 파일 없이 usage 파라미터만으로 저장
 *
 * PDF/이미지 파일 → manual_required 응답 (UI에서 수동 입력 폼 표시)
 * CSV → 사용량 자동 파싱
 */
import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { requirePermission } from '@/lib/auth/permissions';
import { successResponse, errorResponse } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';
import { getActiveEngineVersion, findEmissionFactor } from '@/lib/carbon/engine';

export const dynamic = 'force-dynamic';

// ─── 고지서 유형 추론 ───────────────────────────────────────────────

function inferInvoiceType(
  filename: string,
  utilityTypeHint?: string | null,
): 'electricity' | 'gas' | 'unknown' {
  if (utilityTypeHint === 'electricity') return 'electricity';
  if (utilityTypeHint === 'gas') return 'gas';
  const lower = filename.toLowerCase();
  if (
    lower.includes('전기') ||
    lower.includes('electric') ||
    lower.includes('kepco') ||
    lower.includes('한전')
  )
    return 'electricity';
  if (
    lower.includes('가스') ||
    lower.includes('gas') ||
    lower.includes('도시')
  )
    return 'gas';
  return 'unknown';
}

// ─── CSV 파싱 ───────────────────────────────────────────────────────

function parseSimpleCsv(
  text: string,
): { usage: number; unit: string; period: string } | null {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    const cols = line.split(',').map((c) => c.trim().replace(/"/g, ''));
    const usageIdx = cols.findIndex((c) => /사용량|kwh|usage/i.test(c));
    if (usageIdx !== -1) {
      const nextLine = lines[lines.indexOf(line) + 1];
      if (nextLine) {
        const vals = nextLine.split(',').map((c) => c.trim().replace(/"/g, ''));
        const usage = parseFloat((vals[usageIdx] ?? '').replace(/,/g, ''));
        if (!isNaN(usage) && usage > 0) {
          return { usage, unit: 'kWh', period: new Date().toISOString().slice(0, 7) };
        }
      }
    }
    const nums = cols
      .map((c) => parseFloat(c.replace(/,/g, '')))
      .filter((n) => !isNaN(n) && n > 10);
    if (nums.length > 0 && nums[0] !== undefined) {
      return { usage: nums[0], unit: 'kWh', period: new Date().toISOString().slice(0, 7) };
    }
  }
  return null;
}

// ─── 배출량 저장 (공통) ────────────────────────────────────────────

async function saveEmissionsRecord(params: {
  tenantId: string;
  userId: string;
  usage: number;
  unit: string;
  period: string;
  invoiceType: 'electricity' | 'gas' | 'unknown';
  source: string;
  filename?: string;
}) {
  const { tenantId, userId, usage, unit, period, invoiceType, source, filename } = params;
  const normalizedType =
    invoiceType === 'unknown' ? 'electricity' : invoiceType;

  const category = normalizedType === 'gas' ? 'fuel' : 'electricity';
  const sourceType = normalizedType === 'gas' ? 'natural_gas' : 'electricity';
  const scope = normalizedType === 'gas' ? 'scope1' : 'scope2';

  const factor = await findEmissionFactor({
    tenantId,
    category,
    sourceType,
    year: parseInt(period.slice(0, 4)),
    region: 'KR',
  });

  // 기본 배출계수: 전력 0.4567 kgCO₂/kWh, 천연가스 2.176 kgCO₂/m³
  const factorValue = factor
    ? Number(factor.factor)
    : normalizedType === 'gas'
    ? 2.176
    : 0.4567;

  const emissions = (usage * factorValue) / 1000; // tCO₂eq

  const engine = await getActiveEngineVersion();
  const emissionTypeMap: Record<string, 'scope1' | 'scope2' | 'scope3'> = {
    scope1: 'scope1',
    scope2: 'scope2',
    scope3: 'scope3',
  };

  const record = await prisma.emissionsData.create({
    data: {
      tenantId,
      emissionType: emissionTypeMap[scope] ?? 'scope2',
      sourceType,
      amount: usage,
      unit,
      emissionFactor: factorValue,
      calculatedEmission: emissions,
      period,
      calculationMethod: 'manual',
      dataSource: 'MANUAL',
    },
  });

  await prisma.auditLog
    .create({
      data: {
        tenantId,
        userId,
        action: 'INVOICE_UPLOADED',
        resourceType: 'emissions_data',
        resourceId: record.id,
        changes: {
          filename: filename ?? '수동입력',
          invoiceType: normalizedType,
          usage,
          unit,
          period,
          emissions,
          factorValue,
          engineVersion: engine.version,
          source,
        },
      },
    })
    .catch(() => null);

  return {
    recordId: record.id,
    invoiceType: normalizedType,
    usage,
    unit,
    period,
    emissions: Math.round(emissions * 1000) / 1000,
    emissionsUnit: 'tCO₂eq',
    emissionFactor: factorValue,
    scope,
    message: `${period} 배출량 ${Math.round(emissions * 1000) / 1000} tCO₂eq 기록되었습니다.`,
  };
}

// ─── 핸들러 ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED');
  const permErr = requirePermission(auth.role, 'analytics:carbon');
  if (permErr) return permErr;

  const contentType = request.headers.get('content-type') ?? '';

  // ── A) JSON 직접 입력 ─────────────────────────────────────────────
  if (contentType.includes('application/json')) {
    let body: {
      usage?: number;
      unit?: string;
      period?: string;
      utilityType?: string;
    };
    try {
      body = await request.json();
    } catch {
      return errorResponse('VALIDATION_ERROR', {
        details: { message: 'JSON 파싱 오류' },
      });
    }

    const { usage, unit, period, utilityType } = body;
    if (!usage || usage <= 0) {
      return errorResponse('VALIDATION_ERROR', {
        details: { message: '사용량(usage)이 필요합니다 (양수)' },
      });
    }

    const parsedPeriod =
      period && /^\d{4}-\d{2}$/.test(period)
        ? period
        : new Date().toISOString().slice(0, 7);

    const invoiceType = inferInvoiceType('', utilityType);
    const result = await saveEmissionsRecord({
      tenantId: auth.tenantId,
      userId: auth.userId,
      usage,
      unit: unit ?? (invoiceType === 'gas' ? 'm³' : 'kWh'),
      period: parsedPeriod,
      invoiceType,
      source: 'manual_input',
    });

    return successResponse(result, { status: 201 });
  }

  // ── B) multipart/form-data ────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse('VALIDATION_ERROR', {
      details: { message: 'multipart/form-data 파싱 오류' },
    });
  }

  const file = formData.get('file') as File | null;
  const manualUsage = formData.get('usage') as string | null;
  const manualUnit = formData.get('unit') as string | null;
  const manualPeriod = formData.get('period') as string | null;
  const utilityTypeHint = formData.get('utilityType') as string | null;

  // 파일 없이 수동 파라미터만 → 직접 저장
  if (!file) {
    if (!manualUsage) {
      return errorResponse('VALIDATION_ERROR', {
        details: { message: '파일 또는 사용량(usage)이 필요합니다' },
      });
    }
    const usage = parseFloat(manualUsage);
    if (isNaN(usage) || usage <= 0) {
      return errorResponse('VALIDATION_ERROR', {
        details: { message: '유효한 사용량을 입력해주세요 (양수)' },
      });
    }
    const parsedPeriod =
      manualPeriod && /^\d{4}-\d{2}$/.test(manualPeriod)
        ? manualPeriod
        : new Date().toISOString().slice(0, 7);
    const invoiceType = inferInvoiceType('', utilityTypeHint);
    const result = await saveEmissionsRecord({
      tenantId: auth.tenantId,
      userId: auth.userId,
      usage,
      unit: manualUnit ?? (invoiceType === 'gas' ? 'm³' : 'kWh'),
      period: parsedPeriod,
      invoiceType,
      source: 'manual_form',
    });
    return successResponse(result, { status: 201 });
  }

  // ── C) 파일 업로드 처리 ───────────────────────────────────────────
  if (file.size > 10 * 1024 * 1024) {
    return errorResponse('VALIDATION_ERROR', {
      details: { message: '파일 크기는 10MB 이하여야 합니다' },
    });
  }

  const filename = file.name;
  const mimeType = file.type;
  const invoiceType = inferInvoiceType(filename, utilityTypeHint);

  let parsedUsage: number | null = null;
  let parsedUnit = invoiceType === 'gas' ? 'm³' : 'kWh';
  let parsedPeriod = new Date().toISOString().slice(0, 7);

  // CSV/TXT 자동 파싱
  if (
    mimeType === 'text/csv' ||
    filename.endsWith('.csv') ||
    filename.endsWith('.txt')
  ) {
    try {
      const text = await file.text();
      const parsed = parseSimpleCsv(text);
      if (parsed) {
        parsedUsage = parsed.usage;
        parsedUnit = parsed.unit;
        parsedPeriod = parsed.period;
      }
    } catch {
      // 파싱 실패 → 수동 입력 폼으로 fallback
    }
  }

  // 수동 파라미터 우선
  if (manualUsage) {
    parsedUsage = parseFloat(manualUsage);
    parsedUnit = manualUnit ?? parsedUnit;
    if (manualPeriod && /^\d{4}-\d{2}$/.test(manualPeriod)) {
      parsedPeriod = manualPeriod;
    }
  }

  // PDF/이미지 → OCR 미지원: 수동 입력 안내 반환
  if (
    !parsedUsage &&
    (mimeType === 'application/pdf' || mimeType.startsWith('image/'))
  ) {
    return successResponse({
      status: 'manual_required',
      message:
        'PDF/이미지에서 사용량을 자동으로 읽을 수 없습니다. 아래 수동 입력란을 작성해주세요.',
      filename,
      invoiceType,
      suggestedUnit: invoiceType === 'gas' ? 'm³' : 'kWh',
    });
  }

  if (!parsedUsage || parsedUsage <= 0) {
    return errorResponse('VALIDATION_ERROR', {
      details: {
        message:
          '사용량을 파악할 수 없습니다. 직접 입력 탭을 사용하거나 CSV 형식 파일을 업로드해주세요.',
      },
    });
  }

  if (!/^\d{4}-\d{2}$/.test(parsedPeriod)) {
    parsedPeriod = new Date().toISOString().slice(0, 7);
  }

  const result = await saveEmissionsRecord({
    tenantId: auth.tenantId,
    userId: auth.userId,
    usage: parsedUsage,
    unit: parsedUnit,
    period: parsedPeriod,
    invoiceType,
    source: 'file_upload',
    filename,
  });

  return successResponse({ ...result, filename }, { status: 201 });
}
