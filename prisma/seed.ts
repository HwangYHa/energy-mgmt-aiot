/**
 * prisma/seed.ts — 탄소이음 EMS AIoT 초기 데이터 시딩
 *
 * 실행: npx tsx prisma/seed.ts
 * 또는: npx prisma db seed
 *
 * 포함 데이터:
 *   1. Feature 코드 (기능 단위)
 *   2. Plan + PlanFeature (구독 플랜)
 *   3. 슈퍼어드민 Tenant + User + Subscription
 *   4. 글로벌 EmissionFactor (한국 환경부 2024 기준)
 *   5. CarbonMarketPrice (K-ETS, EU ETS, VCM 최신 참고가)
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────
// 헬퍼: upsert 래퍼
// ─────────────────────────────────────────────
async function upsert<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const result = await fn();
  console.log(`  ✅ ${label}`);
  return result;
}

// ─────────────────────────────────────────────
// 1. Feature 코드
// ─────────────────────────────────────────────
const FEATURES = [
  // analytics
  { code: 'energy_dashboard',    name: '에너지 대시보드',    category: 'analytics' },
  { code: 'carbon_analytics',    name: '탄소 분석',          category: 'analytics' },
  { code: 'carbon_trading',      name: '탄소 거래',          category: 'analytics' },
  { code: 'esg_report',          name: 'ESG 보고서',         category: 'analytics' },
  { code: 'compliance_report',   name: '규제 준수 보고서',   category: 'analytics' },
  // ai
  { code: 'ai_forecast',         name: 'AI 예측',            category: 'ai' },
  { code: 'ai_anomaly',          name: 'AI 이상감지',        category: 'ai' },
  { code: 'ai_optimize',         name: 'AI 최적화',          category: 'ai' },
  // control
  { code: 'dr_event',            name: 'DR 이벤트',          category: 'control' },
  { code: 'gateway_mgmt',        name: '게이트웨이 관리',    category: 'control' },
  { code: 'sensor_mgmt',         name: '센서 관리',          category: 'control' },
  { code: 'digital_twin',        name: '디지털 트윈',        category: 'control' },
  // report
  { code: 'report_download',     name: '보고서 다운로드',    category: 'report' },
  { code: 'report_schedule',     name: '보고서 예약',        category: 'report' },
  // admin
  { code: 'multi_site',          name: '다중 사이트',        category: 'admin' },
  { code: 'multi_user',          name: '다중 사용자',        category: 'admin' },
  { code: 'api_access',          name: 'API 접근',           category: 'admin' },
  { code: 'audit_log',           name: '감사 로그',          category: 'admin' },
  { code: 'rbac',                name: '역할 기반 접근제어', category: 'admin' },
  { code: 'sso',                 name: 'SSO 연동',           category: 'admin' },
  { code: 'white_label',         name: '화이트라벨',         category: 'admin' },
];

// ─────────────────────────────────────────────
// 2. Plan 정의
// ─────────────────────────────────────────────
const PLANS = [
  {
    name: '무료 체험',
    tier: 'trial' as const,
    monthlyPrice: 0,
    yearlyPrice: 0,
    maxSites: 1,
    maxDevices: 10,
    maxUsers: 3,
    dataRetentionDays: 30,
    apiRateLimit: 100,
    features: { tier: 'trial', highlights: ['기본 에너지 모니터링', '1개 사이트', '30일 데이터'] },
    featureCodes: ['energy_dashboard', 'sensor_mgmt', 'gateway_mgmt'],
  },
  {
    name: '베이직',
    tier: 'basic' as const,
    monthlyPrice: 99000,
    yearlyPrice: 990000,
    maxSites: 3,
    maxDevices: 50,
    maxUsers: 10,
    dataRetentionDays: 180,
    apiRateLimit: 500,
    features: { tier: 'basic', highlights: ['탄소 분석', '3개 사이트', '180일 데이터', 'AI 예측'] },
    featureCodes: ['energy_dashboard', 'carbon_analytics', 'ai_forecast', 'ai_anomaly',
                   'sensor_mgmt', 'gateway_mgmt', 'report_download', 'multi_site', 'multi_user'],
  },
  {
    name: '프로',
    tier: 'pro' as const,
    monthlyPrice: 299000,
    yearlyPrice: 2990000,
    maxSites: 10,
    maxDevices: 200,
    maxUsers: 50,
    dataRetentionDays: 365,
    apiRateLimit: 2000,
    features: { tier: 'pro', highlights: ['ESG 보고서', '탄소 거래', '10개 사이트', 'API 접근'] },
    featureCodes: ['energy_dashboard', 'carbon_analytics', 'carbon_trading', 'esg_report',
                   'compliance_report', 'ai_forecast', 'ai_anomaly', 'ai_optimize',
                   'dr_event', 'sensor_mgmt', 'gateway_mgmt', 'digital_twin',
                   'report_download', 'report_schedule', 'multi_site', 'multi_user',
                   'api_access', 'audit_log', 'rbac'],
  },
  {
    name: '엔터프라이즈',
    tier: 'enterprise' as const,
    monthlyPrice: null,
    yearlyPrice: null,
    maxSites: null,
    maxDevices: null,
    maxUsers: null,
    dataRetentionDays: 1825, // 5년
    apiRateLimit: 10000,
    features: { tier: 'enterprise', highlights: ['무제한 사이트', 'SSO', '화이트라벨', '전담 지원'] },
    featureCodes: FEATURES.map(f => f.code), // 모든 기능
  },
];

// ─────────────────────────────────────────────
// 3. 글로벌 배출계수 (한국 환경부/전력거래소 2024)
// ─────────────────────────────────────────────
const EMISSION_FACTORS = [
  // Scope 2 — 전력
  {
    code: 'kr_elec_grid_2024', name: '한국 전력망 배출계수 (2024)',
    factorCode: 'kr-electricity-grid-location',
    category: 'electricity', sourceType: 'grid',
    energyType: 'electricity', calculationType: 'location',
    factor: '0.4781', unit: 'tCO2e/MWh', inputUnit: 'kWh',
    source: '한국전력거래소', sourceName: '2024 전력 CO₂ 배출계수',
    sourceVersion: '2024', countryCode: 'KR',
    year: 2024, region: 'KR', version: '1.0.0',
  },
  {
    code: 'kr_elec_grid_2023', name: '한국 전력망 배출계수 (2023)',
    factorCode: 'kr-electricity-grid-location-2023',
    category: 'electricity', sourceType: 'grid',
    energyType: 'electricity', calculationType: 'location',
    factor: '0.4747', unit: 'tCO2e/MWh', inputUnit: 'kWh',
    source: '한국전력거래소', sourceName: '2023 전력 CO₂ 배출계수',
    sourceVersion: '2023', countryCode: 'KR',
    year: 2023, region: 'KR', version: '1.0.0',
  },
  // Scope 1 — 고정연소
  {
    code: 'kr_diesel_combustion', name: '경유 연소',
    factorCode: 'kr-diesel-stationary-combustion',
    category: 'fuel', sourceType: 'stationary_combustion',
    energyType: 'diesel', calculationType: 'activity',
    factor: '2.5900', unit: 'kgCO2e/L', inputUnit: 'L',
    source: '환경부', sourceName: '국가 온실가스 배출계수 고시',
    sourceVersion: '2024', countryCode: 'KR',
    year: 2024, region: 'KR', version: '1.0.0',
  },
  {
    code: 'kr_lng_combustion', name: 'LNG(도시가스) 연소',
    factorCode: 'kr-lng-stationary-combustion',
    category: 'fuel', sourceType: 'stationary_combustion',
    energyType: 'lng', calculationType: 'activity',
    factor: '2.1760', unit: 'kgCO2e/m3', inputUnit: 'm3',
    source: '환경부', sourceName: '국가 온실가스 배출계수 고시',
    sourceVersion: '2024', countryCode: 'KR',
    year: 2024, region: 'KR', version: '1.0.0',
  },
  {
    code: 'kr_lpg_combustion', name: 'LPG 연소',
    factorCode: 'kr-lpg-stationary-combustion',
    category: 'fuel', sourceType: 'stationary_combustion',
    energyType: 'lpg', calculationType: 'activity',
    factor: '3.0120', unit: 'kgCO2e/kg', inputUnit: 'kg',
    source: '환경부', sourceName: '국가 온실가스 배출계수 고시',
    sourceVersion: '2024', countryCode: 'KR',
    year: 2024, region: 'KR', version: '1.0.0',
  },
  {
    code: 'kr_gasoline_combustion', name: '휘발유 연소',
    factorCode: 'kr-gasoline-stationary-combustion',
    category: 'fuel', sourceType: 'stationary_combustion',
    energyType: 'gasoline', calculationType: 'activity',
    factor: '2.1800', unit: 'kgCO2e/L', inputUnit: 'L',
    source: '환경부', sourceName: '국가 온실가스 배출계수 고시',
    sourceVersion: '2024', countryCode: 'KR',
    year: 2024, region: 'KR', version: '1.0.0',
  },
  {
    code: 'kr_coal_combustion', name: '유연탄(석탄) 연소',
    factorCode: 'kr-coal-stationary-combustion',
    category: 'fuel', sourceType: 'stationary_combustion',
    energyType: 'coal', calculationType: 'activity',
    factor: '2.5900', unit: 'kgCO2e/kg', inputUnit: 'kg',
    source: '환경부', sourceName: '국가 온실가스 배출계수 고시',
    sourceVersion: '2024', countryCode: 'KR',
    year: 2024, region: 'KR', version: '1.0.0',
  },
  // Scope 1 — 이동연소 (차량)
  {
    code: 'kr_diesel_mobile', name: '경유 이동연소(차량)',
    factorCode: 'kr-diesel-mobile-combustion',
    category: 'transport', sourceType: 'mobile_combustion',
    energyType: 'diesel', calculationType: 'activity',
    factor: '2.6790', unit: 'kgCO2e/L', inputUnit: 'L',
    source: '환경부', sourceName: '국가 온실가스 배출계수 고시',
    sourceVersion: '2024', countryCode: 'KR',
    year: 2024, region: 'KR', version: '1.0.0',
  },
  // Scope 3 — 폐기물
  {
    code: 'kr_waste_general', name: '일반 폐기물 매립',
    factorCode: 'kr-waste-landfill-general',
    category: 'waste', sourceType: 'waste',
    energyType: 'waste', calculationType: 'activity',
    factor: '0.5010', unit: 'tCO2e/t', inputUnit: 't',
    source: '환경부', sourceName: '국가 온실가스 배출계수 고시',
    sourceVersion: '2024', countryCode: 'KR',
    year: 2024, region: 'KR', version: '1.0.0',
  },
];

// ─────────────────────────────────────────────
// 4. 탄소 시장 가격 (참고용 최신 시세)
// ─────────────────────────────────────────────
const CARBON_MARKET_PRICES = [
  { market: 'KETS',        price: '13500.0000', currency: 'KRW', unit: 'tCO2', source: 'KAU 현물' },
  { market: 'EU_ETS',      price: '65.2400',    currency: 'EUR', unit: 'tCO2', source: 'EUA 현물' },
  { market: 'VCM',         price: '14.8000',    currency: 'USD', unit: 'tCO2', source: 'CBL Nature' },
  { market: 'GOLD_STANDARD', price: '18.5000',  currency: 'USD', unit: 'tCO2', source: 'GS VER' },
];

// ─────────────────────────────────────────────
// main
// ─────────────────────────────────────────────
async function main() {
  console.log('\n🌱 탄소이음 EMS AIoT — 시드 데이터 삽입 시작\n');

  // ── 1. Feature ───────────────────────────────
  console.log('📦 [1/5] Feature 코드');
  for (const f of FEATURES) {
    await upsert(`Feature: ${f.code}`, () =>
      prisma.feature.upsert({
        where: { code: f.code },
        update: { name: f.name, category: f.category },
        create: { code: f.code, name: f.name, category: f.category, description: f.name },
      })
    );
  }

  // ── 2. Plan + PlanFeature ────────────────────
  console.log('\n📦 [2/5] 구독 플랜');
  for (const p of PLANS) {
    const existing = await prisma.plan.findFirst({ where: { tier: p.tier, isActive: true } });
    const plan = await upsert(`Plan: ${p.name} (${p.tier})`, () =>
      existing
        ? prisma.plan.update({
            where: { id: existing.id },
            data: {
              name: p.name,
              monthlyPrice: p.monthlyPrice,
              yearlyPrice: p.yearlyPrice,
              maxSites: p.maxSites,
              maxDevices: p.maxDevices,
              maxUsers: p.maxUsers,
              dataRetentionDays: p.dataRetentionDays,
              apiRateLimit: p.apiRateLimit,
              features: p.features,
            },
          })
        : prisma.plan.create({
            data: {
              name: p.name,
              tier: p.tier,
              monthlyPrice: p.monthlyPrice,
              yearlyPrice: p.yearlyPrice,
              maxSites: p.maxSites,
              maxDevices: p.maxDevices,
              maxUsers: p.maxUsers,
              dataRetentionDays: p.dataRetentionDays,
              apiRateLimit: p.apiRateLimit,
              features: p.features,
              isActive: true,
              isPublic: p.tier !== 'enterprise',
            },
          })
    );

    // PlanFeature
    for (const code of p.featureCodes) {
      await prisma.planFeature.upsert({
        where: { planId_featureCode: { planId: plan.id, featureCode: code } },
        update: {},
        create: { planId: plan.id, featureCode: code },
      });
    }
    console.log(`     └─ PlanFeature ${p.featureCodes.length}개 연결`);
  }

  // ── 3. 슈퍼어드민 테넌트 + 유저 + 구독 ────────
  console.log('\n📦 [3/5] 슈퍼어드민 테넌트 / 사용자');

  const enterprisePlan = await prisma.plan.findFirst({ where: { tier: 'enterprise' } });
  if (!enterprisePlan) throw new Error('enterprise plan not found');

  const adminTenant = await upsert('Tenant: 탄소이음 (super)', () =>
    prisma.tenant.upsert({
      where: { domain: 'carbonieum.co.kr' },
      update: {},
      create: {
        name: '탄소이음',
        domain: 'carbonieum.co.kr',
        industryType: 'other',
        country: 'KR',
        timezone: 'Asia/Seoul',
        status: 'active',
        onboardingStep: 5,
        onboardingCompletedAt: new Date(),
        settings: { menu: null },
      },
    })
  );

  // super_admin 구독
  const existingSub = await prisma.subscription.findFirst({
    where: { tenantId: adminTenant.id, status: 'ACTIVE' },
  });
  if (!existingSub) {
    const tenYearsLater = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 10);
    await upsert('Subscription: 탄소이음 enterprise', () =>
      prisma.subscription.create({
        data: {
          tenantId: adminTenant.id,
          planId: enterprisePlan.id,
          status: 'ACTIVE',
          billingCycle: 'yearly',
          startDate: new Date(),
          endDate: tenYearsLater,
          autoRenew: false,
        },
      })
    );
  } else {
    console.log('  ✅ Subscription: 이미 존재');
  }

  // super_admin 유저
  const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@carbonieum.co.kr';
  const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Carbonieum2026!';
  // SEED_FORCE_RESET=true 일 때 비밀번호도 재설정
  const FORCE_RESET = process.env.SEED_FORCE_RESET === 'true';

  const existingUser = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!existingUser) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await upsert(`User: ${ADMIN_EMAIL} (super_admin 신규 생성)`, () =>
      prisma.user.create({
        data: {
          tenantId: adminTenant.id,
          email: ADMIN_EMAIL,
          passwordHash: hash,
          name: '탄소이음 관리자',
          role: 'super_admin',
          isActive: true,
          isEmailVerified: true,
        },
      })
    );
    console.log(`\n  ⚠️  초기 비밀번호: ${ADMIN_PASSWORD}`);
    console.log('  ⚠️  로그인 후 즉시 변경하세요!\n');
  } else {
    // 계정 잠금 해제 + 활성화 (이전 실패 시도로 잠겼을 경우 대비)
    const updateData: Record<string, unknown> = {
      loginAttempts: 0,
      lockedUntil: null,
      isActive: true,
    };
    if (FORCE_RESET) {
      updateData.passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
      console.log(`  🔑 FORCE_RESET: 비밀번호 재설정 포함`);
    }
    await (prisma as any).user.update({
      where: { email: ADMIN_EMAIL },
      data: updateData,
    });
    console.log(`  ✅ User: ${ADMIN_EMAIL} — 계정 잠금 해제 완료 (loginAttempts=0, lockedUntil=null)`);
    if (FORCE_RESET) {
      console.log(`\n  ⚠️  재설정된 비밀번호: ${ADMIN_PASSWORD}\n`);
    }
  }

  // ── 데모 계정 (로그인 페이지 "데모 체험" 버튼용) ─────────────
  console.log('\n📦 [3b] 데모 계정');
  const DEMO_EMAIL = 'demo@carbonieum.com';
  const DEMO_PASSWORD = 'Demo1234!';

  let demoTenant = await prisma.tenant.findFirst({ where: { domain: 'demo.carbonieum.com' } });
  if (!demoTenant) {
    demoTenant = await upsert('Tenant: 탄소이음 Demo', () =>
      prisma.tenant.create({
        data: {
          name: '탄소이음 Demo',
          domain: 'demo.carbonieum.com',
          industryType: 'other',
          country: 'KR',
          timezone: 'Asia/Seoul',
          status: 'active',
          onboardingStep: 5,
          onboardingCompletedAt: new Date(),
          settings: { menu: null },
        },
      })
    );
    // demo 구독 (enterprise, 1년)
    const oneYearLater = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    await prisma.subscription.create({
      data: {
        tenantId: demoTenant.id,
        planId: enterprisePlan.id,
        status: 'ACTIVE',
        billingCycle: 'yearly',
        startDate: new Date(),
        endDate: oneYearLater,
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
          tenantId: demoTenant!.id,
          email: DEMO_EMAIL,
          passwordHash: demoHash,
          name: '데모 사용자',
          role: 'tenant_admin',
          isActive: true,
          isEmailVerified: true,
        },
      })
    );
  } else {
    // 데모 계정도 잠금 해제
    await (prisma as any).user.update({
      where: { email: DEMO_EMAIL },
      data: { loginAttempts: 0, lockedUntil: null, isActive: true },
    });
    console.log(`  ✅ User: ${DEMO_EMAIL} — 계정 잠금 해제`);
  }

  // ── 4. 글로벌 배출계수 ───────────────────────
  console.log('\n📦 [4/5] 글로벌 배출계수 (환경부 2024)');
  for (const ef of EMISSION_FACTORS) {
    await upsert(`EmissionFactor: ${ef.code}`, () =>
      (prisma.emissionFactor as any).upsert({
        where: { code_version: { code: ef.code, version: ef.version } },
        update: { factor: ef.factor, year: ef.year, isActive: true },
        create: {
          code: ef.code,
          name: ef.name,
          factorCode: ef.factorCode,
          category: ef.category,
          sourceType: ef.sourceType,
          energyType: ef.energyType,
          calculationType: ef.calculationType,
          factor: ef.factor,
          unit: ef.unit,
          inputUnit: ef.inputUnit,
          source: ef.source,
          sourceName: ef.sourceName,
          sourceVersion: ef.sourceVersion,
          countryCode: ef.countryCode,
          factorSourceType: 'official',
          year: ef.year,
          region: ef.region,
          version: ef.version,
          isCustom: false,
          isDefault: true,
          isActive: true,
          approvalStatus: 'APPROVED',
          validFrom: new Date(`${ef.year}-01-01`),
          validTo: new Date(`${ef.year}-12-31`),
        },
      })
    );
  }

  // ── 5. 탄소시장 가격 ──────────────────────────
  console.log('\n📦 [5/5] 탄소시장 참고 가격');
  const today = new Date().toISOString().split('T')[0]!;
  const todayDate = new Date(today);
  for (const p of CARBON_MARKET_PRICES) {
    await upsert(`CarbonMarketPrice: ${p.market}`, () =>
      (prisma.carbonMarketPrice as any).upsert({
        where: { uq_market_date: { market: p.market, priceDate: todayDate } },
        update: { price: p.price, source: p.source },
        create: {
          market: p.market,
          priceDate: todayDate,
          price: p.price,
          currency: p.currency,
          unit: p.unit,
          source: p.source,
        },
      })
    );
  }

  console.log('\n🎉 시드 완료!\n');
  console.log('  접속 URL : http://49.50.130.189');
  console.log(`  관리자   : ${ADMIN_EMAIL}`);
  console.log(`  관리자PW : ${ADMIN_PASSWORD}`);
  console.log(`  데모계정 : ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log('\n  ※ SEED_FORCE_RESET=true 옵션으로 비밀번호 재설정 가능\n');
}

main()
  .catch(e => { console.error('❌ Seed 실패:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
