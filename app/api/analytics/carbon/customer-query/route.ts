/**
 * POST /api/analytics/carbon/customer-query
 * 고객번호 기반 에너지 사용량 조회 + 배출량 저장
 *
 * 지원 공급사:
 *   - kepco   : 한국전력공사 (KEPCO OpenAPI)
 *   - gas     : 도시가스 (지역사별 통합 API 미제공 → 수동 입력 안내)
 *
 * 환경변수:
 *   KEPCO_API_KEY  : 공공데이터포털 한전 서비스키 (없으면 시뮬레이션 모드)
 *
 * 요청:
 *   { utility: 'kepco'|'gas', customerNo: string, period: 'YYYY-MM' }
 *
 * 응답 (성공):
 *   { status: 'ok', usage, unit, period, recordId, emissions, ... }
 * 응답 (API 키 없음):
 *   { status: 'api_key_required', ... }
 * 응답 (도시가스 — 통합 API 없음):
 *   { status: 'manual_required', ... }
 */

import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';
import { getActiveEngineVersion, findEmissionFactor } from '@/lib/carbon/engine';

export const dynamic = 'force-dynamic';

// ─── KEPCO OpenAPI 호출 ────────────────────────────────────────────
// 공공데이터포털 한전 API: 전기 사용량 조회
// API 명세: https://www.data.go.kr/data/15058057/openapi.do

interface KepcoApiItem {
  metrDt?: string;       // 검침연월 YYYYMM
  useKwh?: string;       // 사용량 kWh
  billAmt?: string;      // 청구금액
  custNm?: string;       // 고객명
}

async function fetchKepcoUsage(
  customerNo: string,
  period: string, // YYYY-MM
  apiKey: string,
): Promise<{ usage: number; unit: 'kWh'; customerName?: string } | null> {
  const metrDt = period.replace('-', ''); // YYYYMM
  const url = new URL(
    'https://openapi.kepco.co.kr/service/eBillSvc/getElctUseInfoList',
  );
  url.searchParams.set('serviceKey', apiKey);
  url.searchParams.set('custNo', customerNo);
  url.searchParams.set('metrDt', metrDt);
  url.searchParams.set('numOfRows', '1');
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('resultType', 'json');

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) return null;

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return null;
  }

  // KEPCO API 응답 구조: response.body.items.item[]
  const items = (
    (json as Record<string, unknown>)?.response as Record<string, unknown>
  )?.body as Record<string, unknown>;
  const itemList = items?.items as
    | { item: KepcoApiItem | KepcoApiItem[] }
    | undefined;
  if (!itemList) return null;

  const item: KepcoApiItem = Array.isArray(itemList.item)
    ? (itemList.item[0] ?? {})
    : (itemList.item ?? {});

  const usage = parseFloat(item.useKwh ?? '');
  if (isNaN(usage) || usage <= 0) return null;

  return {
    usage,
    unit: 'kWh',
    customerName: item.custNm,
  };
}

