import winston from 'winston';
import path from 'path';
import fs from 'fs';

// 로그 디렉토리 생성 (파일시스템 쓰기 권한이 없어도 안전하게 처리)
const logsDir = path.join(process.cwd(), 'logs');
let fileLoggingEnabled = false;
try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  fileLoggingEnabled = true;
} catch {
  // Docker/읽기전용 파일시스템 환경에서는 콘솔 로그만 사용
  console.warn('[Logger] 로그 디렉토리 생성 불가 — 콘솔 로그만 활성화합니다:', logsDir);
}

// ========================================
// 로그 레벨
// ========================================
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// ========================================
// 포맷터
// ========================================
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...args } = info;

    const ts = (timestamp as string).slice(0, 19).replace('T', ' ');
    return `${ts} [${level}]: ${message} ${Object.keys(args).length ? JSON.stringify(args, null, 2) : ''}`;
  })
);

// ========================================
// 트랜스포트
// ========================================

// 콘솔 트랜스포트 (개발 환경에서는 항상 활성화)
const consoleTransport = new winston.transports.Console({ format });

// 파일 트랜스포트 (파일시스템 접근 가능한 경우에만 추가)
const fileTransports: winston.transport[] = fileLoggingEnabled
  ? [
      new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
          winston.format.json()
        ),
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
      new winston.transports.File({
        filename: path.join(logsDir, 'combined.log'),
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
          winston.format.json()
        ),
        maxsize: 5242880, // 5MB
        maxFiles: 10,
      }),
      new winston.transports.File({
        filename: path.join(logsDir, 'security.log'),
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
          winston.format.json()
        ),
        maxsize: 5242880, // 5MB
        maxFiles: 10,
      }),
      new winston.transports.File({
        filename: path.join(logsDir, 'http.log'),
        level: 'http',
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
          winston.format.json()
        ),
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
    ]
  : [];

// 프로덕션: 파일 로깅이 가능한 경우 콘솔 제외, 불가능한 경우 콘솔만 사용
const transports: winston.transport[] =
  process.env.NODE_ENV === 'production' && fileLoggingEnabled
    ? fileTransports
    : [consoleTransport, ...fileTransports];

// ========================================
// 로거 생성
// ========================================
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  levels: LOG_LEVELS,
  format,
  transports,
  // 파일 접근 가능한 경우에만 예외/거부 핸들러 등록
  ...(fileLoggingEnabled
    ? {
        exceptionHandlers: [
          new winston.transports.File({
            filename: path.join(logsDir, 'exceptions.log'),
          }),
        ],
        rejectionHandlers: [
          new winston.transports.File({
            filename: path.join(logsDir, 'rejections.log'),
          }),
        ],
      }
    : {}),
});

// ========================================
// 구조화된 로깅 헬퍼
// ========================================

interface LogContext {
  requestId?: string;
  userId?: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  [key: string]: any;
}

interface SecurityLogData {
  type: 'AUTH_FAILURE' | 'PERMISSION_DENIED' | 'TOKEN_TAMPER' | 'RATE_LIMIT' | 'SUSPICIOUS_ACTIVITY';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  tenantId?: string;
  ipAddress?: string;
  reason?: string;
  [key: string]: any;
}

/**
 * API 요청 시작 로그
 */
export function logHttpRequest(context: LogContext) {
  const { requestId, method, path, userId, tenantId, ipAddress } = context;
  logger.http('HTTP Request', {
    requestId,
    method,
    path,
    userId,
    tenantId,
    ipAddress,
    timestamp: new Date().toISOString(),
  });
}

/**
 * API 응답 로그
 */
export function logHttpResponse(context: LogContext) {
  const { requestId, method, path, statusCode, duration, userId } = context;
  const level = statusCode && statusCode >= 400 ? 'warn' : 'http';

  logger[level as 'http' | 'warn']('HTTP Response', {
    requestId,
    method,
    path,
    statusCode,
    duration: `${duration}ms`,
    userId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * 데이터베이스 쿼리 로그
 */
export function logDbQuery(context: {
  query: string;
  duration: number;
  params?: any;
  error?: string;
  tenantId?: string;
}) {
  const { query, duration, params, error, tenantId } = context;

  if (error) {
    logger.error('Database Query Error', {
      query,
      duration: `${duration}ms`,
      error,
      tenantId,
      timestamp: new Date().toISOString(),
    });
  } else if (duration > 1000) {
    logger.warn('Slow Database Query', {
      query,
      duration: `${duration}ms`,
      params,
      tenantId,
      timestamp: new Date().toISOString(),
    });
  } else {
    logger.debug('Database Query', {
      query,
      duration: `${duration}ms`,
      tenantId,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * 보안 이벤트 로그 (별도 파일)
 */
export function logSecurityEvent(data: SecurityLogData) {
  const { type, severity, userId, tenantId, ipAddress, reason } = data;

  logger.info(`SECURITY_EVENT: ${type}`, {
    type,
    severity,
    userId,
    tenantId,
    ipAddress,
    reason,
    timestamp: new Date().toISOString(),
  });

  // 중요 보안 이벤트는 경고 레벨로 추가 로깅
  if (severity === 'critical' || severity === 'high') {
    logger.warn(`CRITICAL_SECURITY: ${type}`, {
      type,
      severity,
      userId,
      tenantId,
      ipAddress,
      reason,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * 비즈니스 이벤트 로그 (감사 추적)
 */
export function logBusinessEvent(context: {
  action: string;
  resourceType: string;
  resourceId?: string;
  userId: string;
  tenantId: string;
  changes?: any;
  result: 'success' | 'failure' | 'partial';
  errorMessage?: string;
  ipAddress?: string;
  requestId?: string;
}) {
  const {
    action,
    resourceType,
    resourceId,
    userId,
    tenantId,
    changes,
    result,
    errorMessage,
    ipAddress,
    requestId,
  } = context;

  const level = result === 'failure' ? 'warn' : 'info';

  logger[level as 'info' | 'warn'](`BUSINESS_EVENT: ${action}`, {
    action,
    resourceType,
    resourceId,
    userId,
    tenantId,
    changes,
    result,
    errorMessage,
    ipAddress,
    requestId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * 에러 로그 (구조화됨)
 */
export function logError(error: Error | string, context?: LogContext) {
  const errorMsg = error instanceof Error ? error.message : error;
  const stack = error instanceof Error ? error.stack : undefined;

  logger.error('Error', {
    message: errorMsg,
    stack,
    ...context,
    timestamp: new Date().toISOString(),
  });
}

/**
 * 성능 로그
 */
export function logPerformance(context: {
  operation: string;
  duration: number;
  memoryUsage?: NodeJS.MemoryUsage;
  tenantId?: string;
}) {
  const { operation, duration, memoryUsage, tenantId } = context;
  const level = duration > 5000 ? 'warn' : 'debug';

  logger[level as 'debug' | 'warn']('Performance Metric', {
    operation,
    duration: `${duration}ms`,
    memoryUsage: memoryUsage
      ? {
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        }
      : undefined,
    tenantId,
    timestamp: new Date().toISOString(),
  });
}

export default logger;
