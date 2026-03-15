/**
 * US SEC Climate Disclosure Template
 * Securities and Exchange Commission — Climate Disclosure Rules (2024 Final Rules)
 * Release No. 33-11275 (effective March 2024)
 *
 * 6 Sections (S1~S6):
 * S1: Governance
 * S2: Material Climate Risks (Physical + Transition)
 * S3: Scope 1 & 2 GHG Emissions (Scope 3 if material or targeted)
 * S4: Climate Targets & Transition Plans
 * S5: Financial Impact of Severe Weather & Natural Conditions
 * S6: Internal Carbon Price
 *
 * 적용 대상: US SEC 등록 공개 기업 (Large Accelerated Filers, Accelerated Filers)
 */

import { BaseReportTemplate, type TemplateContext, type TemplateValidationResult, type ReportSection, type ReportField } from './base.template';
import type { ESGStandard } from '../types/esg-report.types';

export class USSECTemplate extends BaseReportTemplate {
  readonly standard: ESGStandard = 'US_SEC';
  readonly version = '2024';
  readonly displayName = 'US SEC Climate Disclosure Rules (2024)';
  readonly countryCode = 'US';

  buildSections(ctx: TemplateContext): ReportSection[] {
    return [
      this._s1_governance(ctx),
      this._s2_materialRisks(ctx),
      this._s3_emissions(ctx),
      this._s4_targetsTransition(ctx),
      this._s5_financialImpact(ctx),
      this._s6_internalCarbonPrice(ctx),
    ];
  }

  validate(ctx: TemplateContext): TemplateValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // S3: Scope 1 & 2 필수 (Large Accelerated Filers)
    if (ctx.summary.scope1 === 0) {
      errors.push('[SEC S3] Scope 1 온실가스 배출량 공시는 필수입니다 (Large Accelerated Filers).');
    }
    if (ctx.summary.scope2Location === 0) {
      errors.push('[SEC S3] Scope 2 온실가스 배출량 공시는 필수입니다 (Large Accelerated Filers).');
    }

    // Scope 3 권장 (material 또는 목표 설정 시)
    if (ctx.summary.scope3 === 0) {
      warnings.push('[SEC S3] Scope 3는 material하거나 감축 목표에 포함된 경우 공시 필요합니다.');
    }

    // S5: 재무 영향 임계값 안내
    warnings.push('[SEC S5] 심각한 기상 이벤트로 인한 재무 영향이 $100K 이상인 경우 공시 필요합니다.');

