/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  preset: 'ts-jest',
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        // 테스트용 완화된 설정
        noUnusedLocals: false,
        noUnusedParameters: false,
        noImplicitReturns: false,
        strict: false,
      },
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // Next.js server-only modules 모킹
    '^next/server$': '<rootDir>/__tests__/__mocks__/next-server.ts',
    '^next-auth/jwt$': '<rootDir>/__tests__/__mocks__/next-auth-jwt.ts',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  collectCoverageFrom: [
    'app/api/**/*.ts',
    'lib/**/*.ts',
    '!lib/db/prisma.ts',
    '!lib/env.ts',
  ],
  setupFiles: ['<rootDir>/__tests__/setup.ts'],
};

module.exports = config;
