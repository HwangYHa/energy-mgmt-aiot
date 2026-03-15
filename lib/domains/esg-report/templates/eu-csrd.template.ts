/**
 * EU CSRD / ESRS E1 Template
 * European Corporate Sustainability Reporting Directive
 * ESRS E1 — Climate Change (기후 변화)
 *
 * Reference: ESRS E1 (EU Delegated Regulation 2023/2772)
 * 7 Disclosure Requirements (E1-1 ~ E1-7)
 *
 * 적용 대상: EU 역내 운영 대기업 (직원 250명 이상 또는 매출 4천만 유로 이상)
 */

import { BaseReportTemplate, type TemplateContext, type TemplateValidationResult, type ReportSection, type ReportField } from './base.template';
import type { ESGStandard } from '../types/esg-report.types';

export class EUCSRDTemplate extends BaseReportTemplate {
  readonly standard: ESGStandard = 'CSRD';
  readonly version = 'ESRS-E1-2023';
  readonly displayName = 'EU CSRD / ESRS E1 (Climate Change)';
  readonly countryCode = 'EU';

  buildSections(ctx: TemplateContext): ReportSection[] {
    return [
      this._e1_1_transitionPlan(ctx),
      this._e1_2_climateRisks(ctx),
      this._e1_3_policies(ctx),
      this._e1_4_targets(ctx),
      this._e1_5_energyConsumption(ctx),
      this._e1_6_emissions(ctx),
      this._e1_7_removals(ctx),
    ];
  }

  validate(ctx: TemplateContext): TemplateValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // E1-6: Scope 1/2/3 모두 필수
    if (ctx.summary.scope1 === 0) {
      errors.push('[ESRS E1-6] Scope 1 배출량은 필수 공시 항목입니다.');
    }
    if (ctx.summary.scope2Location === 0) {
      errors.push('[ESRS E1-6] Scope 2 배출량(Location-based)은 필수 공시 항목입니다.');
    }
    if (ctx.summary.scope3 === 0) {
      warnings.push('[ESRS E1-6] CSRD는 Scope 3 공시를 권장합니다 (중요성 평가 필요).');
    }

    // E1-5: 에너지 데이터 권장
    if (!ctx.activityData?.scope2.electricityConsumption) {
      warnings.push('[ESRS E1-5] 에너지 소비량 데이터를 등록하세요.');
    }

    // 기준연도 필요
    if (!ctx.boundary.baseYear) {
      errors.push('[ESRS E1-4] 기준연도(base year) 설정이 필요합니다.');
    }

