/**
 * lib/constants/error-messages.ts - 표준화된 한국어 에러 메시지
 *
 * 모든 API 및 클라이언트에서 일관된 에러 메시지 제공
 */

/**
 * 에러 코드 타입
 */
export type ErrorCode =
  // 인증 관련
  | 'AUTH_REQUIRED'
  | 'AUTH_INVALID_TOKEN'
  | 'AUTH_EXPIRED_TOKEN'
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_USER_INACTIVE'
  | 'AUTH_EMAIL_NOT_VERIFIED'
  // 권한 관련
  | 'PERMISSION_DENIED'
  | 'PERMISSION_INSUFFICIENT_ROLE'
  | 'PERMISSION_TENANT_MISMATCH'
  // CSRF 관련
  | 'CSRF_TOKEN_MISSING'
  | 'CSRF_TOKEN_INVALID'
  | 'CSRF_TOKEN_EXPIRED'
  // 입력 검증 관련
  | 'VALIDATION_ERROR'
  | 'VALIDATION_REQUIRED_FIELD'
  | 'VALIDATION_INVALID_FORMAT'
  | 'VALIDATION_OUT_OF_RANGE'
  // 리소스 관련
  | 'RESOURCE_NOT_FOUND'
  | 'RESOURCE_ALREADY_EXISTS'
  | 'RESOURCE_CONFLICT'
  | 'RESOURCE_DELETED'
  // 서버 오류
  | 'SERVER_ERROR'
  | 'DATABASE_ERROR'
  | 'EXTERNAL_SERVICE_ERROR'
  // 네트워크 오류
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  // 비즈니스 로직
  | 'SUBSCRIPTION_REQUIRED'
  | 'SUBSCRIPTION_LIMIT_REACHED'
  | 'DEVICE_OFFLINE'
  | 'DEVICE_NOT_CONTROLLABLE'
  | 'DR_EVENT_CONFLICT'
  // 기타
  | 'UNKNOWN_ERROR';

/**
 * 에러 메시지 정의
 */
