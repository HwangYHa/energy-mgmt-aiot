/**
 * K-MRV (한국 환경부 온실가스 명세서) Template
 * 국가 온실가스 인벤토리 보고 및 인증에 관한 지침 준수
 * 환경부 고시 제2023-94호 기반
 */

import { BaseReportTemplate, type TemplateContext, type TemplateValidationResult, type ReportSection } from './base.template';
import type { ESGStandard } from '../types/esg-report.types';

export class KMRVTemplate extends BaseReportTemplate {
  readonly standard: ESGStandard = 'K_MRV';
  readonly version = '2023';           // 환경부 고시 2023년
  readonly displayName = '한국 온실가스 명세서 (K-MRV)';
  readonly countryCode = 'KR';

  buildSections(ctx: TemplateContext): ReportSection[] {
    return [
      this.buildCompanySection(ctx),
      this.buildScope1FuelSection(ctx),
      this.buildScope2ElectricitySection(ctx),
      this.buildScope3TransportSection(ctx),
      this.buildEmissionFactorsSection(ctx),
      this.buildVerificationSection(ctx),
    ];
  }

  validate(ctx: TemplateContext): TemplateValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let filledFields = 0;
    const totalFields = 10;

    // 한국 K-MRV 특화 검증
    if (ctx.countryCode !== 'KR') {
      errors.push('K-MRV는 한국(KR) 사업장에만 적용됩니다.');
    }

    // 필수: 사업장 정보
    if (ctx.tenantName) filledFields++;
    else errors.push('사업장명이 누락되었습니다.');

    // 필수: 보고 연도
    if (ctx.reportYear) filledFields++;
    else errors.push('보고 연도가 누락되었습니다.');

    // 필수: Scope 1 (직접 배출) - K-MRV에서 필수
    if (ctx.summary.scope1 >= 0) filledFields++;
    else errors.push('Scope 1 (고정연소, 이동연소) 배출량이 누락되었습니다.');

    // 필수: Scope 2 (전력 간접)
    if (ctx.summary.scope2Location >= 0) filledFields++;
    else errors.push('Scope 2 (전력 간접배출) 배출량이 누락되었습니다.');

    // 배출계수: 환경부 고시 계수 사용 여부 확인
    const envMinistryFactors = ctx.emissionFactors.filter(
      (f) => f.source.includes('환경부') || f.source.includes('Ministry')
    );
    if (envMinistryFactors.length > 0) filledFields += 2;
    else warnings.push('환경부 고시 배출계수 사용을 권고합니다. 자체 계수 사용 시 별도 검증 필요합니다.');

    // 전력 배출계수: 2023년 기준 0.4593 tCO2/MWh 확인
    const elecFactor = ctx.emissionFactors.find(
      (f) => f.category === 'electricity' || f.code.includes('elec')
    );
    if (elecFactor) {
      filledFields++;
      if (elecFactor.year < ctx.reportYear - 1) {
        warnings.push(
          `전력 배출계수가 ${elecFactor.year}년 기준입니다. 최신 환경부 고시 계수를 사용하세요.`
        );
      }
    } else {
      errors.push('전력 배출계수가 설정되지 않았습니다.');
    }

    // K-MRV Location-based only (Market-based 미지원)
    if (ctx.calculationMethod.scope2Method === 'market-based') {
      warnings.push('K-MRV는 Location-based 방식만 공식 인정됩니다. Market-based는 참고용으로만 사용하십시오.');
    } else filledFields++;

    // 활동 데이터 품질
    if ((ctx.activityData?.dataQualitySummary?.completenessScore ?? 0) >= 90) {
      filledFields += 3;
    } else if (ctx.activityData?.dataQualitySummary) {
      filledFields += 1;
      warnings.push(
        `데이터 완전성 점수가 ${ctx.activityData.dataQualitySummary.completenessScore}%입니다. K-MRV 검증을 위해 90% 이상이 필요합니다.`
      );
    } else {
      errors.push('활동 데이터 품질 정보가 없습니다. K-MRV 검증 시 필수 항목입니다.');
    }