    const completenessScore = this._calcCompleteness(ctx);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completenessScore,
    };
  }

  // ─── Private section builders ────────────────────────────────────

  private _e1_1_transitionPlan(_ctx: TemplateContext): ReportSection {
    return {
      sectionId: 'csrd_e1_1',
      title: 'E1-1: Transition Plan for Climate Change Mitigation (기후변화 완화를 위한 전환 계획)',
      fields: [
        {
          fieldId: 'e1_1_net_zero_target',
          label: 'Net-zero 달성 목표 연도',
          value: null,
          unit: 'Year',
          required: true,
          notes: '과학 기반 감축 목표(SBTi) 또는 Paris Agreement 정합 목표',
          xbrlElement: 'esrs-e1:NetZeroTargetYear',
        },
        {
          fieldId: 'e1_1_interim_targets',
          label: '중간 감축 목표 (2030)',
          value: null,
          unit: '%',
          required: true,
          notes: '2030년까지 기준연도 대비 절대량 또는 집약도 감축 목표',
          xbrlElement: 'esrs-e1:InterimReductionTarget2030',
        },
        {
          fieldId: 'e1_1_transition_actions',
          label: '전환 계획 핵심 행동 항목',
          value: null,
          required: true,
          notes: '재생에너지 전환, 에너지 효율화, 공급망 탈탄소화 등 주요 조치',
        },
        {
          fieldId: 'e1_1_locked_in',
          label: '탄소 고착화(Lock-in) 위험 자산 현황',
          value: null,
          required: false,
          notes: '화석연료 의존 자산, 탈탄소화가 어려운 사업 부문',
        },
        {
          fieldId: 'e1_1_paris_alignment',
          label: 'Paris Agreement 1.5°C 경로 정합성',
          value: null,
          required: true,
          notes: '설정 목표가 1.5°C 경로와 정합한지 여부 및 근거',
        },
      ],
    };
  }

  private _e1_2_climateRisks(_ctx: TemplateContext): ReportSection {
    return {
      sectionId: 'csrd_e1_2',
      title: 'E1-2: Physical and Transition Climate Risks (물리적·전환 기후 위험)',
      fields: [
        {
          fieldId: 'e1_2_physical_acute',
          label: '급성 물리적 위험 (폭풍, 홍수, 산불 등)',
          value: null,
          required: true,
          notes: '1.5°C / 3°C 시나리오 하의 단기 물리적 위험',
          xbrlElement: 'esrs-e1:AcutePhysicalRisks',
        },
        {
          fieldId: 'e1_2_physical_chronic',
          label: '만성 물리적 위험 (해수면 상승, 평균기온 상승 등)',
          value: null,
          required: true,
          notes: '장기 기후 변화에 따른 만성적 물리적 위험',
          xbrlElement: 'esrs-e1:ChronicPhysicalRisks',
        },
        {
          fieldId: 'e1_2_transition_policy',
          label: '전환 위험 — 정책·법규 (탄소세, 배출권 등)',
          value: null,
          required: true,
          xbrlElement: 'esrs-e1:PolicyTransitionRisks',
        },
        {
          fieldId: 'e1_2_transition_technology',
          label: '전환 위험 — 기술 변화',
          value: null,
          required: false,
        },
        {
          fieldId: 'e1_2_transition_market',
          label: '전환 위험 — 시장·소비자 행동 변화',
          value: null,
          required: false,
        },
        {
          fieldId: 'e1_2_scenario_analysis',
          label: '기후 시나리오 분석 (1.5°C, 3°C 비교)',
          value: null,
          required: true,
          notes: 'IPCC RCP 시나리오 또는 IEA Net Zero 시나리오 활용',
        },
      ],
    };
  }

  private _e1_3_policies(_ctx: TemplateContext): ReportSection {
    return {
      sectionId: 'csrd_e1_3',
      title: 'E1-3: Policies and Actions (정책 및 조치)',
      fields: [
        {
          fieldId: 'e1_3_climate_policy',
          label: '기후 관련 정책 및 약속',
          value: null,
          required: true,
          notes: '기후 전략, 지속가능성 정책, SBTi 가입 여부 등',
        },
        {
          fieldId: 'e1_3_energy_policy',
          label: 'RE100 또는 재생에너지 조달 정책',
          value: null,
          required: false,
        },
        {
          fieldId: 'e1_3_supply_chain',
          label: '공급망 탈탄소화 정책 (Scope 3 카테고리 1 대응)',
          value: null,
          required: false,
        },
        {
          fieldId: 'e1_3_key_actions',
          label: '주요 탄소 감축 이니셔티브 및 투자',
          value: null,
          required: true,
          notes: '에너지 효율화, 연료 전환, 녹색 채권 발행 등',
        },
      ],
    };
  }

  private _e1_4_targets(ctx: TemplateContext): ReportSection {
    return {
      sectionId: 'csrd_e1_4',
      title: 'E1-4: Targets (감축 목표)',
      fields: [
        {
          fieldId: 'e1_4_base_year',
          label: '기준연도',
          value: ctx.boundary.baseYear,
          required: true,
          xbrlElement: 'esrs-e1:BaseYear',
        },
        {
          fieldId: 'e1_4_base_year_emissions',
          label: '기준연도 배출량',
          value: ctx.boundary.baseYearEmissions ?? null,
          unit: 'tCO2eq',
          required: true,
          xbrlElement: 'esrs-e1:BaseYearEmissions',
        },
        {
          fieldId: 'e1_4_target_2030_scope1_2',
          label: '2030 감축 목표 (Scope 1+2, 절대량)',
          value: null,
          unit: '%',
          required: true,
          xbrlElement: 'esrs-e1:Scope12ReductionTarget2030',
        },
        {
          fieldId: 'e1_4_target_2050',
          label: 'Net-zero 달성 연도',
          value: 2050,
          unit: 'Year',
          required: true,
          xbrlElement: 'esrs-e1:NetZeroYear',
        },
        {
          fieldId: 'e1_4_scope3_target',
          label: 'Scope 3 감축 목표 (해당 시)',
          value: null,
          unit: '%',
          required: false,
          xbrlElement: 'esrs-e1:Scope3ReductionTarget',
        },
        {
          fieldId: 'e1_4_sbti_status',
          label: 'SBTi (과학 기반 감축 목표) 인증 여부',
          value: null,
          required: false,
          notes: 'SBTi Committed / Validated / Not applicable',
        },
      ],
    };
  }

  private _e1_5_energyConsumption(ctx: TemplateContext): ReportSection {
    const electricityMwh = ctx.activityData?.scope2.electricityConsumption ?? 0;

    return {
      sectionId: 'csrd_e1_5',
      title: 'E1-5: Energy Consumption and Mix (에너지 소비량 및 구성)',
      fields: [
        {
          fieldId: 'e1_5_total_energy_mwh',
          label: '총 에너지 소비량',
          value: electricityMwh > 0 ? electricityMwh.toFixed(2) : null,
          unit: 'MWh',
          required: true,
          xbrlElement: 'esrs-e1:TotalEnergyConsumption',
        },
        {
          fieldId: 'e1_5_fossil_fuel_mwh',
          label: '화석연료 기반 에너지',
          value: null,
          unit: 'MWh',
          required: true,
          notes: '석탄, 천연가스, 석유 등 화석연료 에너지 소비량',
          xbrlElement: 'esrs-e1:FossilFuelEnergyConsumption',
        },
        {
          fieldId: 'e1_5_renewable_mwh',
          label: '재생에너지 소비량 (PPA, REC, 자가발전 포함)',
          value: ctx.activityData?.scope2.renewableEnergy ?? 0,
          unit: 'MWh',
          required: true,
          xbrlElement: 'esrs-e1:RenewableEnergyConsumption',
        },
        {
          fieldId: 'e1_5_renewable_ratio',
          label: '재생에너지 비율',
          value: electricityMwh > 0 && ctx.activityData?.scope2.renewableEnergy
            ? ((ctx.activityData.scope2.renewableEnergy / electricityMwh) * 100).toFixed(1)
            : null,
          unit: '%',
          required: false,
          xbrlElement: 'esrs-e1:RenewableEnergyRatio',
        },
        {
          fieldId: 'e1_5_energy_intensity',
          label: '에너지 집약도 (매출 또는 생산량 대비)',
          value: null,
          unit: 'MWh/단위',
          required: false,
          xbrlElement: 'esrs-e1:EnergyIntensity',
        },
      ],
    };
  }

  private _e1_6_emissions(ctx: TemplateContext): ReportSection {
    const totalLocation = this.calcTotalWithMethod(ctx.summary, 'location');
    const fields: ReportField[] = [
      {
        fieldId: 'e1_6_scope1',
        label: 'Scope 1 총 온실가스 배출량 (직접 배출)',
        value: this.formatEmissions(ctx.summary.scope1),
        unit: 'tCO2eq',
        required: true,
        xbrlElement: 'esrs-e1:GrossScope1GHGEmissions',
      },
      {
        fieldId: 'e1_6_scope2_location',
        label: 'Scope 2 총 온실가스 배출량 (Location-based)',
        value: this.formatEmissions(ctx.summary.scope2Location),
        unit: 'tCO2eq',
        required: true,
        xbrlElement: 'esrs-e1:GrossScope2LocationBasedEmissions',
      },
    ];

    if (ctx.summary.scope2Market != null) {
      fields.push({
        fieldId: 'e1_6_scope2_market',
        label: 'Scope 2 총 온실가스 배출량 (Market-based)',
        value: this.formatEmissions(ctx.summary.scope2Market),
        unit: 'tCO2eq',
        required: false,
        xbrlElement: 'esrs-e1:GrossScope2MarketBasedEmissions',
      });
    }

    fields.push(
      {
        fieldId: 'e1_6_scope3',
        label: 'Scope 3 총 온실가스 배출량 (간접 배출)',
        value: this.formatEmissions(ctx.summary.scope3),
        unit: 'tCO2eq',
        required: false,
        notes: 'ESRS는 중요성 평가 후 중요한 카테고리만 공시',
        xbrlElement: 'esrs-e1:GrossScope3GHGEmissions',
      },
      {
        fieldId: 'e1_6_total',
        label: '총 온실가스 배출량 (Scope 1+2+3)',
        value: this.formatEmissions(totalLocation),
        unit: 'tCO2eq',
        required: true,
        xbrlElement: 'esrs-e1:TotalGHGEmissions',
      },
      {
        fieldId: 'e1_6_biogenic_co2',
        label: '생물 기인 CO2 배출량 (별도 공시)',
        value: null,
        unit: 'tCO2',
        required: false,
        notes: '바이오매스 연소, 토지 이용 변화 등 생물학적 CO2',
        xbrlElement: 'esrs-e1:BiogenicCO2Emissions',
      },
      {
        fieldId: 'e1_6_emission_intensity',
        label: '배출 집약도',
        value: null,
        unit: 'tCO2eq/단위',
        required: false,
        xbrlElement: 'esrs-e1:GHGEmissionIntensity',
      }
    );

    return {
      sectionId: 'csrd_e1_6',
      title: 'E1-6: Gross GHG Emissions (총 온실가스 배출량)',
      fields,
    };
  }

  private _e1_7_removals(_ctx: TemplateContext): ReportSection {
    return {
      sectionId: 'csrd_e1_7',
      title: 'E1-7: GHG Removals and Carbon Credits (온실가스 흡수 및 탄소 크레딧)',
      fields: [
        {
          fieldId: 'e1_7_removals',
          label: 'GHG 흡수량 (자연 기반, 기술 기반)',
          value: null,
          unit: 'tCO2eq',
          required: false,
          notes: '조림, 산림 보호, BECCS 등을 통한 CO2 흡수량',
          xbrlElement: 'esrs-e1:GHGRemovals',
        },
        {
          fieldId: 'e1_7_carbon_credits',
          label: '탄소 크레딧 구매량 (VCS, Gold Standard 등)',
          value: null,
          unit: 'tCO2eq',
          required: false,
          notes: '자발적 탄소 시장에서 구매한 크레딧 (배출량 상쇄용)',
          xbrlElement: 'esrs-e1:CarbonCredits',
        },
        {
          fieldId: 'e1_7_net_emissions',
          label: '순 온실가스 배출량 (총배출 - 흡수 - 크레딧)',
          value: null,
          unit: 'tCO2eq',
          required: false,
          notes: 'Net emissions = Gross emissions - Removals - Credits',
          xbrlElement: 'esrs-e1:NetGHGEmissions',
        },
        {
          fieldId: 'e1_7_credit_standard',
          label: '사용 탄소 크레딧 인증 표준',
          value: null,
          required: false,
          notes: 'Verra VCS, Gold Standard, CDM, K-ETS 배출권 등',
        },
      ],
    };
  }

  private _calcCompleteness(ctx: TemplateContext): number {
    const checks = [
      ctx.summary.scope1 > 0,
      ctx.summary.scope2Location > 0,
      ctx.boundary.baseYear > 0,
      ctx.emissionFactors.length > 0,
    ];
    return Math.round(checks.filter(Boolean).length / checks.length * 100);
  }
}