    const completenessScore = this._calcCompleteness(ctx);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completenessScore,
    };
  }

  // ─── Private section builders ────────────────────────────────────

  private _s1_governance(_ctx: TemplateContext): ReportSection {
    return {
      sectionId: 'sec_s1_governance',
      title: 'S1: Governance (지배구조)',
      fields: [
        {
          fieldId: 's1_board_oversight',
          label: '이사회의 기후 위험·기회 감독 체계',
          value: null,
          required: true,
          notes: '이사회 또는 소위원회가 기후 관련 위험을 처리하는 방식. 모든 SEC 등록사 필수.',
          xbrlElement: 'dei:BoardClimateOversight',
        },
        {
          fieldId: 's1_management_role',
          label: '경영진의 기후 위험·기회 평가·관리 역할',
          value: null,
          required: true,
          notes: '기후 관련 위험 평가를 담당하는 경영진 직책, 경험, 전문성',
          xbrlElement: 'dei:ManagementClimateRole',
        },
        {
          fieldId: 's1_risk_management',
          label: '기후 위험 식별·평가·관리 프로세스 및 전사 리스크 통합',
          value: null,
          required: true,
          notes: '기후 관련 위험이 전반적 위험 관리 프로세스에 통합되는 방식',
        },
        {
          fieldId: 's1_time_horizon',
          label: '기후 위험 시계 (단기/중기/장기 정의)',
          value: null,
          required: false,
          notes: 'Short-term: <1yr, Medium-term: 1-10yr, Long-term: >10yr',
        },
      ],
    };
  }

  private _s2_materialRisks(_ctx: TemplateContext): ReportSection {
    return {
      sectionId: 'sec_s2_material_risks',
      title: 'S2: Material Climate Risks (중요한 기후 위험)',
      fields: [
        {
          fieldId: 's2_material_determination',
          label: '기후 위험 중요성(Materiality) 판단 기준',
          value: null,
          required: true,
          notes: 'SEC 규정: 합리적 투자자에게 중요한 기후 위험 식별 기준',
        },
        {
          fieldId: 's2_physical_risk',
          label: '물리적 기후 위험 (급성/만성) — Material한 경우',
          value: null,
          required: false,
          notes: '급성: 폭풍, 홍수 / 만성: 해수면 상승, 평균기온 상승',
          xbrlElement: 'dei:MaterialPhysicalClimateRisks',
        },
        {
          fieldId: 's2_physical_location',
          label: '물리적 기후 위험에 노출된 주요 사업장 위치',
          value: null,
          required: false,
          notes: '기후 위험에 취약한 자산·운영의 지리적 위치',
        },
        {
          fieldId: 's2_transition_risk',
          label: '전환 기후 위험 — Material한 경우',
          value: null,
          required: false,
          notes: '탄소세, RE100, 소비자 선호 변화, 기술 대체 위험 등',
          xbrlElement: 'dei:MaterialTransitionClimateRisks',
        },
        {
          fieldId: 's2_financial_impact_estimate',
          label: '기후 위험의 예상 재무 영향 (정량 또는 정성)',
          value: null,
          unit: 'USD',
          required: false,
          notes: '상당한(material) 기후 위험의 재무적 영향 추정치 또는 정성적 기술',
        },
        {
          fieldId: 's2_scenario_analysis',
          label: '기후 시나리오 분석 사용 여부 및 결과',
          value: null,
          required: false,
          notes: 'IPCC, IEA 시나리오 활용 여부 및 전략적 회복력 평가',
        },
      ],
    };
  }

  private _s3_emissions(ctx: TemplateContext): ReportSection {
    const totalLocation = this.calcTotalWithMethod(ctx.summary, 'location');
    const fields: ReportField[] = [
      {
        fieldId: 's3_scope1',
        label: 'Scope 1 직접 온실가스 배출량 (Gross)',
        value: this.formatEmissions(ctx.summary.scope1),
        unit: 'mtCO2e',
        required: true,
        notes: 'mtCO2e = metric tons CO2 equivalent. Large Accelerated Filer 필수.',
        xbrlElement: 'dei:GrossScope1GHGEmissions',
      },
      {
        fieldId: 's3_scope2_location',
        label: 'Scope 2 간접 배출량 (Location-based)',
        value: this.formatEmissions(ctx.summary.scope2Location),
        unit: 'mtCO2e',
        required: true,
        xbrlElement: 'dei:GrossScope2LocationBasedEmissions',
      },
    ];

    if (ctx.summary.scope2Market != null) {
      fields.push({
        fieldId: 's3_scope2_market',
        label: 'Scope 2 간접 배출량 (Market-based)',
        value: this.formatEmissions(ctx.summary.scope2Market),
        unit: 'mtCO2e',
        required: false,
        xbrlElement: 'dei:GrossScope2MarketBasedEmissions',
      });
    }

    fields.push(
      {
        fieldId: 's3_scope3',
        label: 'Scope 3 배출량 (material 또는 목표 포함 시 필수)',
        value: ctx.summary.scope3 > 0 ? this.formatEmissions(ctx.summary.scope3) : null,
        unit: 'mtCO2e',
        required: false,
        notes: 'SEC: Scope 3가 material하거나 감축 목표에 포함된 경우 공시 의무',
        xbrlElement: 'dei:GrossScope3GHGEmissions',
      },
      {
        fieldId: 's3_total',
        label: '총 온실가스 배출량',
        value: this.formatEmissions(totalLocation),
        unit: 'mtCO2e',
        required: true,
        xbrlElement: 'dei:TotalGHGEmissions',
      },
      {
        fieldId: 's3_methodology',
        label: '배출량 계산 방법론 (GHG Protocol 등)',
        value: `GHG Protocol Corporate Standard, CalculationEngine v${ctx.calculationMethod?.scope2Method}`,
        required: true,
        notes: '사용된 GHG 계산 표준, 배출계수 출처, 조직 경계 방법론',
      },
      {
        fieldId: 's3_boundary',
        label: '조직 경계 설정 방식',
        value: ctx.boundary.organizationalBoundary.consolidationMethod,
        required: true,
        notes: 'Equity Share, Financial Control, or Operational Control approach',
      },
      {
        fieldId: 's3_exclusions',
        label: '제외된 배출원 및 제외 사유',
        value: ctx.boundary.operationalBoundary.exclusions.join(', ') || null,
        required: false,
        notes: '5% de minimis threshold 초과 배출원은 제외 불가',
      },
      {
        fieldId: 's3_assurance',
        label: '제3자 검증(Attestation) 현황',
        value: null,
        required: false,
        notes: 'Large Accelerated Filers: Scope 1/2 제한적 보증(limited assurance) 필요 (2026년 이후)',
      }
    );

    return {
      sectionId: 'sec_s3_emissions',
      title: 'S3: GHG Emissions (온실가스 배출량)',
      fields,
    };
  }

  private _s4_targetsTransition(ctx: TemplateContext): ReportSection {
    return {
      sectionId: 'sec_s4_targets',
      title: 'S4: Climate Targets and Transition Plans (기후 목표 및 전환 계획)',
      fields: [
        {
          fieldId: 's4_has_targets',
          label: '기후 목표 설정 여부',
          value: null,
          required: true,
          notes: 'SEC: 기후 목표 또는 전환 계획이 있는 경우에만 공시 의무',
        },
        {
          fieldId: 's4_target_description',
          label: '기후 목표 내용 (GHG 감축, 에너지 효율 등)',
          value: null,
          required: false,
          notes: '목표 범위(Scope), 기준연도, 목표 연도, 절대량/집약도 구분',
        },
        {
          fieldId: 's4_base_year',
          label: '기준연도',
          value: ctx.boundary.baseYear,
          required: false,
          xbrlElement: 'dei:ClimateTargetBaseYear',
        },
        {
          fieldId: 's4_target_year',
          label: '목표 달성 연도',
          value: null,
          required: false,
          xbrlElement: 'dei:ClimateTargetYear',
        },
        {
          fieldId: 's4_interim_targets',
          label: '중간 목표 (milestone)',
          value: null,
          required: false,
          notes: '2025, 2030 등 중간 목표 연도 및 달성 수준',
        },
        {
          fieldId: 's4_transition_plan',
          label: '전환 계획 핵심 내용',
          value: null,
          required: false,
          notes: '목표 달성을 위한 주요 조치, 투자, 의존 기술 등',
        },
        {
          fieldId: 's4_progress',
          label: '목표 대비 현재 진행 상황',
          value: null,
          required: false,
          notes: '전년도 대비 배출량 변화, 목표 달성도',
        },
        {
          fieldId: 's4_carbon_offsets',
          label: '탄소 상쇄(Carbon Offsets) 활용 계획',
          value: null,
          required: false,
          notes: '목표 달성에 상쇄 크레딧 사용 여부 및 비중',
        },
      ],
    };
  }

  private _s5_financialImpact(_ctx: TemplateContext): ReportSection {
    return {
      sectionId: 'sec_s5_financial_impact',
      title: 'S5: Financial Impact of Severe Weather and Natural Conditions (심각한 기상 재해 재무 영향)',
      fields: [
        {
          fieldId: 's5_severe_weather_costs',
          label: '심각한 기상 이벤트 관련 총 비용 (보고 기간)',
          value: null,
          unit: 'USD',
          required: false,
          notes: 'SEC 임계값: 개별 이벤트 당 $100K 이상, 또는 총 $1M 이상인 경우 공시',
          xbrlElement: 'dei:SevereWeatherCosts',
        },
        {
          fieldId: 's5_severe_weather_losses',
          label: '심각한 기상 이벤트로 인한 손실 (자산 손상 등)',
          value: null,
          unit: 'USD',
          required: false,
          xbrlElement: 'dei:SevereWeatherLosses',
        },
        {
          fieldId: 's5_events_list',
          label: '공시 임계값 초과 기상 이벤트 목록',
          value: null,
          required: false,
          notes: '이벤트 유형(홍수, 폭풍 등), 발생 날짜, 영향 받은 지역',
        },
        {
          fieldId: 's5_transition_expenditures',
          label: '기후 전환 관련 비용 (에너지 효율화, 재생에너지 투자 등)',
          value: null,
          unit: 'USD',
          required: false,
          notes: '탄소 감축을 위한 자본 지출 및 운영 비용',
          xbrlElement: 'dei:ClimateTransitionExpenditures',
        },
        {
          fieldId: 's5_insurance_coverage',
          label: '기후 위험 보험 커버리지 현황',
          value: null,
          required: false,
          notes: '기상 재해 등 기후 위험에 대한 보험 가입 여부 및 한도',
        },
      ],
    };
  }

  private _s6_internalCarbonPrice(_ctx: TemplateContext): ReportSection {
    return {
      sectionId: 'sec_s6_carbon_price',
      title: 'S6: Internal Carbon Price (내부 탄소 가격)',
      fields: [
        {
          fieldId: 's6_uses_carbon_price',
          label: '내부 탄소 가격 사용 여부',
          value: null,
          required: true,
          notes: 'SEC: 내부 탄소 가격이 의사결정에 사용되는 경우에만 공시 의무',
        },
        {
          fieldId: 's6_price_per_ton',
          label: '탄소 가격 (단위: USD/mtCO2e)',
          value: null,
          unit: 'USD/mtCO2e',
          required: false,
          notes: '내부에서 설정한 CO2e 톤당 가격 또는 가격 범위',
          xbrlElement: 'dei:InternalCarbonPrice',
        },
        {
          fieldId: 's6_price_application',
          label: '내부 탄소 가격 적용 범위',
          value: null,
          required: false,
          notes: '어떤 사업 부문, 지역, Scope 범위에 적용하는지',
        },
        {
          fieldId: 's6_price_use_case',
          label: '내부 탄소 가격 활용 사례',
          value: null,
          required: false,
          notes: '자본 배분, 신규 투자 평가, R&D 우선순위 결정 등',
        },
      ],
    };
  }

  private _calcCompleteness(ctx: TemplateContext): number {
    const checks = [
      ctx.summary.scope1 > 0,
      ctx.summary.scope2Location > 0,
      ctx.boundary.organizationalBoundary.consolidationMethod !== '',
      ctx.emissionFactors.length > 0,
    ];
    return Math.round(checks.filter(Boolean).length / checks.length * 100);
  }
}
