/**
 * lib/utils/kepco-pricing.ts
 * KEPCO 산업용(갑) II 고압A 요금 계산 유틸리티
 * 한국전력공사 전기요금표 기준 (2024년 기준)
 */

/** 계절 구분 */
export type Season = 'summer' | 'winter' | 'spring_fall';

/** 부하 시간대 구분 */
export type TimeType = 'offPeak' | 'midPeak' | 'onPeak';

/** KEPCO 산업용(갑) II 고압A 기본요금 (원/kW) */
const BASIC_RATE: Record<Season, number> = {
  summer: 8320,
  winter: 7220,
  spring_fall: 7220,
};

/** KEPCO 산업용(갑) II 고압A 전력량요금 (원/kWh) */
const ENERGY_RATE: Record<Season, Record<TimeType, number>> = {
  summer: {
    offPeak: 68.5,
    midPeak: 116.8,
    onPeak: 234.4,
  },
  winter: {
    offPeak: 63.6,
    midPeak: 110.8,
    onPeak: 174.7,
  },
  spring_fall: {
    offPeak: 61.4,
    midPeak: 102.6,
    onPeak: 139.6,
  },
};

/** 전력산업기반기금 요율 */
export const FUND_RATE = 0.037;
/** 부가가치세 요율 */
export const VAT_RATE = 0.1;

/**
 * 날짜로부터 계절 반환
 * 하계: 7~8월, 동계: 11~2월, 춘추계: 나머지
 */
export function getSeason(date: Date): Season {
  const month = date.getMonth() + 1; // 1-12
  if (month >= 7 && month <= 8) return 'summer';
  if (month === 11 || month === 12 || month <= 2) return 'winter';
  return 'spring_fall';
}

/**
 * 시간(0-23)과 계절로 부하 시간대 반환
 * 기준: 산업용(갑) II 고압A 요금제
 */
export function getTimeType(hour: number, season: Season): TimeType {
  // 경부하: 23:00 ~ 09:00 (모든 계절 공통)
  if (hour >= 23 || hour < 9) return 'offPeak';

  if (season === 'summer') {
    // 하계 최대부하: 10-12, 13-17
    if ((hour >= 10 && hour < 12) || (hour >= 13 && hour < 17)) return 'onPeak';
    // 하계 중간부하: 9-10, 12-13, 17-23
    return 'midPeak';
  } else if (season === 'winter') {
    // 동계 최대부하: 10-12, 17-20
    if ((hour >= 10 && hour < 12) || (hour >= 17 && hour < 20)) return 'onPeak';
    // 동계 중간부하: 9-10, 12-17, 20-23
    return 'midPeak';
  } else {
    // 춘추계 최대부하: 10-12, 13-17
    if ((hour >= 10 && hour < 12) || (hour >= 13 && hour < 17)) return 'onPeak';
    // 춘추계 중간부하: 9-10, 12-13, 17-23
    return 'midPeak';
  }
}

/**
 * kWh를 요금으로 변환 (원)
 */
export function calcEnergyCost(kwh: number, timeType: TimeType, season: Season): number {
  return kwh * ENERGY_RATE[season][timeType];
}

/**
 * 월별 전기요금 계산
 * @param contractPower 계약전력 (kW)
 * @param energyByTimeType 시간대별 kWh 소비량
 * @param month 해당 월 (Date)
 */
export interface CostBreakdown {
  basicCharge: number;
  energyCharge: number;
  subtotal: number;
  fund: number;
  vat: number;
  total: number;
}

export function calcMonthlyCost(
  contractPower: number,
  energyByTimeType: Record<TimeType, number>,
  month: Date
): CostBreakdown {
  const season = getSeason(month);
  const basicCharge = Math.round(contractPower * BASIC_RATE[season]);
  const energyCharge = Math.round(
    energyByTimeType.offPeak * ENERGY_RATE[season].offPeak +
    energyByTimeType.midPeak * ENERGY_RATE[season].midPeak +
    energyByTimeType.onPeak * ENERGY_RATE[season].onPeak
  );
  const subtotal = basicCharge + energyCharge;
  const fund = Math.round(subtotal * FUND_RATE);
  const vat = Math.round(subtotal * VAT_RATE);
  const total = subtotal + fund + vat;

  return { basicCharge, energyCharge, subtotal, fund, vat, total };
}
