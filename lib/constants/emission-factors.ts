// lib/constants/emission-factors.ts

/**
 * 🌍 탄소배출계수 마스터 데이터베이스
 * 
 * 출처:
 * - 전력: 한국전력 (2023년 기준)
 * - 연료: 온실가스 배출권거래제 운영을 위한 검증지침
 * - 운송: 환경부 국가 온실가스 인벤토리
 * 
 * 버전: 2024.1
 * 최종 업데이트: 2024-01-30
 */

export interface EmissionFactor {
  id: string;
  category: 'electricity' | 'fuel' | 'transport' | 'refrigerant' | 'process';
  sourceType: string;
  factor: number;
  unit: string;
  scope: 1 | 2 | 3;
  version: string;
  validFrom: string;
  validTo?: string;
  source: string;
  notes?: string;
}

/**
 * Scope 2: 전력 배출계수
 */
export const ELECTRICITY_FACTORS: EmissionFactor[] = [
  {
    id: 'elec-kr-grid-2023',
    category: 'electricity',
    sourceType: 'grid',
    factor: 0.4593, // tCO₂/MWh
    unit: 'tCO₂/MWh',
    scope: 2,
    version: '2023',
    validFrom: '2023-01-01',
    validTo: '2024-12-31',
    source: '한국전력공사',
    notes: '2023년 전력계통 배출계수',
  },
  {
    id: 'elec-kr-grid-2024',
    category: 'electricity',
    sourceType: 'grid',
    factor: 0.4368, // 예상값 (감소 추세)
    unit: 'tCO₂/MWh',
    scope: 2,
    version: '2024',
    validFrom: '2024-01-01',
    source: '한국전력공사 (예정)',
    notes: '2024년 전력계통 배출계수 (예상)',
  },
  {
    id: 'elec-renewable',
    category: 'electricity',
    sourceType: 'renewable',
    factor: 0,
    unit: 'tCO₂/MWh',
    scope: 2,
    version: '2024',
    validFrom: '2024-01-01',
    source: 'RE100',
    notes: '재생에너지 (태양광, 풍력 등)',
  },
];

/**
 * Scope 1: 연료 연소 배출계수
 */
export const FUEL_FACTORS: EmissionFactor[] = [
  // 액체 연료
  {
    id: 'fuel-diesel',
    category: 'fuel',
    sourceType: 'diesel',
    factor: 2.68,
    unit: 'tCO₂/kL',
    scope: 1,
    version: '2024',
    validFrom: '2024-01-01',
    source: '온실가스 배출권거래제 운영을 위한 검증지침',
    notes: '경유 (Diesel)',
  },
  {
    id: 'fuel-gasoline',
    category: 'fuel',
    sourceType: 'gasoline',
    factor: 2.31,
    unit: 'tCO₂/kL',
    scope: 1,
    version: '2024',
    validFrom: '2024-01-01',
    source: '온실가스 배출권거래제 운영을 위한 검증지침',
    notes: '휘발유 (Gasoline)',
  },
  {
    id: 'fuel-kerosene',
    category: 'fuel',
    sourceType: 'kerosene',
    factor: 2.53,
    unit: 'tCO₂/kL',
    scope: 1,
    version: '2024',
    validFrom: '2024-01-01',
    source: '온실가스 배출권거래제 운영을 위한 검증지침',
    notes: '등유 (Kerosene)',
  },
  {
    id: 'fuel-bunker-c',
    category: 'fuel',
    sourceType: 'bunker-c',
    factor: 3.12,
    unit: 'tCO₂/kL',
    scope: 1,
    version: '2024',
    validFrom: '2024-01-01',
    source: '온실가스 배출권거래제 운영을 위한 검증지침',
    notes: 'B-C유 (Bunker-C)',
  },

  // 기체 연료
  {
    id: 'fuel-lng',
    category: 'fuel',
    sourceType: 'lng',
    factor: 2.75,
    unit: 'tCO₂/ton',
    scope: 1,
    version: '2024',
    validFrom: '2024-01-01',
    source: '온실가스 배출권거래제 운영을 위한 검증지침',
    notes: '액화천연가스 (LNG)',
  },
  {
    id: 'fuel-lpg',
    category: 'fuel',
    sourceType: 'lpg',
    factor: 3.00,
    unit: 'tCO₂/ton',
    scope: 1,
    version: '2024',
    validFrom: '2024-01-01',
    source: '온실가스 배출권거래제 운영을 위한 검증지침',
    notes: '액화석유가스 (LPG)',
  },

  // 고체 연료
  {
    id: 'fuel-coal-bituminous',
    category: 'fuel',
    sourceType: 'coal-bituminous',
    factor: 2.47,
    unit: 'tCO₂/ton',
    scope: 1,
    version: '2024',
    validFrom: '2024-01-01',
    source: '온실가스 배출권거래제 운영을 위한 검증지침',
    notes: '유연탄 (Bituminous Coal)',
  },
  {
    id: 'fuel-coal-anthracite',
    category: 'fuel',
    sourceType: 'coal-anthracite',
    factor: 2.53,
    unit: 'tCO₂/ton',
    scope: 1,
    version: '2024',
    validFrom: '2024-01-01',
    source: '온실가스 배출권거래제 운영을 위한 검증지침',
    notes: '무연탄 (Anthracite)',
  },
];

