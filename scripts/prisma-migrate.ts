#!/usr/bin/env tsx
/**
 * Prisma 마이그레이션 스크립트
 * 
 * 용도:
 * 1. 스키마 검증
 * 2. 마이그레이션 생성
 * 3. DB 동기화
 * 
 * 사용:
 * npm run prisma:migrate
 * 또는
 * tsx scripts/prisma-migrate.ts
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

async function run() {
  console.log('🔄 Prisma 마이그레이션 시작...\n');

  try {
    // 1. 스키마 검증
    console.log('1️⃣ Prisma 스키마 검증 중...');
    await execAsync('npx prisma validate');
    console.log('✅ 스키마 검증 완료\n');

    // 2. Prisma Client 생성
    console.log('2️⃣ Prisma Client 생성 중...');
    await execAsync('npx prisma generate');
    console.log('✅ Prisma Client 생성 완료\n');

    // 3. 마이그레이션 확인
    console.log('3️⃣ 데이터베이스 상태 확인 중...');
    await execAsync('npx prisma migrate status');
    console.log('');

    // 4. 마이그레이션 생성
    console.log('4️⃣ 마이그레이션 생성 중...');
    console.log('💡 마이그레이션 이름: "init_critical_fixes"\n');

    try {
      const { stdout, stderr } = await execAsync(
        'npx prisma migrate dev --name init_critical_fixes --skip-generate'
      );

      console.log(stdout);
      if (stderr && !stderr.includes('Warning')) {
        console.error(stderr);
      }
    } catch (error: any) {
      // 마이그레이션이 필요 없을 수도 있음
      if (error.stdout?.includes('No changes')) {
        console.log('⚠️  변경 사항 없음 - 스키마가 이미 동기화됨');
      } else {
        throw error;
      }
    }

    console.log('\n✅ Prisma 마이그레이션 완료\n');

    // 5. 종료
    console.log('📝 마이그레이션 기록:');
    try {
      const { stdout } = await execAsync('npx prisma migrate status');
      console.log(stdout);
    } catch (error) {
      console.log('마이그레이션 상태 확인 불가');
    }
  } catch (error) {
    console.error('\n❌ 마이그레이션 실패:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

run();
