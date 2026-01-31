/**
 * Prisma Client Singleton
 * 
 * Production 환경에서 HMR(Hot Module Replacement) 시 
 * 중복 인스턴스 생성을 방지하는 싱글톤 패턴 구현
 * 
 * 문제점: 개발 환경에서 파일 변경 시 Next.js가 모듈을 다시 로드하면서
 *        새로운 PrismaClient 인스턴스가 계속 생성되어 DB 연결이 누적됨
 * 
 * 해결책: globalThis를 사용하여 인스턴스를 캐싱
 */

import { PrismaClient } from '@prisma/client';
import { logPerformance } from '@/lib/logger';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * Prisma Client 싱글톤 생성
 * 
 * Features:
 * - 개발/프로덕션 모두에서 안정적인 단일 연결
 * - 쿼리 로깅 (개발 환경에서만)
 * - 느린 쿼리 감지 (1초 이상)
 * - Connection pooling 설정
 */
function initializePrisma(): PrismaClient {
  const client = new PrismaClient({
    // ========================================
    // 로깅 설정
    // ========================================
    log:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn'] // 프로덕션: 에러와 경고만
        : [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
          ],

    // ========================================
    // 에러 포맷팅
    // ========================================
    errorFormat: process.env.NODE_ENV === 'production' ? 'minimal' : 'pretty',
  });

  // ========================================
  // 이벤트 리스너 (개발 환경)
  // ========================================
  if (process.env.NODE_ENV !== 'production') {
    client.$on('query', (event) => {
      if (event.duration > 1000) {
        // 1초 이상 걸린 쿼리
        console.warn(`⚠️  Slow Query (${event.duration}ms): ${event.query}`);
      }
    });

    client.$on('error', (event) => {
      console.error('❌ Prisma Error:', event);
    });

    client.$on('warn', (event) => {
      console.warn('⚠️  Prisma Warning:', event);
    });
  }

  // ========================================
  // 미들웨어: 성능 모니터링
  // ========================================
  client.$use(async (params, next) => {
    const startTime = Date.now();

    try {
      const result = await next(params);
      const duration = Date.now() - startTime;

      // 느린 쿼리 기록 (500ms 이상)
      if (duration > 500) {
        logPerformance({
          operation: `Prisma ${params.model}.${params.action}`,
          duration,
          tenantId: undefined, // 컨텍스트에서 추출 가능
        });
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(
        `Prisma error in ${params.model}.${params.action} after ${duration}ms:`,
        error
      );
      throw error;
    }
  });

  return client;
}

// ========================================
// 싱글톤 인스턴스
// ========================================
export const prisma: PrismaClient =
  global.prisma ||
  (() => {
    const client = initializePrisma();

    // 개발 환경에서는 전역 인스턴스로 캐싱
    // (HMR 시 재생성되지 않음)
    if (process.env.NODE_ENV !== 'production') {
      global.prisma = client;
    }

    return client;
  })();

// ========================================
// 연결 상태 확인
// ========================================
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

// ========================================
// 정리 함수
// ========================================
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
  if (process.env.NODE_ENV !== 'production') {
    global.prisma = undefined;
  }
}