/**
 * Scope 3: 운송 배출계수
 */
export const TRANSPORT_FACTORS: EmissionFactor[] = [
  // ── 화물차 (truck) ──────────────────────────────────────────
  {
    id: 'transport-truck-diesel',
    category: 'transport',
    sourceType: 'truck-diesel',
    factor: 0.062,
    unit: 'tCO₂/km',
    scope: 3,
    version: '2024',
    validFrom: '2024-01-01',
    source: '환경부 국가 온실가스 인벤토리',
    notes: '화물차 (디젤, 5톤 기준)',
  },
  {
    id: 'transport-truck-gasoline',
    category: 'transport',
    sourceType: 'truck-gasoline',
    factor: 0.052,
    unit: 'tCO₂/km',
    scope: 3,
    version: '2024',
    validFrom: '2024-01-01',
    source: '환경부 국가 온실가스 인벤토리',
    notes: '화물차 (휘발유, 5톤 기준)',
  },
  {
    id: 'transport-truck-lpg',
    category: 'transport',
    sourceType: 'truck-lpg',
    factor: 0.048,
    unit: 'tCO₂/km',
    scope: 3,
    version: '2024',
    validFrom: '2024-01-01',
    source: '환경부 국가 온실가스 인벤토리',
    notes: '화물차 (LPG, 5톤 기준)',
  },
  {
    id: 'transport-truck-lng',
    category: 'transport',
    sourceType: 'truck-lng',
    factor: 0.051,
    unit: 'tCO₂/km',
    scope: 3,
    version: '2024',
    validFrom: '2024-01-01',
    source: '환경부 국가 온실가스 인벤토리',
    notes: '화물차 (LNG, 5톤 기준)',
  },
  {
    id: 'transport-truck-electric',
    category: 'transport',
    sourceType: 'truck-electric',
    factor: 0.035,
    unit: 'tCO₂/km',
    scope: 3,
    version: '2024',
    validFrom: '2024-01-01',
    source: '환경부 국가 온실가스 인벤토리',
    notes: '화물차 (전기, 5톤 기준, 전력 배출계수 반영)',
  },

  // ── 승용차 (car) ─────────────────────────────────────────────
  {
    id: 'transport-car-diesel',
    category: 'transport',
    sourceType: 'car-diesel',
    factor: 0.000131,
    unit: 'tCO₂/km',
    scope: 3,
    version: '2024',
    validFrom: '2024-01-01',
    source: '환경부 국가 온실가스 인벤토리',
    notes: '승용차 (경유, 131 gCO₂/km 기준)',
  },
  {
    id: 'transport-car-gasoline',
    category: 'transport',
    sourceType: 'car-gasoline',
    factor: 0.000148,
    unit: 'tCO₂/km',
    scope: 3,
    version: '2024',
    validFrom: '2024-01-01',
    source: '환경부 국가 온실가스 인벤토리',
    notes: '승용차 (휘발유, 148 gCO₂/km 기준)',
  },
  {
    id: 'transport-car-electric',
    category: 'transport',
    sourceType: 'car-electric',
    factor: 0.000053,
    unit: 'tCO₂/km',
    scope: 3,
    version: '2024',
    validFrom: '2024-01-01',
    source: '환경부 국가 온실가스 인벤토리',
    notes: '승용차 (전기, 전력 배출계수 반영, 53 gCO₂/km 기준)',
  },
  {
    id: 'transport-car-lng',
    category: 'transport',
    sourceType: 'car-lng',
    factor: 0.000117,
    unit: 'tCO₂/km',
    scope: 3,
    version: '2024',
    validFrom: '2024-01-01',
    source: '환경부 국가 온실가스 인벤토리',
    notes: '승용차 (LNG/CNG, 117 gCO₂/km 기준)',
  },

  // ── 항공 (air) ───────────────────────────────────────────────
  {
    id: 'transport-air-diesel',
    category: 'transport',
    sourceType: 'air-diesel',
    factor: 0.000255,
    unit: 'tCO₂/km',
    scope: 3,
    version: '2024',
    validFrom: '2024-01-01',
    source: '환경부 국가 온실가스 인벤토리',
    notes: '항공 (국내선, 승객당 255 gCO₂/km 기준)',
  },
  {
    id: 'transport-air-gasoline',
    category: 'transport',
    sourceType: 'air-gasoline',
    factor: 0.000255,
    unit: 'tCO₂/km',
    scope: 3,
    version: '2024',
    validFrom: '2024-01-01',
    source: '환경부 국가 온실가스 인벤토리',
    notes: '항공 (경항공기 항공유 기준)',
  },
  {
    id: 'transport-air-electric',
    category: 'transport',
    sourceType: 'air-electric',
    factor: 0.000100,
    unit: 'tCO₂/km',
    scope: 3,
    version: '2024',
    validFrom: '2024-01-01',
    source: '환경부 국가 온실가스 인벤토리',
    notes: '항공 (전기, 전력 배출계수 기반 추정)',
  },
  {
    id: 'transport-air-lng',
    category: 'transport',
    sourceType: 'air-lng',
    factor: 0.000220,
    unit: 'tCO₂/km',
    scope: 3,
    version: '2024',
    validFrom: '2024-01-01',
    source: '환경부 국가 온실가스 인벤토리',
    notes: '항공 (LNG/SAF 대체 추정)',
  },

  // ── 해운 (ship) ──────────────────────────────────────────────
  {
    id: 'transport-ship-domestic',
    category: 'transport',
    sourceType: 'ship-domestic',
    factor: 0.011,
    unit: 'tCO₂/km',
    scope: 3,
    version: '2024',
    validFrom: '2024-01-01',
    source: '환경부 국가 온실가스 인벤토리',
    notes: '내항 선박 (500톤 기준)',
  },
  {
    id: 'transport-ship-diesel',
    category: 'transport',
    sourceType: 'ship-diesel',
    factor: 0.012,
    unit: 'tCO₂/km',
    scope: 3,
    version: '2024',
    validFrom: '2024-01-01',
    source: '환경부 국가 온실가스 인벤토리',
    notes: '선박 (디젤 벙커유)',
  },
  {
    id: 'transport-ship-gasoline',
    category: 'transport',
    sourceType: 'ship-gasoline',
    factor: 0.013,
    unit: 'tCO₂/km',
    scope: 3,
    version: '2024',
    validFrom: '2024-01-01',
    source: '환경부 국가 온실가스 인벤토리',
    notes: '선박 (휘발유/소형선박)',
  },
  {
    id: 'transport-ship-electric',
    category: 'transport',
    sourceType: 'ship-electric',
    factor: 0.005,
    unit: 'tCO₂/km',
    scope: 3,
    version: '2024',
    validFrom: '2024-01-01',
    source: '환경부 국가 온실가스 인벤토리',
    notes: '선박 (전기 추진, 전력 배출계수 반영)',
  },
  {
    id: 'transport-ship-lng',
    category: 'transport',
    sourceType: 'ship-lng',
    factor: 0.009,
    unit: 'tCO₂/km',
    scope: 3,
    version: '2024',
    validFrom: '2024-01-01',
    source: '환경부 국가 온실가스 인벤토리',
    notes: '선박 (LNG 추진)',
  },

  // ── 철도 (rail) ──────────────────────────────────────────────
  {
    id: 'transport-train-freight',
    category: 'transport',
    sourceType: 'train-freight',
    factor: 0.041,
    unit: 'tCO₂/km',
    scope: 3,
    version: '2024',
    validFrom: '2024-01-01',
    source: '환경부 국가 온실가스 인벤토리',
    notes: '화물 철도 (전기)',
  },
  {
    id: 'transport-rail-diesel',
    category: 'transport',
    sourceType: 'rail-diesel',
    factor: 0.045,
    unit: 'tCO₂/km',
    scope: 3,
    version: '2024',
    validFrom: '2024-01-01',
    source: '환경부 국가 온실가스 인벤토리',
    notes: '철도 (디젤 기관차)',
  },
  {
    id: 'transport-rail-gasoline',
    category: 'transport',
    sourceType: 'rail-gasoline',
    factor: 0.045,
    unit: 'tCO₂/km',
    scope: 3,
    version: '2024',
    validFrom: '2024-01-01',
    source: '환경부 국가 온실가스 인벤토리',
    notes: '철도 (휘발유)',
  },
  {
    id: 'transport-rail-electric',
    category: 'transport',
    sourceType: 'rail-electric',
    factor: 0.010,
    unit: 'tCO₂/km',
    scope: 3,
    version: '2024',
    validFrom: '2024-01-01',
    source: '환경부 국가 온실가스 인벤토리',
    notes: '철도 (전기, KTX/전철 기준)',
  },
  {
    id: 'transport-rail-lng',
    category: 'transport',
    sourceType: 'rail-lng',
    factor: 0.040,
    unit: 'tCO₂/km',
    scope: 3,
    version: '2024',
    validFrom: '2024-01-01',
    source: '환경부 국가 온실가스 인벤토리',
    notes: '철도 (LNG 기관차)',
  },
];

