/**
 * GET /api/manual/pdf — 사용자 매뉴얼 PDF 다운로드 (Puppeteer)
 *
 * Puppeteer(Chromium)으로 한국어 HTML을 렌더링하여 PDF 생성.
 * 별도 폰트 설정 없이 시스템 한국어 폰트 자동 사용.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { generateDownloadFilename, contentDispositionHeader } from '@/lib/utils/filename';

export const dynamic = 'force-dynamic';

const MANUAL_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
    font-size: 11pt;
    color: #1e293b;
    background: #fff;
    padding: 20mm 15mm;
    line-height: 1.6;
  }
  h1 {
    font-size: 22pt;
    color: #0369a1;
    border-bottom: 3px solid #0369a1;
    padding-bottom: 8px;
    margin-bottom: 6px;
  }
  .subtitle {
    font-size: 11pt;
    color: #64748b;
    margin-bottom: 30px;
  }
  .generated {
    font-size: 9pt;
    color: #94a3b8;
    margin-bottom: 40px;
  }
  h2 {
    font-size: 15pt;
    color: #0f172a;
    background: #f1f5f9;
    border-left: 4px solid #0369a1;
    padding: 8px 12px;
    margin: 28px 0 14px 0;
    page-break-after: avoid;
  }
  h3 {
    font-size: 12pt;
    color: #1e40af;
    margin: 14px 0 6px 0;
    page-break-after: avoid;
  }
  p {
    font-size: 10.5pt;
    color: #334155;
    margin-bottom: 6px;
    padding-left: 4px;
  }
  .article {
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 12px 14px;
    margin-bottom: 10px;
    page-break-inside: avoid;
  }
  .toc {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 16px 20px;
    margin-bottom: 36px;
  }
  .toc-title { font-size: 13pt; font-weight: bold; color: #0f172a; margin-bottom: 10px; }
  .toc-item { font-size: 10pt; color: #475569; padding: 3px 0 3px 12px; }
  .footer {
    position: fixed;
    bottom: 10mm;
    left: 15mm;
    right: 15mm;
    font-size: 8pt;
    color: #94a3b8;
    border-top: 1px solid #e2e8f0;
    padding-top: 4px;
    display: flex;
    justify-content: space-between;
  }
  @page { margin: 20mm 15mm 25mm 15mm; }
</style>
</head>
<body>
  <!-- 헤더 -->
  <h1>EMS AIoT 사용자 매뉴얼</h1>
  <p class="subtitle">에너지 관리 시스템 (Energy Management System) — AIoT 기반 탄소중립 SaaS 플랫폼</p>
  <p class="generated">발행일: ${new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

  <!-- 목차 -->
  <div class="toc">
    <div class="toc-title">목차 (Table of Contents)</div>
    <div class="toc-item">1. 시작하기 — 시스템 개요, 초기 설정, 사용자 역할, 로그인</div>
    <div class="toc-item">2. 모니터링 — 대시보드, 실시간 현황, 데이터 수집, 설비 모니터링</div>
    <div class="toc-item">3. 분석 &amp; 예측 — 에너지/비용 분석, 이상 탐지, 시뮬레이터, 데이터 다운로드</div>
    <div class="toc-item">4. 설비 제어 — 수동 제어, 스케줄, AI 최적 제어, DR 참여</div>
    <div class="toc-item">5. 설정 &amp; 관리 — 알림, API 키, 사이트, 구독 관리</div>
    <div class="toc-item">6. 규제 &amp; 컴플라이언스 — 감사 추적, 배출계수, 규제 리포트</div>
  </div>

  <!-- 1. 시작하기 -->
  <h2>1. 시작하기</h2>

  <div class="article">
    <h3>1.1 시스템 개요</h3>
    <p>EMS AIoT는 AI 기반 에너지 관리 플랫폼으로, 제조업·빌딩·데이터센터를 위한 탄소중립 SaaS 솔루션입니다.</p>
    <p>주요 기능: 실시간 에너지 모니터링, AI 부하 예측, 이상 탐지, 설비 자동 제어, 탄소 배출 관리, K-ETS 배출권 거래소, 수요반응(DR) 참여.</p>
    <p>멀티 테넌트 아키텍처로 복수의 사업장과 부서를 하나의 플랫폼에서 통합 관리할 수 있습니다.</p>
  </div>

  <div class="article">
    <h3>1.2 초기 설정 가이드</h3>
    <p>① 테넌트 계정 생성 후 관리자 패널(설정 &gt; 시스템)에서 사업장 정보를 입력합니다.</p>
    <p>② 사이트(Site)를 등록하고 각 사이트에 디바이스(센서/계측기)를 연결합니다.</p>
    <p>③ MQTT 또는 HTTP API를 통해 실시간 데이터 수집을 설정합니다.</p>
    <p>④ 알림 규칙을 설정하여 이상 상황 발생 시 즉시 통보받도록 합니다.</p>
  </div>

  <div class="article">
    <h3>1.3 사용자 역할 및 권한</h3>
    <p><strong>뷰어(Viewer)</strong>: 대시보드·분석 페이지 조회만 가능. 제어 명령 및 설정 변경 불가.</p>
    <p><strong>운영자(Operator)</strong>: 뷰어 권한 + 수동 제어·스케줄 관리·알림 설정 가능.</p>
    <p><strong>사이트 관리자(Site Manager)</strong>: 운영자 권한 + 사이트·디바이스 관리.</p>
    <p><strong>테넌트 관리자(Tenant Admin)</strong>: 사이트 관리자 권한 + 사용자 관리·구독 관리.</p>
    <p><strong>슈퍼 관리자(Super Admin)</strong>: 전체 시스템 관리 권한.</p>
  </div>

  <div class="article">
    <h3>1.4 로그인 및 인증</h3>
    <p>지원 로그인 방식: 이메일/비밀번호, Google OAuth, Naver OAuth.</p>
    <p>비밀번호 분실 시 로그인 페이지의 "비밀번호 찾기" 링크를 이용하여 이메일로 재설정 링크를 받을 수 있습니다.</p>
    <p>보안을 위해 세션은 24시간 후 자동 만료됩니다.</p>
  </div>

  <!-- 2. 모니터링 -->
  <h2>2. 모니터링</h2>

  <div class="article">
    <h3>2.1 종합 모니터링 대시보드</h3>
    <p>메인 대시보드에서 전체 사업장의 전력 사용량, 주요 설비 상태, KPI 지표를 한눈에 확인합니다.</p>
    <p>상단 KPI 카드: 총 소비 전력(kW), 오늘 사용량(kWh), 예상 월 비용(원), 탄소 배출(tCO₂).</p>
    <p>차트 영역: 실시간 부하 추이, 시간대별 사용량 비교, 설비별 소비 분포.</p>
  </div>

  <div class="article">
    <h3>2.2 실시간 데이터 현황</h3>
    <p>모니터링 &gt; 실시간 현황에서 초 단위 갱신되는 전력 소비 그래프를 확인할 수 있습니다.</p>
    <p>피크 전력 임박 시 화면 상단에 경고 배너가 표시됩니다.</p>
    <p>센서별 최신값, 이상 여부, 마지막 통신 시간을 테이블로 확인할 수 있습니다.</p>
  </div>

  <div class="article">
    <h3>2.3 데이터 수집 상태 (파이프라인 모니터링)</h3>
    <p>모니터링 &gt; 파이프라인에서 각 디바이스의 MQTT/HTTP 연결 상태와 데이터 품질을 확인합니다.</p>
    <p>데이터 지연(Latency), 누락 비율, 오류 건수를 실시간으로 모니터링합니다.</p>
  </div>

  <div class="article">
    <h3>2.4 설비 모니터링</h3>
    <p>센서 목록 페이지에서 개별 설비(에어컨, 조명, 압축기 등)의 가동 상태와 소비 전력을 확인합니다.</p>
    <p>이상 감지 시 해당 설비에 빨간 경고 표시가 나타납니다.</p>
  </div>

  <!-- 3. 분석 & 예측 -->
  <h2>3. 분석 &amp; 예측</h2>

  <div class="article">
    <h3>3.1 에너지 분석</h3>
    <p>분석 &gt; 에너지에서 일·주·월·연도별 사용량 추이, 피크 분석, 부하율, 전년 대비 비교를 확인합니다.</p>
    <p>사이트·디바이스 필터로 특정 구역의 소비 패턴을 심층 분석할 수 있습니다.</p>
  </div>

  <div class="article">
    <h3>3.2 비용 분석</h3>
    <p>전력 요금 구성(기본요금·전력량 요금·피크요금), 시간대별 비용, 절감 가능 금액을 분석합니다.</p>
    <p>요금제 시뮬레이션으로 최적 계약 전력을 산정할 수 있습니다.</p>
  </div>

  <div class="article">
    <h3>3.3 이상 탐지</h3>
    <p>AI 모델이 정상 소비 패턴을 학습하여 이상 징후를 자동으로 감지합니다.</p>
    <p>이상 탐지 목록에서 날짜·심각도·대상 설비를 확인하고 원인을 분석할 수 있습니다.</p>
  </div>

  <div class="article">
    <h3>3.4 절감 시뮬레이터</h3>
    <p>LED 교체, HVAC 최적화, 태양광 발전 등 절감 시나리오를 선택하여 예상 절감량과 ROI를 계산합니다.</p>
  </div>

  <div class="article">
    <h3>3.5 탄소 분석 &amp; 배출권 거래소</h3>
    <p>Scope 1/2/3 탄소 배출량을 자동 계산하여 월별 배출 추이를 확인합니다.</p>
    <p>K-ETS 배출권(KAU/KCU/OFFSET) 매수, 보유 포트폴리오 관리, 크레딧 소각(배출량 상계)을 지원합니다.</p>
    <p>탄소중립 로드맵에서 감축 목표를 설정하고 연도별 달성 경로를 시각화합니다.</p>
  </div>

  <div class="article">
    <h3>3.6 데이터 다운로드</h3>
    <p>분석 &gt; 데이터 다운로드에서 수집 데이터를 CSV, Excel, JSON 형식으로 내보낼 수 있습니다.</p>
    <p>기간, 사이트, 메트릭 필터를 적용하여 필요한 데이터만 선택적으로 다운로드합니다.</p>
  </div>

  <!-- 4. 설비 제어 -->
  <h2>4. 설비 제어</h2>

  <div class="article">
    <h3>4.1 수동 제어</h3>
    <p>제어 &gt; 수동 제어에서 개별 설비에 ON/OFF, 출력 조절 명령을 전송합니다.</p>
    <p>제어 이력은 감사 추적 로그에 자동 기록됩니다.</p>
  </div>

  <div class="article">
    <h3>4.2 스케줄 제어</h3>
    <p>시간 기반 자동 제어 스케줄을 설정합니다. 시작 시간·종료 시간·반복 주기·대상 설비를 지정합니다.</p>
    <p>예: 평일 22시 조명 소등, 주말 공조기 저출력 운전.</p>
  </div>

  <div class="article">
    <h3>4.3 AI 최적 제어</h3>
    <p>AI 엔진이 에너지 비용을 최소화하는 최적 운전 전략을 자동으로 생성하고 실행합니다.</p>
    <p>피크 회피, 부하 이동, ESS 최적 충·방전 시점을 자동으로 결정합니다.</p>
  </div>

  <div class="article">
    <h3>4.4 수요반응(DR) 참여</h3>
    <p>한국전력 DR 이벤트 발생 시 시스템이 자동으로 참여 여부를 판단하고 감축 명령을 실행합니다.</p>
    <p>DR 참여 이력, 감축 실적, 인센티브 내역을 제어 &gt; 수요반응에서 확인합니다.</p>
  </div>

  <!-- 5. 설정 & 관리 -->
  <h2>5. 설정 &amp; 관리</h2>

  <div class="article">
    <h3>5.1 알림 설정</h3>
    <p>설정 &gt; 알림에서 이메일·SMS·웹훅 알림 규칙을 설정합니다.</p>
    <p>알림 조건: 피크 전력 초과, 에너지 목표 초과, 설비 고장, 이상 탐지, K-ETS 크레딧 부족 등.</p>
  </div>

  <div class="article">
    <h3>5.2 API 키 관리</h3>
    <p>설정 &gt; API에서 외부 시스템 연동용 API 키를 생성합니다. 키 발급 시 권한(읽기/쓰기)과 만료일을 설정합니다.</p>
    <p>API 키는 발급 직후에만 확인 가능하며, 분실 시 재발급이 필요합니다.</p>
  </div>

  <div class="article">
    <h3>5.3 구독 관리</h3>
    <p>설정 &gt; 시스템에서 현재 구독 플랜, 결제 이력, 사용량을 확인합니다.</p>
    <p>플랜 업그레이드/다운그레이드는 구독 관리 페이지에서 즉시 처리됩니다.</p>
  </div>

  <!-- 6. 규제 & 컴플라이언스 -->
  <h2>6. 규제 &amp; 컴플라이언스</h2>

  <div class="article">
    <h3>6.1 감사 추적</h3>
    <p>컴플라이언스 &gt; 감사 추적에서 모든 시스템 활동(로그인, 제어 명령, 설정 변경)의 이력을 조회합니다.</p>
    <p>감사 로그는 최소 2년간 보존되며 삭제 및 수정이 불가합니다.</p>
  </div>

  <div class="article">
    <h3>6.2 탄소 배출 리포트</h3>
    <p>법정 온실가스 명세서 작성을 위한 Scope 1/2/3 배출량 리포트를 생성합니다.</p>
    <p>ISO 14064, K-ETS 보고 형식에 맞게 CSV 또는 PDF로 내보낼 수 있습니다.</p>
  </div>

  <!-- 푸터 -->
  <div class="footer">
    <span>EMS AIoT — 에너지 관리 시스템 사용자 매뉴얼</span>
    <span>© 2026 EMS AIoT Platform</span>
  </div>
</body>
</html>`;

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Puppeteer를 동적으로 import (서버 사이드 전용)
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(MANUAL_HTML, { waitUntil: 'networkidle0', timeout: 30000 });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: `
          <div style="font-family:'Malgun Gothic',sans-serif;font-size:8pt;color:#94a3b8;
                      width:100%;padding:0 15mm;display:flex;justify-content:space-between;">
            <span>EMS AIoT 사용자 매뉴얼</span>
            <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
          </div>`,
        margin: { top: '15mm', bottom: '20mm', left: '0', right: '0' },
      });

      return new NextResponse(Buffer.from(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': contentDispositionHeader(generateDownloadFilename('사용자매뉴얼', '', 'pdf')),
          'Cache-Control': 'no-store',
        },
      });
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error('[manual/pdf GET]', error);
    return NextResponse.json(
      { error: 'PDF 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
