/**
 * 랜딩 페이지 콘텐츠 데이터
 *
 * CMS 연동 시 이 파일을 API 호출로 대체
 */

export const HERO_CONTENT = {
  badge: 'AI 기반 에너지 관리 플랫폼 1위',
  title: {
    main: '에너지 관리의',
    highlight: '새로운 기준',
  },
  description: 'AI 기반 부하 예측, 실시간 이상 탐지, 자동 최적화 추천으로',
  metrics: {
    efficiency: '15% 향상',
    savings: '₩7.2M 절감',
  },
  cta: {
    primary: '14일 무료 체험',
    secondary: '데모 보기',
  },
  trustIndicators: [
    '신용카드 불필요',
    '즉시 시작',
    '언제든 취소 가능',
  ],
} as const;

export const FEATURES = [
  {
    id: 'forecast',
    icon: 'BarChart3',
    title: '부하 예측',
    color: 'emerald',
    description: 'LSTM 신경망을 이용한 정확한 전력 수요 예측으로 사전 대응이 가능합니다',
    metrics: [
      { label: '정확도', value: '92%', detail: '(MAPE < 8%)' },
      { label: '예측 범위', value: '24시간/7일/30일 예측' },
      { label: '신뢰도', value: '95% 신뢰 구간 제공' },
    ],
  },
  {
    id: 'anomaly',
    icon: 'AlertCircle',
    title: '이상 탐지',
    color: 'orange',
    description: 'Isolation Forest로 비정상 패턴을 실시간으로 감지하고 즉시 알림을 전송합니다',
    metrics: [
      { label: 'F1 점수', value: '0.92' },
      { label: '분류', value: '4단계 심각도 자동 분류' },
      { label: '분석', value: '원인 분석 및 대응 제안' },
    ],
  },
  {
    id: 'optimization',
    icon: 'Zap',
    title: '최적화 추천',
    color: 'yellow',
    description: 'Peak Shaving, ESS 충방전, HVAC 최적화로 에너지 비용을 절감합니다',
    metrics: [
      { label: '일일 절감', value: '1,200 kWh' },
      { label: '월간 절감', value: '₩7.2M' },
      { label: 'ROI', value: '20개월 달성' },
    ],
  },
  {
    id: 'dr',
    icon: 'Smartphone',
    title: '수요반응 (DR)',
    color: 'blue',
    description: '자동화된 DR 이벤트 참여로 추가 수익을 창출하고 피크 부하를 감축합니다',
    metrics: [
      { label: '제어', value: '자동 제어 및 응답' },
      { label: 'DR 수익', value: '월간 ₩9M' },
      { label: '모니터링', value: '실시간 이벤트 모니터링' },
    ],
  },
  {
    id: 'carbon',
    icon: 'Leaf',
    title: '탄소 추적',
    color: 'green',
    description: 'Scope 1/2/3 배출량 자동 계산 및 K-ETS, ISO 14064 규제 보고서 생성',
    metrics: [
      { label: '계산', value: '실시간 배출량 계산' },
      { label: '규제 준수', value: 'K-ETS, RE100 자동 준수' },
      { label: '리포팅', value: 'ESG 리포팅 자동화' },
    ],
  },
  {
    id: 'security',
    icon: 'Lock',
    title: '보안 & 컴플라이언스',
    color: 'red',
    description: '엔터프라이즈급 보안과 완벽한 감사 추적으로 규정을 준수합니다',
    metrics: [
      { label: '감사', value: '전체 감사 로그 기록' },
      { label: '접근 제어', value: '역할 기반 접근 제어 (RBAC)' },
      { label: '암호화', value: 'AES-256 데이터 암호화' },
    ],
  },
] as const;

export const METRICS_DATA = [
  { value: 92, suffix: '%', label: 'AI 예측 정확도 (MAPE < 8%)', color: 'emerald' },
  { value: 92, suffix: '', label: '이상 탐지 F1 점수 (×100)', color: 'orange' },
  { value: 1200, suffix: '', label: '일일 절감량 (kWh)', color: 'yellow' },
  { value: 7.2, suffix: 'M', label: '월간 비용 절감 (₩)', color: 'blue' },
  { value: 15, suffix: '%', label: '에너지 효율 개선', color: 'green' },
  { value: 25, suffix: '%', label: '탄소 배출 감축', color: 'purple' },
  { value: 99.9, suffix: '%', label: '시스템 가용성 (Uptime)', color: 'cyan' },
] as const;

export const TESTIMONIALS = [
  {
    id: 1,
    name: '김철수',
    role: 'A사 에너지 관리팀장',
    avatar: 'A',
    color: 'emerald',
    text: '"AI 예측으로 피크 부하를 20% 감축하고 월 900만원을 절감했습니다. ROI가 18개월에 불과했어요."',
  },
  {
    id: 2,
    name: '이영희',
    role: 'B사 ESG 담당자',
    avatar: 'B',
    color: 'blue',
    text: '"탄소 배출량 자동 계산으로 K-ETS 보고서 작성 시간이 90% 단축되었습니다. 정말 편리합니다."',
  },
  {
    id: 3,
    name: '박민수',
    role: 'C사 시설관리 이사',
    avatar: 'C',
    color: 'purple',
    text: '"이상 탐지로 설비 고장을 사전에 방지해 연간 5,000만원의 유지보수 비용을 절감했습니다."',
  },
] as const;

export const FOOTER_LINKS = {
  products: [
    { label: '기능', href: '/features' },
    { label: '가격', href: '/pricing' },
    { label: '평가판', href: '/trial' },
    { label: 'API', href: '/docs/api' },
  ],
  solutions: [
    { label: '제조업', href: '/solutions/manufacturing' },
    { label: '빌딩', href: '/solutions/building' },
    { label: '데이터센터', href: '/solutions/datacenter' },
    { label: '산업단지', href: '/solutions/industrial' },
  ],
  support: [
    { label: '문서', href: '/docs' },
    { label: 'API 문서', href: '/docs/api' },
    { label: '커뮤니티', href: '/community' },
    { label: '고객센터', href: '/support' },
  ],
  legal: [
    { label: '개인정보처리방침', href: '/legal/privacy' },
    { label: '이용약관', href: '/legal/terms' },
    { label: '보안정책', href: '/legal/security' },
  ],
  social: [
    { platform: 'facebook', href: 'https://facebook.com/energyai', ariaLabel: 'Facebook' },
    { platform: 'twitter', href: 'https://twitter.com/energyai', ariaLabel: 'Twitter' },
  ],
} as const;

export const TRUST_BADGES = [
  { icon: 'Shield', label: '엔터프라이즈급 보안' },
  { icon: 'Users', label: '1,000+ 고객사' },
  { icon: 'Award', label: 'ISO 27001 인증' },
] as const;
