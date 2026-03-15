/**
 * VCMRegistryService
 *
 * 자발적 탄소 시장(VCM) 프로젝트 메타데이터 관리
 *
 * 책임:
 * 1. VCM 프로젝트 등록 (CarbonCreditRegistry 1:1 확장)
 * 2. SDG/공동편익/추가성 기반 필터링
 * 3. VCM 크레딧 프리미엄 가격 계산 참고 데이터 제공
 *
 * 의존성:
 * - CarbonCreditRegistry (기존 v2 모델 — 변경 없음)
 * - CarbonVCMProject (신규 확장 모델)
 */

import { prisma } from '@/lib/db/prisma';
import type {
  VCMProjectMetadata,
  RegisterVCMProjectInput,
  VCMProjectFilter,
} from './types';

const db = prisma as any; // eslint-disable-line @typescript-eslint/no-explicit-any

export class VCMRegistryService {
  /**
   * VCM 프로젝트 등록
   * - registryId는 기존 CarbonCreditRegistry.id
   * - 기존 레지스트리에 VCM 메타데이터 추가
   */
  static async register(input: RegisterVCMProjectInput): Promise<VCMProjectMetadata> {
    // 레지스트리 존재 확인
    const registry = await db.carbonCreditRegistry.findFirst({
      where: { id: input.registryId, tenantId: input.tenantId },
      select: { id: true, registry: true },
    });

    if (!registry) {
      throw new Error('크레딧 레지스트리를 찾을 수 없습니다');
    }

    // VCM이 아닌 K-ETS 전용 레지스트리는 등록 불가
    if (registry.registry === 'K-ETS') {
      throw new Error('K-ETS 크레딧은 자발적 탄소 시장(VCM) 프로젝트로 등록할 수 없습니다');
    }

    const coBenefitsJson = {
      sdgGoals: input.sdgGoals ?? [],
      biodiversityImpact: input.biodiversityImpact ?? false,
      communityBenefit: input.communityBenefit ?? false,
      waterConservation: input.waterConservation ?? false,
      livelihoodImprovement: input.livelihoodImprovement ?? false,
      description: input.coBenefitDescription,
    };

    const project = await db.carbonVCMProject.upsert({
      where: { registryId: input.registryId },
      update: {
        projectCategory: input.projectCategory,
        countryCode: input.countryCode,
        projectStartDate: new Date(input.projectStartDate),
        monitoringPeriodStart: new Date(input.monitoringPeriodStart),
        monitoringPeriodEnd: new Date(input.monitoringPeriodEnd),
        addionalityRating: input.addionalityRating ?? 'unrated',
        permanenceRisk: input.permanenceRisk ?? 'medium',
        sdgGoals: coBenefitsJson.sdgGoals,
        biodiversityImpact: coBenefitsJson.biodiversityImpact,
        communityBenefit: coBenefitsJson.communityBenefit,
        waterConservation: coBenefitsJson.waterConservation,
        livelihoodImprovement: coBenefitsJson.livelihoodImprovement,
        coBenefitDescription: input.coBenefitDescription,
        thirdPartyVerifier: input.thirdPartyVerifier,
        verificationReportUrl: input.verificationReportUrl,
        baselineMethodology: input.baselineMethodology,
        expectedAnnualReductions: input.expectedAnnualReductions,
        verraProjectId: input.verraProjectId,
        goldStandardId: input.goldStandardId,
      },
      create: {
        registryId: input.registryId,
        projectCategory: input.projectCategory,
        countryCode: input.countryCode,
        projectStartDate: new Date(input.projectStartDate),
        monitoringPeriodStart: new Date(input.monitoringPeriodStart),
        monitoringPeriodEnd: new Date(input.monitoringPeriodEnd),
        addionalityRating: input.addionalityRating ?? 'unrated',
        permanenceRisk: input.permanenceRisk ?? 'medium',
        sdgGoals: coBenefitsJson.sdgGoals,
        biodiversityImpact: coBenefitsJson.biodiversityImpact,
        communityBenefit: coBenefitsJson.communityBenefit,
        waterConservation: coBenefitsJson.waterConservation,
        livelihoodImprovement: coBenefitsJson.livelihoodImprovement,
        coBenefitDescription: input.coBenefitDescription,
        thirdPartyVerifier: input.thirdPartyVerifier,
        verificationReportUrl: input.verificationReportUrl,
        baselineMethodology: input.baselineMethodology,
        expectedAnnualReductions: input.expectedAnnualReductions,
        verraProjectId: input.verraProjectId,
        goldStandardId: input.goldStandardId,
      },
    });

    return this._toMetadata(project, input.tenantId);
  }

