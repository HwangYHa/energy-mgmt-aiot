/**
 * 서버 로깅 유틸리티
 * - 서버 시작/종료 로그
 * - 환경별 로그 레벨 제어
 * - 구조화된 로그 출력
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDev = process.env.NODE_ENV === 'development';

class ServerLogger {
  private prefix: string;

  constructor(prefix: string = '[Server]') {
    this.prefix = prefix;
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const logPrefix = `${timestamp} ${this.prefix} [${level.toUpperCase()}]`;

    if (data) {
      return `${logPrefix} ${message}\n${JSON.stringify(data, null, 2)}`;
    }

    return `${logPrefix} ${message}`;
  }

  debug(message: string, data?: any) {
    if (isDev) {
      console.log(this.formatMessage('debug', message, data));
    }
  }

  info(message: string, data?: any) {
    console.log(this.formatMessage('info', message, data));
  }

  warn(message: string, data?: any) {
    console.warn(this.formatMessage('warn', message, data));
  }

  error(message: string, error?: any) {
    const errorData = error instanceof Error
      ? { message: error.message, stack: isDev ? error.stack : undefined }
      : error;

    console.error(this.formatMessage('error', message, errorData));
  }

  /**
   * 서버 시작 로그 출력
   */
  logServerStart() {
    const env = process.env.NODE_ENV || 'development';
    const port = process.env.PORT || 3000;

    console.log('\n' + '='.repeat(60));
    console.log('🚀탄소중립을 위한 에너지 관리 AIoT 서버');
    console.log('='.repeat(60));
    this.info('환경:', { env, port });
    this.info('모드:', isDev ? 'Development' : 'Production');
    this.info('타임스탬프:', new Date().toLocaleString('ko-KR'));
    console.log('='.repeat(60) + '\n');
  }

  /**
   * 미들웨어 초기화 로그
   */
  logMiddlewareInit() {
    this.debug('미들웨어 초기화됨');
  }

  /**
   * API 라우트 등록 로그
   */
  logApiRouteRegistered(route: string) {
    this.debug(`API 경로가 등록되었습니다.: ${route}`);
  }
}

export const serverLogger = new ServerLogger('[Server]');
export const apiLogger = new ServerLogger('[API]');
export const middlewareLogger = new ServerLogger('[Middleware]');
