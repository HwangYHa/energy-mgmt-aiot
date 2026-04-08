/**
 * lib/seo/keywords.ts
 *
 * 탄소이음 SEO 키워드 클러스터 (100개+)
 *
 * TOFU: 검색량 높음, 전환율 낮음 (인지 단계)
 * MOFU: 중간 검색량, 중간 전환 (검토 단계)
 * BOFU: 낮은 검색량, 전환율 높음 (구매 단계)
 */

export type FunnelStage = 'TOFU' | 'MOFU' | 'BOFU';
export type Industry = 'manufacturing' | 'building' | 'datacenter' | 'industrial' | 'franchise' | 'general';

export interface Keyword {
  keyword: string;
  intent: string;         // 검색 의도
  stage: FunnelStage;
  industry?: Industry;
  conversionRate: 'low' | 'medium' | 'high';
  landingPage: string;    // 라우팅 경로
  h1: string;
  metaTitle: string;
  metaDescription: string;
  faqCandidates?: string[];
}

// ─── 에너지 관리 클러스터 ─────────────────────────────────────────

export const ENERGY_MANAGEMENT_KEYWORDS: Keyword[] = [
  {
    keyword: '에너지 관리 시스템',
    intent: '정보 탐색',
    stage: 'TOFU',
    conversionRate: 'low',
    landingPage: '/features',
    h1: 'AI 에너지 관리 시스템(EMS)이란?',
    metaTitle: '에너지 관리 시스템(EMS)이란? 기능·도입 효과 완벽 가이드 | 탄소이음',
    metaDescription: 'EMS(에너지 관리 시스템)의 정의, 주요 기능, 도입 효과를 알아보세요. AI 부하 예측·이상 탐지·자동 최적화로 에너지 비용 최대 30% 절감.',
    faqCandidates: ['EMS란 무엇인가요?', 'EMS 도입 비용은?', 'EMS 도입 효과는?'],
  },
  {
    keyword: '전력 모니터링',
    intent: '정보/비교',
    stage: 'TOFU',
    conversionRate: 'low',
    landingPage: '/features',
    h1: '실시간 전력 모니터링 시스템',
    metaTitle: '실시간 전력 모니터링 솔루션 — IoT 기반 에너지 관리 | 탄소이음',
    metaDescription: 'IoT 센서로 공장·빌딩 전력 사용량을 실시간 모니터링. 이상 감지 시 즉시 알림, AI가 낭비 요인을 자동 분석합니다.',
  },
  {
    keyword: '에너지 관리 솔루션',
    intent: '솔루션 탐색',
    stage: 'MOFU',
    conversionRate: 'medium',
    landingPage: '/features',
    h1: '스마트 에너지 관리 솔루션',
    metaTitle: '기업 에너지 관리 솔루션 비교 — AI 기반 EMS | 탄소이음',
    metaDescription: '탄소이음 에너지 관리 솔루션. AI 예측·이상 탐지·자동 최적화를 하나의 플랫폼에서. 무료 체험 14일.',
  },
  {
    keyword: 'BEMS',
    intent: '정보 탐색',
    stage: 'TOFU',
    industry: 'building',
    conversionRate: 'low',
    landingPage: '/solutions/building',
    h1: 'BEMS(빌딩 에너지 관리 시스템) 완벽 가이드',
    metaTitle: 'BEMS 빌딩 에너지 관리 시스템 | 탄소이음',
    metaDescription: 'BEMS 도입으로 상업 빌딩 에너지 비용 40% 절감. 탄소중립 의무화 대응까지 원스톱으로.',
  },
  {
    keyword: 'FEMS',
    intent: '정보 탐색',
    stage: 'TOFU',
    industry: 'manufacturing',
    conversionRate: 'low',
    landingPage: '/solutions/manufacturing',
    h1: 'FEMS(공장 에너지 관리 시스템) 도입 가이드',
    metaTitle: 'FEMS 공장 에너지 관리 시스템 구축 가이드 | 탄소이음',
    metaDescription: '공장 에너지 비용을 30% 이상 절감하는 FEMS 구축법. AI 부하 예측과 이상 탐지로 설비 효율 극대화.',
  },
  {
    keyword: 'EMS 대시보드',
    intent: '기능 탐색',
    stage: 'MOFU',
    conversionRate: 'medium',
    landingPage: '/features',
    h1: '실시간 EMS 대시보드 — 모든 에너지 데이터 한눈에',
    metaTitle: 'EMS 대시보드 기능 — 실시간 에너지 현황 | 탄소이음',
    metaDescription: '직관적인 HMI 스타일 대시보드로 전력·가스·수도 데이터를 실시간 시각화. 이상 발생 시 즉시 알림.',
  },
  {
    keyword: '에너지 자동화',
    intent: '솔루션 탐색',
    stage: 'MOFU',
    conversionRate: 'medium',
    landingPage: '/features',
    h1: 'AI 에너지 자동화로 낭비 없는 운영',
    metaTitle: '에너지 자동화 솔루션 — AI가 24시간 최적화 | 탄소이음',
    metaDescription: '사람 없이도 AI가 전력 사용을 자동 최적화. 피크 부하 감소, 대기전력 차단, 설비 스케줄 제어.',
  },
  {
    keyword: '에너지 관리 SaaS',
    intent: '솔루션 탐색',
    stage: 'MOFU',
    conversionRate: 'high',
    landingPage: '/pricing',
    h1: '구독형 에너지 관리 SaaS',
    metaTitle: '에너지 관리 SaaS 가격 비교 | 탄소이음',
    metaDescription: '설치 없이 바로 시작하는 클라우드 에너지 관리. 월 ₩99,000부터 시작, 14일 무료 체험.',
  },
];

