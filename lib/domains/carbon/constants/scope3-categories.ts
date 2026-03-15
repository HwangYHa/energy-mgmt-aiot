/**
 * GHG Protocol Scope 3 카테고리 상수
 * Corporate Value Chain (Scope 3) Accounting and Reporting Standard
 * 15개 카테고리 완전 정의 — Big4 감사 대응
 */

// ─── 카테고리 타입 ────────────────────────────────────────────────

export type Scope3CalcMethod = 'activity' | 'spend' | 'spend-or-activity';

export interface Scope3Category {
  /** 카테고리 번호 (1-15, GHG Protocol 기준) */
  no: number;
  /** 코드 (예: CAT01) */
  code: string;
  /** 영문 공식명칭 */
  name: string;
  /** 한국어 명칭 */
  nameKo: string;
  /** 주 계산 방식 */
  method: Scope3CalcMethod;
  /** 설명 */
  description: string;
  /** 한국어 설명 */
  descriptionKo: string;
  /** 대표 배출원 코드 패턴 (sourceType 매핑용) */
  sourceTypePatterns: string[];
}

// ─── GHG Protocol Scope 3 15개 카테고리 ──────────────────────────

export const SCOPE3_CATEGORIES: Record<number, Scope3Category> = {
  1: {
    no: 1,
    code: 'CAT01',
    name: 'Purchased Goods and Services',
    nameKo: '구매한 재화 및 서비스',
    method: 'spend-or-activity',
    description: 'Extraction, production, and transportation of goods/services purchased by the reporting company',
    descriptionKo: '보고 기업이 구매한 재화 및 서비스의 추출, 생산, 운송 과정에서 발생하는 배출',
    sourceTypePatterns: ['cat01', 'purchased-goods', 'raw-material', 'supplier'],
  },
  2: {
    no: 2,
    code: 'CAT02',
    name: 'Capital Goods',
    nameKo: '자본재',
    method: 'spend-or-activity',
    description: 'Extraction, production, and transportation of capital goods purchased by the reporting company',
    descriptionKo: '보고 기업이 구매한 자본재의 추출, 생산, 운송 과정에서 발생하는 배출',
    sourceTypePatterns: ['cat02', 'capital-goods', 'equipment', 'machinery'],
  },
  3: {
    no: 3,
    code: 'CAT03',
    name: 'Fuel and Energy Related Activities',
    nameKo: '연료 및 에너지 관련 활동',
    method: 'activity',
    description: 'Extraction, production, and transportation of fuels and energy purchased by the reporting company (not included in Scope 1 or 2)',
    descriptionKo: 'Scope 1·2에 포함되지 않는 구매 연료·에너지의 업스트림 배출',
    sourceTypePatterns: ['cat03', 'fuel-upstream', 'energy-upstream', 't-d-loss'],
  },
  4: {
    no: 4,
    code: 'CAT04',
    name: 'Upstream Transportation and Distribution',
    nameKo: '상류 운송 및 유통',
    method: 'activity',
    description: 'Transportation and distribution of products purchased by the reporting company in the reporting year',
    descriptionKo: '보고 기업이 구매한 제품의 운송 및 유통 (공급자 → 기업)',
    sourceTypePatterns: ['cat04', 'upstream-transport', 'inbound-logistics', 'freight'],
  },
  5: {
    no: 5,
    code: 'CAT05',
    name: 'Waste Generated in Operations',
    nameKo: '사업장에서 발생한 폐기물',
    method: 'activity',
    description: 'Disposal and treatment of waste generated in the reporting company\'s owned or controlled operations',
    descriptionKo: '보고 기업 사업장에서 발생하는 폐기물의 처리 및 처분',
    sourceTypePatterns: ['cat05', 'waste', 'landfill', 'incineration', 'wastewater'],
  },
  6: {
    no: 6,
    code: 'CAT06',
    name: 'Business Travel',
    nameKo: '출장',
    method: 'activity',
    description: 'Transportation of employees for business-related activities during the reporting year',
    descriptionKo: '임직원 출장 시 이용하는 교통수단에서 발생하는 배출',
    sourceTypePatterns: ['cat06', 'business-travel', 'air-travel', 'rail-travel', 'car-rental'],
  },
  7: {
    no: 7,
    code: 'CAT07',
    name: 'Employee Commuting',
    nameKo: '임직원 통근',
    method: 'activity',
    description: 'Transportation of employees between their homes and their worksites during the reporting year',
    descriptionKo: '임직원이 자택과 사업장 사이를 이동할 때 발생하는 배출',
    sourceTypePatterns: ['cat07', 'commuting', 'employee-commute', 'car-commute'],
  },
  8: {
    no: 8,
    code: 'CAT08',
    name: 'Upstream Leased Assets',
    nameKo: '상류 임차 자산',
    method: 'activity',
    description: 'Operation of assets leased by the reporting company and not included in Scope 1 and 2',
    descriptionKo: 'Scope 1·2에 포함되지 않는 임차 자산의 운영에서 발생하는 배출',
    sourceTypePatterns: ['cat08', 'upstream-lease', 'leased-equipment', 'rented-assets'],
  },
  9: {
    no: 9,
    code: 'CAT09',
    name: 'Downstream Transportation and Distribution',
    nameKo: '하류 운송 및 유통',
    method: 'activity',
    description: 'Transportation and distribution of products sold by the reporting company',
    descriptionKo: '보고 기업이 판매한 제품의 운송 및 유통 (기업 → 최종소비자)',
    sourceTypePatterns: ['cat09', 'downstream-transport', 'outbound-logistics', 'delivery'],
  },
  10: {
    no: 10,
    code: 'CAT10',
    name: 'Processing of Sold Products',
    nameKo: '판매된 제품의 가공',
    method: 'activity',
    description: 'Processing of intermediate products sold by the reporting company by third parties',
    descriptionKo: '제3자가 보고 기업의 중간재를 가공할 때 발생하는 배출',
    sourceTypePatterns: ['cat10', 'sold-product-processing', 'intermediate-processing'],
  },
  11: {
    no: 11,
    code: 'CAT11',
    name: 'Use of Sold Products',
    nameKo: '판매된 제품의 사용',
    method: 'activity',
    description: 'End-use of goods and services sold by the reporting company',
    descriptionKo: '보고 기업이 판매한 제품의 최종 사용 단계에서 발생하는 배출',
    sourceTypePatterns: ['cat11', 'product-use', 'sold-product-use', 'consumer-use'],
  },
  12: {
    no: 12,
    code: 'CAT12',
    name: 'End-of-Life Treatment of Sold Products',
    nameKo: '판매된 제품의 처리',
    method: 'activity',
    description: 'Waste disposal and treatment of products sold by the reporting company',
    descriptionKo: '보고 기업이 판매한 제품의 수명 종료 후 처리에서 발생하는 배출',
    sourceTypePatterns: ['cat12', 'product-eol', 'product-disposal', 'end-of-life'],
  },
  13: {
    no: 13,
    code: 'CAT13',
    name: 'Downstream Leased Assets',
    nameKo: '하류 임대 자산',
    method: 'activity',
    description: 'Operation of assets owned by the reporting company and leased to other entities',
    descriptionKo: '보고 기업 소유 자산을 제3자에게 임대 시 발생하는 배출',
    sourceTypePatterns: ['cat13', 'downstream-lease', 'leased-to-others', 'property-lease'],
  },
  14: {
    no: 14,
    code: 'CAT14',
    name: 'Franchises',
    nameKo: '프랜차이즈',
    method: 'activity',
    description: 'Operation of franchises not included in Scope 1 and 2',
    descriptionKo: 'Scope 1·2에 포함되지 않는 프랜차이즈 운영에서 발생하는 배출',
    sourceTypePatterns: ['cat14', 'franchise', 'franchisee'],
  },
  15: {
    no: 15,
    code: 'CAT15',
    name: 'Investments',
    nameKo: '투자',
    method: 'spend',
    description: 'Scope 3 emissions associated with the reporting company\'s investments',
    descriptionKo: '보고 기업의 투자 활동과 관련된 배출 (금융 기관의 경우 핵심 카테고리)',
    sourceTypePatterns: ['cat15', 'investment', 'portfolio', 'equity', 'bond'],
  },
} as const;

// ─── 헬퍼 함수 ───────────────────────────────────────────────────

/**
 * sourceType 문자열에서 Scope 3 카테고리 번호 추출
 * 패턴: 'cat6_business_travel', 'CAT06-air', 'category-6' 등 지원
 */
export function getCategoryNo(sourceType: string): number | null {
  // 직접 숫자 패턴: cat1, cat06, CAT15, category-3
  const directMatch = sourceType.match(/cat(?:egory)?[-_]?(\d{1,2})/i);
  if (directMatch && directMatch[1] !== undefined) {
    const no = parseInt(directMatch[1]);
    if (isValidScope3Category(no)) return no;
  }

  // 소스 타입 패턴 매칭
  const lowerType = sourceType.toLowerCase();
  for (const [no, category] of Object.entries(SCOPE3_CATEGORIES)) {
    for (const pattern of category.sourceTypePatterns) {
      if (lowerType.includes(pattern)) {
        return Number(no);
      }
    }
  }

  return null; // 판별 불가
}

/**
 * 유효한 Scope 3 카테고리 번호 검증 (1-15)
 */
export function isValidScope3Category(no: number): boolean {
  return Number.isInteger(no) && no >= 1 && no <= 15;
}

/**
 * 카테고리 코드로 조회 (예: 'CAT06')
 */
export function getCategoryByCode(code: string): Scope3Category | undefined {
  return Object.values(SCOPE3_CATEGORIES).find(
    (c) => c.code.toUpperCase() === code.toUpperCase()
  );
}

/**
 * 계산 방식별 카테고리 목록
 */
export function getCategoriesByMethod(method: Scope3CalcMethod): Scope3Category[] {
  return Object.values(SCOPE3_CATEGORIES).filter(
    (c) => c.method === method || c.method === 'spend-or-activity'
  );
}

/**
 * 모든 카테고리 배열 반환 (번호 순서)
 */
export function getAllScope3Categories(): Scope3Category[] {
  return Object.values(SCOPE3_CATEGORIES).sort((a, b) => a.no - b.no);
}