/**
 * Scope 1: 냉매 누출 배출계수 (GWP)
 */
export const REFRIGERANT_FACTORS: EmissionFactor[] = [
  {
    id: 'refrigerant-r22',
    category: 'refrigerant',
    sourceType: 'R-22',
    factor: 1810,
    unit: 'GWP',
    scope: 1,
    version: '2024',
    validFrom: '2024-01-01',
    source: 'IPCC AR5',
    notes: 'HCFC-22 (지구온난화지수)',
  },
  {
    id: 'refrigerant-r134a',
    category: 'refrigerant',
    sourceType: 'R-134a',
    factor: 1430,
    unit: 'GWP',
    scope: 1,
    version: '2024',
    validFrom: '2024-01-01',
    source: 'IPCC AR5',
    notes: 'HFC-134a (지구온난화지수)',
  },
  {
    id: 'refrigerant-r410a',
    category: 'refrigerant',
    sourceType: 'R-410A',
    factor: 2088,
    unit: 'GWP',
    scope: 1,
    version: '2024',
    validFrom: '2024-01-01',
    source: 'IPCC AR5',
    notes: 'HFC-410A (지구온난화지수)',
  },
];

/**
 * 모든 배출계수 통합
 */
export const ALL_EMISSION_FACTORS: EmissionFactor[] = [
  ...ELECTRICITY_FACTORS,
  ...FUEL_FACTORS,
  ...TRANSPORT_FACTORS,
  ...REFRIGERANT_FACTORS,
];

