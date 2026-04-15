/**
 * prisma/seed.ts — 탄소이음 EMS AIoT 초기 데이터 시딩
 *
 * 실행: npx tsx prisma/seed.ts
 * 또는: SEED_FORCE_RESET=true npx tsx prisma/seed.ts  (비밀번호 재설정 포함)
 *
 * 처리 순서:
 *   1. seed-data.sql 실행 (feature/plan/emission_factor/carbon_market_price/menu_group/menu_item/equipment_product)
 *      — 구버전 메뉴 삭제 포함
 *   2. 슈퍼어드민 Tenant + User + Subscription
 *   3. 데모 Tenant + User + Subscription
 *   4. 데모 데이터 (Site/Gateway/Device/Metric/Measurement/AlertRule 등)
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';
import { seedDemoData } from './seed-demo-data';
import { seedDemoExtra } from './seed-demo-extra';

const prisma = new PrismaClient();

async function upsert<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const result = await fn();
  console.log(`  ✅ ${label}`);
  return result;
}

// ─────────────────────────────────────────────
// 1. seed-data.sql 실행
// ─────────────────────────────────────────────
async function runSeedSql() {
  console.log('\n📦 [1/4] seed-data.sql 실행 (feature/plan/emission_factor/탄소가격/메뉴/제품카탈로그)');
  const sqlPath = path.join(__dirname, 'seed-data.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  // 세미콜론 기준 분리 (주석 제외)
  const statements = sql
    .split('\n')
    .filter(line => !line.startsWith('--') && !line.startsWith('/*') && line.trim() !== '')
    .join('\n')
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  let ok = 0, skip = 0;
  for (const stmt of statements) {
    if (!stmt || stmt.startsWith('/*') || stmt.startsWith('--')) { skip++; continue; }
    try {
      await prisma.$executeRawUnsafe(stmt + ';');
      ok++;
    } catch (e: any) {
      // FOREIGN_KEY_CHECKS 토글 실패는 무시
      if (!e.message?.includes('FOREIGN_KEY_CHECKS') && !e.message?.includes('Unknown system variable')) {
        console.warn(`  ⚠️  SQL 오류 (skip): ${e.message?.slice(0, 80)}`);
      }
      skip++;
    }
  }
  console.log(`  ✅ SQL 완료: ${ok}개 실행, ${skip}개 스킵`);
}

// ─────────────────────────────────────────────
// main
// ─────────────────────────────────────────────
async function main() {
  console.log('\n🌱 탄소이음 EMS AIoT — 시드 데이터 삽입 시작\n');

  // ── 1. SQL 시드 (정적 참조 데이터 전체) ──────
  await runSeedSql();

  // ── 2. 슈퍼어드민 Tenant + User ──────────────
  console.log('\n📦 [2/4] 슈퍼어드민 테넌트 / 사용자');

  const enterprisePlan = await prisma.plan.findFirst({ where: { tier: 'enterprise' } });
  if (!enterprisePlan) throw new Error('enterprise plan not found');

  const adminTenant = await upsert('Tenant: 탄소이음 (super)', () =>
    prisma.tenant.upsert({
      where: { domain: 'carbonieum.co.kr' },
      update: {},
      create: {
        name: '탄소이음', domain: 'carbonieum.co.kr',
        industryType: 'other', country: 'KR', timezone: 'Asia/Seoul',
        status: 'active', onboardingStep: 5,
        onboardingCompletedAt: new Date(), settings: { menu: null },
      },
    })
  );

  const existingSub = await prisma.subscription.findFirst({
    where: { tenantId: adminTenant.id, status: 'ACTIVE' },
  });
  if (!existingSub) {
    await upsert('Subscription: enterprise', () =>
      prisma.subscription.create({
        data: {
          tenantId: adminTenant.id, planId: enterprisePlan.id,
          status: 'ACTIVE', billingCycle: 'yearly',
          startDate: new Date(),
          endDate: new Date(Date.now() + 10 * 365 * 86400_000),
          autoRenew: false,
        },
      })
    );
  } else {
    console.log('  ✅ Subscription: 이미 존재');
  }

  const ADMIN_EMAIL    = process.env.SEED_ADMIN_EMAIL    || 'admin@carbonieum.co.kr';
  const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Carbonieum2026!';
  const FORCE_RESET    = process.env.SEED_FORCE_RESET === 'true';

  const existingUser = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!existingUser) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await upsert(`User: ${ADMIN_EMAIL} (super_admin 신규)`, () =>
      prisma.user.create({
        data: {
          tenantId: adminTenant.id, email: ADMIN_EMAIL, passwordHash: hash,
          name: '탄소이음 관리자', role: 'super_admin',
          isActive: true, isEmailVerified: true,
        },
      })
    );
    console.log(`\n  ⚠️  초기 비밀번호: ${ADMIN_PASSWORD}\n`);
  } else {
    const updateData: Record<string, unknown> = {
      loginAttempts: 0, lockedUntil: null, isActive: true,
    };
    if (FORCE_RESET) {
      updateData.passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
      console.log('  🔑 FORCE_RESET: 비밀번호 재설정 포함');
    }
    await (prisma as any).user.update({ where: { email: ADMIN_EMAIL }, data: updateData });
    console.log(`  ✅ User: ${ADMIN_EMAIL} — 계정 잠금 해제`);
  }

  // ── 3. 데모 Tenant + User ─────────────────────
  console.log('\n📦 [3/4] 데모 계정');
  const DEMO_EMAIL    = 'demo@carbonieum.com';
  const DEMO_PASSWORD = 'Demo1234!';

  let demoTenant = await prisma.tenant.findFirst({ where: { domain: 'demo.carbonieum.com' } });
  if (!demoTenant) {
    demoTenant = await upsert('Tenant: 탄소이음 Demo', () =>
      prisma.tenant.create({
        data: {
          name: '탄소이음 Demo', domain: 'demo.carbonieum.com',
          industryType: 'other', country: 'KR', timezone: 'Asia/Seoul',
          status: 'active', onboardingStep: 5,
          onboardingCompletedAt: new Date(), settings: { menu: null },
        },
      })
    );
    await prisma.subscription.create({
      data: {
        tenantId: demoTenant.id, planId: enterprisePlan.id,
        status: 'ACTIVE', billingCycle: 'yearly',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 86400_000),
        autoRenew: false,
      },
    });
  }

  const existingDemo = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (!existingDemo) {
    const demoHash = await bcrypt.hash(DEMO_PASSWORD, 12);
    await upsert(`User: ${DEMO_EMAIL} (demo)`, () =>
      prisma.user.create({
        data: {
          tenantId: demoTenant!.id, email: DEMO_EMAIL, passwordHash: demoHash,
          name: '데모 사용자', role: 'tenant_admin',
          isActive: true, isEmailVerified: true,
        },
      })
    );
  } else {
    await (prisma as any).user.update({
      where: { email: DEMO_EMAIL },
      data: { loginAttempts: 0, lockedUntil: null, isActive: true },
    });
    console.log(`  ✅ User: ${DEMO_EMAIL} — 계정 잠금 해제`);
  }

  // ── 4. 데모 데이터 ────────────────────────────
  const demoTenantFinal = await prisma.tenant.findFirst({ where: { domain: 'demo.carbonieum.com' } });
  const demoUserFinal   = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (demoTenantFinal && demoUserFinal) {
    await seedDemoData(prisma, demoTenantFinal.id, demoUserFinal.id);

    // 사이트/디바이스 ID 조회 후 추가 데모 데이터 삽입
    const demoSites = await prisma.site.findMany({
      where: { tenantId: demoTenantFinal.id },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    const demoDevices = await prisma.device.findMany({
      where: { tenantId: demoTenantFinal.id },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
    const siteIds   = demoSites.map(s => s.id);
    const deviceIds = demoDevices.map(d => d.id);

    await seedDemoExtra(prisma, demoTenantFinal.id, demoUserFinal.id, siteIds, deviceIds);
  } else {
    console.warn('  ⚠️  데모 테넌트/유저 없음 — 데모 데이터 생략');
  }

  console.log('\n🎉 시드 완료!\n');
  console.log('  접속 URL : http://49.50.130.189');
  console.log(`  관리자   : ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`  데모계정 : ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log('  추가계정 : manager@carbonieum.com / Password1!');
  console.log('  추가계정 : operator@carbonieum.com / Password1!');
  console.log('  추가계정 : viewer@carbonieum.com / Password1!');
  console.log('\n  ※ SEED_FORCE_RESET=true 옵션으로 비밀번호 재설정 가능\n');
}

main()
  .catch(e => { console.error('❌ Seed 실패:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