// ─── 탄소중립 클러스터 ────────────────────────────────────────────

export const CARBON_NEUTRAL_KEYWORDS: Keyword[] = [
  {
    keyword: '탄소중립 플랫폼',
    intent: '솔루션 탐색',
    stage: 'MOFU',
    conversionRate: 'medium',
    landingPage: '/features',
    h1: '탄소중립 달성을 위한 올인원 플랫폼',
    metaTitle: '탄소중립 플랫폼 — 배출량 추적부터 감축까지 | 탄소이음',
    metaDescription: 'Scope 1/2/3 탄소 배출량 자동 계산, K-ETS 탄소 거래소 연동, ESG 보고서 자동 생성까지 하나의 플랫폼에서.',
  },
  {
    keyword: '탄소 배출량 측정',
    intent: '정보 탐색',
    stage: 'TOFU',
    conversionRate: 'low',
    landingPage: '/blog/scope1-2-3-guide',
    h1: 'Scope 1/2/3 탄소 배출량 측정 완전 가이드',
    metaTitle: '탄소 배출량 측정 방법 — Scope 1·2·3 가이드 | 탄소이음',
    metaDescription: 'GHG Protocol 기준 탄소 배출량 측정법. Scope 1(직접), Scope 2(전력), Scope 3(공급망) 계산 방법과 자동화 도구.',
    faqCandidates: ['Scope 1·2·3 차이는?', '탄소 배출량 자동 계산 방법은?'],
  },
  {
    keyword: 'K-ETS 탄소 거래',
    intent: '정보/규제 대응',
    stage: 'TOFU',
    conversionRate: 'medium',
    landingPage: '/blog/k-ets-guide',
    h1: 'K-ETS 배출권 거래제 완벽 가이드',
    metaTitle: 'K-ETS 배출권 거래제란? 기업 대응 전략 | 탄소이음',
    metaDescription: '한국 탄소배출권 거래제(K-ETS) 할당량 관리, 탄소 크레딧 매매, 명세서 제출 자동화 방법.',
    faqCandidates: ['K-ETS 할당량 부족 시 어떻게 하나요?', 'K-ETS 신고 방법은?'],
  },
  {
    keyword: 'RE100 대응',
    intent: '규제 대응',
    stage: 'MOFU',
    conversionRate: 'medium',
    landingPage: '/blog/re100-guide',
    h1: 'RE100 달성을 위한 에너지 관리 전략',
    metaTitle: 'RE100 이행 방법 — 재생에너지 전환 전략 | 탄소이음',
    metaDescription: 'RE100 가입 기업의 재생에너지 전환 로드맵. PPA 계약, REC 구매, 자가발전 최적화 전략.',
  },
  {
    keyword: 'CBAM 대응',
    intent: '규제 대응',
    stage: 'MOFU',
    conversionRate: 'medium',
    landingPage: '/blog/cbam-guide',
    h1: 'EU CBAM 탄소국경조정제도 기업 대응 가이드',
    metaTitle: 'EU CBAM 탄소국경조정 대응 방법 | 탄소이음',
    metaDescription: '2026년 EU CBAM 본격 시행. 수출 기업의 탄소 배출량 인증·보고 의무화 대응 전략.',
  },
  {
    keyword: '탄소발자국 계산기',
    intent: '도구 탐색',
    stage: 'MOFU',
    conversionRate: 'high',
    landingPage: '/calculator',
    h1: '기업 탄소발자국 계산기',
    metaTitle: '기업 탄소발자국 무료 계산기 | 탄소이음',
    metaDescription: '전력 사용량을 입력하면 즉시 CO₂ 배출량을 계산. 업종별 벤치마크 비교, 감축 목표 설정까지.',
  },
];

