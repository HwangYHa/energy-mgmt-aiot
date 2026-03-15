/**
 * 배출량 계산기 단위 테스트
 *
 * Big4 감사 대응: 계산 결과의 결정론적 정확성 검증
 * 한국 환경부 / IPCC 표준 배출계수 기반 검증값 사용
 *
 * 실행: npx jest __tests__/carbon/scope-calculator.test.ts
 */

import { Scope1Calculator } from '@/lib/domains/carbon/strategies/scope1.calculator';
import { Scope2LocationCalculator } from '@/lib/domains/carbon/strategies/scope2-location.calculator';
import { Scope2MarketCalculator } from '@/lib/domains/carbon/strategies/scope2-market.calculator';
import { Scope3Calculator } from '@/lib/domains/carbon/strategies/scope3.calculator';
import { getCalculator, getCalculatorVersions } from '@/lib/domains/carbon/strategies/index';
import type { CalculateEmissionsInput } from '@/lib/domains/carbon/strategies/types';

// ─── 공통 입력 헬퍼 ─────────────────────────────────────────────────────────

function makeInput(overrides: Partial<CalculateEmissionsInput>): CalculateEmissionsInput {
  return {
    tenantId: 'test-tenant',
    scope: 'scope1',
    sourceType: 'diesel',
    activityData: 1000,
    activityUnit: 'L',
    period: '2026-01',
    dataSource: 'manual',
    calculatedBy: 'test',
    ...overrides,
  };
}

// ─── Scope 1 ─────────────────────────────────────────────────────────────────

describe('Scope1Calculator', () => {
  const calc = new Scope1Calculator();

  it('경유 1000L × 2.664 tCO2eq/L = 2664 tCO2eq', () => {
    const input = makeInput({ activityData: 1000, activityUnit: 'L', sourceType: 'diesel' });
    const result = calc.calculate(input, 2.664);
    expect(result.emissions).toBeCloseTo(2664, 3);
    expect(result.unit).toBe('tCO2eq');
    expect(result.calculationMethod).toBe('scope1-combustion');
  });

  it('LNG 1 kL = 1000 L로 변환 후 계산', () => {
    const input = makeInput({ activityData: 1, activityUnit: 'kL', sourceType: 'lng' });
    const result = calc.calculate(input, 2.664);
    // 1 kL = 1000 L → 1000 × 2.664 = 2664
    expect(result.emissions).toBeCloseTo(2664, 3);
    expect(result.conversionFactor).toBe(1000);
  });

  it('에너지 기준 1 MJ × 계수', () => {
    const input = makeInput({ activityData: 100, activityUnit: 'MJ', sourceType: 'coal' });
    // 100 MJ × 0.277778 kWh/MJ = 27.7778 kWh
    const result = calc.calculate(input, 0.1);
    expect(result.emissions).toBeCloseTo(100 * 0.277778 * 0.1, 3);
  });

  it('음수 activityData 거부', () => {
    const input = makeInput({ activityData: -1 });
    const valid = calc.validate(input);
    expect(valid.valid).toBe(false);
    expect(valid.errors.length).toBeGreaterThan(0);
  });

  it('0 activityData 거부 (양수만 허용)', () => {
    const input = makeInput({ activityData: 0 });
    const valid = calc.validate(input);
    expect(valid.valid).toBe(false);
  });

  it('미지원 단위 거부', () => {
    const input = makeInput({ activityUnit: 'barrel' });
    const valid = calc.validate(input);
    expect(valid.valid).toBe(false);
    expect(valid.errors[0]).toContain('barrel');
  });

  it('formula 문자열에 계산식 포함', () => {
    const input = makeInput({ activityData: 500, activityUnit: 'L' });
    const result = calc.calculate(input, 2.0);
    expect(result.formula).toContain('500.000000 L');
    expect(result.formula).toContain('2.000000 tCO2eq/L');
    expect(result.formula).toContain('1000.000000 tCO2eq');
  });

  it('잘못된 scope 전달 시 에러', () => {
    const input = makeInput({ scope: 'scope2_location' });
    expect(() => calc.calculate(input, 1.0)).toThrow();
  });
});

