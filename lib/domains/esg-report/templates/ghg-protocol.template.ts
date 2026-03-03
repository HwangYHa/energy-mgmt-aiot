/**
 * GHG Protocol Corporate Standard Template
 * Scope 1/2/3 완전 구현 (Location + Market-based Scope 2)
 */

import { BaseReportTemplate, type TemplateContext, type TemplateValidationResult, type ReportSection } from './base.template';
import type { ESGStandard } from '../types/esg-report.types';

export class GHGProtocolTemplate extends BaseReportTemplate {
  readonly standard: ESGStandard = 'GHG_PROTOCOL';
  readonly version = '2015';           // GHG Protocol Corporate Standard (2015 update)
  readonly displayName = 'GHG Protocol Corporate Standard';
  readonly countryCode = '*';          // 국제 표준 (다국가)

  buildSections(ctx: TemplateContext): ReportSection[] {
    return [
      this.buildOrganizationSection(ctx),
      this.buildScope1Section(ctx),
      this.buildScope2LocationSection(ctx),
      ...(ctx.calculationMethod.scope2Method !== 'location-based'
        ? [this.buildScope2MarketSection(ctx)]
        : []),
      this.buildScope3Section(ctx),
      this.buildSummarySection(ctx),
      this.buildMethodologySection(ctx),
    ];
  }

  validate(ctx: TemplateContext): TemplateValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let filledFields = 0;
    const totalFields = 12;

    // 필수: 조직 경계 설정
    if (!ctx.boundary.organizationalBoundary.approach) {
      errors.push('조직 경계 접근법(Equity Share/Control)이 설정되지 않았습니다.');
    } else filledFields++;

    // 필수: Scope 1
    if (ctx.summary.scope1 >= 0) filledFields++;
    else errors.push('Scope 1 배출량이 누락되었습니다.');

    // 필수: Scope 2 (Location-based)
    if (ctx.summary.scope2Location >= 0) filledFields++;
    else errors.push('Scope 2 배출량(Location-based)이 누락되었습니다.');

    // 권고: Scope 2 (Market-based)
    if (ctx.summary.scope2Market != null) filledFields++;
    else warnings.push('Scope 2 Market-based 배출량이 없습니다 (GHG Protocol 이중 보고 권고).');

    // 권고: Scope 3
    if (ctx.summary.scope3 > 0) filledFields++;
    else warnings.push('Scope 3 배출량이 0입니다. 최소 관련 카테고리를 포함하는 것을 권고합니다.');

    // 기준연도
    if (ctx.baseYearEmissions != null) filledFields++;
    else warnings.push('기준연도 배출량이 설정되지 않았습니다.');

    // 배출계수 출처
    if (ctx.emissionFactors.length > 0) filledFields++;
    else errors.push('사용된 배출계수 목록이 없습니다.');

    // 계산방식
    if (ctx.calculationMethod.verificationStatus) filledFields++;
    else warnings.push('검증 상태가 명시되지 않았습니다.');

    // Scope 3 Category 목록
    if (ctx.boundary.operationalBoundary.scope3Categories.length > 0) filledFields++;
    else warnings.push('Scope 3 포함 카테고리 목록이 없습니다.');

    // 활동 데이터 품질
    if (ctx.activityData?.dataQualitySummary) filledFields += 3;
    else warnings.push('활동 데이터 품질 요약 정보가 없습니다.');