// ─── ESG 보고 클러스터 ────────────────────────────────────────────

export const ESG_KEYWORDS: Keyword[] = [
  {
    keyword: 'ESG 자동 리포트',
    intent: '솔루션 탐색',
    stage: 'MOFU',
    conversionRate: 'high',
    landingPage: '/features',
    h1: 'ESG 보고서 자동 생성 시스템',
    metaTitle: 'ESG 보고서 자동 생성 솔루션 | 탄소이음',
    metaDescription: 'GRI·TCFD·CDP 기준 ESG 보고서를 클릭 한 번으로 자동 생성. 에너지·탄소·수자원 데이터 자동 집계.',
  },
  {
    keyword: 'ESG 경영',
    intent: '정보 탐색',
    stage: 'TOFU',
    conversionRate: 'low',
    landingPage: '/blog/esg-guide',
    h1: 'ESG 경영 완전 가이드 — 환경·사회·지배구조',
    metaTitle: 'ESG 경영이란? 중소·중견기업 ESG 대응 가이드 | 탄소이음',
    metaDescription: 'ESG 경영의 E(환경)·S(사회)·G(지배구조) 개념과 중견기업 대응 방법. 탄소 배출량 공시 의무화 일정과 준비 방법.',
  },
  {
    keyword: 'GHG Protocol',
    intent: '정보 탐색',
    stage: 'TOFU',
    conversionRate: 'low',
    landingPage: '/blog/ghg-protocol',
    h1: 'GHG Protocol 온실가스 회계 기준 설명서',
    metaTitle: 'GHG Protocol이란? 온실가스 배출량 보고 기준 | 탄소이음',
    metaDescription: 'IPCC·GHG Protocol 기반 온실가스 배출량 계산 방법. Scope 1/2/3 분류와 보고 절차 완전 가이드.',
  },
  {
    keyword: '온실가스 명세서',
    intent: '규제 대응',
    stage: 'MOFU',
    conversionRate: 'high',
    landingPage: '/features',
    h1: '온실가스 명세서 자동 작성 시스템',
    metaTitle: '온실가스 명세서 자동 작성 — GHG 관리시스템 | 탄소이음',
    metaDescription: '환경부 온실가스 목표관리제 명세서를 자동으로 작성·제출. K-ETS 할당량 관리까지 원스톱.',
  },
];

// ─── 전기요금 절감 클러스터 ───────────────────────────────────────

