/**
 * CarbonXBRLMapper
 *
 * 탄소 거래 데이터 → XBRL 요소 매핑
 *
 * 지원 택소노미(Taxonomy):
 * - GHG_PROTOCOL: GHG Protocol Corporate Standard (가장 범용)
 * - CDP: CDP Climate Questionnaire (C4, C5, C6 섹션)
 * - ESRS_E1: EU CSRD ESRS E1 (E1-6, E1-7 탄소 크레딧)
 * - SEC_CLIMATE: US SEC Climate Disclosure Rules 2024 (S-K Item 1500~1507)
 * - IFRS_S2: ISSB IFRS S2 Climate-related Disclosures
 *
 * 출력 형식:
 * - XBRLElement 배열 (인라인 XBRL용 구조)
 * - 실제 iXBRL 패키징은 별도 렌더러에서 처리 (확장 포인트)
 *
 * 주요 요소 매핑:
 * | 택소노미 | 요소명 | 설명 |
 * |--------|--------|------|
 * | GHG | ghgp:GHGEmissionsFromOffsets | 구매한 탄소 상쇄량 |
 * | CDP | cdp:CarbonCreditPurchasedQuantity | CDP C6.5 |
 * | ESRS_E1 | esrs:CarbonCreditsUsed | E1-7 |
 * | SEC | srtcs:CarbonOffsetsPurchased | S-K 1502(b) |
 * | IFRS_S2 | ifrs-s2:CarbonCreditsOffset | IFRS S2.29 |
 */

import type { LedgerEntry, RetirementCertificate } from '../../types';

// ─── XBRL 택소노미 ────────────────────────────────────────────────────

export type XBRLTaxonomy = 'GHG_PROTOCOL' | 'CDP' | 'ESRS_E1' | 'SEC_CLIMATE' | 'IFRS_S2';

// ─── XBRL 요소 ───────────────────────────────────────────────────────

export interface XBRLElement {
  /** 택소노미 식별자 */
  taxonomy: XBRLTaxonomy;
  /** 요소 이름 (로컬 파트) */
  element: string;
  /** XML 네임스페이스 접두사 */
  namespace: string;
  /** 전체 요소명 (namespace:element) */
  qualifiedName: string;
  /** 컨텍스트 참조 (기간/단위) */
  contextRef: string;
  /** 단위 참조 */
  unitRef: string;
  /** 소수점 자리 (-6 = 백만 단위, 2 = 소수 둘째) */
  decimals: number;
  /** 값 (문자열) */
  value: string;
  /** 사람이 읽을 수 있는 레이블 */
  label: string;
  /** 관련 공시 참조 (예: "E1-7", "C6.5") */
  disclosureRef?: string;
}

export interface XBRLEntityInfo {
  entityName: string;
  entityIdentifier: string;  // LEI 또는 사업자등록번호
  reportingPeriodStart: string;  // "YYYY-MM-DD"
  reportingPeriodEnd: string;
  currency: string;              // "KRW" | "USD" | "EUR"
}

export interface XBRLDocument {
  schemaVersion: '1.0';
  taxonomy: XBRLTaxonomy;
  entity: XBRLEntityInfo;
  elements: XBRLElement[];
  generatedAt: string;
  /** iXBRL inline HTML 준비 여부 (현재: false — 별도 렌더러 필요) */
  inlineReady: boolean;
}

// ─── 택소노미 네임스페이스 매핑 ──────────────────────────────────────

const TAXONOMY_NAMESPACES: Record<XBRLTaxonomy, { prefix: string; uri: string }> = {
  GHG_PROTOCOL: {
    prefix: 'ghgp',
    uri: 'https://xbrl.ghgprotocol.org/2023/taxonomy',
  },
  CDP: {
    prefix: 'cdp',
    uri: 'https://www.cdp.net/taxonomy/2024/climate',
  },
  ESRS_E1: {
    prefix: 'esrs',
    uri: 'https://xbrl.efrag.org/taxonomy/2023/esrs/e1',
  },
  SEC_CLIMATE: {
    prefix: 'srtcs',
    uri: 'https://xbrl.sec.gov/srtcs/2024/srtcs-2024.xsd',
  },
  IFRS_S2: {
    prefix: 'ifrs-s2',
    uri: 'https://xbrl.ifrs.org/taxonomy/2023-03-23/ifrs-s2',
  },
};

// ─── 요소 정의 매핑 ──────────────────────────────────────────────────

interface ElementDef {
  element: string;
  label: string;
  disclosureRef?: string;
}

