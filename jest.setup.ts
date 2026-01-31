/**
 * Jest 설정 및 테스트 환경 초기화
 */

// 환경 변수 설정 (테스트 환경)
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/energy_test';
process.env.JWT_SECRET = 'test-jwt-secret-minimum-32-characters-123456';
process.env.NEXTAUTH_SECRET = 'test-auth-secret-minimum-32-characters-1234';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.AI_ENGINE_URL = 'http://localhost:8001';
process.env.AI_ENGINE_API_KEY = 'test-api-key-minimum-32-characters-1234567';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.MQTT_BROKER_URL = 'mqtt://localhost:1883';
process.env.WEB_APP_URL = 'http://localhost:3000';

// 타임아웃 증가 (DB 연결용)
jest.setTimeout(30000);

// Prisma 모듈 모킹
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    // 이벤트 리스너 모킹 (예: $on('query', handler))
    $on: jest.fn().mockImplementation((event: string, handler: (...args: any[]) => void) => {
      // noop: 필요시 테스트에서 호출 여부를 검사할 수 있음
      return undefined;
    }),
    // 미들웨어 모킹 (미들웨어를 등록하되 테스트 환경에서는 실행하지 않음)
    $use: jest.fn().mockImplementation((middleware: any) => {
      return undefined;
    }),
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    device: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    measurement: {
      findMany: jest.fn(),
    },
  })),
  Prisma: {
    validator: (fn) => fn,
  },
}));

// ESM/CJS 호환성 설정
Object.defineProperty(globalThis, 'fetch', {
  writable: true,
  value: jest.fn(),
});

// Mock NextRequest from next/server for tests
jest.mock('next/server', () => ({
  NextRequest: jest.fn().mockImplementation((url: string, options?: any) => ({
    url,
    method: options?.method || 'GET',
    headers: options?.headers || {},
    json: async () => ({}),
    text: async () => '',
  })),
}));

// Suppress logs during tests - 선택사항
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };
