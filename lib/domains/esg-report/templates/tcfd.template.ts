/**
 * TCFD Report Template
 * Task Force on Climate-related Financial Disclosures
 * 11 Recommended Disclosures (4 Pillars)
 *
 * Reference: TCFD Final Recommendations (2017) + 2021 Guidance
 *
 * Pillars:
 * 1. Governance (2 disclosures)
 * 2. Strategy (3 disclosures)
 * 3. Risk Management (3 disclosures)
 * 4. Metrics & Targets (3 disclosures)
 */

import { BaseReportTemplate, type TemplateContext, type TemplateValidationResult, type ReportSection, type ReportField } from './base.template';
import type { ESGStandard } from '../types/esg-report.types';

export class TCFDTemplate extends BaseReportTemplate {
  readonly standard: ESGStandard = 'TCFD';
  readonly version = '2021';
  readonly displayName = 'TCFD (Task Force on Climate-related Financial Disclosures)';
  readonly countryCode = '*'; // 다국가

  buildSections(ctx: TemplateContext): ReportSection[] {
    return [
      this._governanceSection(ctx),
      this._strategySection(ctx),
      this._riskManagementSection(ctx),
      this._metricsTargetsSection(ctx),
    ];
  }

  validate(ctx: TemplateContext): TemplateValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Scope 1 필수
    if (ctx.summary.scope1 === 0) {
      warnings.push('[TCFD 4a] Scope 1 배출량이 0입니다. 데이터를 확인하세요.');
    }

    // Scope 2 필수 (Location-based 최소 필요)
    if (ctx.summary.scope2Location === 0) {
      warnings.push('[TCFD 4a] Scope 2 배출량(location-based)이 0입니다.');
    }

    // Scope 3 권장
    if (ctx.summary.scope3 === 0) {
      warnings.push('[TCFD 4a] Scope 3 배출량 공시가 권장됩니다 (material 여부 평가 필요).');
    }

    // 배출계수 출처 검증
    if (ctx.emissionFactors.length === 0) {
      errors.push('[TCFD 4a] 배출계수 스냅샷이 없습니다. 보고서 생성을 다시 시도하세요.');
    }

    // 완전성 점수 계산
    const requiredFields = [
      ctx.summary.scope1,          // 4a
      ctx.summary.scope2Location,  // 4a
      ctx.boundary.reportingYear,  // 2a
      ctx.boundary.baseYear,       // 4c
    ];
    const filledCount = requiredFields.filter(v => v != null && v !== 0).length;
    const completenessScore = Math.round((filledCount / requiredFields.length) * 100);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completenessScore,
    };
  }

  // ─── Private section builders ───────────────────────────────────

  private _governanceSection(ctx: TemplateContext): ReportSection {
    return {
      sectionId: 'tcfd_governance',
      title: 'Governance (지배구조)',
      fields: [
        {
          fieldId: 'gov_a_board_oversight',
          label: '[TCFD-G1a] 이사회의 기후 관련 위험 및 기회 감독 현황',
          value: null,
          required: true,
          notes: '이사회 또는 이사회 산하 위원회가 기후 관련 사안을 처리하는 방식 기술',
          xbrlElement: 'tcfd:BoardOversightClimateRisks',
        },
        {
          fieldId: 'gov_b_management_role',
          label: '[TCFD-G1b] 경영진의 기후 관련 위험 및 기회 평가·관리 역할',
          value: null,
          required: true,
          notes: '기후 관련 사안을 담당하는 경영진 직위 또는 위원회 기술',
          xbrlElement: 'tcfd:ManagementClimateRole',
        },
        {
          fieldId: 'gov_reporting_org',
          label: '보고 기업명',
          value: ctx.tenantName,
          required: true,
        },
        {
          fieldId: 'gov_reporting_year',
          label: '보고 연도',
          value: ctx.reportYear,
          required: true,
        },
      ],
    };
  }

  private _strategySection(_ctx: TemplateContext): ReportSection {
    return {
      sectionId: 'tcfd_strategy',
      title: 'Strategy (전략)',
      fields: [
        {
          fieldId: 'str_a_risks_opps',
          label: '[TCFD-S2a] 단기·중기·장기 기후 위험 및 기회',
          value: null,
          required: true,
          notes: '기후 위험(물리적/전환)과 기회 사항 기술 (단기<1년, 중기1-5년, 장기>5년)',
          xbrlElement: 'tcfd:ClimateRisksOpportunities',
        },
        {
          fieldId: 'str_b_business_impact',
          label: '[TCFD-S2b] 기후 위험·기회의 비즈니스·전략·재무계획 영향',
          value: null,
          required: true,
          notes: '기후 관련 사안이 사업 전략과 재무계획에 미치는 실질적·잠재적 영향',
          xbrlElement: 'tcfd:BusinessStrategyImpact',
        },
        {
          fieldId: 'str_c_scenario',
          label: '[TCFD-S2c] 기후 시나리오 분석 결과 (1.5°C / 2°C / 4°C)',
          value: null,
          required: false,
          notes: '다양한 기후 시나리오 하에서 조직 전략의 회복력 평가 결과',
          xbrlElement: 'tcfd:ScenarioAnalysis',
        },
        {
          fieldId: 'str_transition_plan',
          label: '기후 전환 계획 (탄소중립 목표)',
          value: null,
          required: false,
          notes: 'Net-zero 달성을 위한 로드맵 및 중간 목표',
        },
      ],
    };
  }

  private _riskManagementSection(_ctx: TemplateContext): ReportSection {
    return {
      sectionId: 'tcfd_risk_management',
      title: 'Risk Management (위험 관리)',
      fields: [
        {
          fieldId: 'rm_a_identify',
          label: '[TCFD-R3a] 기후 관련 위험 식별·평가 프로세스',
          value: null,
          required: true,
          notes: '기후 관련 위험을 식별하고 평가하는 조직의 프로세스 기술',
          xbrlElement: 'tcfd:RiskIdentificationProcess',
        },
        {
          fieldId: 'rm_b_manage',
          label: '[TCFD-R3b] 기후 관련 위험 관리 프로세스',
          value: null,
          required: true,
          notes: '식별된 기후 위험을 관리·완화하는 방법 기술',
          xbrlElement: 'tcfd:RiskManagementProcess',
        },
        {
          fieldId: 'rm_c_integration',
          label: '[TCFD-R3c] 전사 위험 관리와의 통합 방식',
          value: null,
          required: true,
          notes: '기후 위험 식별·평가·관리 프로세스가 전사 위험 관리 체계에 통합되는 방식',
          xbrlElement: 'tcfd:RiskManagementIntegration',
        },
        {
          fieldId: 'rm_physical_risks',
          label: '물리적 기후 위험 (극한 기상, 만성 위험)',
          value: null,
          required: false,
          notes: '홍수, 폭염, 해수면 상승 등 물리적 위험 영향 평가',
        },
        {
          fieldId: 'rm_transition_risks',
          label: '전환 기후 위험 (정책, 기술, 시장, 평판)',
          value: null,
          required: false,
          notes: '탄소세, RE100, 소비자 행동 변화 등 전환 위험 영향 평가',
        },
      ],
    };
  }

  private _metricsTargetsSection(ctx: TemplateContext): ReportSection {
    const totalWithLocation = this.calcTotalWithMethod(ctx.summary, 'location');

    const fields: ReportField[] = [
      {
        fieldId: 'mt_a_scope1',
        label: '[TCFD-M4a] Scope 1 직접 온실가스 배출량',
        value: this.formatEmissions(ctx.summary.scope1),
        unit: 'tCO2eq',
        required: true,
        xbrlElement: 'tcfd:GrossScope1Emissions',
      },
      {
        fieldId: 'mt_a_scope2_location',
        label: '[TCFD-M4a] Scope 2 간접 배출량 (Location-based)',
        value: this.formatEmissions(ctx.summary.scope2Location),
        unit: 'tCO2eq',
        required: true,
        xbrlElement: 'tcfd:GrossScope2LocationEmissions',
      },
    ];

    if (ctx.summary.scope2Market != null) {
      fields.push({
        fieldId: 'mt_a_scope2_market',
        label: '[TCFD-M4a] Scope 2 간접 배출량 (Market-based)',
        value: this.formatEmissions(ctx.summary.scope2Market),
        unit: 'tCO2eq',
        required: false,
        xbrlElement: 'tcfd:GrossScope2MarketEmissions',
      });
    }

    fields.push(
      {
        fieldId: 'mt_a_scope3',
        label: '[TCFD-M4a] Scope 3 간접 배출량 (해당하는 경우)',
        value: this.formatEmissions(ctx.summary.scope3),
        unit: 'tCO2eq',
        required: false,
        xbrlElement: 'tcfd:GrossScope3Emissions',
      },
      {
        fieldId: 'mt_a_total',
        label: '[TCFD-M4a] 총 온실가스 배출량',
        value: this.formatEmissions(totalWithLocation),
        unit: 'tCO2eq',
        required: true,
        xbrlElement: 'tcfd:TotalGHGEmissions',
      },
      {
        fieldId: 'mt_b_financial_metrics',
        label: '[TCFD-M4b] 기후 관련 위험 재무 영향 지표',
        value: null,
        required: false,
        notes: '내부 탄소 가격, 기후 관련 비용·수익 등',
        xbrlElement: 'tcfd:ClimateFinancialMetrics',
      },
      {
        fieldId: 'mt_c_target',
        label: '[TCFD-M4c] 감축 목표',
        value: null,
        unit: '%',
        required: true,
        notes: '기준연도 대비 감축 목표율 및 목표 연도',
        xbrlElement: 'tcfd:GHGReductionTarget',
      },
      {
        fieldId: 'mt_c_base_year',
        label: '기준연도',
        value: ctx.boundary.baseYear,
        required: true,
      },
      {
        fieldId: 'mt_c_target_year',
        label: '목표 연도',
        value: null,
        required: false,
      },
      {
        fieldId: 'mt_emission_intensity',
        label: '배출 집약도 (선택)',
        value: null,
        unit: 'tCO2eq/매출액 단위',
        required: false,
        notes: '매출 또는 생산량 대비 배출 집약도',
      }
    );

    return {
      sectionId: 'tcfd_metrics_targets',
      title: 'Metrics & Targets (지표 및 목표)',
      fields,
    };
  }
}