const BUY_ELEMENT_MAP: Record<XBRLTaxonomy, ElementDef> = {
  GHG_PROTOCOL: {
    element: 'CarbonOffsetsCreditsPurchased',
    label: 'Carbon Offsets/Credits Purchased',
    disclosureRef: 'GHG Protocol — Scope 2 Market-based Method',
  },
  CDP: {
    element: 'CarbonCreditPurchasedQuantity',
    label: 'Carbon Credits Purchased (tCO2e)',
    disclosureRef: 'CDP C6.5',
  },
  ESRS_E1: {
    element: 'CarbonCreditsPurchased',
    label: 'Carbon Credits Purchased',
    disclosureRef: 'ESRS E1-7',
  },
  SEC_CLIMATE: {
    element: 'CarbonOffsetsPurchased',
    label: 'Carbon Offsets Purchased',
    disclosureRef: 'S-K Item 1502(b)',
  },
  IFRS_S2: {
    element: 'CarbonCreditsPurchased',
    label: 'Carbon Credits Purchased',
    disclosureRef: 'IFRS S2.29(a)',
  },
};

const RETIRE_ELEMENT_MAP: Record<XBRLTaxonomy, ElementDef> = {
  GHG_PROTOCOL: {
    element: 'GHGEmissionsOffsetThroughRetirement',
    label: 'GHG Emissions Offset through Retirement (tCO2e)',
    disclosureRef: 'GHG Protocol — Scope 3 Category 15',
  },
  CDP: {
    element: 'CarbonCreditRetiredQuantity',
    label: 'Carbon Credits Retired (tCO2e)',
    disclosureRef: 'CDP C6.5a',
  },
  ESRS_E1: {
    element: 'CarbonCreditsUsedForCompensation',
    label: 'Carbon Credits Used for GHG Compensation',
    disclosureRef: 'ESRS E1-7 DR E1-47',
  },
  SEC_CLIMATE: {
    element: 'CarbonOffsetsRetiredForNetZero',
    label: 'Carbon Offsets Retired toward Net-Zero Targets',
    disclosureRef: 'S-K Item 1502(c)',
  },
  IFRS_S2: {
    element: 'CarbonCreditsRetiredForOffset',
    label: 'Carbon Credits Retired as GHG Offset',
    disclosureRef: 'IFRS S2.29(b)',
  },
};

// ─── 매퍼 ─────────────────────────────────────────────────────────────

export class CarbonXBRLMapper {
  /**
   * 원장 거래 내역 → XBRL 요소 배열
   * - BUY 이벤트 → 구매량 집계
   * - RETIRE 이벤트 → 소각량 집계
   */
  static mapLedgerToXBRL(
    entries: LedgerEntry[],
    taxonomy: XBRLTaxonomy,
    entity: XBRLEntityInfo
  ): XBRLElement[] {
    const ns = TAXONOMY_NAMESPACES[taxonomy];
    const contextRef = this._buildContextRef(entity);

    const totalBuy = entries
      .filter((e) => e.eventType === 'BUY')
      .reduce((sum, e) => sum + e.quantity, 0);

    const totalRetire = entries
      .filter((e) => e.eventType === 'RETIRE')
      .reduce((sum, e) => sum + e.quantity, 0);

    const elements: XBRLElement[] = [];

    if (totalBuy > 0) {
      const def = BUY_ELEMENT_MAP[taxonomy];
      elements.push({
        taxonomy,
        element: def.element,
        namespace: ns.prefix,
        qualifiedName: `${ns.prefix}:${def.element}`,
        contextRef,
        unitRef: 'tCO2e',
        decimals: 2,
        value: totalBuy.toFixed(2),
        label: def.label,
        disclosureRef: def.disclosureRef,
      });
    }

    if (totalRetire > 0) {
      const def = RETIRE_ELEMENT_MAP[taxonomy];
      elements.push({
        taxonomy,
        element: def.element,
        namespace: ns.prefix,
        qualifiedName: `${ns.prefix}:${def.element}`,
        contextRef,
        unitRef: 'tCO2e',
        decimals: 2,
        value: totalRetire.toFixed(2),
        label: def.label,
        disclosureRef: def.disclosureRef,
      });
    }

    // ESRS E1 추가: 구매 vs 소각 순잔액
    if (taxonomy === 'ESRS_E1' && (totalBuy > 0 || totalRetire > 0)) {
      const netBalance = totalBuy - totalRetire;
      elements.push({
        taxonomy,
        element: 'CarbonCreditNetBalance',
        namespace: ns.prefix,
        qualifiedName: `${ns.prefix}:CarbonCreditNetBalance`,
        contextRef,
        unitRef: 'tCO2e',
        decimals: 2,
        value: netBalance.toFixed(2),
        label: 'Net Carbon Credit Balance (tCO2e)',
        disclosureRef: 'ESRS E1-7 DR E1-48',
      });
    }

    return elements;
  }