  /**
   * VCM 프로젝트 조회 (단건)
   */
  static async getByRegistryId(
    registryId: string,
    tenantId: string
  ): Promise<VCMProjectMetadata | null> {
    const project = await db.carbonVCMProject.findUnique({
      where: { registryId },
      include: {
        registry: { select: { tenantId: true } },
      },
    });

    if (!project || project.registry?.tenantId !== tenantId) return null;
    return this._toMetadata(project, tenantId);
  }

  /**
   * 테넌트의 VCM 포트폴리오 목록
   * - SDG 목표 / 카테고리 / 국가 필터링 지원
   */
  static async list(filter: VCMProjectFilter): Promise<VCMProjectMetadata[]> {
    const where: Record<string, unknown> = {
      registry: { tenantId: filter.tenantId },
    };

    if (filter.projectCategory) where.projectCategory = filter.projectCategory;
    if (filter.addionalityRating) where.addionalityRating = filter.addionalityRating;
    if (filter.countryCode) where.countryCode = filter.countryCode;

    const projects = await db.carbonVCMProject.findMany({
      where,
      include: {
        registry: { select: { tenantId: true, registry: true, availableQuantity: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // SDG 필터는 JSON 배열 내 포함 여부로 in-memory 필터
    let result = projects.map((p: any) => this._toMetadata(p, filter.tenantId));
    if (filter.sdgGoal !== undefined) {
      result = result.filter((m: VCMProjectMetadata) =>
        m.coBenefits.sdgGoals.includes(filter.sdgGoal!)
      );
    }

    return result;
  }

  // ─── 내부 유틸 ──────────────────────────────────────────────────────

  private static _toMetadata(project: any, tenantId: string): VCMProjectMetadata {
    return {
      registryId: project.registryId,
      tenantId,
      projectCategory: project.projectCategory,
      verraProjectId: project.verraProjectId ?? undefined,
      goldStandardId: project.goldStandardId ?? undefined,
      countryCode: project.countryCode,
      projectStartDate: project.projectStartDate?.toISOString().slice(0, 10) ?? '',
      monitoringPeriodStart: project.monitoringPeriodStart?.toISOString().slice(0, 10) ?? '',
      monitoringPeriodEnd: project.monitoringPeriodEnd?.toISOString().slice(0, 10) ?? '',
      addionalityRating: project.addionalityRating ?? 'unrated',
      permanenceRisk: project.permanenceRisk ?? 'medium',
      coBenefits: {
        sdgGoals: Array.isArray(project.sdgGoals) ? project.sdgGoals : [],
        biodiversityImpact: project.biodiversityImpact ?? false,
        communityBenefit: project.communityBenefit ?? false,
        waterConservation: project.waterConservation ?? false,
        livelihoodImprovement: project.livelihoodImprovement ?? false,
        description: project.coBenefitDescription ?? undefined,
      },
      thirdPartyVerifier: project.thirdPartyVerifier ?? undefined,
      verificationReportUrl: project.verificationReportUrl ?? undefined,
      baselineMethodology: project.baselineMethodology ?? undefined,
      expectedAnnualReductions: project.expectedAnnualReductions
        ? Number(project.expectedAnnualReductions)
        : undefined,
    };
  }
}