export const ELECTRICITY_COST_KEYWORDS: Keyword[] = [
  {
    keyword: '전기요금 절감',
    intent: '비용 절감',
    stage: 'TOFU',
    conversionRate: 'medium',
    landingPage: '/calculator',
    h1: '전기요금 절감 시뮬레이터 — 얼마나 줄일 수 있을까?',
    metaTitle: '전기요금 절감 방법 TOP 10 — 제조·빌딩 사례 | 탄소이음',
    metaDescription: '전기요금 30% 절감 실제 사례. 피크 관리, 역률 개선, 설비 스케줄 최적화로 산업용 전기요금 줄이는 방법.',
    faqCandidates: ['산업용 전기요금 절감 방법?', '전력 피크 관리란?'],
  },
  {
    keyword: '전기요금 절감 계산기',
    intent: '도구 탐색',
    stage: 'BOFU',
    conversionRate: 'high',
    landingPage: '/calculator',
    h1: '전기요금 절감 계산기 — 무료로 절감 효과 예측',
    metaTitle: '전기요금 절감 계산기 무료 | 탄소이음',
    metaDescription: '현재 전기 사용량을 입력하면 AI가 절감 가능 금액을 즉시 계산. 제조업·빌딩·데이터센터 맞춤 분석.',
  },
  {
    keyword: '피크 부하 관리',
    intent: '기능 탐색',
    stage: 'MOFU',
    conversionRate: 'medium',
    landingPage: '/features',
    h1: 'AI 피크 부하 관리 — 최대수요전력 자동 제어',
    metaTitle: '피크 부하 관리 시스템 — 최대수요전력 절감 | 탄소이음',
    metaDescription: 'AI가 전력 피크를 예측하고 자동으로 부하를 제어. 최대수요전력 요금 절감으로 연간 수천만 원 절약.',
  },
  {
    keyword: '수요반응 DR',
    intent: '정보/기능 탐색',
    stage: 'MOFU',
    conversionRate: 'medium',
    landingPage: '/features',
    h1: '수요반응(DR) 자동 참여 — 절감 + 인센티브 동시에',
    metaTitle: '수요반응(DR) 자동 참여 시스템 | 탄소이음',
    metaDescription: 'KPX 수요반응 자동 입찰·이행. DR 이벤트 발령 시 AI가 자동으로 부하를 감소시키고 인센티브를 최대화.',
  },
  {
    keyword: 'ROI 계산기',
    intent: '도구/구매 검토',
    stage: 'BOFU',
    conversionRate: 'high',
    landingPage: '/calculator',
    h1: '에너지 관리 시스템 ROI 계산기',
    metaTitle: 'EMS 도입 ROI 계산기 — 투자 회수 기간 분석 | 탄소이음',
    metaDescription: '에너지 관리 시스템 도입 비용 대비 절감 효과를 계산. 대부분의 기업에서 6~12개월 내 투자 회수.',
  },
];

// ─── AI 전력 예측 클러스터 ────────────────────────────────────────

export const AI_PREDICTION_KEYWORDS: Keyword[] = [
  {
    keyword: 'AI 전력 예측',
    intent: '기능 탐색',
    stage: 'MOFU',
    conversionRate: 'medium',
    landingPage: '/features',
    h1: 'AI 전력 부하 예측 — MAPE 8% 이하 정확도',
    metaTitle: 'AI 전력 부하 예측 시스템 — MAPE 8% | 탄소이음',
    metaDescription: '딥러닝 기반 부하 예측으로 내일의 전력 사용량을 미리 파악. MAPE 8% 이하 정확도로 에너지 계획 최적화.',
  },
  {
    keyword: '전력 이상 탐지',
    intent: '기능 탐색',
    stage: 'MOFU',
    conversionRate: 'medium',
    landingPage: '/features',
    h1: 'AI 전력 이상 탐지 — F1-Score 0.92 정확도',
    metaTitle: 'AI 전력 이상 탐지 시스템 | 탄소이음',
    metaDescription: '설비 오작동, 누전, 에너지 낭비를 AI가 실시간으로 탐지. F1-Score 0.92 정확도로 오탐률 최소화.',
    faqCandidates: ['이상 탐지 시 어떻게 알림이 오나요?', 'AI 탐지 정확도는?'],
  },
  {
    keyword: '스마트미터 SaaS',
    intent: '솔루션 탐색',
    stage: 'MOFU',
    conversionRate: 'high',
    landingPage: '/features',
    h1: '스마트미터 데이터 분석 SaaS 플랫폼',
    metaTitle: '스마트미터 데이터 분석 SaaS | 탄소이음',
    metaDescription: 'AMI 스마트미터 데이터를 클라우드로 수집·분석. 15분 단위 전력 패턴 분석, 이상 즉시 알림.',
  },
  {
    keyword: '에너지 빅데이터',
    intent: '정보/기능 탐색',
    stage: 'TOFU',
    conversionRate: 'low',
    landingPage: '/blog/energy-bigdata',
    h1: '에너지 빅데이터 분석으로 절감 기회 찾기',
    metaTitle: '에너지 빅데이터 분석 활용 사례 | 탄소이음',
    metaDescription: '수백만 건 에너지 데이터에서 절감 기회를 AI가 자동 발굴. 실제 제조업·빌딩 절감 성공 사례.',
  },
];