  /**
   * 소각 인증서 → XBRL 요소 배열
   * - K-ETS 준수 정보 포함
   */
  static mapRetirementToXBRL(
    certs: RetirementCertificate[],
    taxonomy: XBRLTaxonomy,
    entity: XBRLEntityInfo
  ): XBRLElement[] {
    const ns = TAXONOMY_NAMESPACES[taxonomy];
    const contextRef = this._buildContextRef(entity);
    const def = RETIRE_ELEMENT_MAP[taxonomy];

    const total = certs.reduce((sum, c) => sum + c.retiredQuantity, 0);
    if (total === 0) return [];

    const elements: XBRLElement[] = [
      {
        taxonomy,
        element: def.element,
        namespace: ns.prefix,
        qualifiedName: `${ns.prefix}:${def.element}`,
        contextRef,
        unitRef: 'tCO2e',
        decimals: 2,
        value: total.toFixed(2),
        label: def.label,
        disclosureRef: def.disclosureRef,
      },
    ];

    // 소각 인증서 수 (감사용)
    elements.push({
      taxonomy,
      element: 'CarbonCreditRetirementCertificateCount',
      namespace: ns.prefix,
      qualifiedName: `${ns.prefix}:CarbonCreditRetirementCertificateCount`,
      contextRef,
      unitRef: 'pure',
      decimals: 0,
      value: String(certs.length),
      label: 'Number of Carbon Credit Retirement Certificates',
    });

    // SEC: Scope별 분리
    if (taxonomy === 'SEC_CLIMATE') {
      const byScope = { scope1: 0, scope2: 0, scope3: 0 };
      certs.forEach((c) => {
        if (c.offsetScope === 'scope1') byScope.scope1 += c.retiredQuantity;
        else if (c.offsetScope === 'scope2') byScope.scope2 += c.retiredQuantity;
        else if (c.offsetScope === 'scope3') byScope.scope3 += c.retiredQuantity;
      });

      if (byScope.scope1 > 0) {
        elements.push({
          taxonomy,
          element: 'CarbonOffsetsScope1',
          namespace: ns.prefix,
          qualifiedName: `${ns.prefix}:CarbonOffsetsScope1`,
          contextRef,
          unitRef: 'tCO2e',
          decimals: 2,
          value: byScope.scope1.toFixed(2),
          label: 'Carbon Offsets Applied to Scope 1 Emissions',
          disclosureRef: 'S-K Item 1503(a)(1)',
        });
      }

      if (byScope.scope2 > 0) {
        elements.push({
          taxonomy,
          element: 'CarbonOffsetsScope2',
          namespace: ns.prefix,
          qualifiedName: `${ns.prefix}:CarbonOffsetsScope2`,
          contextRef,
          unitRef: 'tCO2e',
          decimals: 2,
          value: byScope.scope2.toFixed(2),
          label: 'Carbon Offsets Applied to Scope 2 Emissions',
          disclosureRef: 'S-K Item 1503(a)(2)',
        });
      }
    }

    return elements;
  }

  /**
   * XBRL 문서 빌드 (메타데이터 + 요소 집합)
   */
  static buildDocument(
    elements: XBRLElement[],
    taxonomy: XBRLTaxonomy,
    entity: XBRLEntityInfo
  ): XBRLDocument {
    return {
      schemaVersion: '1.0',
      taxonomy,
      entity,
      elements,
      generatedAt: new Date().toISOString(),
      inlineReady: false,  // 향후 iXBRL 렌더러 구현 시 true
    };
  }

  /**
   * 여러 택소노미로 일괄 매핑 (멀티 레귤레이터 제출용)
   */
  static mapToMultipleTaxonomies(
    entries: LedgerEntry[],
    certs: RetirementCertificate[],
    taxonomies: XBRLTaxonomy[],
    entity: XBRLEntityInfo
  ): Map<XBRLTaxonomy, XBRLDocument> {
    const result = new Map<XBRLTaxonomy, XBRLDocument>();

    for (const taxonomy of taxonomies) {
      const ledgerElements = this.mapLedgerToXBRL(entries, taxonomy, entity);
      const certElements = this.mapRetirementToXBRL(certs, taxonomy, entity);
      const allElements = [...ledgerElements, ...certElements];

      // 중복 제거 (동일 element 합산)
      const merged = this._mergeElements(allElements, taxonomy);
      result.set(taxonomy, this.buildDocument(merged, taxonomy, entity));
    }

    return result;
  }

  // ─── 내부 유틸 ────────────────────────────────────────────────────

  private static _buildContextRef(entity: XBRLEntityInfo): string {
    const start = entity.reportingPeriodStart.replace(/-/g, '');
    const end = entity.reportingPeriodEnd.replace(/-/g, '');
    return `ctx_${start}_${end}`;
  }

  private static _mergeElements(
    elements: XBRLElement[],
    taxonomy: XBRLTaxonomy
  ): XBRLElement[] {
    const merged = new Map<string, XBRLElement>();

    for (const el of elements) {
      const key = el.qualifiedName;
      if (merged.has(key) && el.unitRef === 'tCO2e') {
        const existing = merged.get(key)!;
        const sum = parseFloat(existing.value) + parseFloat(el.value);
        merged.set(key, { ...existing, value: sum.toFixed(2) });
      } else {
        merged.set(key, { ...el, taxonomy });
      }
    }

    return Array.from(merged.values());
  }
}
