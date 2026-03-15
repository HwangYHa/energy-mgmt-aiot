/**
 * CSP (Content Security Policy) 위반 리포트 수신 엔드포인트
 *
 * 브라우저가 CSP 위반 감지 시 자동 전송 → AuditLog DB 저장
 * 동일 출처(blocked-uri)가 1분 내 5회 초과 시 HIGH 보안 이벤트
 */

import { NextRequest, NextResponse } from 'next/server';
import { logSecurityEvent } from '@/lib/services/security-event.service';

// 짧은 시간 내 동일 위반 중복 방지 (메모리 디바운스)
const recentViolations = new Map<string, number>(); // key → last timestamp
setInterval(() => recentViolations.clear(), 60 * 1000);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const report = body['csp-report'] ?? body; // Chrome/Firefox 포맷 모두 지원

    const blockedUri    = report['blocked-uri'] ?? report.blockedURI ?? 'unknown';
    const violatedDir   = report['violated-directive'] ?? report.violatedDirective ?? '';
    const documentUri   = report['document-uri'] ?? report.documentURI ?? '';
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
              ?? request.headers.get('x-real-ip')
              ?? '0.0.0.0';

    // 중복 제거: 동일 (IP + blockedUri) 조합은 1분 내 1회만 DB 기록
    const dedupeKey = `${ip}:${blockedUri}`;
    const lastSeen = recentViolations.get(dedupeKey) ?? 0;
    if (Date.now() - lastSeen < 60_000) {
      return NextResponse.json({ received: true }, { status: 200 });
    }
    recentViolations.set(dedupeKey, Date.now());

    // DB 기록 (fire-and-forget)
    logSecurityEvent({
      type:     'CSP_VIOLATION',
      severity: violatedDir.includes('script-src') ? 'HIGH' : 'LOW',
      ip,
      path:     documentUri,
      details: {
        blockedUri,
        violatedDirective: violatedDir,
        originalPolicy:    report['original-policy'] ?? report.originalPolicy,
        disposition:       report['disposition'],
      },
    }).catch(() => {});

  } catch {
    // 파싱 실패도 무시 (브라우저 CSP 리포트는 형식이 다양)
  }

  // 항상 200 반환 (브라우저가 재시도하지 않도록)
  return NextResponse.json({ received: true }, { status: 200 });
}
