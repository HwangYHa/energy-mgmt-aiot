/**
 * prisma/seed-demo-full.ts
 * 탄소이음 EMS AIoT — 데모 계정 전체 메뉴 화면 대량 데이터 삽입 (2차)
 *
 * seed-demo-extra.ts 이후에 실행되어 아래 메뉴 화면 데이터를 추가로 채움:
 *  - 알람 규칙 설정       (AlertRule 15건)
 *  - 알림 규칙            (NotificationRule 10건)
 *  - 센서 관리            (Sensor 30건)
 *  - 수동 제어 이력       (ControlLog 60건)
 *  - 청구서               (Invoice 13건 + InvoiceLineItem)
 *  - 결제 이력            (PaymentHistory 12건)
 *  - 규제 샌드박스        (RegulatorySandbox 6건)
 *  - 보안 알림            (RansomwareAlert 18건)
 *  - 백업 기록            (BackupRecord 24건)
 *  - 계산 엔진 버전       (CalcEngineVersion 2건)
 *  - 정밀 배출량 기록     (EmissionsRecord 24건)
 *  - 디지털 트윈          (PhysicalSpace + TwinNode)
 *  - API 키               (ApiKey 4건)
 *  - 고객 문의            (SupportInquiry 20건)
 *  - 규제 보고서          (RegulationReport 10건)
 *  - 탄소 시장 가격       (CarbonMarketPrice 365일 × 4개 시장)
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// 유틸 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

/** days일 전 Date 반환 */
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