// ─── IoT 센서 클러스터 ────────────────────────────────────────────

export const IOT_KEYWORDS: Keyword[] = [
  {
    keyword: 'IoT 전력 센서',
    intent: '제품 탐색',
    stage: 'MOFU',
    conversionRate: 'medium',
    landingPage: '/features',
    h1: 'IoT 전력 센서 실시간 모니터링',
    metaTitle: 'IoT 전력 센서 설치·모니터링 | 탄소이음',
    metaDescription: 'CT 센서, 스마트 플러그, 에너지 미터 등 모든 IoT 디바이스를 하나의 플랫폼에서 관리.',
  },
  {
    keyword: '스마트팩토리 에너지',
    intent: '산업 솔루션',
    stage: 'MOFU',
    industry: 'manufacturing',
    conversionRate: 'high',
    landingPage: '/solutions/manufacturing',
    h1: '스마트팩토리 에너지 관리 — 공장 전력 절감',
    metaTitle: '스마트팩토리 에너지 관리 솔루션 | 탄소이음',
    metaDescription: '공장 설비별 전력 사용량 실시간 모니터링. AI가 설비 스케줄을 자동 최적화하여 에너지 비용 30% 절감.',
  },
  {
    keyword: 'MQTT 에너지 모니터링',
    intent: '기술 탐색',
    stage: 'MOFU',
    conversionRate: 'medium',
    landingPage: '/docs/api',
    h1: 'MQTT 프로토콜 에너지 모니터링 시스템',
    metaTitle: 'MQTT 기반 실시간 에너지 모니터링 | 탄소이음',
    metaDescription: 'MQTT·Modbus·BACnet 등 산업 프로토콜을 지원하는 IoT 게이트웨이로 기존 설비를 스마트하게.',
  },
  {
    keyword: 'PLC 에너지 연동',
    intent: '기술 탐색',
    stage: 'MOFU',
    industry: 'manufacturing',
    conversionRate: 'medium',
    landingPage: '/solutions/manufacturing',
    h1: 'PLC·SCADA 에너지 데이터 연동 가이드',
    metaTitle: 'PLC·SCADA 에너지 관리 시스템 연동 | 탄소이음',
    metaDescription: '기존 PLC·SCADA 시스템에 에너지 관리 기능 추가. Modbus TCP/RTU, OPC-UA 프로토콜 지원.',
  },
];

// ─── 스마트팩토리 클러스터 ────────────────────────────────────────

export const SMART_FACTORY_KEYWORDS: Keyword[] = [
  {
    keyword: '공장 전력 모니터링',
    intent: '솔루션 탐색',
    stage: 'MOFU',
    industry: 'manufacturing',
    conversionRate: 'high',
    landingPage: '/solutions/manufacturing',
    h1: '공장 전력 모니터링 시스템 — 설비별 실시간 관리',
    metaTitle: '공장 전력 모니터링 시스템 구축 | 탄소이음',
    metaDescription: '제조 공장 설비별 전력 사용량 실시간 측정·분석. 에너지 낭비 설비 즉시 파악, 최대 30% 전기요금 절감.',
  },
  {
    keyword: '제조업 탄소중립',
    intent: '규제 대응',
    stage: 'MOFU',
    industry: 'manufacturing',
    conversionRate: 'medium',
    landingPage: '/solutions/manufacturing',
    h1: '제조업 탄소중립 달성 — 배출량 감축 로드맵',
    metaTitle: '제조업 탄소중립 전략 — 2050 Net-Zero | 탄소이음',
    metaDescription: '제조 공정 탄소 배출량 감축 방법. 에너지 효율화, 재생에너지 전환, 공정 개선으로 2030 NDC 목표 달성.',
  },
  {
    keyword: '설비 에너지 효율',
    intent: '기능 탐색',
    stage: 'MOFU',
    industry: 'manufacturing',
    conversionRate: 'medium',
    landingPage: '/solutions/manufacturing',
    h1: '설비별 에너지 효율 분석 — 최적화 포인트 발굴',
    metaTitle: '설비 에너지 효율 분석·최적화 | 탄소이음',
    metaDescription: '모터·컴프레서·HVAC 등 설비별 에너지 효율을 실시간 분석. 교체 시기 예측으로 유지보수 비용도 절감.',
  },
];

