/**
 * ESG Report Template Registry
 * 표준별 템플릿 팩토리
 */

import { GHGProtocolTemplate } from './ghg-protocol.template';
import { KMRVTemplate } from './kmrv.template';
import { ISSBTemplate } from './issb.template';
import { CDPTemplate } from './cdp.template';
import type { BaseReportTemplate } from './base.template';
import type { ESGStandard } from '../types/esg-report.types';

export { GHGProtocolTemplate } from './ghg-protocol.template';
export { KMRVTemplate } from './kmrv.template';
export { ISSBTemplate } from './issb.template';
export { CDPTemplate } from './cdp.template';
export type { BaseReportTemplate, TemplateContext, TemplateValidationResult, ReportSection } from './base.template';

// ─── 템플릿 레지스트리 ────────────────────────────────────────────

const TEMPLATE_REGISTRY: Record<ESGStandard, new () => BaseReportTemplate> = {
  GHG_PROTOCOL: GHGProtocolTemplate,
  K_MRV: KMRVTemplate,
  ISSB: ISSBTemplate,
  CDP: CDPTemplate,
  ISO_14064: GHGProtocolTemplate,   // ISO 14064는 GHG Protocol 방식 사용
  K_ETS: KMRVTemplate,              // K-ETS는 K-MRV 방식 사용
};

export function getTemplate(standard: ESGStandard): BaseReportTemplate {
  const TemplateClass = TEMPLATE_REGISTRY[standard];
  if (!TemplateClass) {
    throw new Error(`지원하지 않는 ESG 표준입니다: ${standard}`);
  }
  return new TemplateClass();
}

export function getSupportedStandards(): Array<{ standard: ESGStandard; displayName: string; version: string }> {
  return Object.entries(TEMPLATE_REGISTRY).map(([standard, TemplateClass]) => {
    const instance = new TemplateClass();
    return {
      standard: standard as ESGStandard,
      displayName: instance.displayName,
      version: instance.version,
    };
  });
}