/** days일 후 Date 반환 */
function daysLater(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

/** min~max 사이 랜덤 정수 */
function ri(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** min~max 사이 랜덤 실수 (소수 n자리) */
function rf(min: number, max: number, n = 2): number {
  return Math.round((Math.random() * (max - min) + min) * 10 ** n) / 10 ** n;
}

/** 배열에서 랜덤 항목 반환 */
function pick<T>(arr: T[]): T {
  return arr[ri(0, arr.length - 1)]!;
}

/** SHA-256 해시 */
function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

/** 월 시작일 (현재 기준 n개월 전) */
function mStart(n: number): Date {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 월 종료일 (현재 기준 n개월 전) */
function mEnd(n: number): Date {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n + 1);
  d.setDate(0);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** "YYYY-MM" 문자열 (현재 기준 n개월 전) */
function period(n: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인 시딩 함수
// ─────────────────────────────────────────────────────────────────────────────

export async function seedDemoFull(
  prisma: PrismaClient,
  tenantId: string,
  userId: string,
  siteIds: string[],
  deviceIds: string[],
) {
  const site1 = siteIds[0] ?? '';
  const site2 = siteIds[1] ?? '';
  const site3 = siteIds[2] ?? '';

  // ── 1. AlertRule (알람 규칙 설정 15건) ──────────────────────────────────
  console.log('\n📦 [Full] AlertRule (15건)');
  const existingAR = await prisma.alertRule.count({ where: { tenantId } });
  if (existingAR < 5) {
    const alertRules = [
      // 에너지 알람
      {
        name: '전력 피크 초과 경보 (500kW)',
        description: '순간 최대수요가 계약 전력 500kW를 초과하면 즉시 경보 발령',
        category: 'energy' as const,
        severity: 'critical' as const,
        scope: 'tenant' as const,
        scopeId: null,
        condition: { metric: 'power_active_kw', operator: 'gt', threshold: 500, windowMin: 1 },
        channels: ['email', 'sms'],
        recipients: ['demo@carbonieum.com'],
      },
      {
        name: '에너지 사용량 급증 감지',
        description: '전일 동시간 대비 에너지 사용량 30% 이상 증가 시 경고',
        category: 'energy' as const,
        severity: 'warning' as const,
        scope: 'site' as const,
        scopeId: site1,
        condition: { metric: 'energy_kwh', operator: 'pct_change_gt', threshold: 30, compareWindow: '1d' },
        channels: ['email'],
        recipients: ['demo@carbonieum.com'],
      },
      {
        name: '역률(Power Factor) 저하 경고',
        description: '역률이 85% 미만으로 저하 시 에너지 손실 경고',
        category: 'energy' as const,
        severity: 'warning' as const,
        scope: 'device' as const,
        scopeId: deviceIds[0] ?? null,
        condition: { metric: 'power_factor', operator: 'lt', threshold: 85, windowMin: 15 },
        channels: ['email'],
        recipients: ['demo@carbonieum.com'],
      },
      {
        name: '야간 대기전력 이상 감지',
        description: '23시~06시 에너지 사용이 기준치 150kWh/h 초과 시 알람',
        category: 'energy' as const,
        severity: 'warning' as const,
        scope: 'site' as const,
        scopeId: site2,
        condition: { metric: 'power_active_kw', operator: 'gt', threshold: 150, timeRange: { start: 23, end: 6 } },
        channels: ['email'],
        recipients: ['demo@carbonieum.com'],
      },
      {
        name: '월간 에너지 예산 90% 도달',
        description: '월간 에너지 예산(250,000kWh)의 90% 도달 시 사전 경고',
        category: 'energy' as const,
        severity: 'warning' as const,
        scope: 'tenant' as const,
        scopeId: null,
        condition: { metric: 'monthly_kwh', operator: 'gte', threshold: 225000 },
        channels: ['email'],
        recipients: ['demo@carbonieum.com'],
      },
      // 설비 알람
      {
        name: '게이트웨이 연결 끊김',
        description: '게이트웨이가 30분 이상 응답 없을 경우 긴급 알람',
        category: 'device' as const,
        severity: 'critical' as const,
        scope: 'tenant' as const,
        scopeId: null,
        condition: { metric: 'gateway_heartbeat', operator: 'missing', windowMin: 30 },
        channels: ['email', 'sms'],
        recipients: ['demo@carbonieum.com'],
      },
      {
        name: '공조기(AHU) 이상 온도 감지',
        description: '공조기 급기온도가 28°C 초과 시 즉시 경보 (냉방 이상)',
        category: 'device' as const,
        severity: 'critical' as const,
        scope: 'device' as const,
        scopeId: deviceIds[1] ?? null,
        condition: { metric: 'supply_temp_c', operator: 'gt', threshold: 28, windowMin: 5 },
        channels: ['email', 'sms'],
        recipients: ['demo@carbonieum.com'],
      },
      {
        name: '냉동기 COP 저하 경보',
        description: 'COP(성능계수)가 3.0 미만으로 저하 시 점검 필요 알람',
        category: 'device' as const,
        severity: 'warning' as const,
        scope: 'device' as const,
        scopeId: deviceIds[4] ?? null,
        condition: { metric: 'cop', operator: 'lt', threshold: 3.0, windowMin: 30 },
        channels: ['email'],
        recipients: ['demo@carbonieum.com'],
      },
      {
        name: '압축기 토출 압력 이상',
        description: '압축기 출구 압력이 10bar 초과 시 안전 경보',
        category: 'device' as const,
        severity: 'critical' as const,
        scope: 'device' as const,
        scopeId: deviceIds[2] ?? null,
        condition: { metric: 'pressure_bar', operator: 'gt', threshold: 10, windowMin: 2 },
        channels: ['email', 'sms'],
        recipients: ['demo@carbonieum.com'],
      },
      // 탄소 알람
      {
        name: '탄소 배출 예산 80% 초과',
        description: '월간 탄소 배출량이 예산(80tCO₂)의 80% 도달 시 경고',
        category: 'energy' as const,
        severity: 'warning' as const,
        scope: 'tenant' as const,
        scopeId: null,
        condition: { metric: 'monthly_co2_ton', operator: 'gte', threshold: 64 },
        channels: ['email'],
        recipients: ['demo@carbonieum.com'],
      },
      // DR 알람
      {
        name: 'DR 이벤트 30분 전 사전 알림',
        description: 'DR 이벤트 시작 30분 전 사전 준비 알림 자동 발송',
        category: 'dr' as const,
        severity: 'info' as const,
        scope: 'tenant' as const,
        scopeId: null,
        condition: { trigger: 'dr_event_upcoming', leadTimeMin: 30 },
        channels: ['email', 'sms'],
        recipients: ['demo@carbonieum.com'],
      },
      {
        name: 'DR 이벤트 감축 목표 미달 경보',
        description: 'DR 이벤트 중 목표 감축량의 80%에 미달 시 즉시 경보',
        category: 'dr' as const,
        severity: 'warning' as const,
        scope: 'tenant' as const,
        scopeId: null,
        condition: { trigger: 'dr_reduction_below_pct', threshold: 80 },
        channels: ['email'],
        recipients: ['demo@carbonieum.com'],
      },
      // 보안 알람
      {
        name: '비정상 로그인 시도 감지',
        description: '동일 IP에서 5회 이상 로그인 실패 시 보안 경보',
        category: 'security' as const,
        severity: 'critical' as const,
        scope: 'tenant' as const,
        scopeId: null,
        condition: { trigger: 'login_failure_count', threshold: 5, windowMin: 10 },
        channels: ['email'],
        recipients: ['demo@carbonieum.com'],
      },
      {
        name: '구독 만료 7일 전 안내',
        description: '구독 만료 7일 전 갱신 안내 알림 발송',
        category: 'system' as const,
        severity: 'info' as const,
        scope: 'tenant' as const,
        scopeId: null,
        condition: { trigger: 'subscription_expiry_days', threshold: 7 },
        channels: ['email'],
        recipients: ['demo@carbonieum.com'],
      },
      {
        name: 'CO₂ 농도 실내 공기질 경보',
        description: '실내 CO₂ 농도 1,000 ppm 초과 시 환기 권장 경고',
        category: 'energy' as const,
        severity: 'warning' as const,
        scope: 'site' as const,
        scopeId: site2,
        condition: { metric: 'co2_ppm', operator: 'gt', threshold: 1000, windowMin: 10 },
        channels: ['email'],
        recipients: ['demo@carbonieum.com'],
      },
    ];

    for (const r of alertRules) {
      await prisma.alertRule.create({
        data: {
          tenantId,
          name:       r.name,
          description: r.description,
          category:   r.category,
          severity:   r.severity,
          scope:      r.scope,
          scopeId:    r.scopeId ?? undefined,
          condition:  r.condition,
          channels:   r.channels,
          recipients: r.recipients,
          enabled:    true,
        },
      });
    }
    console.log('  ✅ AlertRule 15건 완료');
  } else {
    console.log(`  ✅ AlertRule 이미 충분 (${existingAR}건)`);
  }

  // ── 2. NotificationRule (알림 규칙 10건) ────────────────────────────────
  console.log('\n📦 [Full] NotificationRule (10건)');
  const existingNR = await (prisma.notificationRule as any).count({ where: { tenantId } });
  if (existingNR < 5) {
    const nrDefs = [
      { name: '에너지 이상 알림 - 이메일', category: 'energy' as const, severity: 'critical' as const, emailEnabled: true,  smsEnabled: true,  threshold: 500,  unit: 'kW',   op: 'gt'  },
      { name: '에너지 경고 알림 - 이메일', category: 'energy' as const, severity: 'warning' as const, emailEnabled: true,  smsEnabled: false, threshold: 400,  unit: 'kW',   op: 'gt'  },
      { name: '설비 장애 즉시 알림',       category: 'device' as const, severity: 'critical' as const, emailEnabled: true,  smsEnabled: true,  threshold: null, unit: null,   op: null  },
      { name: '설비 경고 알림',            category: 'device' as const, severity: 'warning' as const, emailEnabled: true,  smsEnabled: false, threshold: null, unit: null,   op: null  },
      { name: 'DR 이벤트 알림',            category: 'dr'     as const, severity: 'info'     as const, emailEnabled: true,  smsEnabled: true,  threshold: null, unit: null,   op: null  },
      { name: '탄소 배출 경고',            category: 'energy' as const, severity: 'warning' as const, emailEnabled: true,  smsEnabled: false, threshold: 80,   unit: 'tCO2', op: 'gte' },
      { name: '보안 이벤트 긴급 알림',     category: 'security' as const, severity: 'critical' as const, emailEnabled: true, smsEnabled: true,  threshold: null, unit: null,   op: null  },
      { name: '시스템 점검 안내',          category: 'system' as const, severity: 'info'     as const, emailEnabled: true,  smsEnabled: false, threshold: null, unit: null,   op: null  },
      { name: '구독/결제 알림',            category: 'system' as const, severity: 'warning' as const, emailEnabled: true,  smsEnabled: false, threshold: null, unit: null,   op: null  },
      { name: '리포트 생성 완료 알림',     category: 'system' as const, severity: 'info'     as const, emailEnabled: true,  smsEnabled: false, threshold: null, unit: null,   op: null  },
    ];
    for (const r of nrDefs) {
      await (prisma.notificationRule as any).create({
        data: {
          tenantId,
          userId,
          name:          r.name,
          category:      r.category,
          severity:      r.severity,
          emailEnabled:  r.emailEnabled,
          smsEnabled:    r.smsEnabled,
          threshold:     r.threshold,
          thresholdUnit: r.unit,
          thresholdOp:   r.op,
          enabled:       true,
        },
      });
    }
    console.log('  ✅ NotificationRule 10건 완료');
  } else {
    console.log(`  ✅ NotificationRule 이미 충분 (${existingNR}건)`);
  }

  // NotificationRule ID 조회 (NotificationLog 재삽입용)
  const notifRules = await (prisma.notificationRule as any).findMany({
    where: { tenantId }, select: { id: true }, take: 10,
  });
  if (notifRules.length > 0) {
    const existingNL = await (prisma.notificationLog as any).count({ where: { rule: { tenantId } } });
    if (existingNL < 10) {
      console.log('\n📦 [Full] NotificationLog (80건 — 규칙 연결)');
      const subjects = [
        '⚡ 전력 피크 초과 경보 - 즉시 조치 필요',
        '🌡️ 공조기 이상 온도 감지 (AHU-1)',
        '📡 게이트웨이 연결 끊김 (GW-FAC-001)',
        '🌿 탄소 예산 90% 도달 - 이번 달 잔여 예산 부족',
        '🔔 DR 이벤트 30분 전 사전 알림',
        '💡 실내 CO₂ 농도 1,200ppm 경고',
        '💳 구독 만료 7일 전 갱신 안내',
        '🔒 비정상 로그인 시도 5회 감지',
        '📊 월간 리포트 생성 완료',
        '🔧 냉동기 COP 2.8 저하 — 점검 권장',
      ];
      for (let i = 0; i < 80; i++) {
        const rule    = notifRules[ri(0, notifRules.length - 1)]!;
        const success = Math.random() > 0.05;
        await (prisma.notificationLog as any).create({
          data: {
            ruleId:    rule.id,
            channel:   pick(['email', 'sms', 'push']),
            recipient: 'demo@carbonieum.com',
            subject:   subjects[ri(0, subjects.length - 1)],
            body:      `[탄소이음 EMS] 자동 알림 #${i + 1}: 시스템 감지 이벤트 발생. 대시보드에서 상세 내용을 확인하세요.`,
            status:    success ? 'sent' : 'failed',
            errorMsg:  success ? null : 'SMTP 서버 응답 없음 (timeout)',
            sentAt:    success ? daysAgo(ri(0, 180)) : null,
            createdAt: daysAgo(ri(0, 180)),
          },
        });
        if (i % 20 === 0) process.stdout.write('.');
      }
      console.log('\n  ✅ NotificationLog 80건 완료');
    }
  }

  // ── 3. Sensor (센서 관리 30건) ──────────────────────────────────────────
  console.log('\n📦 [Full] Sensor (30건)');
  const existingSensor = await (prisma.sensor as any).count({ where: { tenantId } });
  if (existingSensor < 10 && deviceIds.length > 0) {
    const sensorTypes = [
      { type: 'temperature',       unit: '°C',  mfr: 'VAISALA',   model: 'HMT310',        min: -10,  max: 80   },
      { type: 'humidity',          unit: '%RH', mfr: 'VAISALA',   model: 'HMT310',        min: 0,    max: 100  },
      { type: 'co2',               unit: 'ppm', mfr: 'Trane',     model: 'CO2-Sensor-1K', min: 400,  max: 5000 },
      { type: 'power',             unit: 'kW',  mfr: 'LS일렉트릭', model: 'CT-300',        min: 0,    max: 1000 },
      { type: 'current',           unit: 'A',   mfr: 'ABB',       model: 'CM-EFS.2',      min: 0,    max: 3000 },
      { type: 'voltage',           unit: 'V',   mfr: 'ABB',       model: 'CM-EFC.2',      min: 100,  max: 480  },
      { type: 'pressure',          unit: 'bar', mfr: '한화',      model: 'PT-100',        min: 0,    max: 20   },
      { type: 'flow_rate',         unit: 'L/m', mfr: 'Endress',   model: 'Proline 300',   min: 0,    max: 2000 },
      { type: 'illuminance',       unit: 'lux', mfr: '오스람',    model: 'DALI-S01',      min: 0,    max: 5000 },
      { type: 'occupancy',         unit: '',    mfr: 'Bosch',     model: 'BSD-300',       min: 0,    max: 1    },
    ];
    const locations = [
      '1층 기계실', '2층 전기실', '옥상 설비층', '냉동기실', '공조기실',
      '서버룸', '생산라인 A', '생산라인 B', '사무층 1', '창고 구역',
    ];
    let sensorCount = 0;
    for (let i = 0; i < 30 && i < deviceIds.length * 3; i++) {
      const devId = deviceIds[Math.floor(i / 3) % deviceIds.length]!;
      const st = sensorTypes[i % sensorTypes.length]!;
      const calDate = daysAgo(ri(30, 365));
      await (prisma.sensor as any).create({
        data: {
          tenantId,
          deviceId:            devId,
          name:                `${st.type === 'temperature' ? '온도' : st.type === 'humidity' ? '습도' : st.type === 'co2' ? 'CO₂' : st.type === 'power' ? '전력' : st.type === 'current' ? '전류' : st.type === 'voltage' ? '전압' : st.type === 'pressure' ? '압력' : st.type === 'flow_rate' ? '유량' : st.type === 'illuminance' ? '조도' : '재실'} 센서 #${String(i + 1).padStart(3, '0')}`,
          code:                `SEN-${String(i + 1).padStart(4, '0')}`,
          serialNumber:        `SN${2024000 + i}`,
          sensorType:          st.type,
          manufacturer:        st.mfr,
          model:               st.model,
          unit:                st.unit || undefined,
          minRange:            st.min,
          maxRange:            st.max,
          calibrationDate:     calDate,
          nextCalibrationDate: new Date(calDate.getTime() + 365 * 86_400_000),
          status:              pick(['online', 'online', 'online', 'online', 'offline', 'maintenance']),
          lastValue:           rf(st.min, st.max),
          lastSeenAt:          daysAgo(ri(0, 2)),
          installLocation:     pick(locations),
          installDate:         daysAgo(ri(180, 730)),
          metadata:            { accuracy: '±0.3', ipRating: 'IP54', protocol: 'RS-485' },
        },
      });
      sensorCount++;
      if (sensorCount % 10 === 0) process.stdout.write('.');
    }
    console.log(`\n  ✅ Sensor ${sensorCount}건 완료`);
  } else {
    console.log(`  ✅ Sensor 이미 충분 (${existingSensor}건)`);
  }

  // ── 4. ControlLog (수동 제어 이력 60건) ─────────────────────────────────
  console.log('\n📦 [Full] ControlLog (60건)');
  const existingCL = await (prisma.controlLog as any).count({ where: { tenantId } });
  if (existingCL < 20 && deviceIds.length > 0) {
    const actions = [
      { action: 'setpoint_temperature', reason: '여름철 냉방 설정온도 조정 (에너지 절감)', target: 24,  site: site1 },
      { action: 'setpoint_temperature', reason: '야간 냉방 설정온도 완화 (26°C 유지)',      target: 26,  site: site1 },
      { action: 'stop',                 reason: '점심 시간대 압축기 가동 중지 (피크 저감)',  target: 0,   site: site1 },
      { action: 'start',                reason: 'DR 이벤트 종료 후 정상 운전 복귀',          target: null, site: site1 },
      { action: 'setpoint_power',       reason: '최대 수요 전력 제한 (DR 대응)',              target: 400, site: site2 },
      { action: 'dim',                  reason: '자연 채광 확보 구역 조도 50% 절감',          target: 50,  site: site2 },
      { action: 'stop',                 reason: '주말 설비 자동 중지 스케줄 적용',            target: 0,   site: site3 },
      { action: 'start',                reason: '월요일 사전 예열 (출근 30분 전 자동 기동)',  target: null, site: site3 },
      { action: 'setpoint_cop',         reason: 'COP 최적화 운전 모드 전환 (AI 권장)',        target: 5.2, site: site1 },
      { action: 'maintenance_mode',     reason: '정기 점검을 위한 유지보수 모드 전환',        target: null, site: site2 },
    ];
    const statuses = ['success', 'success', 'success', 'success', 'success', 'success', 'failed', 'pending'] as const;
    const modes    = ['manual', 'manual', 'scheduled', 'ai'] as const;
    for (let i = 0; i < 60; i++) {
      const devId = deviceIds[ri(0, Math.min(deviceIds.length - 1, 7))]!;
      const act   = actions[i % actions.length]!;
      const reqAt = daysAgo(ri(0, 180));
      const st    = pick(statuses);
      const mode  = pick(modes);
      const appRequired = mode === 'manual' && act.target !== null;
      await (prisma.controlLog as any).create({
        data: {
          tenantId,
          deviceId:        devId,
          action:          act.action,
          parameters:      { mode: 'auto', priority: ri(1, 5) },
          targetValue:     act.target,
          actualValue:     st === 'success' ? (act.target ? act.target * rf(0.95, 1.05) : null) : null,
          status:          st,
          requiresApproval: appRequired,
          approvedBy:      appRequired && st === 'success' ? userId : null,
          approvedAt:      appRequired && st === 'success' ? new Date(reqAt.getTime() + ri(1, 10) * 60_000) : null,
          executedBy:      userId,
          executionMode:   mode,
          reason:          act.reason,
          siteId:          act.site || undefined,
          ipAddress:       `192.168.1.${ri(10, 200)}`,
          requestedAt:     reqAt,
        },
      });
      if (i % 20 === 0) process.stdout.write('.');
    }
    console.log('\n  ✅ ControlLog 60건 완료');
  } else {
    console.log(`  ✅ ControlLog 이미 충분 (${existingCL}건)`);
  }

  // ── 5. Invoice + InvoiceLineItem (13개월 청구서) ────────────────────────
  console.log('\n📦 [Full] Invoice + InvoiceLineItem (13건)');
  const sub = await prisma.subscription.findFirst({
    where: { tenantId, status: 'ACTIVE' }, select: { id: true },
  });
  const existingInv = await (prisma.invoice as any).count({ where: { tenantId } });
  if (existingInv < 5 && sub) {
    const planPrices: Record<number, number> = {
      0:  990_000,  // 이번 달 (미발행)
      1:  990_000,  2:  990_000,  3:  990_000,
      4:  990_000,  5:  990_000,  6:  990_000,
      7:  990_000,  8:  990_000,  9:  990_000,
      10: 990_000,  11: 990_000,  12: 990_000,
    };
    for (let m = 1; m <= 13; m++) {
      const pStart = period(m + 1);
      const pEnd   = period(m);
      const base   = planPrices[m] ?? 990_000;
      const energyAddon   = m <= 6 ? 150_000 : 0;
      const supportAddon  = m <= 3 ? 50_000  : 0;
      const subtotal = base + energyAddon + supportAddon;
      const taxAmt   = Math.round(subtotal * 0.1);
      const total    = subtotal + taxAmt;
      const status   = m <= 12 ? 'paid' : 'draft';
      const paidAt   = m <= 12 ? mEnd(m) : null;
      const invNo    = `INV-${new Date().getFullYear()}-${String(m).padStart(4, '0')}`;
      const existing = await (prisma.invoice as any).findFirst({ where: { invoiceNo: invNo } });
      if (existing) continue;

      const inv = await (prisma.invoice as any).create({
        data: {
          invoiceNo:      invNo,
          tenantId,
          subscriptionId: sub.id,
          periodStart:    pStart,
          periodEnd:      pEnd,
          subtotal,
          taxRate:        0.10,
          taxAmount:      taxAmt,
          total,
          currency:       'KRW',
          status,
          dueDate:        new Date(mEnd(m).getTime() + 14 * 86_400_000),
          paidAt,
          notes:          status === 'paid' ? '자동이체 결제 완료' : null,
        },
      });
      // 품목 행 생성
      const lineItems = [
        { desc: '탄소이음 EMS AIoT Pro 월정액', qty: 1, unit: base, amt: base },
        ...(energyAddon > 0 ? [{ desc: '에너지 데이터 분석 Add-on', qty: 1, unit: energyAddon, amt: energyAddon }] : []),
        ...(supportAddon > 0 ? [{ desc: '전담 기술지원 서비스', qty: 1, unit: supportAddon, amt: supportAddon }] : []),
      ];
      for (const li of lineItems) {
        await (prisma.invoiceLineItem as any).create({
          data: { invoiceId: inv.id, description: li.desc, quantity: li.qty, unitPrice: li.unit, amount: li.amt },
        });
      }
    }
    console.log('  ✅ Invoice 13건 + LineItems 완료');
  } else {
    console.log(`  ✅ Invoice 이미 충분 (${existingInv}건)`);
  }

  // ── 6. PaymentHistory (12건) ─────────────────────────────────────────────
  console.log('\n📦 [Full] PaymentHistory (12건)');
  if (sub) {
    const existingPH = await (prisma.paymentHistory as any).count({ where: { tenantId } });
    if (existingPH < 5) {
      for (let m = 1; m <= 12; m++) {
        await (prisma.paymentHistory as any).create({
          data: {
            tenantId,
            subscriptionId: sub.id,
            amount:         1_089_000, // 990,000 × 1.1 VAT
            currency:       'KRW',
            status:         'paid' as const,
            method:         pick(['card', 'card', 'card', 'bank_transfer']),
            transactionId:  `TOSS-${Date.now()}-${m}`,
            receiptUrl:     `https://receipt.tosspayments.com/receipts/demo-${m}`,
            paidAt:         mEnd(m),
          },
        });
      }
      console.log('  ✅ PaymentHistory 12건 완료');
    } else {
      console.log(`  ✅ PaymentHistory 이미 충분 (${existingPH}건)`);
    }
  }

  // ── 7. RegulatorySandbox (규제 샌드박스 6건) ────────────────────────────
  console.log('\n📦 [Full] RegulatorySandbox (6건)');
  const existingRSB = await (prisma.regulatorySandbox as any).count({ where: { tenantId } });
  if (existingRSB < 3) {
    const sandboxes = [
      {
        title:           '소규모 사업장 온실가스 배출 면제 신청 (환경부)',
        description:     '연간 배출량 2,500tCO₂ 미만 소규모 사업장 대상 의무 보고 면제 신청',
        regulationType:  'K-MRV',
        exemptionScope:  'Scope 1 직접 배출 면제 (천연가스 연소 부문)',
        status:          'approved',
        appliedAt:       daysAgo(180),
        reviewStartedAt: daysAgo(150),
        reviewedAt:      daysAgo(120),
        expireDate:      daysLater(185),
        conditions:      { maxEmissionTon: 2500, reportingFreq: 'yearly', auditRequired: false },
        applicantName:   '김에너지',
        applicantEmail:  'demo@carbonieum.com',
        contactPhone:    '02-1234-5678',
      },
      {
        title:           '재생에너지 100% 전환 사업장 K-ETS 특례 신청',
        description:     'REC 기반 전력 100% 재생에너지 전환 사업장 K-ETS 할당량 조정 신청',
        regulationType:  'K-ETS',
        exemptionScope:  'Scope 2 전력 배출 할당량 면제',
        status:          'in_review',
        appliedAt:       daysAgo(45),
        reviewStartedAt: daysAgo(20),
        reviewedAt:      null,
        expireDate:      null,
        conditions:      { renewableEnergyPct: 100, recCertified: true },
        applicantName:   '이탄소',
        applicantEmail:  'demo@carbonieum.com',
        contactPhone:    '02-1234-5678',
      },
      {
        title:           '스마트공장 에너지 모니터링 실증 특례 신청',
        description:     '스마트공장 AIoT 기반 에너지 계측 실증 사업 규제 특례 신청 (산업부)',
        regulationType:  'REG_SANDBOX',
        exemptionScope:  '전력 계측 설비 인증 면제 (실증 기간 24개월)',
        status:          'approved',
        appliedAt:       daysAgo(300),
        reviewStartedAt: daysAgo(270),
        reviewedAt:      daysAgo(240),
        expireDate:      daysLater(60),
        conditions:      { pilotSites: 3, maxPower: 1000, dataSharing: true },
        applicantName:   '박스마트',
        applicantEmail:  'demo@carbonieum.com',
        contactPhone:    '02-1234-5678',
      },
      {
        title:           '탄소 크레딧 자체 발급 실증 신청 (ICVCM 연계)',
        description:     '자발적 탄소 시장(VCM) 기반 국내 탄소 크레딧 자체 발급 실증 허가 신청',
        regulationType:  'VCM',
        exemptionScope:  '자체 탄소 크레딧 발급 및 내부 상쇄 허용',
        status:          'pending',
        appliedAt:       daysAgo(10),
        reviewStartedAt: null,
        reviewedAt:      null,
        expireDate:      null,
        conditions:      { thirdPartyAudit: true, vintageYear: 2024 },
        applicantName:   '최크레딧',
        applicantEmail:  'demo@carbonieum.com',
        contactPhone:    '02-1234-5678',
      },
      {
        title:           'ESS(에너지저장장치) DR 참여 규제 특례',
        description:     '배터리 ESS 기반 수요반응(DR) 참여를 위한 전력시장 특례 신청 (한전)',
        regulationType:  'DR_REG',
        exemptionScope:  '소규모 ESS DR 시장 직접 참여 허용',
        status:          'rejected',
        appliedAt:       daysAgo(200),
        reviewStartedAt: daysAgo(180),
        reviewedAt:      daysAgo(160),
        expireDate:      null,
        conditions:      { essCapacityKwh: 500, minDrKw: 100 },
        applicantName:   '정에스에스',
        applicantEmail:  'demo@carbonieum.com',
        contactPhone:    '02-1234-5678',
      },
      {
        title:           '중소기업 온실가스 자발적 감축 인증 특례 신청',
        description:     '중소기업 자발적 온실가스 감축 실적 인증 및 K-ETS 외부사업 등록 신청',
        regulationType:  'K-ETS',
        exemptionScope:  '외부감축사업 등록 간소화 절차 적용',
        status:          'approved',
        appliedAt:       daysAgo(365),
        reviewStartedAt: daysAgo(330),
        reviewedAt:      daysAgo(310),
        expireDate:      daysLater(0),
        conditions:      { annualReductionTon: 500, auditFreq: 'yearly' },
        applicantName:   '한중소기업',
        applicantEmail:  'demo@carbonieum.com',
        contactPhone:    '02-1234-5678',
      },
    ];
    for (const sb of sandboxes) {
      await (prisma.regulatorySandbox as any).create({
        data: {
          tenantId,
          title:           sb.title,
          description:     sb.description,
          regulationType:  sb.regulationType,
          exemptionScope:  sb.exemptionScope,
          status:          sb.status,
          appliedAt:       sb.appliedAt,
          reviewStartedAt: sb.reviewStartedAt,
          reviewedAt:      sb.reviewedAt,
          expireDate:      sb.expireDate ?? undefined,
          reviewNote:      sb.reviewedAt ? (sb.status === 'approved' ? '심사 요건 충족, 특례 승인' : sb.status === 'rejected' ? '기술 기준 미달 — 추가 보완 후 재신청 요망' : null) : null,
          conditions:      sb.conditions,
          applicantName:   sb.applicantName,
          applicantEmail:  sb.applicantEmail,
          contactPhone:    sb.contactPhone,
        },
      });
    }
    console.log('  ✅ RegulatorySandbox 6건 완료');
  } else {
    console.log(`  ✅ RegulatorySandbox 이미 충분 (${existingRSB}건)`);
  }

  // ── 8. RansomwareAlert (보안 알림 18건) ─────────────────────────────────
  console.log('\n📦 [Full] RansomwareAlert (18건)');
  const existingRW = await (prisma.ransomwareAlert as any).count({ where: { tenantId } });
  if (existingRW < 5) {
    const alertTypes = [
      { type: 'brute_force',        sev: 'high',     desc: '로그인 브루트포스 공격 탐지: 동일 IP(203.0.113.42)에서 10분 내 50회 실패' },
      { type: 'suspicious_login',   sev: 'medium',   desc: '해외 IP(US/미국)에서 비정상 로그인 시도 감지' },
      { type: 'api_abuse',          sev: 'high',     desc: 'API 키 비정상 사용 감지: 1시간 내 5,000회 호출 (정상 상한: 1,000회)' },
      { type: 'ransomware_pattern', sev: 'critical', desc: '파일 암호화 패턴 의심 행위 감지 — 즉시 격리 조치 필요' },
      { type: 'data_exfiltration',  sev: 'high',     desc: '비정상 대량 데이터 다운로드 감지 (500MB/5분)' },
      { type: 'privilege_escalation', sev: 'high',   desc: '권한 상승 시도 감지: viewer 계정에서 admin 기능 직접 호출' },
    ];
    for (let i = 0; i < 18; i++) {
      const at = alertTypes[i % alertTypes.length]!;
      const resolved = i < 14;
      await (prisma.ransomwareAlert as any).create({
        data: {
          tenantId,
          userId:      userId,
          sourceIp:    `${ri(100, 220)}.${ri(0, 255)}.${ri(0, 255)}.${ri(1, 254)}`,
          alertType:   at.type,
          severity:    at.sev,
          description: at.desc,
          metadata:    { requestCount: ri(10, 5000), userAgent: 'curl/7.79.0', geoCountry: pick(['KR', 'US', 'CN', 'RU']) },
          status:      resolved ? 'resolved' : 'open',
          resolvedBy:  resolved ? userId : null,
          resolvedAt:  resolved ? daysAgo(ri(0, 30)) : null,
          createdAt:   daysAgo(ri(0, 180)),
        },
      });
    }
    console.log('  ✅ RansomwareAlert 18건 완료');
  } else {
    console.log(`  ✅ RansomwareAlert 이미 충분 (${existingRW}건)`);
  }

  // ── 9. BackupRecord (백업 기록 24건) ────────────────────────────────────
  console.log('\n📦 [Full] BackupRecord (24건)');
  const existingBR = await (prisma.backupRecord as any).count();
  if (existingBR < 10) {
    const backupTypes = ['full', 'incremental', 'differential'];
    const storageBase = 's3://carbonieum-backup/ems';
    for (let i = 0; i < 24; i++) {
      const bt        = backupTypes[i % 3]!;
      const startedAt = daysAgo(i * 3 + ri(0, 2));
      const success   = Math.random() > 0.08;
      const sizeBytes = bt === 'full' ? BigInt(ri(2_000_000_000, 8_000_000_000)) :
                        bt === 'incremental' ? BigInt(ri(100_000_000, 500_000_000)) :
                        BigInt(ri(500_000_000, 2_000_000_000));
      await (prisma.backupRecord as any).create({
        data: {
          backupType:  bt,
          status:      success ? 'completed' : 'failed',
          sizeBytes:   success ? sizeBytes : null,
          storagePath: `${storageBase}/${bt}/${startedAt.toISOString().slice(0, 10)}/backup-${i + 1}.tar.gz`,
          checksum:    success ? sha256(`backup-${i}-${Date.now()}`).slice(0, 64) : null,
          isImmutable: true,
          expiresAt:   new Date(startedAt.getTime() + 90 * 86_400_000),
          startedAt,
          completedAt: success ? new Date(startedAt.getTime() + ri(5, 60) * 60_000) : null,
          metadata:    { version: '3.1', compression: 'gzip', encryption: 'AES-256', retentionDays: 90 },
        },
      });
    }
    console.log('  ✅ BackupRecord 24건 완료');
  } else {
    console.log(`  ✅ BackupRecord 이미 충분 (${existingBR}건)`);
  }

  // ── 10. CalcEngineVersion + EmissionsRecord ──────────────────────────────
  console.log('\n📦 [Full] CalcEngineVersion (2건) + EmissionsRecord (24건)');

  // CalcEngineVersion 생성 (EmissionsRecord FK 필요)
  let engineId: string | null = null;
  const existingEngine = await (prisma.calcEngineVersion as any).findFirst({
    where: { isActive: true }, select: { id: true },
  });
  if (existingEngine) {
    engineId = existingEngine.id;
  } else {
    const eng1 = await (prisma.calcEngineVersion as any).create({
      data: {
        version:     '1.0.0',
        name:        'GHG Protocol v1 — 기본 계산 엔진',
        description: 'ISO 14064-1:2018 기반 온실가스 배출량 계산 엔진 최초 버전',
        methodology: 'GHG Protocol',
        formula:     { scope1: 'activity × EF', scope2: 'kWh × gridEF', scope3: 'activity × EF' },
        parameters:  { defaultGridEF: 0.4594, unit: 'kgCO2/kWh' },
        isActive:    false,
        releasedAt:  daysAgo(730),
        deprecatedAt: daysAgo(180),
        changelog:   '최초 릴리스',
      },
    });
    const eng2 = await (prisma.calcEngineVersion as any).create({
      data: {
        version:     '2.0.0',
        name:        'GHG Protocol v2 + ISO 14064 — 강화된 계산 엔진',
        description: '환경부 고시 2024-39호 배출계수 반영, Scope 3 15개 카테고리 전체 지원, Market-based Scope 2 추가',
        methodology: 'GHG Protocol + ISO 14064',
        formula:     { scope1: 'activity × EF_site', scope2_location: 'kWh × gridEF', scope2_market: 'kWh × suppliEF', scope3: 'sum(cat_i × EF_i)' },
        parameters:  { defaultGridEF: 0.4567, marketBasedEF: 0.3800, unit: 'kgCO2/kWh', scope3Categories: 15 },
        isActive:    true,
        releasedAt:  daysAgo(180),
        changelog:   '환경부 2024년 배출계수 반영, Scope 3 카테고리 15개 완전 구현, Market-based Scope 2 추가',
      },
    });
    engineId = eng2.id;
    console.log('  ✅ CalcEngineVersion 2건 완료');
  }

  // EmissionsRecord — EmissionFactor ID 조회
  if (engineId) {
    const emFactor = await prisma.emissionFactor.findFirst({
      where: { isActive: true }, select: { id: true, factorValue: true, version: true },
    });
    if (emFactor) {
      const existingER = await (prisma.emissionsRecord as any).count({ where: { tenantId } });
      if (existingER < 10) {
        const scopeDefs = [
          { scope: 'scope1',          sourceType: 'natural_gas',     actUnit: 'Nm3',  actBase: 3200,   emissions: 6.24  },
          { scope: 'scope1',          sourceType: 'diesel',          actUnit: 'L',    actBase: 850,    emissions: 2.23  },
          { scope: 'scope2_location', sourceType: 'grid_electricity', actUnit: 'kWh', actBase: 185000, emissions: 84.5  },
          { scope: 'scope2_market',   sourceType: 'grid_electricity', actUnit: 'kWh', actBase: 185000, emissions: 70.3  },
          { scope: 'scope3',          sourceType: 'business_travel',  actUnit: 'km',  actBase: 12000,  emissions: 2.76  },
          { scope: 'scope3',          sourceType: 'waste',            actUnit: 'ton', actBase: 8.5,    emissions: 0.043 },
        ];
        for (let m = 0; m < 4; m++) {
          for (const sd of scopeDefs) {
            const activity = rf(sd.actBase * 0.88, sd.actBase * 1.12, 1);
            const emKg     = rf(sd.emissions * 0.88 * 1000, sd.emissions * 1.12 * 1000, 3);
            await (prisma.emissionsRecord as any).create({
              data: {
                tenantId,
                siteId:                site1,
                scope:                 sd.scope,
                sourceType:            sd.sourceType,
                activityData:          activity,
                activityUnit:          sd.actUnit,
                activityDataSnapshot:  { measured: activity, unit: sd.actUnit, source: 'sensor', collectedAt: period(m + 1) },
                emissions:             emKg / 1000,
                unit:                  'tCO2eq',
                engineVersionId:       engineId!,
                emissionFactorId:      emFactor.id,
                emissionFactorVersion: emFactor.version ?? '1.0.0',
                emissionFactorValue:   emFactor.factorValue,
                calculationMethod:     sd.scope === 'scope2_market' ? 'market-based' : 'location-based',
                dataSource:            'sensor',
                dataQuality:           'good',
                period:                period(m + 1),
                isArchived:            false,
                calculatedBy:          'SYSTEM_AUTO',
                dataSubmittedBy:       userId,
              },
            });
          }
        }
        console.log('  ✅ EmissionsRecord 24건 완료');
      } else {
        console.log(`  ✅ EmissionsRecord 이미 충분 (${existingER}건)`);
      }
    } else {
      console.log('  ⚠️  EmissionFactor 없어 EmissionsRecord 건너뜀');
    }
  }

  // ── 11. PhysicalSpace + TwinNode (디지털 트윈) ──────────────────────────
  console.log('\n📦 [Full] PhysicalSpace + TwinNode');
  if (site1) {
    const existingPS = await (prisma.physicalSpace as any).count({ where: { tenantId } });
    if (existingPS < 3) {
      // 건물 → 층 → 구역 계층 생성
      const building = await (prisma.physicalSpace as any).create({
        data: {
          tenantId,
          siteId:   site1,
          name:     '본관 (서울 상암 공장)',
          code:     'BLD-001',
          type:     'building',
          level:    0,
          parentId: null,
        },
      });
      const floors = await Promise.all([
        (prisma.physicalSpace as any).create({
          data: { tenantId, siteId: site1, name: '1층 — 생산라인 A/B', code: 'FL-001', type: 'floor', level: 1, parentId: building.id },
        }),
        (prisma.physicalSpace as any).create({
          data: { tenantId, siteId: site1, name: '2층 — 기계설비실', code: 'FL-002', type: 'floor', level: 1, parentId: building.id },
        }),
        (prisma.physicalSpace as any).create({
          data: { tenantId, siteId: site1, name: '3층 — 사무공간', code: 'FL-003', type: 'floor', level: 1, parentId: building.id },
        }),
        (prisma.physicalSpace as any).create({
          data: { tenantId, siteId: site1, name: '옥상 — PV/냉각탑', code: 'RF-001', type: 'floor', level: 1, parentId: building.id },
        }),
      ]);
      // 구역 생성
      const zones = await Promise.all([
        (prisma.physicalSpace as any).create({ data: { tenantId, siteId: site1, name: '전기실', code: 'ZN-E01', type: 'zone', level: 2, parentId: floors[1].id } }),
        (prisma.physicalSpace as any).create({ data: { tenantId, siteId: site1, name: '공조기실', code: 'ZN-M01', type: 'zone', level: 2, parentId: floors[1].id } }),
        (prisma.physicalSpace as any).create({ data: { tenantId, siteId: site1, name: '생산 라인 A', code: 'ZN-P01', type: 'zone', level: 2, parentId: floors[0].id } }),
        (prisma.physicalSpace as any).create({ data: { tenantId, siteId: site1, name: '냉동기실', code: 'ZN-C01', type: 'zone', level: 2, parentId: floors[1].id } }),
      ]);
      console.log(`  ✅ PhysicalSpace ${1 + floors.length + zones.length}건 완료`);

      // TwinNode 연결 (device → space)
      const controlDevices = deviceIds.slice(0, Math.min(8, deviceIds.length));
      const spaceList = [zones[0], zones[1], zones[2], zones[3], floors[3], floors[1], zones[0], zones[2]];
      const sysTypes  = ['ELECTRICAL', 'HVAC', 'MECHANICAL', 'HVAC', 'ELECTRICAL', 'MECHANICAL', 'LIGHTING', 'MECHANICAL'] as const;
      const eqClasses = ['METER', 'AHU', 'PUMP', 'CHILLER', 'METER', 'BOILER', 'PANEL', 'FAN'] as const;
      for (let i = 0; i < controlDevices.length; i++) {
        const devId = controlDevices[i]!;
        const sp    = spaceList[i % spaceList.length]!;
        const existing = await (prisma.twinNode as any).findFirst({ where: { deviceId: devId } });
        if (!existing) {
          await (prisma.twinNode as any).create({
            data: {
              tenantId,
              deviceId:        devId,
              spaceId:         sp.id,
              systemType:      sysTypes[i % sysTypes.length],
              equipClass:      eqClasses[i % eqClasses.length],
              feedsIds:        i > 0 ? [controlDevices[i - 1]] : [],
              fedByIds:        i < controlDevices.length - 1 ? [controlDevices[i + 1]] : [],
              computedMetrics: { cop: 'power_out / power_in', loadRatio: 'actual_power / rated_power' },
            },
          });
        }
      }
      console.log(`  ✅ TwinNode ${controlDevices.length}건 완료`);
    } else {
      console.log(`  ✅ PhysicalSpace 이미 충분 (${existingPS}건)`);
    }
  }

  // ── 12. ApiKey (API 키 4건) ──────────────────────────────────────────────
  console.log('\n📦 [Full] ApiKey (4건)');
  const existingAK = await (prisma.apiKey as any).count({ where: { tenantId } });
  if (existingAK < 2) {
    const apiKeys = [
      { name: '에너지 모니터링 읽기 전용 키',    scopes: ['read:sites', 'read:measurements', 'read:devices'], expires: daysLater(365) },
      { name: 'DR 이벤트 제어 API 키',            scopes: ['read:sites', 'write:control', 'read:dr'], expires: daysLater(180) },
      { name: '탄소 분석 데이터 내보내기 키',     scopes: ['read:emissions', 'read:reports', 'read:carbon'], expires: daysLater(90) },
      { name: 'ERP 연동 전체 읽기 키 (SAP)',       scopes: ['read:sites', 'read:measurements', 'read:invoices', 'read:kpi'], expires: daysLater(730) },
    ];
    for (const ak of apiKeys) {
      const rawKey = `eak_${crypto.randomBytes(24).toString('hex')}`;
      await (prisma.apiKey as any).create({
        data: {
          tenantId,
          userId,
          name:       ak.name,
          keyHash:    sha256(rawKey),
          keyPrefix:  rawKey.slice(0, 12),
          scopes:     ak.scopes,
          lastUsedAt: daysAgo(ri(0, 30)),
          expiresAt:  ak.expires,
          isActive:   true,
        },
      });
    }
    console.log('  ✅ ApiKey 4건 완료');
  } else {
    console.log(`  ✅ ApiKey 이미 충분 (${existingAK}건)`);
  }

  // ── 13. SupportInquiry (고객 문의 20건) ─────────────────────────────────
  console.log('\n📦 [Full] SupportInquiry (20건)');
  const existingSI = await (prisma.supportInquiry as any).count({ where: { tenantId } });
  if (existingSI < 5) {
    const inquiries = [
      { cat: 'technical', subj: 'MQTT 게이트웨이 연결 오류 문의', msg: '게이트웨이 연결이 간헐적으로 끊기는 현상이 발생합니다. 브로커 설정을 확인했으나 동일 증상이 반복됩니다.', status: 'resolved' },
      { cat: 'billing',   subj: '구독 플랜 Enterprise 전환 문의', msg: 'Pro 플랜에서 Enterprise 플랜으로 중간 업그레이드 시 요금 정산 방식을 알고 싶습니다.', status: 'resolved' },
      { cat: 'technical', subj: '탄소 배출량 계산 오류 신고',    msg: 'Scope 2 배출량이 전월 대비 비정상적으로 높게 계산됩니다. 배출계수 업데이트 관련인지 확인 부탁드립니다.', status: 'in_progress' },
      { cat: 'general',   subj: 'DR 이벤트 참여 방법 안내 요청', msg: 'DR 이벤트 자동 참여 설정 방법과 목표 감축량 설정 절차를 안내해 주세요.', status: 'resolved' },
      { cat: 'technical', subj: 'API 키 만료 후 갱신 오류',      msg: 'API 키 만료 후 신규 발급했으나 기존 연동 시스템에서 인증 오류가 발생합니다.', status: 'resolved' },
      { cat: 'feature',   subj: '엑셀 일괄 업로드 기능 요청',    msg: '에너지 데이터를 엑셀로 일괄 업로드하는 기능이 있으면 좋겠습니다. 현재는 수동 입력만 가능합니다.', status: 'pending' },
      { cat: 'technical', subj: 'PDF 리포트 한글 폰트 깨짐 문제', msg: 'PDF 리포트 다운로드 시 한글이 깨져서 출력됩니다. Chrome/Edge 모두 동일 증상입니다.', status: 'resolved' },
      { cat: 'billing',   subj: '세금계산서 이메일 재발송 요청',  msg: '3월분 세금계산서를 분실했습니다. 동일 이메일로 재발송 부탁드립니다.', status: 'resolved' },
      { cat: 'technical', subj: 'Modbus TCP 디바이스 추가 오류',  msg: 'Modbus TCP 프로토콜 디바이스 추가 시 연결 테스트가 계속 실패합니다. 포트 502 방화벽 허용 완료 상태입니다.', status: 'in_progress' },
      { cat: 'general',   subj: '사용자 권한 role 추가 문의',     msg: '현재 viewer/operator/site_manager 외에 외부 감사자용 읽기 전용 계정 추가가 가능한지 문의드립니다.', status: 'pending' },
      { cat: 'technical', subj: '실시간 대시보드 데이터 지연',    msg: '실시간 대시보드에서 센서 데이터가 3~5분 지연되어 표시됩니다. 설정 변경이 가능한지 문의드립니다.', status: 'resolved' },
      { cat: 'feature',   subj: 'Kakao 알림톡 연동 요청',         msg: 'SMS 대신 카카오 알림톡으로 알림을 받고 싶습니다. 연동 지원 예정이 있는지 알고 싶습니다.', status: 'pending' },
      { cat: 'technical', subj: 'K-ETS 보고서 XML 내보내기 오류', msg: 'K-ETS 보고서 XML 내보내기 시 스키마 오류가 발생합니다. 환경부 제출 형식과 맞지 않는 것 같습니다.', status: 'in_progress' },
      { cat: 'billing',   subj: '연간 결제 할인 적용 요청',       msg: '월정액 대신 연간 선납 결제로 전환 시 할인 혜택이 있는지 문의드립니다.', status: 'resolved' },
      { cat: 'general',   subj: 'ESG 보고서 외부 공개 URL 기능',  msg: 'ESG 보고서를 외부 이해관계자(투자자)에게 공개할 수 있는 공개 링크 기능이 있는지 문의드립니다.', status: 'pending' },
      { cat: 'technical', subj: '모바일 앱 출시 일정 문의',       msg: '현재 웹만 지원되는데 모바일 앱(iOS/Android) 출시 계획이 있는지 알고 싶습니다.', status: 'resolved' },
      { cat: 'technical', subj: '이상 탐지 민감도 조정 방법',     msg: '이상 탐지 알람이 너무 자주 발생합니다. 민감도를 낮추는 설정 방법을 안내해 주세요.', status: 'resolved' },
      { cat: 'general',   subj: '다중 테넌트 계정 관리 문의',     msg: '그룹사 여러 계열사를 하나의 대시보드에서 관리할 수 있는 멀티 테넌트 관리 기능이 있는지 문의드립니다.', status: 'pending' },
      { cat: 'feature',   subj: 'SCADA 연동 API 지원 여부',       msg: '기존 사용 중인 SCADA 시스템과의 REST API 연동을 지원하는지, 연동 가이드가 있는지 문의드립니다.', status: 'resolved' },
      { cat: 'technical', subj: 'BACnet/IP 게이트웨이 설정 오류', msg: 'BACnet/IP 프로토콜 게이트웨이 자동 디스커버리가 작동하지 않습니다. 수동 설정 방법을 안내해 주세요.', status: 'in_progress' },
    ];
    for (const inq of inquiries) {
      await (prisma.supportInquiry as any).create({
        data: {
          name:      '데모 사용자',
          email:     'demo@carbonieum.com',
          category:  inq.cat,
          subject:   inq.subj,
          message:   inq.msg,
          status:    inq.status,
          tenantId,
          userId,
          adminNote: inq.status === 'resolved' ? '처리 완료. 관련 문서 링크 안내 완료.' : inq.status === 'in_progress' ? '기술팀 확인 중 — 2영업일 내 회신 예정' : null,
          createdAt: daysAgo(ri(0, 180)),
        },
      });
    }
    console.log('  ✅ SupportInquiry 20건 완료');
  } else {
    console.log(`  ✅ SupportInquiry 이미 충분 (${existingSI}건)`);
  }

  // ── 14. RegulationReport (규제 보고서 10건) ─────────────────────────────
  console.log('\n📦 [Full] RegulationReport (10건)');
  const existingRR = await (prisma.regulationReport as any).count({ where: { tenantId } });
  if (existingRR < 5) {
    const reportTypes = [
      { type: 'K-MRV',   name: 'K-MRV 온실가스 명세서' },
      { type: 'K-ETS',   name: 'K-ETS 배출권거래제 명세서' },
      { type: 'GHG_INV', name: '온실가스 인벤토리 보고서' },
      { type: 'ENV_RPT', name: '환경정보 공시 보고서' },
      { type: 'ISO14064',name: 'ISO 14064-1 검증 보고서' },
    ];
    for (let i = 0; i < 10; i++) {
      const rt     = reportTypes[i % reportTypes.length]!;
      const mo     = i + 2;
      const per    = period(mo);
      const st     = i < 6 ? 'approved' : i < 8 ? 'submitted' : 'draft';
      const sc1    = rf(18, 28, 3);
      const sc2    = rf(75, 95, 3);
      const sc3    = rf(8, 18, 3);
      const dueD   = new Date(mEnd(mo).getTime() + 45 * 86_400_000);
      await (prisma.regulationReport as any).create({
        data: {
          tenantId,
          reportType:     rt.type,
          reportName:     `${per} ${rt.name}`,
          period:         per,
          status:         st as any,
          dueDate:        dueD,
          submittedDate:  st !== 'draft' ? new Date(mEnd(mo).getTime() + 30 * 86_400_000) : null,
          submittedBy:    st !== 'draft' ? userId : null,
          approvedDate:   st === 'approved' ? new Date(mEnd(mo).getTime() + 42 * 86_400_000) : null,
          approvedBy:     st === 'approved' ? userId : null,
          totalEmissions: sc1 + sc2 + sc3,
          scope1:         sc1,
          scope2:         sc2,
          scope3:         sc3,
          fileUrl:        st !== 'draft' ? `/files/reports/${per}-${rt.type}.pdf` : null,
          pdfUrl:         st === 'approved' ? `/files/reports/${per}-${rt.type}-final.pdf` : null,
        },
      });
    }
    console.log('  ✅ RegulationReport 10건 완료');
  } else {
    console.log(`  ✅ RegulationReport 이미 충분 (${existingRR}건)`);
  }

  // ── 15. CarbonMarketPrice (탄소 시장 가격 365일 × 4개 시장) ─────────────
  console.log('\n📦 [Full] CarbonMarketPrice (365일 × 4개 시장)');
  const existingCMP = await (prisma.carbonMarketPrice as any).count();
  if (existingCMP < 100) {
    // 시장별 기준 가격 (원/tCO2)
    const markets = [
      { code: 'KETS',         base: 13_500, vol: 1200, currency: 'KRW', unit: 'tCO2', src: 'K-ETS (환경부 온실가스종합정보센터)' },
      { code: 'EU_ETS',       base: 65_000, vol: 5000, currency: 'KRW', unit: 'tCO2', src: 'EU ETS (ICE Futures)' },
      { code: 'VCM',          base: 18_000, vol: 2000, currency: 'KRW', unit: 'tCO2', src: 'VCM (Xpansiv CBL)' },
      { code: 'GOLD_STANDARD',base: 22_000, vol: 2500, currency: 'KRW', unit: 'tCO2', src: 'Gold Standard (South Pole)' },
    ];

    // 365일 일별 가격 생성 (누적 랜덤 워크 시뮬레이션)
    const batchSize = 100;
    let batch: any[] = [];
    for (const mkt of markets) {
      let price = mkt.base;
      for (let d = 364; d >= 0; d--) {
        const priceDate = daysAgo(d);
        priceDate.setHours(0, 0, 0, 0);
        const change  = (Math.random() - 0.48) * mkt.vol * 0.05;
        price         = Math.max(mkt.base * 0.5, Math.min(mkt.base * 1.8, price + change));
        const prevPrice = price - change;
        const chgRate   = prevPrice > 0 ? ((price - prevPrice) / prevPrice * 100) : 0;
        batch.push({
          market:     mkt.code,
          priceDate,
          price:      parseFloat(price.toFixed(2)),
          currency:   mkt.currency,
          unit:       mkt.unit,
          source:     mkt.src,
          changeRate: parseFloat(chgRate.toFixed(4)),
          volume:     ri(500, 5000),
        });
        if (batch.length >= batchSize) {
          await (prisma.carbonMarketPrice as any).createMany({ data: batch, skipDuplicates: true });
          batch = [];
          process.stdout.write('.');
        }
      }
    }
    if (batch.length > 0) {
      await (prisma.carbonMarketPrice as any).createMany({ data: batch, skipDuplicates: true });
    }
    console.log('\n  ✅ CarbonMarketPrice 365일 × 4시장 완료');
  } else {
    console.log(`  ✅ CarbonMarketPrice 이미 충분 (${existingCMP}건)`);
  }

  // ── 16. UserSiteAccess (사용자-사이트 접근 권한) ────────────────────────
  console.log('\n📦 [Full] UserSiteAccess');
  const existingUSA = await (prisma.userSiteAccess as any).count({ where: { userId } });
  if (existingUSA < siteIds.length) {
    for (const sid of siteIds) {
      const ex = await (prisma.userSiteAccess as any).findFirst({ where: { userId, siteId: sid } });
      if (!ex) {
        await (prisma.userSiteAccess as any).create({
          data: { userId, siteId: sid, accessLevel: 'admin' as const },
        });
      }
    }
    console.log(`  ✅ UserSiteAccess ${siteIds.length}건 완료`);
  } else {
    console.log(`  ✅ UserSiteAccess 이미 충분 (${existingUSA}건)`);
  }

  console.log('\n🎉 [Full] 전체 데모 데이터 삽입 완료!\n');
}