// ─── 빌딩/상업시설 클러스터 ──────────────────────────────────────

export const BUILDING_KEYWORDS: Keyword[] = [
  {
    keyword: '빌딩 에너지 관리',
    intent: '솔루션 탐색',
    stage: 'MOFU',
    industry: 'building',
    conversionRate: 'high',
    landingPage: '/solutions/building',
    h1: '빌딩 에너지 관리 시스템(BEMS) — 40% 절감 달성',
    metaTitle: '빌딩 에너지 관리 시스템 — 전기요금 40% 절감 | 탄소이음',
    metaDescription: '상업 빌딩·오피스·리테일 에너지 자동 관리. 냉난방·조명·엘리베이터 통합 제어로 에너지 비용 최대 40% 절감.',
  },
  {
    keyword: '건물 탄소 배출',
    intent: '규제 대응',
    stage: 'MOFU',
    industry: 'building',
    conversionRate: 'medium',
    landingPage: '/solutions/building',
    h1: '건물 탄소 배출량 측정·감축 시스템',
    metaTitle: '건물 탄소 배출량 관리 — 그린빌딩 인증 | 탄소이음',
    metaDescription: '건물에너지효율등급·그린빌딩 인증 대응. 탄소 배출량 실시간 추적, 감축 목표 달성 현황 자동 리포트.',
  },
  {
    keyword: '프랜차이즈 에너지 관리',
    intent: '솔루션 탐색',
    stage: 'MOFU',
    industry: 'franchise',
    conversionRate: 'high',
    landingPage: '/solutions/building',
    h1: '프랜차이즈 다점포 에너지 통합 관리',
    metaTitle: '프랜차이즈 에너지 관리 — 본사·지점 통합 플랫폼 | 탄소이음',
    metaDescription: '수십~수백 개 매장의 전력 사용량을 본사에서 한눈에 관리. 이상 매장 즉시 감지, 전체 에너지 비용 20% 절감.',
  },
];

// ─── 데이터센터 클러스터 ──────────────────────────────────────────

export const DATACENTER_KEYWORDS: Keyword[] = [
  {
    keyword: '데이터센터 PUE',
    intent: '기술 탐색',
    stage: 'MOFU',
    industry: 'datacenter',
    conversionRate: 'medium',
    landingPage: '/solutions/datacenter',
    h1: '데이터센터 PUE 개선 — 1.2 이하 달성 가이드',
    metaTitle: '데이터센터 PUE 최적화 솔루션 | 탄소이음',
    metaDescription: 'PUE 1.2 이하 달성으로 냉각 비용 45% 절감. AI가 서버룸 온도·기류를 자동 최적화.',
  },
  {
    keyword: '데이터센터 에너지 효율',
    intent: '기술/솔루션 탐색',
    stage: 'MOFU',
    industry: 'datacenter',
    conversionRate: 'medium',
    landingPage: '/solutions/datacenter',
    h1: '데이터센터 에너지 효율화 전략',
    metaTitle: '데이터센터 에너지 효율화 — PUE·냉각 최적화 | 탄소이음',
    metaDescription: '서버 가상화·냉각 최적화·UPS 효율 개선으로 데이터센터 전력 비용 45% 절감. 탄소 배출량 50% 감축.',
  },
];

// ─── SaaS/구독 관리 클러스터 ──────────────────────────────────────

