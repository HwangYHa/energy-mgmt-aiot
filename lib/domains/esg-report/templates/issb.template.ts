/**
 * ISSB IFRS S2 Template (기후 관련 공시)
 * International Sustainability Standards Board
 * IFRS S2 Climate-related Disclosures (2023)
 * XBRL 매핑 포함
 */

import { BaseReportTemplate, type TemplateContext, type TemplateValidationResult, type ReportSection } from './base.template';
import type { ESGStandard, XBRLMapping, XBRLMappingEntry } from '../types/esg-report.types';

export class ISSBTemplate extends BaseReportTemplate {
  readonly standard: ESGStandard = 'ISSB';
  readonly version = '2023';           // IFRS S2 (2023)
  readonly displayName = 'ISSB IFRS S2 기후 관련 공시';
  readonly countryCode = '*';

  buildSections(ctx: TemplateContext): ReportSection[] {
    return [
      this.buildGovernanceSection(ctx),
      this.buildStrategySection(ctx),
      this.buildRiskManagementSection(ctx),
      this.buildMetricsSection(ctx),
      this.buildTargetsSection(ctx),
    ];
  }

  validate(ctx: TemplateContext): TemplateValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let filledFields = 0;
    const totalFields = 15;

    // IFRS S2 필수 공시 항목
    if (ctx.summary.scope1 >= 0) filledFields++;
    else errors.push('[IFRS S2 29(a)] Scope 1 GHG 배출량이 필수입니다.');

    if (ctx.summary.scope2Location >= 0) filledFields++;
    else errors.push('[IFRS S2 29(b)] Scope 2 GHG 배출량(Location-based)이 필수입니다.');

    // IFRS S2: 이중 보고 강제 (Location + Market)
    if (ctx.summary.scope2Market != null) filledFields++;
    else errors.push('[IFRS S2 29(b)] Scope 2 Market-based 배출량도 공시해야 합니다 (이중 보고 의무).');

    // Scope 3 공시 (중요한 경우 필수)
    if (ctx.summary.scope3 >= 0) filledFields += 2;
    else warnings.push('[IFRS S2 29(c)] 중요성 판단 후 Scope 3 포함 여부를 결정하세요.');

    // GHG 측정 기준
    if (ctx.emissionFactors.length > 0) filledFields++;
    else errors.push('[IFRS S2 31] GHG 측정에 사용한 방법, 데이터, 가정이 공시되어야 합니다.');

    // 배출 강도 (단위 수익당 GHG)
    warnings.push('[IFRS S2 32] GHG 배출 강도(tCO2eq/단위)를 추가로 공시하는 것을 권장합니다.');

    // 기후 위험/기회
    warnings.push('[IFRS S2 10] 거버넌스, 전략, 위험관리 공시는 질적 정보로 별도 제공이 필요합니다.');

    // 기준연도
    if (ctx.baseYearEmissions != null) {
      filledFields += 2;
    } else {
      warnings.push('[IFRS S2 34] 기준연도 배출량과 재설정 기준을 공시해야 합니다.');
    }

    // 탄소 감축 목표
    if (ctx.boundary.reportingYear) filledFields++;
    warnings.push('[IFRS S2 33] GHG 배출 감축 목표 및 진행 상황 공시를 검토하세요.');

    // Scope 3 Category
    if (ctx.boundary.operationalBoundary.scope3Categories.length > 0) {
      filledFields += 3;
    } else {
      warnings.push('[IFRS S2 29(c)] Scope 3 포함/제외 카테고리와 그 사유를 명시하세요.');
    }

    // 검증
    if (ctx.calculationMethod.verificationStatus !== 'self-declared') {
      filledFields += 4;
    } else {
      warnings.push('[IFRS S2] 제3자 검증(보증)을 받은 경우 공시 신뢰성이 향상됩니다.');
    }

