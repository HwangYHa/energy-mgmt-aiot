/**
 * CDP (Carbon Disclosure Project) Template
 * CDP Climate Change Questionnaire 2024 기반
 * C6. Emissions Data, C7. Emissions Breakdown
 */

import { BaseReportTemplate, type TemplateContext, type TemplateValidationResult, type ReportSection } from './base.template';
import type { ESGStandard, XBRLMapping, XBRLMappingEntry } from '../types/esg-report.types';

export class CDPTemplate extends BaseReportTemplate {
  readonly standard: ESGStandard = 'CDP';
  readonly version = '2024';
  readonly displayName = 'CDP 기후변화 질의서 (Climate Change)';
  readonly countryCode = '*';

  buildSections(ctx: TemplateContext): ReportSection[] {
    return [
      this.buildC1GovernanceSection(ctx),
      this.buildC6EmissionsSection(ctx),
      this.buildC7BreakdownSection(ctx),
      this.buildC9TargetsSection(ctx),
    ];
  }

  validate(ctx: TemplateContext): TemplateValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let filledFields = 0;
    const totalFields = 14;

    // C6.1: Scope 1 필수
    if (ctx.summary.scope1 >= 0) filledFields++;
    else errors.push('[CDP C6.1] Scope 1 총 배출량이 필수입니다.');

    // C6.2: Scope 2 Location-based 필수
    if (ctx.summary.scope2Location >= 0) filledFields++;
    else errors.push('[CDP C6.2] Scope 2 Location-based 배출량이 필수입니다.');

    // C6.2: Scope 2 Market-based 강력 권고
    if (ctx.summary.scope2Market != null) {
      filledFields++;
    } else {
      warnings.push('[CDP C6.2] Scope 2 Market-based 배출량은 CDP 고득점을 위해 필요합니다.');
    }

    // C6.3: 배출 강도 (GHG intensity)
    warnings.push('[CDP C6.3] 수익 또는 생산량 대비 배출 강도를 추가하면 CDP 점수가 향상됩니다.');

    // C6.5: Scope 3 필수 (CDP Leadership)
    if (ctx.summary.scope3 > 0) filledFields += 2;
    else warnings.push('[CDP C6.5] Scope 3 배출량 공시가 CDP Leadership 등급에 필요합니다.');

    // C7: 배출원별 상세
    if (ctx.activityData?.scope1.sourceBreakdown?.length) {
      filledFields += 2;
    } else {
      warnings.push('[CDP C7.1] Scope 1 배출원별 상세 데이터가 있으면 CDP 점수에 유리합니다.');
    }

    // 배출계수
    if (ctx.emissionFactors.length > 0) filledFields += 2;
    else errors.push('[CDP C6] 배출계수 출처 및 방법론이 필수입니다.');

    // 검증
    if (ctx.calculationMethod.verificationStatus === 'third-party-verified') {
      filledFields += 4;
    } else if (ctx.calculationMethod.verificationStatus !== 'self-declared') {
      filledFields += 2;
      warnings.push('[CDP C10] 제3자 검증(보증)으로 CDP 점수를 향상시킬 수 있습니다.');
    } else {
      warnings.push('[CDP C10] 외부 검증 없이는 CDP Leadership 등급 달성이 어렵습니다.');
    }

    // 기준연도
    if (ctx.baseYearEmissions != null) filledFields++;
    else warnings.push('[CDP C5.2] 기준연도 배출량을 설정하면 CDP 추이 분석이 가능합니다.');

    // Scope 3 카테고리
    if (ctx.boundary.operationalBoundary.scope3Categories.length >= 3) {
      filledFields += 3;
    } else {
      warnings.push('[CDP C6.5] Scope 3 카테고리 3개 이상 포함 시 CDP 고득점이 가능합니다.');
    }

