/**
 * POST /api/analytics/carbon/invoice
 * 고지서(전기/가스) 파일 업로드 → 사용량 추출 → 배출량 자동 계산
 *
 * 지원 형식: PDF, JPG, PNG, XLSX, CSV, TXT
 *
 * 처리 흐름:
 *   1. 파일 수신 (multipart/form-data)
 *   2. 파일 타입별 사용량 파싱
 *      - CSV/TXT : 한국 공공 고지서 패턴 기반 정규식 파싱
 *      - XLSX    : exceljs로 셀 탐색 → 사용량/기간 추출
 *      - PDF/이미지: ANTHROPIC_API_KEY 설정 시 Claude Vision → 없으면 수동 입력 안내
 *   3. CarbonCalculatorService.calculateFromInvoice() — 계산 + 저장 + AuditLog
 *   4. 결과 반환
 */
import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { requirePermission } from '@/lib/auth/permissions';
import { successResponse, errorResponse } from '@/lib/api/response';
import { CarbonCalculatorService, type InvoiceType } from '@/lib/services/carbon-calculator.service';

export const dynamic = 'force-dynamic';

// ─── 고지서 유형 추론 ────────────────────────────────────────────────────────

function inferInvoiceType(filename: string, text?: string): InvoiceType {
  const lower = filename.toLowerCase();
  if (lower.includes('전기') || lower.includes('electric') || lower.includes('kepco') || lower.includes('한전')) {
    return 'electricity';
  }
  if (lower.includes('가스') || lower.includes('gas') || lower.includes('도시')) {
    return 'gas';
  }
  // 파일 내용 기반 보조 판별
  if (text) {
    const t = text.slice(0, 2000);
    if (/한국전력|전력량|kWh|kepco/i.test(t)) return 'electricity';
    if (/도시가스|가스사용량|m³|MJ|열량/i.test(t))  return 'gas';
  }
  return 'electricity';
}

// ─── 기간 추출 헬퍼 ──────────────────────────────────────────────────────────

function extractPeriod(text: string): string {
  // YYYY-MM, YYYY년 MM월, YYYYMM 순서로 탐색
  const patterns = [
    /(\d{4})-(\d{2})/,
    /(\d{4})년\s*(\d{1,2})월/,
    /청구월\s*[:：]?\s*(\d{4})[-.]?(\d{2})/,
    /사용기간.*?(\d{4})[-.](\d{2})/,
    /(\d{4})(\d{2})\b/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1] && m[2]) {
      const year  = m[1];
      const month = m[2].padStart(2, '0');
      const y = parseInt(year, 10);
      const mo = parseInt(month, 10);
      if (y >= 2000 && y <= 2099 && mo >= 1 && mo <= 12) {
        return `${year}-${month}`;
      }
    }
  }
  return new Date().toISOString().slice(0, 7);
}

// ─── 단위 추출 헬퍼 ──────────────────────────────────────────────────────────

function extractUnit(text: string): string {
  if (/m³|㎥|세제곱미터|MJ|열량/i.test(text)) return 'm³';
  if (/kWh|kwh|킬로와트/i.test(text))          return 'kWh';
  return 'kWh';
}

// ─── CSV / TXT 파싱 (한국 공공 고지서 패턴) ──────────────────────────────────

interface ParsedInvoice {
  usage:  number;
  unit:   string;
  period: string;
}

