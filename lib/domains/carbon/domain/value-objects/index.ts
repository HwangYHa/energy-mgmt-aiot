/**
 * Carbon Domain — Value Objects
 *
 * Value Object 원칙:
 * - 불변 (immutable): 한 번 생성된 값은 변경 불가
 * - 동등성: 참조가 아닌 값으로 비교
 * - 자체 검증: 생성 시점에 유효성 보장 (불변식)
 * - 부작용 없음: 순수 함수만 포함
 */

import crypto from 'crypto';


// ─── EmissionValue ────────────────────────────────────────────────────────────

/**
 * 배출량 값 객체 (항상 tCO2eq 단위)
 * 소수점 6자리로 반올림 (국제 표준 정밀도)
 */
export class EmissionValue {
  readonly value: number;
  readonly unit = 'tCO2eq' as const;

  private constructor(value: number) {
    if (!Number.isFinite(value)) throw new Error('배출량은 유효한 숫자여야 합니다');
    if (value < 0) throw new Error('배출량은 0 이상이어야 합니다');
    this.value = Math.round(value * 1_000_000) / 1_000_000; // 6자리 반올림
  }

  static of(value: number): EmissionValue {
    return new EmissionValue(value);
  }

  add(other: EmissionValue): EmissionValue {
    return new EmissionValue(this.value + other.value);
  }

  equals(other: EmissionValue): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return `${this.value.toFixed(6)} ${this.unit}`;
  }
}

// ─── ValidityPeriod ───────────────────────────────────────────────────────────

/**
 * 유효기간 값 객체
 * - validTo=null: 무한대 (현재까지 유효)
 * - 생성 시 validFrom < validTo 보장
 */
export class ValidityPeriod {
  readonly from: Date;
  readonly to: Date | null;

  private constructor(from: Date, to: Date | null) {
    if (to !== null && from >= to) {
      throw new Error(
        `validFrom(${from.toISOString()})은 validTo(${to.toISOString()})보다 이전이어야 합니다`
      );
    }
    this.from = from;
    this.to = to;
  }

  static of(from: Date, to: Date | null): ValidityPeriod {
    return new ValidityPeriod(from, to);
  }

  /** 특정 시점이 유효기간 내인지 확인 */
  contains(date: Date): boolean {
    if (date < this.from) return false;
    if (this.to !== null && date > this.to) return false;
    return true;
  }

  /** 두 유효기간이 겹치는지 확인 */
  overlaps(other: ValidityPeriod): boolean {
    // [a, b] ∩ [c, d] ≠ ∅ ↔ a <= d AND c <= b
    const aEnd = this.to ?? new Date(8640000000000000); // 최대 날짜
    const bEnd = other.to ?? new Date(8640000000000000);
    return this.from <= bEnd && other.from <= aEnd;
  }

  toString(): string {
    return `[${this.from.toISOString().split('T')[0]}, ${this.to?.toISOString().split('T')[0] ?? '∞'}]`;
  }
}

// ─── FactorVersion ────────────────────────────────────────────────────────────

/**
 * Semantic Version 값 객체
 * 형식: major.minor.patch (예: 1.0.0, 1.1.0, 2.0.0)
 */
export class FactorVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;

  private constructor(major: number, minor: number, patch: number) {
    if (!Number.isInteger(major) || !Number.isInteger(minor) || !Number.isInteger(patch)) {
      throw new Error('버전 번호는 정수여야 합니다');
    }
    if (major < 0 || minor < 0 || patch < 0) {
      throw new Error('버전 번호는 0 이상이어야 합니다');
    }
    this.major = major;
    this.minor = minor;
    this.patch = patch;
  }

  static of(version: string): FactorVersion {
    const parts = version.split('.').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
      throw new Error(`잘못된 버전 형식입니다: ${version}. 예: 1.0.0`);
    }
    return new FactorVersion(parts[0]!, parts[1]!, parts[2]!);
  }

  static initial(): FactorVersion {
    return new FactorVersion(1, 0, 0);
  }

  /** 값 변경 시 minor 증가 (1.0.0 → 1.1.0) */
  bumpMinor(): FactorVersion {
    return new FactorVersion(this.major, this.minor + 1, 0);
  }

  /** 메타 변경 시 patch 증가 (1.0.0 → 1.0.1) */
  bumpPatch(): FactorVersion {
    return new FactorVersion(this.major, this.minor, this.patch + 1);
  }

  /** 주요 변경(규제 개편 등) 시 major 증가 (1.x.x → 2.0.0) */
  bumpMajor(): FactorVersion {
    return new FactorVersion(this.major + 1, 0, 0);
  }

  equals(other: FactorVersion): boolean {
    return this.major === other.major &&
           this.minor === other.minor &&
           this.patch === other.patch;
  }

  isNewerThan(other: FactorVersion): boolean {
    if (this.major !== other.major) return this.major > other.major;
    if (this.minor !== other.minor) return this.minor > other.minor;
    return this.patch > other.patch;
  }

  toString(): string {
    return `${this.major}.${this.minor}.${this.patch}`;
  }
}