// ─── Scope 2 Location-based ──────────────────────────────────────────────────

describe('Scope2LocationCalculator', () => {
  const calc = new Scope2LocationCalculator();

  it('전력 1000 kWh × 0.4567 = 456.7 tCO2eq', () => {
    const input = makeInput({ scope: 'scope2_location', activityData: 1000, activityUnit: 'kWh', sourceType: 'grid-korea' });
    const result = calc.calculate(input, 0.4567);
    expect(result.emissions).toBeCloseTo(456.7, 3);
    expect(result.calculationMethod).toBe('scope2-location-based');
  });

  it('1 MWh = 1000 kWh로 변환', () => {
    const input = makeInput({ scope: 'scope2_location', activityData: 1, activityUnit: 'MWh', sourceType: 'grid-korea' });
    const result = calc.calculate(input, 0.4567);
    expect(result.emissions).toBeCloseTo(456.7, 3);
    expect(result.conversionFactor).toBe(1000);
  });

  it('0 전력 사용 허용 (배출량 0)', () => {
    const input = makeInput({ scope: 'scope2_location', activityData: 0, activityUnit: 'kWh' });
    const result = calc.calculate(input, 0.4567);
    expect(result.emissions).toBe(0);
  });

  it('음수 전력 거부', () => {
    const input = makeInput({ scope: 'scope2_location', activityData: -100, activityUnit: 'kWh' });
    expect(() => calc.calculate(input, 0.4567)).toThrow();
  });

  it('formula에 location-based 표기', () => {
    const input = makeInput({ scope: 'scope2_location', activityData: 100, activityUnit: 'kWh' });
    const result = calc.calculate(input, 0.4567);
    expect(result.formula).toContain('[location-based]');
  });
});

// ─── Scope 2 Market-based ────────────────────────────────────────────────────

describe('Scope2MarketCalculator', () => {
  const calc = new Scope2MarketCalculator();

  it('PPA 없을 때: 1000 kWh × 0.4567 = 456.7 tCO2eq', () => {
    const input = makeInput({ scope: 'scope2_market', activityData: 1000, activityUnit: 'kWh' });
    const result = calc.calculate(input, 0.4567);
    expect(result.emissions).toBeCloseTo(456.7, 3);
  });

  it('PPA 300 kWh 반영: (1000-300) × 0.4567 = 319.69 tCO2eq', () => {
    const input = makeInput({
      scope: 'scope2_market',
      activityData: 1000,
      activityUnit: 'kWh',
      renewableEnergy: 300,
    });
    const result = calc.calculate(input, 0.4567);
    expect(result.emissions).toBeCloseTo(700 * 0.4567, 3);
    expect(result.calculationMethod).toBe('scope2-market-based');
  });

  it('PPA = 전력 전량: 배출량 0', () => {
    const input = makeInput({
      scope: 'scope2_market',
      activityData: 1000,
      activityUnit: 'kWh',
      renewableEnergy: 1000,
    });
    const result = calc.calculate(input, 0.4567);
    expect(result.emissions).toBe(0);
  });

  it('PPA > 전력 사용: 음수 방지 (max 0)', () => {
    // 검증은 경고만, 계산은 max(0,...) 처리
    const input = makeInput({
      scope: 'scope2_market',
      activityData: 500,
      activityUnit: 'kWh',
      renewableEnergy: 800, // 전력보다 많음
    });
    const result = calc.calculate(input, 0.4567);
    expect(result.emissions).toBe(0);
  });

  it('formula에 market-based 표기', () => {
    const input = makeInput({ scope: 'scope2_market', activityData: 100, activityUnit: 'kWh', renewableEnergy: 30 });
    const result = calc.calculate(input, 0.4567);
    expect(result.formula).toContain('[market-based]');
    expect(result.formula).toContain('재생에너지');
  });
});

// ─── Scope 3 ─────────────────────────────────────────────────────────────────