function parseCsvText(raw: string): ParsedInvoice | null {
  const text = raw.replace(/\r/g, '');

  // ── 패턴 1: "당월사용량", "이번달사용량" 등 레이블 + 숫자
  const labelPatterns = [
    /당월\s*사용량[\s,：:]*([0-9,]+(?:\.[0-9]+)?)/,
    /이번\s*달?\s*사용량[\s,：:]*([0-9,]+(?:\.[0-9]+)?)/,
    /사용량[\s,：:]*([0-9,]+(?:\.[0-9]+)?)/,
    /전력량[\s,：:]*([0-9,]+(?:\.[0-9]+)?)/,
    /가스\s*사용량[\s,：:]*([0-9,]+(?:\.[0-9]+)?)/,
    /use(?:d)?\s*(?:kwh|m3|m³)?[\s:,]*([0-9,]+(?:\.[0-9]+)?)/i,
    /usage[\s:,]*([0-9,]+(?:\.[0-9]+)?)/i,
  ];
  for (const re of labelPatterns) {
    const m = text.match(re);
    if (m && m[1]) {
      const usage = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(usage) && usage > 0) {
        return {
          usage,
          unit:   extractUnit(text),
          period: extractPeriod(text),
        };
      }
    }
  }

  // ── 패턴 2: CSV 헤더 기반 (사용량 / kWh / usage 컬럼)
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const cols = (lines[i] ?? '').split(',').map(c => c.trim().replace(/"/g, ''));
    const usageIdx = cols.findIndex(c => /^(사용량|당월사용량|전력량|kwh|m3|m³|usage)$/i.test(c));
    if (usageIdx !== -1) {
      const nextLine = lines[i + 1];
      if (nextLine) {
        const vals  = nextLine.split(',').map(c => c.trim().replace(/"/g, ''));
        const usage = parseFloat((vals[usageIdx] ?? '').replace(/,/g, ''));
        if (!isNaN(usage) && usage > 0) {
          const periodIdx = cols.findIndex(c => /기간|청구월|월|period|date/i.test(c));
          const period = (periodIdx !== -1 && vals[periodIdx])
            ? extractPeriod(vals[periodIdx])
            : extractPeriod(text);
          return { usage, unit: extractUnit(text), period };
        }
      }
    }
  }

  // ── 패턴 3: 숫자 fallback — 100~99999 범위의 첫 번째 합리적인 값
  const nums = [...text.matchAll(/\b([0-9]{3,6}(?:\.[0-9]+)?)\b/g)]
    .map(m => parseFloat((m[1] ?? '').replace(/,/g, '')))
    .filter(n => !isNaN(n) && n >= 100 && n <= 99999);
  const firstNum = nums[0];
  if (firstNum !== undefined) {
    return { usage: firstNum, unit: extractUnit(text), period: extractPeriod(text) };
  }

  return null;
}

// ─── XLSX 파싱 (exceljs) ────────────────────────────────────────────────────

async function parseXlsx(buffer: ArrayBuffer): Promise<ParsedInvoice | null> {
  const ExcelJS = (await import('exceljs')).default;
  const wb      = new ExcelJS.Workbook();
  // exceljs load accepts Buffer — cast through unknown to satisfy strict types
  await wb.xlsx.load(Buffer.from(buffer) as unknown as Parameters<typeof wb.xlsx.load>[0]);

  let combinedText = '';

  for (const ws of wb.worksheets) {
    let usageVal: number | null = null;
    let periodVal = '';
    let unitVal   = 'kWh';

    ws.eachRow((row, rowNum) => {
      row.eachCell((cell) => {
        const v = String(cell.value ?? '').trim();
        combinedText += ' ' + v;

        // 사용량 레이블 셀 → 오른쪽/아래 셀에서 값 추출
        if (/사용량|전력량|kwh|usage|m3|m³/i.test(v)) {
          // 같은 행 다음 셀
          const nextCell = row.getCell(cell.col + 1);
          const nextVal  = parseFloat(String(nextCell.value ?? '').replace(/,/g, ''));
          if (!isNaN(nextVal) && nextVal > 0) {
            usageVal = nextVal;
            if (/m3|m³|가스/i.test(v)) unitVal = 'm³';
          }
        }

        // 기간 추출 (날짜 형식 셀)
        if (cell.type === 4 /* DATE */ && cell.value instanceof Date) {
          const d = cell.value as Date;
          const candidate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (!periodVal) periodVal = candidate;
        }
        // 기간 추출 (문자열 날짜 패턴)
        if (!periodVal && /\d{4}[-년]\d{1,2}/.test(v)) {
          periodVal = extractPeriod(v);
        }
      });

      // 행 전체를 합쳐서 패턴 탐지
      const rawVals = Array.isArray(row.values) ? row.values : Object.values(row.values as object);
      const rowText = (rawVals as unknown[])
        .slice(1)
        .map((v: unknown) => String(v ?? ''))
        .join(',');
      const parsed = parseCsvText(rowText);
      if (parsed && !usageVal) {
        usageVal  = parsed.usage;
        unitVal   = parsed.unit;
        periodVal = parsed.period;
      }
      void rowNum; // suppress unused warning
    });

    if (usageVal && usageVal > 0) {
      return {
        usage:  usageVal,
        unit:   unitVal,
        period: periodVal || extractPeriod(combinedText),
      };
    }
  }

  // 워크시트 전체 텍스트로 재시도
  const fromText = parseCsvText(combinedText);
  return fromText;
}

// ─── Claude Vision API (PDF / 이미지) ───────────────────────────────────────

interface ClaudeMessage {
  content: Array<{ type: string; text?: string }>;
}

async function extractWithClaudeVision(
  buffer: Buffer,
  mimeType: string,
  invoiceType: InvoiceType,
): Promise<ParsedInvoice | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  // PDF는 document 타입, 이미지는 image 타입
  const isPdf    = mimeType === 'application/pdf';
  const b64data  = buffer.toString('base64');
  const mediaType = isPdf ? 'application/pdf' : mimeType;

  const contentBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: mediaType, data: b64data } }
    : { type: 'image',    source: { type: 'base64', media_type: mediaType, data: b64data } };

  const utilityLabel = invoiceType === 'gas' ? '도시가스' : '전기';
  const unitExample  = invoiceType === 'gas' ? 'm³ 또는 MJ' : 'kWh';

  const prompt = `당신은 한국 ${utilityLabel} 고지서에서 에너지 사용량 데이터를 추출하는 전문가입니다.

이 ${utilityLabel} 고지서에서 다음 정보를 정확하게 추출하세요:
1. 당월(이번 달) 사용량 (숫자만, 단위 제외)
2. 사용 단위 (${unitExample})
3. 청구 월 (YYYY-MM 형식)

반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "usage": <숫자>,
  "unit": "<단위>",
  "period": "<YYYY-MM>",
  "confidence": <0.0~1.0>
}

찾을 수 없는 경우: {"usage": null, "unit": null, "period": null, "confidence": 0}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-opus-4-6',
        max_tokens: 256,
        messages: [
          {
            role:    'user',
            content: [contentBlock, { type: 'text', text: prompt }],
          },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) return null;

    const json = await res.json() as ClaudeMessage;
    const text = json.content?.find(c => c.type === 'text')?.text ?? '';

    // JSON 추출 (마크다운 코드블록 내에 있을 수 있음)
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]) as {
      usage:      number | null;
      unit:       string | null;
      period:     string | null;
      confidence: number;
    };

    if (!parsed.usage || parsed.usage <= 0 || parsed.confidence < 0.3) return null;

    return {
      usage:  parsed.usage,
      unit:   parsed.unit ?? 'kWh',
      period: parsed.period ?? new Date().toISOString().slice(0, 7),
    };
  } catch {
    return null;
  }
}

// ─── Route Handler ───────────────────────────────────────────────────────────

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

  const filename = file.name;
  const mimeType = file.type || 'application/octet-stream';

  // 파일 크기 제한 (10MB)
  if (file.size > 10 * 1024 * 1024) {
    return errorResponse('VALIDATION_ERROR', { details: { message: '파일 크기는 10MB 이하여야 합니다' } });
  }

  let parsedUsage: number | null  = null;
  let parsedUnit                  = 'kWh';
  let parsedPeriod                = new Date().toISOString().slice(0, 7);
  let extractionMethod            = 'none';

  const isCsv  = mimeType === 'text/csv'  || filename.endsWith('.csv') || filename.endsWith('.txt');
  const isXlsx = mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
               || mimeType === 'application/vnd.ms-excel'
               || filename.endsWith('.xlsx')
               || filename.endsWith('.xls');
  const isPdf  = mimeType === 'application/pdf' || filename.endsWith('.pdf');
  const isImage = mimeType.startsWith('image/');

  // ── 1. CSV / TXT 파싱 ──────────────────────────────────────────────────────
  if (isCsv) {
    try {
      const text   = await file.text();
      const invoiceType = inferInvoiceType(filename, text);
      const parsed = parseCsvText(text);
      if (parsed) {
        parsedUsage  = parsed.usage;
        parsedUnit   = parsed.unit;
        parsedPeriod = parsed.period;
        extractionMethod = 'csv';
        // 추론된 고지서 유형으로 업데이트
        void invoiceType;
      }
    } catch {
      // 파싱 실패 — 다음 단계로
    }
  }

  // ── 2. XLSX 파싱 ──────────────────────────────────────────────────────────
  if (!parsedUsage && isXlsx) {
    try {
      const parsed = await parseXlsx(await file.arrayBuffer());
      if (parsed) {
        parsedUsage  = parsed.usage;
        parsedUnit   = parsed.unit;
        parsedPeriod = parsed.period;
        extractionMethod = 'xlsx';
      }
    } catch {
      // 파싱 실패 — 다음 단계로
    }
  }

  // ── 3. Claude Vision API (PDF / 이미지) ───────────────────────────────────
  const invoiceType = inferInvoiceType(filename);
  if (!parsedUsage && (isPdf || isImage)) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = await extractWithClaudeVision(buffer, mimeType, invoiceType);
      if (parsed) {
        parsedUsage  = parsed.usage;
        parsedUnit   = parsed.unit;
        parsedPeriod = parsed.period;
        extractionMethod = 'claude_vision';
      }
    } catch {
      // API 실패 — 수동 입력 안내
    }
  }

  // ── 4. 수동 입력값 우선 적용 ────────────────────────────────────────────────
  if (manualUsage) {
    parsedUsage      = parseFloat(manualUsage);
    parsedUnit       = manualUnit   ?? parsedUnit;
    parsedPeriod     = manualPeriod ?? parsedPeriod;
    extractionMethod = 'manual';
  }

  // ── 5. PDF/이미지에서 추출 실패 → 수동 입력 안내 ────────────────────────────
  if (!parsedUsage && (isPdf || isImage)) {
    const hasVision = !!process.env.ANTHROPIC_API_KEY;
    return successResponse({
      status:    'manual_required',
      message:   hasVision
        ? 'AI가 사용량을 인식하지 못했습니다. 고지서를 확인하고 아래 양식에 직접 입력해주세요.'
        : 'PDF/이미지 파일은 AI 추출을 위해 ANTHROPIC_API_KEY 설정이 필요합니다. 아래 양식에 직접 입력해주세요.',
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
    return errorResponse('VALIDATION_ERROR', {
      details: { message: '사용량을 파악할 수 없습니다. usage 파라미터를 직접 입력해주세요.' },
    });
  }

  if (!/^\d{4}-\d{2}$/.test(parsedPeriod)) {
    parsedPeriod = new Date().toISOString().slice(0, 7);
  }

  // ── CarbonCalculatorService: 계산 + 저장 + AuditLog ───────────────────────
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
      recordId:        result.recordId,
      filename,
      invoiceType,
      usage:           parsedUsage,
      unit:            parsedUnit,
      period:          parsedPeriod,
      emissions:       result.emissions,
      emissionsUnit:   result.emissionsUnit,
      emissionFactor:  result.factorValue,
      factorSource:    result.factorSource,
      scope:           result.scope,
      engineVersion:   result.engineVersion,
      message:         result.message,
      extractionMethod,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '계산 오류';
    return errorResponse('SERVER_ERROR', { details: { message } });
  }
}
