/**
 * Security Event Service
 *
 * 보안 사고 대응 시스템:
 * - CSP 위반 / CSRF 실패 / 브루트포스 / 계정 잠금 / 의심 로그인 로깅
 * - AuditLog 테이블 재사용 (action='security:*')
 * - IP 차단 목록 메모리 캐시 (Redis 미사용 환경 대응)
 * - 임계값 초과 시 이메일 알림
 */

import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();

// ──────────────────────────────────────────────────────────────
// 보안 이벤트 타입
// ──────────────────────────────────────────────────────────────
export type SecurityEventType =
  | 'BRUTE_FORCE'       // 브루트포스 로그인 시도
  | 'ACCOUNT_LOCKED'    // 계정 잠금
  | 'SUSPICIOUS_LOGIN'  // 새 IP/디바이스에서 로그인
  | 'CSRF_VIOLATION'    // CSRF 토큰 위반
  | 'CSP_VIOLATION'     // CSP 정책 위반
  | 'RATE_LIMIT_EXCEEDED' // API 한도 초과
  | 'UNAUTHORIZED_ACCESS' // 권한 없는 접근 시도
  | 'TOKEN_INVALID'     // 유효하지 않은 JWT/API 키
  | 'IP_BLOCKED'        // IP 차단됨
  | 'SESSION_HIJACK'    // 세션 탈취 의심
  | 'PASSWORD_CHANGED'  // 비밀번호 변경
  | 'FORCE_LOGOUT';     // 강제 로그아웃

export type SecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SecurityEventPayload {
  type: SecurityEventType;
  severity: SecuritySeverity;
  ip?: string;
  userId?: string;
  tenantId?: string;
  userAgent?: string;
  path?: string;
  details?: Record<string, unknown>;
}

// ──────────────────────────────────────────────────────────────
// 임계값 설정
// ──────────────────────────────────────────────────────────────
const THRESHOLDS = {
  BRUTE_FORCE_ALERT:      10,   // 10회 이상 → CRITICAL 알림
  RATE_LIMIT_ALERT:       50,   // 50회 연속 한도 초과 → MEDIUM 알림
  CSP_VIOLATION_ALERT:    20,   // 20회 → LOW 알림
  IP_BLOCK_THRESHOLD:     20,   // 20회 브루트포스 → IP 차단
  IP_BLOCK_DURATION_MS:   30 * 60 * 1000, // 30분
} as const;

// ──────────────────────────────────────────────────────────────
// 메모리 IP 차단 목록
// ──────────────────────────────────────────────────────────────
interface BlockedIp {
  ip: string;
  blockedAt: number;
  expiresAt: number;
  reason: string;
}

const ipBlocklist = new Map<string, BlockedIp>();

// 만료된 IP 주기적 정리
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipBlocklist.entries()) {
    if (entry.expiresAt < now) ipBlocklist.delete(ip);
  }
}, 5 * 60 * 1000);

// ──────────────────────────────────────────────────────────────
// IP 차단 관련 함수
// ──────────────────────────────────────────────────────────────
export function isIpBlocked(ip: string): boolean {
  const entry = ipBlocklist.get(ip);
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) {
    ipBlocklist.delete(ip);
    return false;
  }
  return true;
}

export function blockIp(ip: string, reason: string, durationMs = THRESHOLDS.IP_BLOCK_DURATION_MS): void {
  const now = Date.now();
  ipBlocklist.set(ip, {
    ip,
    blockedAt: now,
    expiresAt: now + durationMs,
    reason,
  });
}

export function unblockIp(ip: string): void {
  ipBlocklist.delete(ip);
}

export function getBlockedIps(): BlockedIp[] {
  return Array.from(ipBlocklist.values());
}

// ──────────────────────────────────────────────────────────────
// 보안 이벤트 기록 (AuditLog 재사용)
// ──────────────────────────────────────────────────────────────
export async function logSecurityEvent(payload: SecurityEventPayload): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId:     payload.tenantId ?? null,
        userId:       payload.userId ?? null,
        action:       `security:${payload.type}`,
        resourceType: 'security',
        ipAddress:    payload.ip ?? null,
        userAgent:    payload.userAgent ?? null,
        result:       payload.severity === 'LOW' || payload.severity === 'MEDIUM' ? 'failure' : 'failure',
        metadata: JSON.parse(JSON.stringify({
          type:     payload.type,
          severity: payload.severity,
          path:     payload.path,
          ...payload.details,
        })),
      },
    });

    // HIGH / CRITICAL 이벤트는 관리자 이메일 알림
    if (payload.severity === 'HIGH' || payload.severity === 'CRITICAL') {
      await notifySecurityAdmin(payload);
    }

    // 브루트포스 IP 자동 차단
    if (payload.type === 'BRUTE_FORCE' && payload.ip) {
      await checkBruteForceAndBlock(payload.ip);
    }
  } catch {
    // 보안 로깅 실패가 서비스 중단으로 이어지면 안 됨
    console.error('[SecurityEvent] 로그 기록 실패:', payload.type, payload.ip);
  }
}