// ─── 핸들러 ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return errorResponse('AUTH_REQUIRED');

  let body: {
    utility?: string;
    customerNo?: string;
    period?: string;
    saveRecord?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return errorResponse('VALIDATION_ERROR', {
      details: { message: 'JSON 파싱 오류' },
    });
  }

  const { utility, customerNo, period, saveRecord = true } = body;

  if (!utility || !customerNo || !period) {
    return errorResponse('VALIDATION_ERROR', {
      details: { message: 'utility, customerNo, period 모두 필요합니다' },
    });
  }

  if (!/^\d{4}-\d{2}$/.test(period)) {
    return errorResponse('VALIDATION_ERROR', {
      details: { message: 'period는 YYYY-MM 형식이어야 합니다' },
    });
  }

  if (customerNo.length < 3 || customerNo.length > 20) {
    return errorResponse('VALIDATION_ERROR', {
      details: { message: '유효한 고객번호를 입력해주세요 (3~20자리)' },
    });
  }

  // ── 도시가스: 통합 API 없음 → 수동 입력 안내 ─────────────────────
  if (utility === 'gas') {
    return successResponse({
      status: 'manual_required',
      utility: 'gas',
      message:
        '도시가스는 공급사(각 지역별)에 따라 API가 상이하여 자동 조회가 지원되지 않습니다. ' +
        '가스요금 고지서에서 사용량(m³)을 확인하여 직접 입력 탭을 사용해주세요.',
      customerNo,
      period,
      suggestedAction: 'manual_input',
      suggestedUnit: 'm³',
    });
  }

  // ── 한국전력 ──────────────────────────────────────────────────────
  if (utility !== 'kepco') {
    return errorResponse('VALIDATION_ERROR', {
      details: { message: '지원하는 공급사: kepco, gas' },
    });
  }

  const kepcoApiKey = process.env.KEPCO_API_KEY;

  // API 키 없음 → 안내 반환
  if (!kepcoApiKey) {
    return successResponse({
      status: 'api_key_required',
      utility: 'kepco',
      message:
        '한국전력 API 키가 설정되지 않았습니다. ' +
        '관리자에게 문의하거나 아래 직접 입력 방식을 사용해주세요.',
      customerNo,
      period,
      suggestedAction: 'manual_input',
      howToSetup:
        '관리자: 공공데이터포털(data.go.kr)에서 한전 OpenAPI 신청 후 KEPCO_API_KEY 환경변수 설정',
    });
  }

  // KEPCO API 호출
  let kepcoResult: { usage: number; unit: 'kWh'; customerName?: string } | null = null;
  try {
    kepcoResult = await fetchKepcoUsage(customerNo, period, kepcoApiKey);
  } catch (err) {
    console.error('[customer-query] KEPCO API 오류:', err);
    return successResponse({
      status: 'api_error',
      utility: 'kepco',
      message:
        '한국전력 API 호출 중 오류가 발생했습니다. 잠시 후 다시 시도하거나 직접 입력을 사용해주세요.',
      customerNo,
      period,
      suggestedAction: 'manual_input',
    });
  }

  if (!kepcoResult) {
    return successResponse({
      status: 'not_found',
      utility: 'kepco',
      message:
        `고객번호 ${customerNo}의 ${period} 사용량 데이터를 찾을 수 없습니다. ` +
        '고객번호와 기간을 확인하거나 직접 입력을 사용해주세요.',
      customerNo,
      period,
      suggestedAction: 'manual_input',
    });
  }

  const { usage, unit, customerName } = kepcoResult;

  // 배출량 계산 및 저장 (saveRecord=true 시)
  if (!saveRecord) {
    return successResponse({
      status: 'preview',
      utility: 'kepco',
      customerNo,
      customerName,
      usage,
      unit,
      period,
    });
  }

  const factor = await findEmissionFactor({
    tenantId: auth.tenantId,
    category: 'electricity',
    sourceType: 'electricity',
    year: parseInt(period.slice(0, 4)),
    region: 'KR',
  });
  const factorValue = factor ? Number(factor.factor) : 0.4567;
  const emissions = (usage * factorValue) / 1000;

  const engine = await getActiveEngineVersion();

  const record = await prisma.emissionsData.create({
    data: {
      tenantId: auth.tenantId,
      emissionType: 'scope2',
      sourceType: 'electricity',
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
        tenantId: auth.tenantId,
        userId: auth.userId,
        action: 'INVOICE_UPLOADED',
        resourceType: 'emissions_data',
        resourceId: record.id,
        changes: {
          source: 'kepco_api',
          customerNo,
          customerName,
          usage,
          unit,
          period,
          emissions,
          factorValue,
          engineVersion: engine.version,
        },
      },
    })
    .catch(() => null);

  return successResponse({
    status: 'ok',
    utility: 'kepco',
    customerNo,
    customerName,
    usage,
    unit,
    period,
    emissions: Math.round(emissions * 1000) / 1000,
    emissionsUnit: 'tCO₂eq',
    emissionFactor: factorValue,
    scope: 'scope2',
    recordId: record.id,
    message: `${period} 전력 사용량 ${usage.toLocaleString()} kWh, 배출량 ${Math.round(emissions * 1000) / 1000} tCO₂eq 기록되었습니다.`,
  });
}
