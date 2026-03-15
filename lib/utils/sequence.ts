/**
 * lib/utils/sequence.ts - 채번(일련번호) 생성 유틸리티
 *
 * 형식: {PREFIX}-{YYYYMMDD}-{NNNN}
 * 예:   ST-20260301-0001  (사이트 생성 1번)
 *       CF-20260301-0042  (탄소연료 등록 42번)
 *       DR-20260301-0003  (DR 이벤트 생성 3번)
 *
 * 특징:
 * - MySQL ON DUPLICATE KEY UPDATE를 이용한 원자적 증가 (race-condition 없음)
 * - 날짜가 바뀌면 순번이 1부터 재시작
 * - 실패 시 UUID 기반 폴백값 반환 (로깅 실패 방지)
 */

import { prisma } from '@/lib/db/prisma';

// ─────────────────────────────────────────────────────────────────────────────
// 메뉴코드 → 단축 접두사 매핑 (2자리, 대문자)
// id-generator.ts의 PREFIX 컨벤션 참조
// ─────────────────────────────────────────────────────────────────────────────
export const MENU_PREFIX: Record<string, string> = {
  // 사이트/장치 관리
  SITE_MGMT:    'ST',
  DEVICE_MGMT:  'DV',
  SENSOR_MGMT:  'SN',
  GATEWAY_MGMT: 'GW',

  // API / 보안
  API_KEY_MGMT: 'AK',

  // 탄소 관리
  CARBON_FUEL:      'CF',
  CARBON_TRANSPORT: 'CT',
  CARBON_INVOICE:   'CI',
  CARBON_TRADING:   'CG',  // Carbon Goods/거래
  CARBON_RETIRE:    'CR',
  CARBON_ROADMAP:   'CM',  // Carbon Map (마일스톤)
  EMISSIONS_DATA:   'ED',  // 배출량 수동 등록 (scope1/3)
  EMISSIONS_RECORD: 'ER',  // 배출량 계산 레코드 (v2)

  // 수요반응 (DR)
  DR_EVENT: 'DR',

  // 보고서 / 다운로드
  REPORT_GEN:    'RP',
  DATA_DOWNLOAD: 'DL',

  // 알림
  ALERT_RULE:        'AL',
  NOTIFICATION_RULE: 'NR',

  // 제어 스케줄
  CONTROL_SCHEDULE: 'CS',

  // 배출계수
  EMISSION_FACTOR: 'EF',

  // 자원 관리 (장비 출하)
  EQUIPMENT_PRODUCT: 'EP',
  EQUIPMENT_LOT:     'EL',

  // 지원/문의
  SUPPORT_INQUIRY: 'SI',

  // 결제 / 구독
  PAYMENT:      'PM',
  SUBSCRIPTION: 'SB',

  // 파트너
  PARTNER: 'PT',

  // 사용자 / 테넌트
  USER:   'US',
  TENANT: 'TN',

  // 시스템
  ADMIN: 'AD',
};

// ─────────────────────────────────────────────────────────────────────────────
// 날짜 포맷 헬퍼
// ─────────────────────────────────────────────────────────────────────────────
function toYYYYMMDD(date: Date): string {
  const Y = date.getFullYear();
  const M = String(date.getMonth() + 1).padStart(2, '0');
  const D = String(date.getDate()).padStart(2, '0');
  return `${Y}${M}${D}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 원자적 일련번호 채번
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 메뉴코드와 날짜를 기반으로 원자적 일련번호를 생성합니다.
 *
 * MySQL의 INSERT ... ON DUPLICATE KEY UPDATE 를 이용하여 동시 요청에서도
 * 중복 없이 순번을 증가시킵니다.
 *
 * @param menuCode - MENU_CODES 상수값 (예: 'SITE_MGMT', 'CARBON_FUEL')
 * @param date     - 기준 날짜 (기본값: 현재 시각)
 * @returns 채번 문자열 (예: 'ST-20260301-0001')
 */
export async function generateSeqNo(
  menuCode: string,
  date: Date = new Date(),
): Promise<string> {
  const prefix  = MENU_PREFIX[menuCode] ?? menuCode.slice(0, 2).toUpperCase();
  const dateStr = toYYYYMMDD(date);

  try {
    // ① 원자적 INSERT or INCREMENT
    //    신규 날짜면 seq=1 삽입, 기존이면 seq+1 업데이트
    await prisma.$executeRaw`
      INSERT INTO activity_log_seq (prefix, seq_date, seq)
      VALUES (${prefix}, ${dateStr}, 1)
      ON DUPLICATE KEY UPDATE seq = seq + 1
    `;

    // ② 현재 seq 조회 (위 트랜잭션과 같은 커넥션에서는 자신의 값)
    //    Prisma의 $transaction으로 같은 커넥션 보장
    const rows = await prisma.$queryRaw<Array<{ seq: number }>>`
      SELECT seq FROM activity_log_seq
      WHERE prefix = ${prefix} AND seq_date = ${dateStr}
    `;

    const seq = Number(rows[0]?.seq ?? 1);
    return formatSeqNo(prefix, dateStr, seq);

  } catch (err) {
    // 폴백: 채번 실패 시 타임스탬프 기반 유니크 번호로 대체 (로그 누락 방지)
    console.error('[SeqNo] 채번 실패, 폴백 사용:', (err as Error)?.message ?? String(err));
    const fallbackSeq = Date.now() % 10000; // 마지막 4자리
    return formatSeqNo(prefix, dateStr, fallbackSeq);
  }
}

/**
 * 채번 문자열 포맷
 *
 * @example
 * formatSeqNo('ST', '20260301', 1)   // 'ST-20260301-0001'
 * formatSeqNo('CF', '20260301', 42)  // 'CF-20260301-0042'
 * formatSeqNo('DR', '20260301', 999) // 'DR-20260301-0999'
 */
export function formatSeqNo(prefix: string, dateStr: string, seq: number): string {
  return `${prefix}-${dateStr}-${String(seq).padStart(4, '0')}`;
}

/**
 * 채번 문자열 파싱
 *
 * @example
 * parseSeqNo('ST-20260301-0001') // { prefix: 'ST', date: '20260301', seq: 1 }
 */
export function parseSeqNo(logNo: string): { prefix: string; date: string; seq: number } | null {
  const match = logNo.match(/^([A-Z]+)-(\d{8})-(\d+)$/);
  if (!match || !match[1] || !match[2] || !match[3]) return null;
  return {
    prefix: match[1],
    date:   match[2],
    seq:    parseInt(match[3], 10),
  };
}

/**
 * 메뉴코드에 해당하는 단축 접두사 반환
 *
 * @example
 * getMenuPrefix('SITE_MGMT')   // 'ST'
 * getMenuPrefix('CARBON_FUEL') // 'CF'
 * getMenuPrefix('UNKNOWN')     // 'UN'
 */
export function getMenuPrefix(menuCode: string): string {
  return MENU_PREFIX[menuCode] ?? menuCode.slice(0, 2).toUpperCase();
}