// ──────────────────────────────────────────────────────────────
// 브루트포스 IP 차단 체크
// ──────────────────────────────────────────────────────────────
async function checkBruteForceAndBlock(ip: string): Promise<void> {
  try {
    const windowStart = new Date(Date.now() - 15 * 60 * 1000); // 15분 내
    const count = await prisma.auditLog.count({
      where: {
        action:    'security:BRUTE_FORCE',
        ipAddress: ip,
        createdAt: { gte: windowStart },
      },
    });

    if (count >= THRESHOLDS.IP_BLOCK_THRESHOLD && !isIpBlocked(ip)) {
      blockIp(ip, `브루트포스 ${count}회 (15분 내)`);
      console.warn(`[Security] IP 차단: ${ip} (브루트포스 ${count}회)`);
    }
  } catch {
    // ignore
  }
}

// ──────────────────────────────────────────────────────────────
// 관리자 이메일 알림
// ──────────────────────────────────────────────────────────────
async function notifySecurityAdmin(payload: SecurityEventPayload): Promise<void> {
  const adminEmail = process.env.SECURITY_ALERT_EMAIL;
  if (!adminEmail) return;

  const severityEmoji: Record<SecuritySeverity, string> = {
    LOW: '🟡',
    MEDIUM: '🟠',
    HIGH: '🔴',
    CRITICAL: '🚨',
  };

  const subject = `${severityEmoji[payload.severity]} [탄소이음] 보안 이벤트: ${payload.type} (${payload.severity})`;
  const html = `
    <h2>보안 이벤트 감지</h2>
    <table border="1" cellpadding="8" style="border-collapse:collapse">
      <tr><th>구분</th><th>내용</th></tr>
      <tr><td>이벤트 유형</td><td><strong>${payload.type}</strong></td></tr>
      <tr><td>심각도</td><td><strong style="color:${payload.severity === 'CRITICAL' ? '#dc2626' : '#f59e0b'}">${payload.severity}</strong></td></tr>
      <tr><td>IP 주소</td><td>${payload.ip ?? '-'}</td></tr>
      <tr><td>경로</td><td>${payload.path ?? '-'}</td></tr>
      <tr><td>사용자 ID</td><td>${payload.userId ?? '-'}</td></tr>
      <tr><td>테넌트 ID</td><td>${payload.tenantId ?? '-'}</td></tr>
      <tr><td>발생 시각</td><td>${new Date().toISOString()}</td></tr>
      ${payload.details ? `<tr><td>상세 정보</td><td><pre>${JSON.stringify(payload.details, null, 2)}</pre></td></tr>` : ''}
    </table>
    <p style="color:#6b7280;font-size:12px">이 알림은 탄소이음 보안 모니터링 시스템에서 자동 발송됩니다.</p>
  `;

  try {
    const transport = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
    await transport.sendMail({ from: process.env.GMAIL_USER, to: adminEmail, subject, html });
  } catch {
    console.warn('[SecurityEvent] 이메일 발송 실패');
  }
}

// ──────────────────────────────────────────────────────────────
// 보안 이벤트 조회 (관리자용)
// ──────────────────────────────────────────────────────────────
export async function getSecurityEvents(options: {
  tenantId?: string;
  type?: SecurityEventType;
  severity?: SecuritySeverity;
  ip?: string;
  since?: Date;
  limit?: number;
  offset?: number;
}) {
  const { tenantId, type, severity, ip, since, limit = 50, offset = 0 } = options;

  const where: Record<string, unknown> = {
    action: type ? `security:${type}` : { startsWith: 'security:' },
    resourceType: 'security',
    ...(tenantId && { tenantId }),
    ...(ip && { ipAddress: ip }),
    ...(since && { createdAt: { gte: since } }),
    ...(severity && {
      metadata: { path: ['severity'], equals: severity },
    }),
  };

  const [total, events] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        action: true,
        ipAddress: true,
        userId: true,
        tenantId: true,
        userAgent: true,
        metadata: true,
        createdAt: true,
      },
    }),
  ]);

  return { total, events };
}

// ──────────────────────────────────────────────────────────────
// 보안 통계 (대시보드용)
// ──────────────────────────────────────────────────────────────
export async function getSecurityStats(tenantId?: string) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const baseWhere = {
    resourceType: 'security',
    action: { startsWith: 'security:' },
    ...(tenantId && { tenantId }),
  };

  const [last24h, last7d, bruteForce24h, topIps] = await Promise.all([
    prisma.auditLog.count({ where: { ...baseWhere, createdAt: { gte: since24h } } }),
    prisma.auditLog.count({ where: { ...baseWhere, createdAt: { gte: since7d } } }),
    prisma.auditLog.count({
      where: { ...baseWhere, action: 'security:BRUTE_FORCE', createdAt: { gte: since24h } },
    }),
    // 상위 의심 IP (24시간)
    prisma.auditLog.groupBy({
      by: ['ipAddress'],
      where: { ...baseWhere, createdAt: { gte: since24h }, ipAddress: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    }),
  ]);

  return {
    last24h,
    last7d,
    bruteForce24h,
    blockedIps: ipBlocklist.size,
    topSuspiciousIps: topIps.map(r => ({
      ip: r.ipAddress,
      count: r._count.id,
      isBlocked: r.ipAddress ? isIpBlocked(r.ipAddress) : false,
    })),
  };
}