export const SAAS_KEYWORDS: Keyword[] = [
  {
    keyword: '에너지 관리 구독',
    intent: '구매 검토',
    stage: 'BOFU',
    conversionRate: 'high',
    landingPage: '/pricing',
    h1: '에너지 관리 구독 플랜 비교',
    metaTitle: '에너지 관리 SaaS 구독 플랜 비교 | 탄소이음',
    metaDescription: 'Basic(₩99,000/월) · Pro(₩299,000/월) · Enterprise. 14일 무료 체험으로 시작하세요.',
  },
  {
    keyword: '무료 체험 EMS',
    intent: '구매 결정',
    stage: 'BOFU',
    conversionRate: 'high',
    landingPage: '/trial',
    h1: 'EMS 14일 무료 체험 — 신용카드 없이 시작',
    metaTitle: 'EMS 무료 체험 14일 | 탄소이음',
    metaDescription: '탄소이음 에너지 관리 플랫폼 14일 무료 체험. 신용카드 없이 즉시 시작. 데모 데이터로 모든 기능 경험.',
  },
  {
    keyword: '에너지 관리 데모',
    intent: '구매 결정',
    stage: 'BOFU',
    conversionRate: 'high',
    landingPage: '/demo',
    h1: '에너지 관리 시스템 데모 신청',
    metaTitle: 'EMS 데모 신청 — 전문가 1:1 시연 | 탄소이음',
    metaDescription: '에너지 관리 전문가가 직접 시연. 우리 회사 상황에 맞는 절감 방법을 30분 안에 파악하세요.',
  },
  {
    keyword: 'API 에너지 데이터',
    intent: '기술 통합',
    stage: 'MOFU',
    conversionRate: 'medium',
    landingPage: '/docs/api',
    h1: '에너지 데이터 API — REST·WebSocket 연동',
    metaTitle: '에너지 데이터 API 문서 | 탄소이음',
    metaDescription: 'ERP·MES·BMS 시스템과 에너지 데이터 연동. REST API, WebSocket, Webhook 지원.',
  },
];

// ─── B2B ROI 클러스터 ─────────────────────────────────────────────

export const ROI_KEYWORDS: Keyword[] = [
  {
    keyword: '에너지 절감 ROI',
    intent: '투자 검토',
    stage: 'BOFU',
    conversionRate: 'high',
    landingPage: '/calculator',
    h1: 'EMS 투자 ROI — 에너지 절감 수익 계산',
    metaTitle: '에너지 관리 시스템 ROI 분석 | 탄소이음',
    metaDescription: '에너지 관리 시스템 도입 비용 대비 절감 효과. 평균 6~12개월 투자 회수, 연간 수천만 원 절감 사례.',
  },
  {
    keyword: '에너지 비용 절감 사례',
    intent: '검증/비교',
    stage: 'MOFU',
    conversionRate: 'medium',
    landingPage: '/blog/success-cases',
    h1: '에너지 비용 절감 성공 사례 — 실제 도입 기업',
    metaTitle: '에너지 관리 절감 성공 사례 모음 | 탄소이음',
    metaDescription: '제조업 A사 32% 절감, 빌딩 B사 41% 절감, 데이터센터 C사 PUE 1.18 달성. 실제 도입 기업의 생생한 사례.',
  },
  {
    keyword: '전력 비용 분석',
    intent: '분석/진단',
    stage: 'MOFU',
    conversionRate: 'medium',
    landingPage: '/calculator',
    h1: '기업 전력 비용 무료 분석 — 절감 기회 진단',
    metaTitle: '기업 전력 비용 분석 서비스 무료 | 탄소이음',
    metaDescription: '전력 사용 패턴을 분석하여 절감 기회를 무료로 진단. 업종별 에너지 효율 벤치마크 비교 제공.',
  },
];

// ─── 전체 키워드 병합 ─────────────────────────────────────────────

export const ALL_KEYWORDS: Keyword[] = [
  ...ENERGY_MANAGEMENT_KEYWORDS,
  ...CARBON_NEUTRAL_KEYWORDS,
  ...ESG_KEYWORDS,
  ...ELECTRICITY_COST_KEYWORDS,
  ...AI_PREDICTION_KEYWORDS,
  ...IOT_KEYWORDS,
  ...SMART_FACTORY_KEYWORDS,
  ...BUILDING_KEYWORDS,
  ...DATACENTER_KEYWORDS,
  ...SAAS_KEYWORDS,
  ...ROI_KEYWORDS,
];

/** 퍼널 단계별 필터 */
export function getKeywordsByStage(stage: FunnelStage): Keyword[] {
  return ALL_KEYWORDS.filter((k) => k.stage === stage);
}

/** 산업군별 필터 */
export function getKeywordsByIndustry(industry: Industry): Keyword[] {
  return ALL_KEYWORDS.filter((k) => k.industry === industry || !k.industry);
}

/** 전환율 높은 순 정렬 */
export function getHighConversionKeywords(): Keyword[] {
  return ALL_KEYWORDS.filter((k) => k.conversionRate === 'high');
}
