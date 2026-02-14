/**
 * CSP (Content Security Policy) 위반 리포트 수신 엔드포인트
 *
 * 보안 헤더에서 설정한 report-uri로 브라우저가 CSP 위반 시 자동 전송
 * 프로덕션에서 CSP 위반 패턴을 모니터링하여 보안 정책 조정에 활용
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const report = await request.json();

    // CSP 위반 로그 기록
    console.warn('[CSP Violation]', JSON.stringify(report, null, 2));

    // TODO: 프로덕션에서는 Sentry, Datadog 등 외부 모니터링 서비스로 전송
    // await sendToMonitoring('csp-violation', report);

    return NextResponse.json({ received: true }, { status: 200 });
  } catch {
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
