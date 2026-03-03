/**
 * lib/services/activity-log.service.ts
 *
 * 메뉴별 사용자 활동 이력 로깅 서비스
 *
 * 특징:
 * - fire-and-forget: 실패해도 메인 흐름에 영향 없음
 * - 채번(logNo): 메뉴코드 단축 2자 + YYYYMMDD + 일별 4자리 순번 (예: ST-20260301-0001)
 * - 메뉴코드 상수 제공 (MENU_CODES)
 * - 액션타입 상수 제공 (ACTION_TYPES)
 */

import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import { generateSeqNo } from '@/lib/utils/sequence';

// ─────────────────────────────────────────────────────────────────────────────
// 메뉴 코드 상수
// ─────────────────────────────────────────────────────────────────────────────
export const MENU_CODES = {
  // 사이트/장치 관리
  SITE_MGMT:    'SITE_MGMT',
  DEVICE_MGMT:  'DEVICE_MGMT',
  SENSOR_MGMT:  'SENSOR_MGMT',
  GATEWAY_MGMT: 'GATEWAY_MGMT',

  // API / 보안
  API_KEY_MGMT: 'API_KEY_MGMT',

  // 탄소 관리
  CARBON_FUEL:      'CARBON_FUEL',
  CARBON_TRANSPORT: 'CARBON_TRANSPORT',
  CARBON_INVOICE:   'CARBON_INVOICE',
  CARBON_TRADING:   'CARBON_TRADING',
  CARBON_RETIRE:    'CARBON_RETIRE',
  CARBON_ROADMAP:   'CARBON_ROADMAP',

  // 수요반응 (DR)
  DR_EVENT: 'DR_EVENT',

  // 보고서 / 다운로드
  REPORT_GEN:    'REPORT_GEN',
  DATA_DOWNLOAD: 'DATA_DOWNLOAD',

  // 알림
  ALERT_RULE: 'ALERT_RULE',

  // 결제 / 구독
  PAYMENT:      'PAYMENT',
  SUBSCRIPTION: 'SUBSCRIPTION',

  // 시스템
  ADMIN: 'ADMIN',
} as const;

export type MenuCode = (typeof MENU_CODES)[keyof typeof MENU_CODES];

// ─────────────────────────────────────────────────────────────────────────────
// 액션 타입 상수
// ─────────────────────────────────────────────────────────────────────────────
export const ACTION_TYPES = {
  CREATE:     'CREATE',
  UPDATE:     'UPDATE',
  DELETE:     'DELETE',
  DOWNLOAD:   'DOWNLOAD',
  UPLOAD:     'UPLOAD',
  GENERATE:   'GENERATE',
  APPROVE:    'APPROVE',
  REJECT:     'REJECT',
  ACTIVATE:   'ACTIVATE',
  DEACTIVATE: 'DEACTIVATE',
} as const;

export type ActionType = (typeof ACTION_TYPES)[keyof typeof ACTION_TYPES];

// ─────────────────────────────────────────────────────────────────────────────
// 로그 입력 타입
// ─────────────────────────────────────────────────────────────────────────────
export interface LogActivityInput {
  tenantId: string;
  menuCode: MenuCode | string;
  actionType: ActionType | string;
  actionLabel: string;

  // 대상 리소스
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;

  // 변경 데이터
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;

  // 결과
  status?: 'success' | 'failed';
  errorMessage?: string;

  // 요청자 (TenantContext or manual)
  userId?: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  ipAddress?: string;

  // NextRequest에서 자동 추출 가능
  request?: NextRequest;
}

// ─────────────────────────────────────────────────────────────────────────────
// IP 주소 추출 헬퍼
// ─────────────────────────────────────────────────────────────────────────────
function extractIp(request: NextRequest): string | undefined {
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    undefined
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 공통 데이터 빌더 (채번 포함)
// ─────────────────────────────────────────────────────────────────────────────
async function buildLogData(input: LogActivityInput) {
  const {
    tenantId, menuCode, actionType, actionLabel,
    resourceType, resourceId, resourceName,
    beforeData, afterData, metadata,
    status = 'success', errorMessage,
    userId, userName, userEmail, userRole,
    ipAddress, request,
  } = input;

  const resolvedIp = ipAddress ?? (request ? extractIp(request) : undefined);

  // 채번 생성 (실패해도 폴백값 사용)
  const logNo = await generateSeqNo(menuCode);

  return {
    tenantId,
    logNo,
    menuCode,
    actionType,
    actionLabel,
    resourceType,
    resourceId,
    resourceName,
    beforeData: beforeData ? (beforeData as Prisma.InputJsonValue) : undefined,
    afterData:  afterData  ? (afterData  as Prisma.InputJsonValue) : undefined,
    metadata:   metadata   ? (metadata   as Prisma.InputJsonValue) : undefined,
    status,
    errorMessage,
    userId,
    userName,
    userEmail,
    userRole,
    ipAddress: resolvedIp,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인 로깅 함수 (fire-and-forget)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 활동 이력 로깅 (fire-and-forget)
 *
 * 실패해도 예외를 전파하지 않음 — 메인 비즈니스 로직에 영향 없음
 * logNo(채번)가 자동으로 생성됩니다: 예) ST-20260301-0001
 *
 * @example
 * logActivity({
 *   tenantId,
 *   menuCode: MENU_CODES.SITE_MGMT,
 *   actionType: ACTION_TYPES.CREATE,
 *   actionLabel: '사이트 생성',
 *   resourceType: 'site',
 *   resourceId: newSite.id,
 *   resourceName: newSite.name,
 *   afterData: { name: newSite.name, code: newSite.code },
 *   userId, userEmail, userRole,
 *   request,
 * });
 */
export function logActivity(input: LogActivityInput): void {
  // 비동기 실행 — await 없이 호출 (fire-and-forget)
  buildLogData(input)
    .then((data) => prisma.activityLog.create({ data }))
    .catch((err) => {
      console.error('[ActivityLog] 로깅 실패:', err?.message ?? String(err));
    });
}

/**
 * 활동 이력 로깅 (awaitable — 채번 결과가 필요한 경우)
 *
 * logNo를 반환하므로 UI에서 참조번호를 바로 표시할 때 유용합니다.
 *
 * @returns 생성된 채번 (예: 'ST-20260301-0001'), 실패 시 null
 */
export async function logActivityAsync(input: LogActivityInput): Promise<string | null> {
  try {
    const data = await buildLogData(input);
    await prisma.activityLog.create({ data });
    return data.logNo;
  } catch (err) {
    console.error('[ActivityLog] 로깅 실패:', (err as Error)?.message ?? String(err));
    return null;
  }
}