/**
 * 배출계수 조회 함수
 */
export function getEmissionFactor(
  category: string,
  sourceType: string,
  version?: string
): EmissionFactor | undefined {
  const factors = ALL_EMISSION_FACTORS.filter(
    (f) =>
      f.category === category &&
      f.sourceType === sourceType &&
      (!version || f.version === version)
  );

  // 가장 최신 버전 반환
  return factors.sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0];
}

/**
 * 현재 유효한 배출계수 조회
 */
export function getCurrentEmissionFactor(
  category: string,
  sourceType: string
): EmissionFactor | undefined {
  const today = new Date().toISOString().split('T')[0]!; // ISO date string always has T separator

  const factors = ALL_EMISSION_FACTORS.filter(
    (f) =>
      f.category === category &&
      f.sourceType === sourceType &&
      f.validFrom <= today &&
      (!f.validTo || f.validTo >= today)
  );

  return factors[0];
}

/**
 * Scope별 배출계수 조회
 */
export function getEmissionFactorsByScope(scope: 1 | 2 | 3): EmissionFactor[] {
  return ALL_EMISSION_FACTORS.filter((f) => f.scope === scope);
}

/**
 * 배출량 계산 헬퍼 함수
 */
export function calculateEmission(
  category: string,
  sourceType: string,
  amount: number,
  unit: string
): number {
  const factor = getCurrentEmissionFactor(category, sourceType);
  
  if (!factor) {
    throw new Error(`Emission factor not found: ${category}/${sourceType}`);
  }

  // 단위 변환 (필요시)
  let convertedAmount = amount;
  
  if (factor.unit === 'tCO₂/MWh' && unit === 'kWh') {
    convertedAmount = amount / 1000; // kWh → MWh
  }

  return convertedAmount * factor.factor;
}