    const completenessScore = Math.round((filledFields / totalFields) * 100);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completenessScore,
    };
  }

  // ─── CDP XBRL ─────────────────────────────────────────────────

  override buildXBRLMapping(ctx: TemplateContext): XBRLMapping {
    const { summary } = ctx;
    const contextRef = `cdp_climate_${ctx.reportYear}`;

    const entries: XBRLMappingEntry[] = [
      {
        xbrlElement: 'cdp:C6.1-Scope1Emissions',
        taxonomy: 'cdp',
        value: summary.scope1,
        unit: 'tCO2e',
        period: `${ctx.reportYear}-01-01/${ctx.reportYear}-12-31`,
        contextRef,
      },
      {
        xbrlElement: 'cdp:C6.2-Scope2LocationBased',
        taxonomy: 'cdp',
        value: summary.scope2Location,
        unit: 'tCO2e',
        period: `${ctx.reportYear}-01-01/${ctx.reportYear}-12-31`,
        contextRef,
      },
      ...(summary.scope2Market != null ? [{
        xbrlElement: 'cdp:C6.2-Scope2MarketBased',
        taxonomy: 'cdp',
        value: summary.scope2Market,
        unit: 'tCO2e',
        period: `${ctx.reportYear}-01-01/${ctx.reportYear}-12-31`,
        contextRef,
      }] : []),
      {
        xbrlElement: 'cdp:C6.5-Scope3TotalEmissions',
        taxonomy: 'cdp',
        value: summary.scope3,
        unit: 'tCO2e',
        period: `${ctx.reportYear}-01-01/${ctx.reportYear}-12-31`,
        contextRef,
      },
    ];

    return { taxonomy: 'cdp', version: '2024', entries };
  }

  // ─── CDP 섹션 빌더 ─────────────────────────────────────────────

  private buildC1GovernanceSection(_ctx: TemplateContext): ReportSection {
    return {
      sectionId: 'c1_governance',
      title: 'C1. 거버넌스',
      fields: [
        {
          fieldId: 'c1.1',
          label: 'C1.1 이사회 기후변화 감독',
          value: '이사회 수준의 기후 위험 및 기회 감독 여부',
          required: true,
          notes: 'Yes / No + 상세 설명',
        },
        {
          fieldId: 'c1.2',
          label: 'C1.2 경영진 기후변화 책임',
          value: '최고 경영진 수준의 기후변화 책임 보유 여부',
          required: true,
        },
      ],
    };
  }

  private buildC6EmissionsSection(ctx: TemplateContext): ReportSection {
    const { summary } = ctx;
    return {
      sectionId: 'c6_emissions',
      title: 'C6. 배출량 데이터',
      fields: [
        {
          fieldId: 'c6.1',
          label: 'C6.1 Scope 1 총 배출량',
          value: summary.scope1,
          unit: 'tCO2eq',
          required: true,
          xbrlElement: 'cdp:C6.1-Scope1Emissions',
        },
        {
          fieldId: 'c6.2.location',
          label: 'C6.2 Scope 2 배출량 (Location-based)',
          value: summary.scope2Location,
          unit: 'tCO2eq',
          required: true,
          xbrlElement: 'cdp:C6.2-Scope2LocationBased',
        },
        {
          fieldId: 'c6.2.market',
          label: 'C6.2 Scope 2 배출량 (Market-based)',
          value: summary.scope2Market ?? null,
          unit: 'tCO2eq',
          required: false,
          xbrlElement: 'cdp:C6.2-Scope2MarketBased',
        },
        {
          fieldId: 'c6.5.scope3',
          label: 'C6.5 Scope 3 배출량',
          value: summary.scope3,
          unit: 'tCO2eq',
          required: false,
          xbrlElement: 'cdp:C6.5-Scope3TotalEmissions',
        },
        {
          fieldId: 'c6.total',
          label: 'C6 총 배출량 (Scope 1+2+3)',
          value: summary.totalEmissions,
          unit: 'tCO2eq',
          required: true,
        },
        {
          fieldId: 'c6.methodology',
          label: 'C6 산정 방법론',
          value: 'GHG Protocol Corporate Standard, Tier 2',
          required: true,
        },
      ],
    };
  }

  private buildC7BreakdownSection(ctx: TemplateContext): ReportSection {
    const sources = ctx.activityData?.scope1.sourceBreakdown ?? [];
    const categories = ctx.activityData?.scope3.categories ?? [];

    return {
      sectionId: 'c7_breakdown',
      title: 'C7. 배출원별 상세',
      fields: [
        {
          fieldId: 'c7.1.method',
          label: 'C7.1 Scope 1 분류 방법',
          value: 'GHG 유형, 사업 부문, 시설',
          required: false,
        },
        ...sources.map((s, i) => ({
          fieldId: `c7.1.source.${i}`,
          label: `Scope 1 배출원: ${s.sourceType}`,
          value: s.emissions,
          unit: 'tCO2eq',
          required: false,
        })),
        {
          fieldId: 'c7.scope3.categories',
          label: 'C7.2 Scope 3 포함 카테고리',
          value: ctx.boundary.operationalBoundary.scope3Categories.map((n) => `Cat.${n}`).join(', ') || '미포함',
          required: false,
        },
        ...categories.map((c) => ({
          fieldId: `c7.scope3.cat${c.categoryNo}`,
          label: `카테고리 ${c.categoryNo}: ${c.categoryName}`,
          value: c.emissions,
          unit: 'tCO2eq',
          required: false,
        })),
      ],
    };
  }

  private buildC9TargetsSection(ctx: TemplateContext): ReportSection {
    return {
      sectionId: 'c9_targets',
      title: 'C9. 목표 및 이니셔티브',
      fields: [
        {
          fieldId: 'c9.1.hasTarget',
          label: 'C9.1 배출 감축 목표 설정 여부',
          value: '목표 있음 (절대감축 목표)',
          required: false,
        },
        {
          fieldId: 'c9.1.targetYear',
          label: 'C9.1 목표 달성 연도',
          value: 2030,
          required: false,
        },
        {
          fieldId: 'c9.1.baseYear',
          label: 'C9.1 기준연도',
          value: ctx.boundary.baseYear,
          required: false,
        },
        {
          fieldId: 'c9.1.baseYearEmissions',
          label: 'C9.1 기준연도 배출량',
          value: ctx.baseYearEmissions ?? null,
          unit: 'tCO2eq',
          required: false,
        },
      ],
    };
  }
}
