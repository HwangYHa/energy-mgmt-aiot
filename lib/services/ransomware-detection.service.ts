/**
 * lib/services/ransomware-detection.service.ts
 *
 * 랜섬웨어·이상 작업 탐지 서비스
 * - 슬라이딩 윈도우(메모리) 기반 대량 연산 감지
 * - CRITICAL 등급 즉시 사용자 차단
 * - logSecurityEvent() + RansomwareAlert DB 기록 + 이메일 알림
 */

import { prisma } from '@/lib/db/prisma';
import nodemailer from 'nodemailer';
import { logSecurityEvent } from '@/lib/services/security-event.service';

const THRESHOLDS = {
  MASS_DELETE_ROWS:     500,
  MASS_UPDATE_ROWS:     1000,
  BULK_EXPORT_MB:       100,
  CRYPTO_PATTERN_RATIO: 0.5,
  WINDOW_MS:            60_000,
} as const;

interface WindowEntry {
  timestamps: number[];
  values:     number[];
}

const deleteWindow = new Map<string, WindowEntry>();
const updateWindow = new Map<string, WindowEntry>();

// 만료 항목 정기 정리
setInterval(() => {
  const cutoff = Date.now() - THRESHOLDS.WINDOW_MS;
  for (const [key, entry] of deleteWindow.entries()) {
    let i = 0;
    while (i < entry.timestamps.length && (entry.timestamps[i] ?? 0) < cutoff) i++;
    entry.timestamps = entry.timestamps.slice(i);
    entry.values     = entry.values.slice(i);
    if (entry.timestamps.length === 0) deleteWindow.delete(key);
  }
  for (const [key, entry] of updateWindow.entries()) {
    let i = 0;
    while (i < entry.timestamps.length && (entry.timestamps[i] ?? 0) < cutoff) i++;
    entry.timestamps = entry.timestamps.slice(i);
    entry.values     = entry.values.slice(i);
    if (entry.timestamps.length === 0) updateWindow.delete(key);
  }
}, 30_000);

function pushWindow(map: Map<string, WindowEntry>, key: string, value: number): number {
  const now    = Date.now();
  const cutoff = now - THRESHOLDS.WINDOW_MS;

  if (!map.has(key)) map.set(key, { timestamps: [], values: [] });
  const entry = map.get(key)!;

  // 만료 제거
  let i = 0;
  while (i < entry.timestamps.length && (entry.timestamps[i] ?? 0) < cutoff) i++;
  entry.timestamps = entry.timestamps.slice(i);
  entry.values     = entry.values.slice(i);

  entry.timestamps.push(now);
  entry.values.push(value);

  return entry.values.reduce((a, b) => a + b, 0);
}

async function blockUser(userId: string): Promise<void> {
  try {
    await (prisma as any).user.update({
      where: { id: userId },
      data:  { isActive: false },
    });
    console.warn(`[RansomwareDetection] 사용자 강제 차단: ${userId}`);
  } catch (err) {
    console.error('[RansomwareDetection] 사용자 차단 실패:', err);
  }
}

async function createAlert(params: {
  tenantId?:   string;
  userId?:     string;
  sourceIp?:   string;
  alertType:   string;
  severity:    'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  metadata?:   Record<string, unknown>;
}): Promise<void> {
  try {
    await (prisma as any).ransomwareAlert.create({
      data: {
        tenantId:    params.tenantId   ?? null,
        userId:      params.userId     ?? null,
        sourceIp:    params.sourceIp   ?? null,
        alertType:   params.alertType,
        severity:    params.severity,
        description: params.description,
        metadata:    params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : null,
        status:      'open',
      },
    });
  } catch (err) {
    console.error('[RansomwareDetection] Alert DB 기록 실패:', err);
  }
}

async function sendAlertEmail(subject: string, body: string): Promise<void> {
  const adminEmail = process.env.SECURITY_ALERT_EMAIL;
  if (!adminEmail || !process.env.SMTP_HOST) return;
  try {
    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: { user: process.env.SMTP_USER ?? '', pass: process.env.SMTP_PASS ?? '' },
    });
    await transporter.sendMail({
      from:    `"탄소이음 보안" <${process.env.SMTP_USER}>`,
      to:      adminEmail,
      subject: `[탄소이음 보안 경보] ${subject}`,
      text:    body,
    });
  } catch (err) {
    console.error('[RansomwareDetection] 이메일 발송 실패:', err);
  }
}