    const completenessScore = Math.round((filledFields / totalFields) * 100);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completenessScore,
    };
  }

  // ─── 섹션 빌더 ────────────────────────────────────────────────

  private buildOrganizationSection(ctx: TemplateContext): ReportSection {
    const { boundary } = ctx;
    return {
      sectionId: 'organization',
      title: '1. 조직 정보 및 경계 설정',
      fields: [
        {
          fieldId: 'org.name',
          label: '보고 법인명',
          value: ctx.tenantName,
          required: true,
        },
        {
          fieldId: 'org.reportingPeriod',
          label: '보고 기간',
          value: ctx.period,
          required: true,
        },
        {
          fieldId: 'org.boundaryApproach',
          label: '조직 경계 접근법',
          value: boundary.organizationalBoundary.approach,
          required: true,
        },
        {
          fieldId: 'org.baseYear',
          label: '기준연도',
          value: boundary.reportingYear,
          required: true,
        },
        {
          fieldId: 'org.baseYearEmissions',
          label: '기준연도 배출량 (tCO2eq)',
          value: ctx.baseYearEmissions ?? null,
          unit: 'tCO2eq',
          required: false,
        },
      ],
    };
  }

  private buildScope1Section(ctx: TemplateContext): ReportSection {
    const { summary, activityData } = ctx;
    const sourceBreakdown = activityData?.scope1.sourceBreakdown ?? [];

    return {
      sectionId: 'scope1',
      title: '2. Scope 1 직접 배출',
      fields: [
        {
          fieldId: 'scope1.total',
          label: 'Scope 1 합계',
          value: summary.scope1,
          unit: 'tCO2eq',
          required: true,
          xbrlElement: 'ifrs-full:GrossEmissionsScope1',
        },
        ...sourceBreakdown.map((s, i) => ({
          fieldId: `scope1.source.${i}`,
          label: `연료 출처: ${s.sourceType}`,
          value: s.emissions,
          unit: 'tCO2eq',
          required: false,
        })),
      ],
    };
  }

  private buildScope2LocationSection(ctx: TemplateContext): ReportSection {
    const { summary, activityData } = ctx;
    return {
      sectionId: 'scope2_location',
      title: '3. Scope 2 간접 배출 (Location-based)',
      fields: [
        {
          fieldId: 'scope2.location.electricity',
          label: '전력 소비량',
          value: activityData?.scope2.electricityConsumption ?? null,
          unit: 'MWh',
          required: true,
        },
        {
          fieldId: 'scope2.location.factor',
          label: '전력 배출계수 (Location-based)',
          value: activityData?.scope2.locationBasedFactor ?? null,
          unit: 'tCO2eq/MWh',
          required: true,
        },
        {
          fieldId: 'scope2.location.total',
          label: 'Scope 2 합계 (Location-based)',
          value: summary.scope2Location,
          unit: 'tCO2eq',
          required: true,
          xbrlElement: 'ifrs-full:GrossEmissionsScope2LocationBased',
        },
      ],
    };
  }

  private buildScope2MarketSection(ctx: TemplateContext): ReportSection {
    const { summary, activityData } = ctx;
    return {
      sectionId: 'scope2_market',
      title: '4. Scope 2 간접 배출 (Market-based)',
      fields: [
        {
          fieldId: 'scope2.market.renewableEnergy',
          label: '재생에너지 조달량 (REC/PPA)',
          value: activityData?.scope2.renewableEnergy ?? null,
          unit: 'MWh',
          required: false,
        },
        {
          fieldId: 'scope2.market.factor',
          label: '전력 배출계수 (Market-based)',
          value: activityData?.scope2.marketBasedFactor ?? null,
          unit: 'tCO2eq/MWh',
          required: true,
        },
        {
          fieldId: 'scope2.market.total',
          label: 'Scope 2 합계 (Market-based)',
          value: summary.scope2Market ?? null,
          unit: 'tCO2eq',
          required: true,
          xbrlElement: 'ifrs-full:GrossEmissionsScope2MarketBased',
        },
      ],
    };
  }

  private buildScope3Section(ctx: TemplateContext): ReportSection {
    const { summary, activityData, boundary } = ctx;
    const categories = activityData?.scope3.categories ?? [];

    return {
      sectionId: 'scope3',
      title: '5. Scope 3 기타 간접 배출',
      fields: [
        {
          fieldId: 'scope3.includedCategories',
          label: '포함된 카테고리',
          value: boundary.operationalBoundary.scope3Categories.join(', ') || '없음',
          required: false,
        },
        {
          fieldId: 'scope3.total',
          label: 'Scope 3 합계',
          value: summary.scope3,
          unit: 'tCO2eq',
          required: false,
          xbrlElement: 'ifrs-full:GrossEmissionsScope3',
        },
        ...categories.map((c) => ({
          fieldId: `scope3.cat${c.categoryNo}`,
          label: `카테고리 ${c.categoryNo}: ${c.categoryName}`,
          value: c.emissions,
          unit: 'tCO2eq',
          required: false,
        })),
      ],
    };
  }

  private buildSummarySection(ctx: TemplateContext): ReportSection {
    const { summary } = ctx;
    const scope2 = this.calcScope2Total(summary, 'location');
    const grandTotal = this.calcTotalWithMethod(summary, 'location');

    return {
      sectionId: 'summary',
      title: '6. 배출량 합계',
      fields: [
        {
          fieldId: 'total.scope1',
          label: 'Scope 1 합계',
          value: summary.scope1,
          unit: 'tCO2eq',
          required: true,
        },
        {
          fieldId: 'total.scope2',
          label: 'Scope 2 합계 (Location-based)',
          value: scope2,
          unit: 'tCO2eq',
          required: true,
        },
        {
          fieldId: 'total.scope3',
          label: 'Scope 3 합계',
          value: summary.scope3,
          unit: 'tCO2eq',
          required: false,
        },
        {
          fieldId: 'total.grand',
          label: '총 배출량 (Scope 1+2+3)',
          value: grandTotal,
          unit: 'tCO2eq',
          required: true,
          xbrlElement: 'ifrs-full:TotalGHGEmissions',
        },
      ],
    };
  }

  private buildMethodologySection(ctx: TemplateContext): ReportSection {
    const { calculationMethod, emissionFactors } = ctx;
    return {
      sectionId: 'methodology',
      title: '7. 방법론 및 배출계수',
      fields: [
        {
          fieldId: 'method.scope2Method',
          label: 'Scope 2 계산 방식',
          value: calculationMethod.scope2Method,
          required: true,
        },
        {
          fieldId: 'method.verificationStatus',
          label: '검증 수준',
          value: calculationMethod.verificationStatus,
          required: true,
        },
        {
          fieldId: 'method.uncertaintyLevel',
          label: '불확실성 수준',
          value: calculationMethod.uncertaintyLevel,
          required: false,
        },
        {
          fieldId: 'method.factorCount',
          label: '사용된 배출계수 종류',
          value: emissionFactors.length,
          required: true,
        },
        ...emissionFactors.slice(0, 5).map((f, i) => ({
          fieldId: `method.factor.${i}`,
          label: `배출계수: ${f.sourceType} (v${f.version})`,
          value: `${f.factor} ${f.unit}`,
          required: false,
          notes: `출처: ${f.source} (${f.year})`,
        })),
      ],
    };
  }
}
