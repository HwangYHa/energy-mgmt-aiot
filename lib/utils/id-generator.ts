/**
 * ID 생성 유틸리티
 *
 * 각 테이블별 고유 접두사 + 타임스탬프 기반 짧은 ID 생성
 * 형식: {PREFIX}_{BASE36_TIMESTAMP}{RANDOM}
 * 예: TNT_m5k8x2a1, USR_n3p7q9b4, SIT_k2j6r8c5
 */

// 테이블별 접두사 매핑
export const TABLE_PREFIX = {
  tenant: 'TNT',
  user: 'USR',
  site: 'SIT',
  gateway: 'GW',
  device: 'DEV',
  sensor: 'SNR',
  metric: 'MET',
  measurement: 'MSR',
  subscription: 'SUB',
  plan: 'PLN',
  alert_rule: 'ALR',
  audit_log: 'AUD',
  report: 'RPT',
  forecast_result: 'FCT',
  dr_event: 'DRE',
  payment_history: 'PAY',
  notification_rule: 'NTR',
  notification_log: 'NTL',
  schedule: 'SCH',
  menu_group: 'MNG',
  menu_item: 'MNI',
} as const;

export type TableName = keyof typeof TABLE_PREFIX;

// Base62 문자셋 (0-9, a-z, A-Z)
const BASE62_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * 숫자를 Base62 문자열로 변환
 */
function toBase62(num: number): string {
  if (num === 0) return '0';
  let result = '';
  let n = Math.abs(num);
  while (n > 0) {
    result = BASE62_CHARS[n % 62] + result;
    n = Math.floor(n / 62);
  }
  return result;
}

/**
 * 크립토 랜덤 문자열 생성 (서버용)
 */
function randomBase62(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += BASE62_CHARS[Math.floor(Math.random() * 62)];
  }
  return result;
}

// 마지막 타임스탬프와 시퀀스 (동일 밀리초 내 순서 보장)
let lastTimestamp = 0;
let sequence = 0;

/**
 * TSID 스타일 고유 ID 생성
 *
 * 형식: {PREFIX}_{TIMESTAMP_BASE62}{RANDOM}
 * 총 길이: 접두사 3자 + _ + 본문 12자 = 약 16자
 *
 * @param table - 테이블 이름
 * @returns 접두사 포함 고유 ID (예: "TNT_m5k8x2a1b3c4")
 *
 * @example
 * generateId('tenant')  // "TNT_m5k8x2a1b3c4"
 * generateId('user')    // "USR_n3p7q9b4e5f6"
 * generateId('site')    // "SIT_k2j6r8c5g7h8"
 */
export function generateId(table: TableName): string {
  const prefix = TABLE_PREFIX[table];

  const now = Date.now();

  // 동일 밀리초 내 시퀀스 증가
  if (now === lastTimestamp) {
    sequence++;
  } else {
    lastTimestamp = now;
    sequence = 0;
  }

  // 타임스탬프를 Base62로 인코딩 (8자)
  const tsBase62 = toBase62(now).slice(-8);

  // 시퀀스 + 랜덤 (4자)
  const seqRand = toBase62(sequence) + randomBase62(3);
  const suffix = seqRand.slice(0, 4);

  return `${prefix}_${tsBase62}${suffix}`;
}

/**
 * ID에서 접두사 추출
 *
 * @example
 * getPrefix("TNT_m5k8x2a1b3c4") // "TNT"
 */
export function getPrefix(id: string): string {
  return id.split('_')[0] ?? '';
}

/**
 * ID의 접두사가 특정 테이블과 일치하는지 확인
 *
 * @example
 * isIdForTable("TNT_m5k8x2a1b3c4", "tenant") // true
 * isIdForTable("USR_m5k8x2a1b3c4", "tenant") // false
 */
export function isIdForTable(id: string, table: TableName): boolean {
  return getPrefix(id) === TABLE_PREFIX[table];
}
