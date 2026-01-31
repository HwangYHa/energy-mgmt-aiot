/**
 * 민감한 데이터 보호 유틸
 * 
 * 목표:
 * - 민감한 필드(passwordHash, 토큰 등)를 자동으로 제외
 * - API 응답에서 이러한 필드가 노출되지 않도록 보장
 * - 로그에도 민감한 데이터 기록 금지
 */

// ========================================
// 1. 민감한 필드 정의
// ========================================

/**
 * 절대 API 응답에 포함되면 안 되는 필드들
 */
export const SENSITIVE_FIELDS = {
  User: [
    'passwordHash',
    'mfaSecret',
    'refreshToken',
    'refreshTokenExpiresAt',
    'resetToken',
    'resetTokenExpiresAt',
    'tokenVersion',
    'preferences',
  ],
  Device: [
    'connectionConfig',
  ],
  Gateway: [
    'config',
  ],
  Plan: [
    'features',
  ],
  RegulationReport: [
    'fileUrl',
    'pdfUrl',
  ],
};

// ========================================
// 2. 안전한 Select 객체
// ========================================

export const safeUserSelect = {
  id: true,
  tenantId: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  isActive: true,
  isEmailVerified: true,
  lastLoginAt: true,
  lastLoginIp: true,
  createdAt: true,
  updatedAt: true,
};

export const safeDeviceSelect = {
  id: true,
  tenantId: true,
  siteId: true,
  gatewayId: true,
  name: true,
  code: true,
  deviceType: true,
  manufacturer: true,
  model: true,
  protocol: true,
  controlCapable: true,
  controlMode: true,
  status: true,
  lastSeenAt: true,
  pollIntervalMs: true,
  responseTimeMs: true,
  installationDate: true,
  warrantyEndDate: true,
  location: true,
  createdAt: true,
  updatedAt: true,
};

export const safeGatewaySelect = {
  id: true,
  tenantId: true,
  siteId: true,
  serialNumber: true,
  name: true,
  model: true,
  firmwareVersion: true,
  ipAddress: true,
  macAddress: true,
  vpnAddress: true,
  primaryConnection: true,
  fallbackConnection: true,
  status: true,
  lastSeenAt: true,
  lastHeartbeatAt: true,
  bufferSizeMb: true,
  bufferedRecords: true,
  ownership: true,
  installationDate: true,
  createdAt: true,
  updatedAt: true,
};

export const safeSiteSelect = {
  id: true,
  tenantId: true,
  name: true,
  code: true,
  address: true,
  city: true,
  country: true,
  latitude: true,
  longitude: true,
  timezone: true,
  siteType: true,
  areaSqm: true,
  floors: true,
  operatingHours: true,
  peakPowerKw: true,
  isActive: true,
  managerId: true,
  createdAt: true,
  updatedAt: true,
};

// ========================================
// 3. 민감한 데이터 마스킹
// ========================================

/**
 * 로그에 출력되는 객체에서 민감한 데이터 마스킹
 */
export function maskSensitiveData(obj: any, model?: string): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const masked = { ...obj };
  const sensitiveFields = model ? SENSITIVE_FIELDS[model as any] || [] : [];

  // 자동으로 민감한 필드 마스킹
  [
    'password',
    'passwordHash',
    'secret',
    'token',
    'apiKey',
    'mfaSecret',
    'refreshToken',
    'resetToken',
    'creditCard',
    'ssn',
  ].forEach((field) => {
    if (field in masked) {
      masked[field] = '***MASKED***';
    }
  });

  // 모델별 민감한 필드 마스킹
  sensitiveFields.forEach((field) => {
    if (field in masked) {
      masked[field] = '***MASKED***';
    }
  });

  return masked;
}

// ========================================
// 4. 로깅 헬퍼
// ========================================

/**
 * 안전한 로깅 (민감한 데이터 자동 마스킹)
 */
export function logSafely(message: string, data?: any, model?: string) {
  const safeData = data ? maskSensitiveData(data, model) : undefined;
  console.log(message, safeData ? JSON.stringify(safeData, null, 2) : '');
}

// ========================================
// 5. 응답 필터링
// ========================================

/**
 * API 응답 데이터에서 민감한 필드 제거
 */
export function cleanResponseData(data: any, model?: string): any {
  if (!data) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => cleanResponseData(item, model));
  }

  if (typeof data !== 'object') {
    return data;
  }

  const cleaned = { ...data };
  const fieldsToRemove = model ? SENSITIVE_FIELDS[model as any] || [] : [];

  fieldsToRemove.forEach((field) => {
    delete cleaned[field];
  });

  return cleaned;
}
