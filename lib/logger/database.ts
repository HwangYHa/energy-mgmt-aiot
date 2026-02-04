/**
 * 데이터베이스 연결 로깅 유틸리티
 * - Prisma 연결 상태 모니터링
 * - 쿼리 성능 로깅 (개발 환경)
 * - 연결 오류 추적
 */

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

const isDev = process.env.NODE_ENV === 'development';

class DatabaseLogger {
  private status: ConnectionStatus = 'disconnected';
  private connectionAttempts = 0;

  private log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const prefix = `${timestamp} [Database] [${level.toUpperCase()}]`;

    if (level === 'error') {
      console.error(prefix, message, data || '');
    } else if (level === 'warn') {
      console.warn(prefix, message, data || '');
    } else {
      console.log(prefix, message, data || '');
    }
  }

  /**
   * 데이터베이스 연결 시도 로그
   */
  logConnectionAttempt() {
    this.connectionAttempts++;
    this.status = 'connecting';
    this.log('info', `데이터베이스에 연결을 시도하는 중입니다. (시도 #${this.connectionAttempts})`);
  }

  /**
   * 데이터베이스 연결 성공 로그
   */
  logConnectionSuccess() {
    this.status = '연결됨';
    console.log('\n' + '-'.repeat(60));
    console.log('✅ 데이터베이스 연결이 설정되었습니다');
    console.log('-'.repeat(60));
    this.log('info', '데이터베이스에 성공적으로 연결되었습니다.');
    this.log('info', '데이터베이스:', {
      제공: 'MySQL',
      상태: this.status,
      시도: this.connectionAttempts,
    });
    console.log('-'.repeat(60) + '\n');
  }

  /**
   * 데이터베이스 연결 실패 로그
   */
  logConnectionFailure(error: Error) {
    this.status = 'error';
    console.log('\n' + '-'.repeat(60));
    console.log('❌ 데이터베이스 연결 실패');
    console.log('-'.repeat(60));
    this.log('error', '데이터베이스에 연결하지 못했습니다.', {
      오류: error.message,
      시도: this.connectionAttempts,
      stack: isDev ? error.stack : undefined,
    });
    console.log('-'.repeat(60) + '\n');
  }

  /**
   * 쿼리 실행 로그 (개발 환경만)
   */
  logQuery(query: string, duration?: number) {
    if (isDev) {
      const msg = duration
        ? `Query executed in ${duration}ms: ${query.substring(0, 100)}...`
        : `Query: ${query.substring(0, 100)}...`;
      this.log('info', msg);
    }
  }

  /**
   * 쿼리 오류 로그
   */
  logQueryError(query: string, error: Error) {
    this.log('error', 'Query failed', {
      query: query.substring(0, 200),
      error: error.message,
      stack: isDev ? error.stack : undefined,
    });
  }

  /**
   * 연결 상태 반환
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * 연결 상태 체크 로그
   */
  logHealthCheck(isHealthy: boolean) {
    if (isHealthy) {
      this.log('info', '✓ 데이터베이스 상태 점검 통과');
    } else {
      this.log('warn', '⚠ 데이터베이스 상태 점검에 실패했습니다.');
    }
  }
}

export const dbLogger = new DatabaseLogger();