export const ERROR_MESSAGES: Record<ErrorCode, { message: string; description?: string }> = {
  // 인증 관련
  AUTH_REQUIRED: {
    message: '인증이 필요합니다',
    description: '이 작업을 수행하려면 로그인이 필요합니다.',
  },
  AUTH_INVALID_TOKEN: {
    message: '유효하지 않은 인증 토큰',
    description: '인증 토큰이 유효하지 않습니다. 다시 로그인해주세요.',
  },
  AUTH_EXPIRED_TOKEN: {
    message: '인증 토큰이 만료됨',
    description: '로그인 세션이 만료되었습니다. 다시 로그인해주세요.',
  },
  AUTH_INVALID_CREDENTIALS: {
    message: '잘못된 자격 증명',
    description: '이메일 또는 비밀번호가 올바르지 않습니다.',
  },
  AUTH_USER_INACTIVE: {
    message: '비활성화된 계정',
    description: '계정이 비활성화되었습니다. 관리자에게 문의하세요.',
  },
  AUTH_EMAIL_NOT_VERIFIED: {
    message: '이메일 인증 필요',
    description: '이메일 인증이 완료되지 않았습니다. 인증 메일을 확인해주세요.',
  },

  // 권한 관련
  PERMISSION_DENIED: {
    message: '접근 권한 없음',
    description: '이 작업을 수행할 권한이 없습니다.',
  },
  PERMISSION_INSUFFICIENT_ROLE: {
    message: '권한 부족',
    description: '이 기능을 사용하기 위한 권한이 부족합니다.',
  },
  PERMISSION_TENANT_MISMATCH: {
    message: '접근 불가',
    description: '다른 조직의 리소스에 접근할 수 없습니다.',
  },

  // CSRF 관련
  CSRF_TOKEN_MISSING: {
    message: 'CSRF 토큰 누락',
    description: 'CSRF 토큰이 누락되었습니다. 페이지를 새로고침해주세요.',
  },
  CSRF_TOKEN_INVALID: {
    message: 'CSRF 토큰 유효하지 않음',
    description: 'CSRF 토큰 검증에 실패했습니다. 페이지를 새로고침해주세요.',
  },
  CSRF_TOKEN_EXPIRED: {
    message: 'CSRF 토큰 만료',
    description: 'CSRF 토큰이 만료되었습니다. 페이지를 새로고침해주세요.',
  },

  // 입력 검증 관련
  VALIDATION_ERROR: {
    message: '입력값 검증 오류',
    description: '입력한 값이 올바르지 않습니다.',
  },
  VALIDATION_REQUIRED_FIELD: {
    message: '필수 입력 항목 누락',
    description: '필수 입력 항목을 모두 입력해주세요.',
  },
  VALIDATION_INVALID_FORMAT: {
    message: '잘못된 형식',
    description: '입력 형식이 올바르지 않습니다.',
  },
  VALIDATION_OUT_OF_RANGE: {
    message: '범위 초과',
    description: '입력값이 허용 범위를 벗어났습니다.',
  },

  // 리소스 관련
  RESOURCE_NOT_FOUND: {
    message: '리소스를 찾을 수 없음',
    description: '요청한 리소스를 찾을 수 없습니다.',
  },
  RESOURCE_ALREADY_EXISTS: {
    message: '이미 존재하는 리소스',
    description: '동일한 리소스가 이미 존재합니다.',
  },
  RESOURCE_CONFLICT: {
    message: '리소스 충돌',
    description: '리소스 충돌이 발생했습니다. 다시 시도해주세요.',
  },
  RESOURCE_DELETED: {
    message: '삭제된 리소스',
    description: '이 리소스는 이미 삭제되었습니다.',
  },

  // 서버 오류
  SERVER_ERROR: {
    message: '서버 오류',
    description: '서버에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  },
  DATABASE_ERROR: {
    message: '데이터베이스 오류',
    description: '데이터베이스 처리 중 오류가 발생했습니다.',
  },
  EXTERNAL_SERVICE_ERROR: {
    message: '외부 서비스 오류',
    description: '외부 서비스와의 통신 중 오류가 발생했습니다.',
  },

  // 네트워크 오류
  NETWORK_ERROR: {
    message: '네트워크 오류',
    description: '네트워크 연결을 확인해주세요.',
  },
  TIMEOUT_ERROR: {
    message: '요청 시간 초과',
    description: '서버 응답 시간이 초과되었습니다. 다시 시도해주세요.',
  },
  RATE_LIMIT_EXCEEDED: {
    message: '요청 한도 초과',
    description: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  },

  // 비즈니스 로직
  SUBSCRIPTION_REQUIRED: {
    message: '구독 필요',
    description: '이 기능을 사용하려면 유료 구독이 필요합니다.',
  },
  SUBSCRIPTION_LIMIT_REACHED: {
    message: '구독 한도 도달',
    description: '현재 구독 플랜의 한도에 도달했습니다. 업그레이드를 고려해주세요.',
  },
  DEVICE_OFFLINE: {
    message: '설비 오프라인',
    description: '해당 설비가 오프라인 상태입니다.',
  },
  DEVICE_NOT_CONTROLLABLE: {
    message: '제어 불가 설비',
    description: '이 설비는 원격 제어를 지원하지 않습니다.',
  },
  DR_EVENT_CONFLICT: {
    message: 'DR 이벤트 충돌',
    description: '해당 시간에 이미 DR 이벤트가 예정되어 있습니다.',
  },

  // 기타
  UNKNOWN_ERROR: {
    message: '알 수 없는 오류',
    description: '알 수 없는 오류가 발생했습니다. 관리자에게 문의하세요.',
  },
};

/**
 * 에러 코드로 메시지 가져오기
 */
export function getErrorMessage(code: ErrorCode): string {
  return ERROR_MESSAGES[code]?.message || ERROR_MESSAGES.UNKNOWN_ERROR.message;
}

/**
 * 에러 코드로 설명 가져오기
 */
export function getErrorDescription(code: ErrorCode): string {
  return ERROR_MESSAGES[code]?.description || ERROR_MESSAGES.UNKNOWN_ERROR.description || '';
}

/**
 * 에러 응답 생성 (API용)
 */
export function createErrorResponse(code: ErrorCode, details?: Record<string, unknown>) {
  const errorInfo = ERROR_MESSAGES[code] || ERROR_MESSAGES.UNKNOWN_ERROR;
  return {
    success: false,
    error: errorInfo.message,
    code,
    message: errorInfo.description,
    details,
  };
}

/**
 * HTTP 상태 코드에서 에러 코드 추론
 */
export function getErrorCodeFromStatus(status: number): ErrorCode {
  switch (status) {
    case 400:
      return 'VALIDATION_ERROR';
    case 401:
      return 'AUTH_REQUIRED';
    case 403:
      return 'PERMISSION_DENIED';
    case 404:
      return 'RESOURCE_NOT_FOUND';
    case 408:
      return 'TIMEOUT_ERROR';
    case 409:
      return 'RESOURCE_CONFLICT';
    case 422:
      return 'VALIDATION_ERROR';
    case 429:
      return 'RATE_LIMIT_EXCEEDED';
    case 500:
      return 'SERVER_ERROR';
    case 502:
    case 503:
    case 504:
      return 'SERVER_ERROR';
    default:
      return 'UNKNOWN_ERROR';
  }
}
