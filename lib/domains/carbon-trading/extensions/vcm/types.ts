/**
 * VCM (Voluntary Carbon Market) — 자발적 탄소 시장 타입 정의
 *
 * 지원 레지스트리:
 * - Verra VCS (Verified Carbon Standard): REDD+, 재생에너지, 토지이용
 * - Gold Standard: SDG 공동편익 중점
 * - American Carbon Registry (ACR)
 * - Climate Action Reserve (CAR)
 *
 * 멀티테넌트 SaaS 확장 고려사항:
 * - CarbonCreditRegistry (K-ETS/규제시장)와 동일한 레지스트리 ID 공유
 * - VCMProject는 CarbonCreditRegistry를 1:1 확장 (별도 테이블)
 * - 테넌트별 격리: tenantId → CarbonCreditRegistry → CarbonVCMProject
 */

// ─── 프로젝트 카테고리 ────────────────────────────────────────────────

/**
 * Verra VCS / Gold Standard 인정 프로젝트 카테고리
 * IPCC Sectoral Scope 분류 기반
 */
export type VCMProjectCategory =
  | 'REDD_PLUS'           // Reducing Emissions from Deforestation & Degradation
  | 'AFFORESTATION'       // Afforestation, Reforestation, Revegetation (ARR)
  | 'IMPROVED_FOREST'     // Improved Forest Management (IFM)
  | 'BLUE_CARBON'         // Mangrove, Seagrass, Saltmarsh (Coastal Wetlands)
  | 'SOIL_CARBON'         // Agricultural Soil Carbon (Regenerative Ag)
  | 'RENEWABLE_ENERGY'    // Wind, Solar, Hydro, Geothermal
  | 'METHANE_CAPTURE'     // Landfill/Agriculture/Coal Mine Methane
  | 'COOKSTOVES'          // Clean Cooking (Household Devices)
  | 'DIRECT_AIR_CAPTURE'  // DAC (Direct Air Capture Technology)
  | 'INDUSTRIAL_EFFICIENCY' // Energy Efficiency in Industry
  | 'BIOCHAR'             // Biochar Carbon Removal
  | 'ENHANCED_WEATHERING' // Mineral Weathering Carbon Removal
  | 'OTHER';

/**
 * 추가성(Additionality) 등급
 * Gold Standard Performance Benchmark 기반
 */
export type AddionalityRating = 'gold' | 'silver' | 'bronze' | 'unrated';

/**
 * 영구성(Permanence) 위험 등급
 * 역전 위험(Reversal Risk) 수준
 */
export type PermanenceRisk = 'low' | 'medium' | 'high';

// ─── 공동편익 (Co-Benefits) ───────────────────────────────────────────

/**
 * UN 지속가능발전목표(SDG) 및 자연/사회 공동편익
 */
export interface CoBenefits {
  /** 관련 UN SDG 번호 (1~17) */
  sdgGoals: number[];
  /** 생물다양성 보전 효과 */
  biodiversityImpact: boolean;
  /** 지역사회 편익 (일자리/소득 창출 등) */
  communityBenefit: boolean;
  /** 수자원 보전 효과 */
  waterConservation: boolean;
  /** 생계/식량 안보 개선 */
  livelihoodImprovement: boolean;
  /** 공동편익 상세 설명 */
  description?: string;
  /** CCBA (Climate, Community & Biodiversity Alliance) 인증 */
  ccbaStandard?: boolean;
}

// ─── VCM 프로젝트 메타데이터 ────────────────────────────────────────

export interface VCMProjectMetadata {
  /** 연결된 CarbonCreditRegistry.id */
  registryId: string;
  tenantId: string;

  // 분류
  projectCategory: VCMProjectCategory;

  // 레지스트리 프로젝트 ID
  verraProjectId?: string;       // e.g. "VCS-1234"
  goldStandardId?: string;       // e.g. "GS-5678"
  acrProjectId?: string;         // American Carbon Registry

  // 지리 정보
  countryCode: string;           // ISO 3166-1 alpha-2 (e.g. "BR", "KE")
  region?: string;               // 도/주 등

  // 프로젝트 기간
  projectStartDate: string;      // ISO date "YYYY-MM-DD"
  monitoringPeriodStart: string; // ISO date
  monitoringPeriodEnd: string;   // ISO date
  projectEndDate?: string;       // 예상 종료일

  // 품질 등급
  addionalityRating: AddionalityRating;
  permanenceRisk: PermanenceRisk;

  // 공동편익
  coBenefits: CoBenefits;

  // 검증 기관 (제3자 감사)
  thirdPartyVerifier?: string;   // SGS, TÜV SÜD, DNV, Bureau Veritas 등
  verificationDate?: string;     // ISO date
  verificationReportUrl?: string;
  nextVerificationDate?: string; // 다음 검증 예정일

  // 기준선 방법론
  baselineMethodology?: string;  // e.g. "VM0007", "AMS-I.D."

  // 예상 연간 감축량 (tCO2e)
  expectedAnnualReductions?: number;

  // 가격 프리미엄 정보
  sdgPremium?: boolean;          // SDG 공동편익 프리미엄 적용 여부
  ccbPremium?: boolean;          // CCB 인증 프리미엄
}

// ─── 서비스 DTO ───────────────────────────────────────────────────────

export interface RegisterVCMProjectInput {
  registryId: string;
  tenantId: string;
  projectCategory: VCMProjectCategory;
  countryCode: string;
  projectStartDate: string;
  monitoringPeriodStart: string;
  monitoringPeriodEnd: string;
  addionalityRating?: AddionalityRating;
  permanenceRisk?: PermanenceRisk;
  sdgGoals?: number[];
  biodiversityImpact?: boolean;
  communityBenefit?: boolean;
  waterConservation?: boolean;
  livelihoodImprovement?: boolean;
  coBenefitDescription?: string;
  thirdPartyVerifier?: string;
  verificationReportUrl?: string;
  baselineMethodology?: string;
  expectedAnnualReductions?: number;
  verraProjectId?: string;
  goldStandardId?: string;
}

export interface VCMProjectFilter {
  tenantId: string;
  projectCategory?: VCMProjectCategory;
  sdgGoal?: number;
  addionalityRating?: AddionalityRating;
  countryCode?: string;
}