export class RansomwareDetectionService {
  /** 대량 삭제/업데이트 탐지 */
  static async checkMassOperation(
    tenantId:     string,
    userId:       string,
    operation:    'DELETE' | 'UPDATE',
    affectedRows: number,
    sourceIp?:    string,
  ): Promise<void> {
    const windowMap   = operation === 'DELETE' ? deleteWindow : updateWindow;
    const threshold   = operation === 'DELETE'
      ? THRESHOLDS.MASS_DELETE_ROWS
      : THRESHOLDS.MASS_UPDATE_ROWS;
    const windowTotal = pushWindow(windowMap, `${tenantId}:${userId}`, affectedRows);
    if (windowTotal <= threshold) return;

    const severity: 'HIGH' | 'CRITICAL' = windowTotal > threshold * 3 ? 'CRITICAL' : 'HIGH';
    const alertType   = operation === 'DELETE' ? 'MASS_DELETE' : 'MASS_UPDATE';
    const description = `60초 내 ${operation} ${windowTotal}행 감지 (임계값: ${threshold}행)`;

    await logSecurityEvent({
      type:    'UNAUTHORIZED_ACCESS',
      severity,
      userId,
      tenantId,
      ip:      sourceIp,
      details: { alertType, affectedRows: windowTotal, operation },
    }).catch(() => {});

    await createAlert({ tenantId, userId, sourceIp, alertType, severity, description,
      metadata: { windowTotal, threshold, operation } });

    if (severity === 'CRITICAL') {
      await blockUser(userId);
      await sendAlertEmail(
        `CRITICAL — 대량 ${operation} 탐지`,
        `테넌트: ${tenantId}\n사용자: ${userId}\nIP: ${sourceIp ?? '-'}\n${description}\n\n사용자 계정이 자동 차단되었습니다.`,
      );
    }
  }

  /** 대용량 내보내기 탐지 */
  static async checkBulkExport(
    tenantId:     string,
    userId:       string,
    exportSizeMb: number,
    sourceIp?:    string,
  ): Promise<void> {
    if (exportSizeMb <= THRESHOLDS.BULK_EXPORT_MB) return;
    const severity: 'MEDIUM' | 'HIGH' = exportSizeMb > 500 ? 'HIGH' : 'MEDIUM';
    const description = `대용량 데이터 내보내기 탐지: ${exportSizeMb.toFixed(1)}MB`;

    await logSecurityEvent({
      type: 'UNAUTHORIZED_ACCESS', severity, userId, tenantId, ip: sourceIp,
      details: { alertType: 'BULK_DOWNLOAD', exportSizeMb },
    }).catch(() => {});

    await createAlert({ tenantId, userId, sourceIp,
      alertType: 'BULK_DOWNLOAD', severity, description, metadata: { exportSizeMb } });

    if (severity === 'HIGH') {
      await sendAlertEmail('대용량 데이터 내보내기 탐지',
        `${description}\n사용자: ${userId}\n테넌트: ${tenantId}`);
    }
  }

  /** 암호화 패턴 탐지 (랜섬웨어 payload 업로드 의심) */
  static async checkCryptoPattern(
    tenantId:    string,
    requestPath: string,
    body:        string,
    sourceIp?:   string,
    userId?:     string,
  ): Promise<void> {
    if (!body || body.length < 1000) return;
    const base64Chars = (body.match(/[A-Za-z0-9+/=]/g) ?? []).length;
    const ratio       = base64Chars / body.length;
    if (ratio < THRESHOLDS.CRYPTO_PATTERN_RATIO) return;

    const description = `암호화 의심 payload 탐지 (base64 비율: ${(ratio * 100).toFixed(1)}%) — ${requestPath}`;

    await logSecurityEvent({
      type: 'SUSPICIOUS_LOGIN', severity: 'CRITICAL',
      userId, tenantId, ip: sourceIp,
      details: { alertType: 'CRYPTO_PATTERN', base64Ratio: ratio, path: requestPath },
    }).catch(() => {});

    await createAlert({ tenantId, userId, sourceIp,
      alertType: 'CRYPTO_PATTERN', severity: 'CRITICAL', description,
      metadata: { base64Ratio: ratio, bodyLength: body.length, path: requestPath } });

    if (userId) await blockUser(userId);

    await sendAlertEmail('CRITICAL — 암호화 payload 탐지',
      `${description}\n사용자: ${userId ?? '미인증'}\n테넌트: ${tenantId}\nIP: ${sourceIp ?? '-'}\n\n즉시 조사가 필요합니다.`);
  }
}
