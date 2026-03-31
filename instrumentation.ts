/**
 * Next.js Instrumentation
 * 서버 시작 시 한 번만 실행되는 초기화 코드
 *
 * IMPORTANT: This file runs in both Node.js and Edge Runtime
 * Only import Node.js modules conditionally
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Edge Runtime 체크 - Prisma는 Node.js에서만 실행 가능
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Node.js 전용 모듈을 동적으로 import
    const { serverLogger } = await import('@/lib/logger/server');
    const { checkDatabaseConnection } = await import('@/lib/db/prisma');

    // 서버 시작 로그 출력
    serverLogger.logServerStart();

    // 데이터베이스 연결 확인
    try {
      const isConnected = await checkDatabaseConnection();

      if (!isConnected) {
        serverLogger.error('시작 중에 데이터베이스 연결에 실패했습니다.');
        // 운영 환경에서는 서버 시작 실패 처리 가능
        if (process.env.NODE_ENV === 'production') {
          serverLogger.error('심각: 데이터베이스 연결 없이는 서버를 시작할 수 없습니다.');
          // process.exit(1); // 선택: 운영 환경에서 DB 없이 시작 방지
        }
      }
    } catch (error) {
      serverLogger.error('데이터베이스 연결 확인 중 오류 발생', error);
    }

    serverLogger.info('서버 측정 완료');

    // MQTT 브로커 연결 초기화 (MQTT_BROKER_URL 미설정 시 자동 스킵)
    const { initMQTT } = await import('@/lib/mqtt/init');
    initMQTT();
  }
  // Edge Runtime에서는 아무것도 하지 않음
}