    const completenessScore = Math.round((filledFields / totalFields) * 100);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completenessScore,
    };
  }

  // ─── K-MRV 섹션 빌더 ───────────────────────────────────────────

  private buildCompanySection(ctx: TemplateContext): ReportSection {
    return {
      sectionId: 'company',
      title: '제1장 사업장 기본 정보',
      fields: [
        {
          fieldId: 'company.name',
          label: '사업장명',
          value: ctx.tenantName,
          required: true,
        },
        {
          fieldId: 'company.reportYear',
          label: '명세서 작성 연도',
          value: ctx.reportYear,
          required: true,
        },
        {
          fieldId: 'company.reportingPeriod',
          label: '보고 기간',
          value: `${ctx.period}-01-01 ~ ${ctx.period}-12-31`,
          required: true,
        },
        {
          fieldId: 'company.standard',
          label: '적용 기준',
          value: '환경부 고시 제2023-94호 (국가 온실가스 인벤토리 보고 및 인증에 관한 지침)',
          required: true,
        },
        {
          fieldId: 'company.methodology',
          label: '배출량 산정 방법',
          value: 'Tier 2 (배출계수법)',
          required: true,
        },
      ],
    };
  }

  private buildScope1FuelSection(ctx: TemplateContext): ReportSection {
    const sources = ctx.activityData?.scope1.sourceBreakdown ?? [];
    return {
      sectionId: 'scope1_fuel',
      title: '제2장 직접 배출 (Scope 1)',
      fields: [
        {
          fieldId: 'scope1.category',
          label: '배출원 구분',
          value: '고정연소 + 이동연소',
          required: true,
        },
        {
          fieldId: 'scope1.total',
          label: 'Scope 1 합계',
          value: ctx.summary.scope1,
          unit: 'tCO2eq',
          required: true,
        },
        ...sources.map((s, i) => ({
          fieldId: `scope1.fuel.${i}`,
          label: `${s.sourceType} 연소`,
          value: s.emissions,
          unit: 'tCO2eq',
          required: false,
          notes: `활동량: ${s.activityData} ${s.unit} × 배출계수: ${s.emissionsFactor} tCO2/${s.unit}`,
        })),
      ],
    };
  }

  private buildScope2ElectricitySection(ctx: TemplateContext): ReportSection {
    const elecFactor = ctx.emissionFactors.find(
      (f) => f.category === 'electricity' || f.code.includes('elec')
    );

    return {
      sectionId: 'scope2_elec',
      title: '제3장 간접 배출 - 전력 (Scope 2)',
      fields: [
        {
          fieldId: 'scope2.method',
          label: '산정 방법',
          value: 'Location-based (지역기반)',
          required: true,
        },
        {
          fieldId: 'scope2.electricity',
          label: '전력 사용량',
          value: ctx.activityData?.scope2.electricityConsumption ?? null,
          unit: 'MWh',
          required: true,
        },
        {
          fieldId: 'scope2.factor',
          label: '전력 배출계수',
          value: elecFactor?.factor ?? ctx.activityData?.scope2.locationBasedFactor ?? null,
          unit: 'tCO2eq/MWh',
          required: true,
          notes: elecFactor
            ? `출처: ${elecFactor.source} (${elecFactor.year}년 기준)`
            : '환경부 국가 전력 배출계수',
        },
        {
          fieldId: 'scope2.total',
          label: 'Scope 2 합계',
          value: ctx.summary.scope2Location,
          unit: 'tCO2eq',
          required: true,
        },
      ],
    };
  }

  private buildScope3TransportSection(ctx: TemplateContext): ReportSection {
    const categories = ctx.activityData?.scope3.categories ?? [];

    return {
      sectionId: 'scope3_transport',
      title: '제4장 기타 간접 배출 (Scope 3) - 물류/운송',
      fields: [
        {
          fieldId: 'scope3.category',
          label: '포함 카테고리',
          value: '카테고리 4 (업스트림 물류/운송)',
          required: false,
        },
        {
          fieldId: 'scope3.total',
          label: 'Scope 3 합계',
          value: ctx.summary.scope3,
          unit: 'tCO2eq',
          required: false,
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

  private buildEmissionFactorsSection(ctx: TemplateContext): ReportSection {
    return {
      sectionId: 'emission_factors',
      title: '제5장 배출계수 명세',
      fields: ctx.emissionFactors.map((f, i) => ({
        fieldId: `factor.${i}`,
        label: `${f.sourceType} 배출계수`,
        value: `${f.factor} ${f.unit}`,
        required: false,
        notes: `코드: ${f.code}, 버전: v${f.version}, 출처: ${f.source} (${f.year})`,
      })),
    };
  }

  private buildVerificationSection(ctx: TemplateContext): ReportSection {
    const quality = ctx.activityData?.dataQualitySummary;
    return {
      sectionId: 'verification',
      title: '제6장 자체 검증 선언',
      fields: [
        {
          fieldId: 'verify.status',
          label: '검증 유형',
          value: ctx.calculationMethod.verificationStatus === 'third-party-verified'
            ? '제3자 검증'
            : '자체 선언',
          required: true,
        },
        {
          fieldId: 'verify.completeness',
          label: '데이터 완전성 점수',
          value: quality?.completenessScore ?? null,
          unit: '%',
          required: false,
        },
        {
          fieldId: 'verify.totalDataPoints',
          label: '총 데이터 포인트',
          value: quality?.totalDataPoints ?? null,
          required: false,
        },
        {
          fieldId: 'verify.sensorData',
          label: '센서 자동 수집 데이터',
          value: quality?.sensorData ?? null,
          required: false,
        },
        {
          fieldId: 'verify.manualData',
          label: '수동 입력 데이터',
          value: quality?.manualData ?? null,
          required: false,
        },
      ],
    };
  }
}