// ─── RecordHash ───────────────────────────────────────────────────────────────

/**
 * 레코드 무결성 Hash 값 객체
 * SHA-256으로 핵심 필드 해시 → 레코드 변조 탐지
 *
 * 해시 포함 필드 (변경 금지 — 변경 시 기존 해시 모두 무효):
 *   factorValue, unit, inputUnit, validFrom, validTo, sourceName, sourceVersion, createdBy, createdAt
 */
export class RecordHash {
  readonly hash: string;

  private constructor(hash: string) {
    if (!/^[0-9a-f]{64}$/.test(hash)) {
      throw new Error('잘못된 SHA-256 해시 형식입니다');
    }
    this.hash = hash;
  }

  static compute(data: {
    factorValue: number | string;
    unit: string;
    inputUnit: string;
    validFrom: Date;
    validTo: Date | null;
    sourceName: string;
    sourceVersion?: string | null;
    createdBy: string;
    createdAt: Date;
  }): RecordHash {
    // 결정론적 직렬화: key 정렬 + 날짜 ISO 변환
    const payload = {
      factorValue: String(data.factorValue),
      unit: data.unit,
      inputUnit: data.inputUnit,
      validFrom: data.validFrom.toISOString(),
      validTo: data.validTo?.toISOString() ?? null,
      sourceName: data.sourceName,
      sourceVersion: data.sourceVersion ?? null,
      createdBy: data.createdBy,
      createdAt: data.createdAt.toISOString(),
    };

    const json = JSON.stringify(payload, Object.keys(payload).sort());
    const hash = crypto.createHash('sha256').update(json, 'utf8').digest('hex');
    return new RecordHash(hash);
  }

  static fromStored(hash: string): RecordHash {
    return new RecordHash(hash);
  }

  equals(other: RecordHash): boolean {
    return this.hash === other.hash;
  }

  toString(): string {
    return this.hash;
  }
}

// ─── UnitConversion ───────────────────────────────────────────────────────────

/** 단위 변환 표 (표준 단위 기준) */
const UNIT_TABLES = {
  energy: { kWh: 1, MWh: 1_000, GWh: 1_000_000, TJ: 277_777.78, MJ: 0.277778, GJ: 277.778 },
  volume: { L: 1, kL: 1_000, mL: 0.001, m3: 1_000, ft3: 28.3168 },
  mass:   { kg: 1, t: 1_000, mt: 1_000, g: 0.001, lb: 0.453592 },
  distance: { km: 1, m: 0.001, mile: 1.60934, nmi: 1.852 },
  currency: { KRW: 1, USD: 1_400, EUR: 1_500 }, // 환율은 외부에서 주입 권장
} as const;

type UnitCategory = keyof typeof UNIT_TABLES;

/**
 * 단위 변환 값 객체
 */
export class UnitConversion {
  readonly originalValue: number;
  readonly originalUnit: string;
  readonly convertedValue: number;
  readonly standardUnit: string;
  readonly conversionFactor: number;

  private constructor(
    originalValue: number,
    originalUnit: string,
    convertedValue: number,
    standardUnit: string,
    conversionFactor: number
  ) {
    this.originalValue = originalValue;
    this.originalUnit = originalUnit;
    this.convertedValue = convertedValue;
    this.standardUnit = standardUnit;
    this.conversionFactor = conversionFactor;
  }

  static convert(value: number, unit: string): UnitConversion {
    for (const [category, table] of Object.entries(UNIT_TABLES)) {
      if (unit in table) {
        const factor = (table as Record<string, number>)[unit]!;
        const standardUnit = UnitConversion._standardUnitOf(category as UnitCategory);
        return new UnitConversion(value, unit, value * factor, standardUnit, factor);
      }
    }
    // 알 수 없는 단위: 1:1 변환 (Scope 3 커스텀 단위 등)
    return new UnitConversion(value, unit, value, unit, 1);
  }

  private static _standardUnitOf(category: UnitCategory): string {
    const map: Record<UnitCategory, string> = {
      energy: 'kWh', volume: 'L', mass: 'kg', distance: 'km', currency: 'KRW',
    };
    return map[category];
  }

  static supportedUnits(): string[] {
    return Object.values(UNIT_TABLES).flatMap(t => Object.keys(t));
  }

  static isCurrency(unit: string): boolean {
    return unit in UNIT_TABLES.currency;
  }
}