    const completenessScore = Math.round((filledFields / totalFields) * 100);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completenessScore,
    };
  }

  // ─── XBRL 매핑 ────────────────────────────────────────────────

  override buildXBRLMapping(ctx: TemplateContext): XBRLMapping {
    const { summary, boundary } = ctx;
    const periodStart = `${ctx.reportYear}-01-01`;
    const periodEnd = `${ctx.reportYear}-12-31`;
    const contextRef = `duration_${ctx.reportYear}`;

    const entries: XBRLMappingEntry[] = [
      {
        xbrlElement: 'ifrs-full:GrossEmissionsScope1',
        taxonomy: 'ifrs-full',
        value: summary.scope1,
        unit: 'tCO2e',
        period: `${periodStart}/${periodEnd}`,
        contextRef,
      },
      {
        xbrlElement: 'ifrs-full:GrossEmissionsScope2LocationBased',
        taxonomy: 'ifrs-full',
        value: summary.scope2Location,
        unit: 'tCO2e',
        period: `${periodStart}/${periodEnd}`,
        contextRef,
      },
      ...(summary.scope2Market != null ? [{
        xbrlElement: 'ifrs-full:GrossEmissionsScope2MarketBased',
        taxonomy: 'ifrs-full',
        value: summary.scope2Market,
        unit: 'tCO2e',
        period: `${periodStart}/${periodEnd}`,
        contextRef,
      }] : []),
      {
        xbrlElement: 'ifrs-full:GrossEmissionsScope3',
        taxonomy: 'ifrs-full',
        value: summary.scope3,
        unit: 'tCO2e',
        period: `${periodStart}/${periodEnd}`,
        contextRef,
      },
      {
        xbrlElement: 'ifrs-full:TotalGHGEmissions',
        taxonomy: 'ifrs-full',
        value: summary.totalEmissions,
        unit: 'tCO2e',
        period: `${periodStart}/${periodEnd}`,
        contextRef,
      },
      {
        xbrlElement: 'ifrs-full:BaseYearForGHGEmissionsTarget',
        taxonomy: 'ifrs-full',
        value: boundary.baseYear,
        period: periodEnd,
        contextRef: `instant_${ctx.reportYear}`,
      },
    ];

    return {
      taxonomy: 'ifrs-full',
      version: '2023',
      entries,
    };
  }

  // ─── IFRS S2 섹션 ─────────────────────────────────────────────

  private buildGovernanceSection(_ctx: TemplateContext): ReportSection {
    return {
      sectionId: 'governance',
      title: '거버넌스 (IFRS S2 §6-9)',
      fields: [
        {
          fieldId: 'gov.boardOversight',
          label: '이사회의 기후 관련 위험·기회 감독 구조',
          value: '이사회 ESG 위원회를 통한 정기 보고',
          required: true,
          notes: '[IFRS S2 6] 이사회 또는 이사회 위원회의 책임 명시',
        },
        {
          fieldId: 'gov.managementRole',
          label: '경영진의 기후 관련 위험·기회 관리 역할',
          value: 'ESG 최고책임자(CSEO) 임명 및 운영',
          required: true,
          notes: '[IFRS S2 6(b)] 경영진 수준에서의 모니터링 및 관리 명시',
        },
      ],
    };
  }

  private buildStrategySection(_ctx: TemplateContext): ReportSection {
    return {
      sectionId: 'strategy',
      title: '전략 (IFRS S2 §10-24)',
      fields: [
        {
          fieldId: 'strat.climateRisks',
          label: '기후 관련 위험 및 기회 식별',
          value: '물리적 위험(극단적 기상), 전환 위험(탄소세, 규제)',
          required: true,
        },
        {
          fieldId: 'strat.businessImpact',
          label: '기후 위험·기회가 사업 모델에 미치는 영향',
          value: '에너지 비용 증가, 탄소 규제 비용 발생 가능',
          required: true,
        },
        {
          fieldId: 'strat.resilience',
          label: '기후 시나리오 분석 결과',
          value: '1.5°C / 2°C 시나리오 기반 사업 복원력 평가',
          required: false,
          notes: '[IFRS S2 22] 기후 복원력 평가',
        },
      ],
    };
  }

  private buildRiskManagementSection(_ctx: TemplateContext): ReportSection {
    return {
      sectionId: 'risk_management',
      title: '위험 관리 (IFRS S2 §25-28)',
      fields: [
        {
          fieldId: 'risk.identificationProcess',
          label: '기후 관련 위험 식별 및 평가 프로세스',
          value: '연간 ESG 위험 평가 (전사 위험관리체계 통합)',
          required: true,
        },
        {
          fieldId: 'risk.managementProcess',
          label: '기후 위험 관리 및 완화 프로세스',
          value: '에너지 효율 개선, 재생에너지 전환 계획',
          required: true,
        },
      ],
    };
  }

  private buildMetricsSection(ctx: TemplateContext): ReportSection {
    const { summary } = ctx;
    const scope2Used = summary.scope2Market ?? summary.scope2Location;

    return {
      sectionId: 'metrics',
      title: '지표 및 목표 - 배출량 (IFRS S2 §29-32)',
      fields: [
        {
          fieldId: 'metrics.scope1',
          label: 'Scope 1 GHG 배출량',
          value: summary.scope1,
          unit: 'tCO2eq',
          required: true,
          xbrlElement: 'ifrs-full:GrossEmissionsScope1',
        },
        {
          fieldId: 'metrics.scope2Location',
          label: 'Scope 2 GHG 배출량 (Location-based)',
          value: summary.scope2Location,
          unit: 'tCO2eq',
          required: true,
          xbrlElement: 'ifrs-full:GrossEmissionsScope2LocationBased',
        },
        {
          fieldId: 'metrics.scope2Market',
          label: 'Scope 2 GHG 배출량 (Market-based)',
          value: summary.scope2Market ?? null,
          unit: 'tCO2eq',
          required: true,
          xbrlElement: 'ifrs-full:GrossEmissionsScope2MarketBased',
          notes: '[IFRS S2 29(b)] Scope 2 이중 보고 의무',
        },
        {
          fieldId: 'metrics.scope3',
          label: 'Scope 3 GHG 배출량',
          value: summary.scope3,
          unit: 'tCO2eq',
          required: false,
          xbrlElement: 'ifrs-full:GrossEmissionsScope3',
        },
        {
          fieldId: 'metrics.total',
          label: '총 GHG 배출량 (Scope 1+2+3)',
          value: summary.scope1 + scope2Used + summary.scope3,
          unit: 'tCO2eq',
          required: true,
          xbrlElement: 'ifrs-full:TotalGHGEmissions',
        },
        {
          fieldId: 'metrics.baseYear',
          label: '기준연도',
          value: ctx.boundary.baseYear,
          required: true,
          xbrlElement: 'ifrs-full:BaseYearForGHGEmissionsTarget',
        },
        {
          fieldId: 'metrics.baseYearEmissions',
          label: '기준연도 배출량',
          value: ctx.baseYearEmissions ?? null,
          unit: 'tCO2eq',
          required: false,
        },
      ],
    };
  }

  private buildTargetsSection(ctx: TemplateContext): ReportSection {
    return {
      sectionId: 'targets',
      title: '목표 (IFRS S2 §33-36)',
      fields: [
        {
          fieldId: 'targets.reductionTarget',
          label: 'GHG 배출 감축 목표',
          value: '2030년까지 2020년 대비 40% 감축',
          required: false,
          xbrlElement: 'ifrs-full:DescriptionOfTargetForReducingGHGEmissions',
        },
        {
          fieldId: 'targets.targetYear',
          label: '목표 달성 연도',
          value: 2030,
          required: false,
        },
        {
          fieldId: 'targets.baselineYear',
          label: '기준연도',
          value: ctx.boundary.baseYear,
          required: false,
        },
        {
          fieldId: 'targets.progress',
          label: '목표 달성 진행률',
          value: ctx.baseYearEmissions
            ? Math.round(
                ((ctx.baseYearEmissions - ctx.summary.totalEmissions) / ctx.baseYearEmissions) * 100
              )
            : null,
          unit: '%',
          required: false,
        },
      ],
    };
  }
}
