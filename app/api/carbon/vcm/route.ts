/**
 * GET  /api/carbon/vcm  — 테넌트 VCM 포트폴리오 목록
 * POST /api/carbon/vcm  — VCM 프로젝트 메타데이터 등록/갱신
 *
 * 자발적 탄소 시장(VCM) — Verra VCS / Gold Standard / ACR
 * 사전 조건: registryId의 CarbonCreditRegistry 레코드 존재 필요
 */

import { type NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { successResponse, errorResponse } from '@/lib/api/response';
import { VCMRegistryService } from '@/lib/domains/carbon-trading/extensions/vcm/vcm-registry.service';
import type {
  VCMProjectFilter,
  VCMProjectCategory,
  AddionalityRating,
} from '@/lib/domains/carbon-trading/extensions/vcm/types';

const VALID_CATEGORIES: VCMProjectCategory[] = [
  'REDD_PLUS', 'AFFORESTATION', 'IMPROVED_FOREST', 'BLUE_CARBON',
  'SOIL_CARBON', 'RENEWABLE_ENERGY', 'METHANE_CAPTURE', 'COOKSTOVES',
  'DIRECT_AIR_CAPTURE', 'INDUSTRIAL_EFFICIENCY', 'BIOCHAR',
  'ENHANCED_WEATHERING', 'OTHER',
];
const VALID_RATINGS: AddionalityRating[] = ['gold', 'silver', 'bronze', 'unrated'];

// ─── GET — VCM 프로젝트 목록 ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  const { searchParams } = req.nextUrl;
  const filter: VCMProjectFilter = {
    tenantId: auth.tenantId,
    projectCategory: (searchParams.get('category') as VCMProjectCategory) || undefined,
    addionalityRating: (searchParams.get('rating') as AddionalityRating) || undefined,
    countryCode: searchParams.get('country') || undefined,
    sdgGoal: searchParams.has('sdg') ? Number(searchParams.get('sdg')) : undefined,
  };

  try {
    const items = await VCMRegistryService.list(filter);
    return successResponse({ items, total: items.length });
  } catch (e) {
    console.error('[carbon/vcm GET]', e);
    return errorResponse('SERVER_ERROR', { status: 500 });
  }
}

// ─── POST — VCM 프로젝트 등록/갱신 ──────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return errorResponse('AUTH_REQUIRED', { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: '요청 본문이 올바르지 않습니다' } });

  const {
    registryId, projectCategory, countryCode,
    projectStartDate, monitoringPeriodStart, monitoringPeriodEnd,
    addionalityRating, permanenceRisk,
    sdgGoals, biodiversityImpact, communityBenefit,
    waterConservation, livelihoodImprovement, coBenefitDescription,
    thirdPartyVerifier, verificationReportUrl, baselineMethodology,
    expectedAnnualReductions, verraProjectId, goldStandardId,
  } = body;

  // 필수 검증
  const missing = ['registryId', 'projectCategory', 'countryCode',
    'projectStartDate', 'monitoringPeriodStart', 'monitoringPeriodEnd']
    .filter((k) => !body[k]);
  if (missing.length) {
    return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: `필수 항목 누락: ${missing.join(', ')}` } });
  }
  if (!VALID_CATEGORIES.includes(projectCategory)) {
    return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: `유효하지 않은 카테고리: ${projectCategory}` } });
  }
  if (addionalityRating && !VALID_RATINGS.includes(addionalityRating)) {
    return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: `유효하지 않은 추가성 등급: ${addionalityRating}` } });
  }
  if (sdgGoals && (sdgGoals as unknown[]).some((n) => typeof n !== 'number' || n < 1 || n > 17)) {
    return errorResponse('VALIDATION_ERROR', { status: 400, details: { message: 'SDG 목표는 1~17 사이 숫자여야 합니다' } });
  }

  try {
    const result = await VCMRegistryService.register({
      registryId,
      tenantId: auth.tenantId,
      projectCategory,
      countryCode: String(countryCode).toUpperCase().slice(0, 3),
      projectStartDate,
      monitoringPeriodStart,
      monitoringPeriodEnd,
      addionalityRating,
      permanenceRisk,
      sdgGoals,
      biodiversityImpact: Boolean(biodiversityImpact),
      communityBenefit: Boolean(communityBenefit),
      waterConservation: Boolean(waterConservation),
      livelihoodImprovement: Boolean(livelihoodImprovement),
      coBenefitDescription,
      thirdPartyVerifier,
      verificationReportUrl,
      baselineMethodology,
      expectedAnnualReductions: expectedAnnualReductions != null ? Number(expectedAnnualReductions) : undefined,
      verraProjectId,
      goldStandardId,
    });
    return successResponse(result, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'VCM 프로젝트 등록 중 오류가 발생했습니다';
    if (msg.includes('찾을 수 없습니다') || msg.includes('등록할 수 없습니다')) {
      return errorResponse('VALIDATION_ERROR', { status: 422, details: { message: msg } });
    }
    console.error('[carbon/vcm POST]', e);
    return errorResponse('SERVER_ERROR', { status: 500, details: { message: msg } });
  }
}