describe('Scope3Calculator', () => {
  const calc = new Scope3Calculator();

  it('Activity-based: 출장 1000 km × 0.14 tCO2/km = 140 tCO2eq', () => {
    const input = makeInput({
      scope: 'scope3',
      activityData: 1000,
      activityUnit: 'km',
      sourceType: 'cat06_air_travel',
      scope3CategoryNo: 6,
    });
    const result = calc.calculate(input, 0.14);
    expect(result.emissions).toBeCloseTo(140, 3);
    expect(result.calculationMethod).toBe('scope3-activity-based');
  });

  it('Spend-based: 구매비 10,000,000 KRW × 0.5 tCO2/백만KRW = 5 tCO2eq', () => {
    const input = makeInput({
      scope: 'scope3',
      activityData: 10_000_000,
      activityUnit: 'KRW',
      sourceType: 'cat01_purchased_goods',
      scope3CategoryNo: 1,
    });
    const result = calc.calculate(input, 0.5);
    // 10,000,000 KRW ÷ 1,000,000 × 0.5 = 5 tCO2eq
    expect(result.emissions).toBeCloseTo(5, 3);
    expect(result.calculationMethod).toBe('scope3-spend-based');
  });

  it('카테고리 자동 추론 (sourceType에서)', () => {
    const input = makeInput({
      scope: 'scope3',
      activityData: 100,
      activityUnit: 'km',
      sourceType: 'business-travel-air',
    });
    const result = calc.calculate(input, 0.1);
    // sourceType 'business-travel' → CAT06
    expect(result.formula).toContain('CAT06');
  });

  it('잘못된 카테고리 번호 거부', () => {
    const input = makeInput({
      scope: 'scope3',
      scope3CategoryNo: 16, // 1-15 범위 초과
      activityData: 100,
      activityUnit: 'km',
    });
    const valid = calc.validate(input);
    expect(valid.valid).toBe(false);
    expect(valid.errors[0]).toContain('16');
  });

  it('formula에 카테고리 표기', () => {
    const input = makeInput({
      scope: 'scope3',
      activityData: 500,
      activityUnit: 'kg',
      scope3CategoryNo: 5,
    });
    const result = calc.calculate(input, 0.02);
    expect(result.formula).toContain('CAT05');
  });
});

// ─── Strategy Registry ────────────────────────────────────────────────────────

describe('getCalculator (Strategy Registry)', () => {
  it('scope1 → Scope1Calculator', () => {
    const calc = getCalculator('scope1');
    expect(calc.scope).toBe('scope1');
  });

  it('scope2_location → Scope2LocationCalculator', () => {
    const calc = getCalculator('scope2_location');
    expect(calc.scope).toBe('scope2_location');
  });

  it('scope2_market → Scope2MarketCalculator', () => {
    const calc = getCalculator('scope2_market');
    expect(calc.scope).toBe('scope2_market');
  });

  it('scope3 → Scope3Calculator', () => {
    const calc = getCalculator('scope3');
    expect(calc.scope).toBe('scope3');
  });

  it('계산기 버전 정보 반환', () => {
    const versions = getCalculatorVersions();
    expect(versions.scope1).toBeDefined();
    expect(versions.scope2_location).toBeDefined();
    expect(versions.scope2_market).toBeDefined();
    expect(versions.scope3).toBeDefined();
  });
});

// ─── Determinism (결정론적 계산 검증) ────────────────────────────────────────

describe('Determinism: 동일 입력 → 항상 동일 출력', () => {
  it('Scope1: 동일 입력 10회 연속 동일 결과', () => {
    const calc = new Scope1Calculator();
    const input = makeInput({ activityData: 1234.5678, activityUnit: 'L' });
    const results = Array.from({ length: 10 }, () => calc.calculate(input, 2.664).emissions);
    expect(new Set(results).size).toBe(1); // 모두 동일
  });

  it('Scope2Market: PPA 반영 동일 입력 반복 검증', () => {
    const calc = new Scope2MarketCalculator();
    const input = makeInput({
      scope: 'scope2_market',
      activityData: 9876,
      activityUnit: 'kWh',
      renewableEnergy: 1234,
    });
    const results = Array.from({ length: 10 }, () => calc.calculate(input, 0.4567).emissions);
    expect(new Set(results).size).toBe(1);
  });
});
