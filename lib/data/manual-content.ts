/**
 * lib/data/manual-content.ts
 *
 * 사용자 매뉴얼 단일 소스 (Single Source of Truth)
 * - app/(tenant)/manual/page.tsx (UI)
 * - app/api/manual/pdf/route.ts  (PDF 생성)
 * 두 곳에서 동일하게 임포트합니다.
 *
 * 콘텐츠 블록 타입:
 *   p      - 본문 문단
 *   steps  - 번호 있는 순서 절차
 *   list   - 글머리 기호 목록
 *   tip    - 참고/팁 박스
 *   warn   - 주의 박스
 *   roles  - 역할 테이블 (role + desc 쌍)
 */

export type Block =
  | { type: 'p'; text: string }
  | { type: 'steps'; items: string[] }
  | { type: 'list'; items: string[] }
  | { type: 'tip'; text: string }
  | { type: 'warn'; text: string }
  | { type: 'roles'; items: { role: string; desc: string }[] };

export interface Article {
  id: string;
  title: string;
  description: string; // 목록·검색용 한 줄 요약
  body: Block[];
}

export interface Chapter {
  id: string;
  title: string;
  icon: string;         // lucide-react 아이콘 이름
  color: string;        // tailwind text-* 클래스
  articles: Article[];
}

export interface ManualData {
  version: string;
  updatedAt: string;    // ISO date string
  chapters: Chapter[];
}

export const MANUAL_DATA: ManualData = {
  version: '2.0',
  updatedAt: '2026-02-20',
  chapters: [
    // ──────────────────────────────────────────────
    // 1. 시작하기
    // ──────────────────────────────────────────────
    {
      id: 'getting-started',
      title: '시작하기',
      icon: 'BookOpen',
      color: 'text-cyan-400',
      articles: [
        {
          id: 'overview',
          title: '시스템 개요',
          description: 'EMS AIoT 시스템의 전체 구조와 주요 기능을 설명합니다.',
          body: [
            {
              type: 'p',
              text: 'EMS AIoT는 AI 기반 에너지 관리 플랫폼으로, 제조업·빌딩·데이터센터를 위한 탄소중립 SaaS 솔루션입니다.',
            },
            {
              type: 'list',
              items: [
                '실시간 에너지 모니터링 — MQTT/HTTP 수집 → 초 단위 갱신',
                'AI 부하 예측 — 24h/7d/30d 수요 예측',
                '이상 탐지 — 정상 패턴 이탈 자동 감지',
                '설비 자동 제어 — 스케줄·DR·AI 최적 제어',
                '탄소 배출 관리 — Scope 1/2/3 자동 계산',
                'K-ETS 배출권 거래소 — KAU/KCU/OFFSET 포트폴리오',
                '수요반응(DR) 참여 — 한전 이벤트 자동 대응',
              ],
            },
            {
              type: 'tip',
              text: '멀티 테넌트 아키텍처로 복수의 사업장과 부서를 하나의 플랫폼에서 통합 관리할 수 있습니다.',
            },
          ],
        },
        {
          id: 'initial-setup',
          title: '초기 설정 가이드',
          description: '사이트 등록, 디바이스 연결, 센서 설정 방법을 안내합니다.',
          body: [
            { type: 'p', text: '처음 플랫폼에 접속하면 아래 순서로 초기 설정을 진행합니다.' },
            {
              type: 'steps',
              items: [
                '테넌트 계정 생성 후 설정 > 시스템에서 회사명·업종·사업장 정보를 입력합니다.',
                '운영 관리 > 사이트 관리에서 사업장(Site)을 1개 이상 등록합니다.',
                '운영 관리 > 디바이스 관리에서 각 사이트에 계측기·센서를 연결합니다.',
                'MQTT 브로커(mqtt://host:1883) 또는 REST API로 실시간 데이터 수집을 설정합니다.',
                '설정 > 알림에서 피크 초과·설비 고장 알림 규칙을 설정합니다.',
              ],
            },
            {
              type: 'tip',
              text: '디바이스가 없을 경우 분석 > 절감 시뮬레이터에서 가상 데이터로 기능을 체험할 수 있습니다.',
            },
          ],
        },
        {
          id: 'user-roles',
          title: '사용자 역할 및 권한',
          description: '뷰어, 운영자, 관리자 등 역할별 접근 권한을 설명합니다.',
          body: [
            { type: 'p', text: '플랫폼은 5단계 역할 기반 접근 제어(RBAC)를 사용합니다.' },
            {
              type: 'roles',
              items: [
                { role: '뷰어 (Viewer)', desc: '대시보드·분석·리포트 조회만 가능. 제어·설정 변경 불가.' },
                { role: '운영자 (Operator)', desc: '뷰어 권한 + 수동 제어·스케줄 관리·알림 설정 가능.' },
                { role: '사이트 관리자 (Site Manager)', desc: '운영자 권한 + 사이트·디바이스·센서 관리.' },
                { role: '테넌트 관리자 (Tenant Admin)', desc: '사이트 관리자 권한 + 사용자 초대·구독·결제 관리.' },
                { role: '슈퍼 관리자 (Super Admin)', desc: '전체 테넌트 생성·정지, 플랫폼 설정 관리.' },
              ],
            },
            {
              type: 'warn',
              text: '역할 변경은 테넌트 관리자 이상 권한을 가진 사용자만 수행할 수 있습니다.',
            },
          ],
        },
        {
          id: 'login',
          title: '로그인 및 인증',
          description: 'Google OAuth, Naver 로그인, 이메일 인증 방법을 안내합니다.',
          body: [
            { type: 'p', text: '다음 세 가지 로그인 방식을 지원합니다.' },
            {
              type: 'list',
              items: [
                '이메일 / 비밀번호 — 가입 시 설정한 이메일과 비밀번호로 로그인',
                'Google OAuth — "Google로 로그인" 버튼 클릭 후 Google 계정 인증',
                'Naver OAuth — "Naver로 로그인" 버튼 클릭 후 네이버 계정 인증',
              ],
            },
            {
              type: 'steps',
              items: [
                '비밀번호 분실 시 로그인 페이지 하단 "비밀번호 찾기"를 클릭합니다.',
                '가입 시 사용한 이메일 주소를 입력합니다.',
                '수신된 재설정 링크를 클릭하여 새 비밀번호를 설정합니다. (링크 유효 시간: 1시간)',
              ],
            },
            {
              type: 'tip',
              text: '보안을 위해 세션은 24시간 후 자동 만료됩니다. 장기 자동화 연동에는 API 키를 사용하세요.',
            },
          ],
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 2. 모니터링
    // ──────────────────────────────────────────────
    {
      id: 'monitoring',
      title: '모니터링',
      icon: 'Monitor',
      color: 'text-emerald-400',
      articles: [
        {
          id: 'dashboard',
          title: '종합 모니터링 대시보드',
          description: '전력 사용량, 설비 상태, KPI를 실시간으로 확인합니다.',
          body: [
            { type: 'p', text: '메인 대시보드는 전체 사업장의 핵심 지표를 한 화면에 표시합니다.' },
            {
              type: 'list',
              items: [
                '상단 KPI 카드: 총 소비 전력(kW), 오늘 사용량(kWh), 설비 가동률(%), 탄소 배출(tCO₂)',
                '월별 소비량 막대 그래프 — 목표 대비 실적 비교',
                '시간대별 부하 추이 — 피크 구간 강조 표시',
                '비용 분석 — 기본요금 + 전력량 요금 + 피크요금 분리 표시',
                '신재생 에너지 — 태양광·풍력·ESS 발전량 현황',
              ],
            },
            {
              type: 'tip',
              text: '대시보드 데이터는 30초마다 자동 갱신됩니다. 우상단 새로고침 버튼으로 수동 갱신도 가능합니다.',
            },
          ],
        },
        {
          id: 'realtime',
          title: '실시간 데이터 현황',
          description: '실시간 전력 소비 그래프와 피크 관리 방법을 설명합니다.',
          body: [
            { type: 'p', text: '대시보드 > 실시간 현황에서 초 단위 갱신 데이터를 확인합니다.' },
            {
              type: 'list',
              items: [
                '현재 전력(kW) 및 오늘 누적 사용량(kWh)',
                '피크 대비 현재 부하율(%) — 90% 초과 시 경고',
                '예상 월 전기요금 실시간 계산',
                '센서별 최신값·이상 여부·마지막 통신 시간',
              ],
            },
            {
              type: 'warn',
              text: '피크 전력 임박 시 화면 상단에 빨간 경고 배너가 표시됩니다. 즉시 부하 이동 또는 수동 제어를 검토하세요.',
            },
          ],
        },
        {
          id: 'pipeline',
          title: '데이터 수집 상태 (파이프라인)',
          description: '센서/디바이스 연결 상태와 데이터 품질 모니터링 방법입니다.',
          body: [
            { type: 'p', text: '모니터링 > 파이프라인에서 데이터 수집 파이프라인 전체 상태를 확인합니다.' },
            {
              type: 'list',
              items: [
                'MQTT / HTTP 연결 상태 (온라인 / 오프라인 / 오류)',
                '데이터 지연(Latency ms) 및 누락 비율(%)',
                '최근 1시간 수신 레코드 수',
                '품질 등급별 분포 (good / uncertain / bad)',
              ],
            },
            {
              type: 'tip',
              text: '특정 디바이스가 오프라인이면 설비 관리 페이지에서 연결 설정을 확인하세요.',
            },
          ],
        },
        {
          id: 'equipment',
          title: '설비 모니터링',
          description: '개별 설비의 가동 상태와 에너지 소비를 확인합니다.',
          body: [
            { type: 'p', text: '운영 관리 > 디바이스 관리에서 설비 단위 모니터링을 수행합니다.' },
            {
              type: 'list',
              items: [
                '설비 목록: 이름·종류·상태 (운전/정지/오류/유지보수)',
                '실시간 소비 전력 및 누적 에너지',
                '이상 감지 시 빨간 경고 뱃지 표시',
                '설비 클릭 → 상세 측정값·제어 이력 확인',
              ],
            },
          ],
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 3. 분석 & 예측
    // ──────────────────────────────────────────────
    {
      id: 'analytics',
      title: '분석 & 예측',
      icon: 'BarChart3',
      color: 'text-yellow-400',
      articles: [
        {
          id: 'energy-analysis',
          title: '에너지 분석',
          description: '기간별 전력 사용량 추이, 피크 분석, 부하율을 확인합니다.',
          body: [
            { type: 'p', text: '분석 > 에너지에서 다양한 기간별 에너지 소비를 분석합니다.' },
            {
              type: 'list',
              items: [
                '기간 선택: 시간 / 일 / 주 / 월 / 연간',
                '사이트·디바이스 필터로 특정 구역만 조회',
                '피크 분석: 최대·최소·평균 전력, 부하율',
                '전월/전년 대비 비교 차트',
              ],
            },
          ],
        },
        {
          id: 'cost-analysis',
          title: '비용 분석',
          description: '전력 요금 구성, 시간대별 비용, 절감 가능 금액을 분석합니다.',
          body: [
            { type: 'p', text: '분석 > 비용에서 전기요금을 구성 항목별로 분석합니다.' },
            {
              type: 'list',
              items: [
                '요금 구성: 기본요금 + 전력량 요금 + 피크요금 + 부가세',
                '시간대별(경부하·중간부하·최대부하) 비용 분포',
                '절감 가능 금액 추정 (피크 회피 효과)',
                '요금제 시뮬레이션으로 최적 계약 전력 산정',
              ],
            },
          ],
        },
        {
          id: 'anomaly',
          title: '이상 탐지',
          description: 'AI 기반 에너지 사용 이상 패턴 탐지 기능을 설명합니다.',
          body: [
            { type: 'p', text: 'AI 모델이 정상 소비 패턴을 학습하여 이상 징후를 자동으로 감지합니다.' },
            {
              type: 'list',
              items: [
                '이상 탐지 목록: 날짜·심각도·대상 설비·편차율',
                '원인 분석 힌트 제공 (예: 영업외 시간 가동, 급격한 소비 증가)',
                '이상 항목 클릭 → 해당 시점 측정 데이터 상세 조회',
              ],
            },
            {
              type: 'tip',
              text: '이상 탐지 정확도는 실제 측정 데이터가 2주 이상 쌓인 후 높아집니다.',
            },
          ],
        },
        {
          id: 'simulator',
          title: '절감 시뮬레이터',
          description: 'LED, HVAC, 태양광 등 시나리오별 절감 효과를 시뮬레이션합니다.',
          body: [
            { type: 'p', text: '절감 시나리오를 선택하여 예상 절감량과 투자 회수 기간(ROI)을 계산합니다.' },
            {
              type: 'list',
              items: [
                'LED 조명 교체 — 조명 부하 기준 절감률 계산',
                'HVAC 최적화 — 설정 온도 조정 시 예상 절감',
                '태양광 발전 설치 — 설비 용량 대비 자가 발전 비율',
                'ESS 도입 — 피크 전력 절감 및 요금 최적화',
              ],
            },
          ],
        },
        {
          id: 'carbon',
          title: '탄소 분석 & 배출권 거래소',
          description: 'Scope 1/2/3 탄소 배출 관리와 K-ETS 배출권 거래를 설명합니다.',
          body: [
            {
              type: 'p',
              text: '분석 > 탄소 분석에서 온실가스 배출량을 Scope별로 관리합니다.',
            },
            {
              type: 'list',
              items: [
                'Scope 1: 직접 연소 (경유·LNG·LPG 등)',
                'Scope 2: 간접 배출 (구매 전력 소비)',
                'Scope 3: 기타 간접 (운송·출장 등)',
                '월별 배출 추이, 전년 대비 감축률 자동 계산',
              ],
            },
            {
              type: 'p',
              text: '탄소배출권 거래소 탭에서 K-ETS 크레딧 포트폴리오를 관리합니다.',
            },
            {
              type: 'list',
              items: [
                'KAU / KCU / OFFSET 크레딧 매수 및 보유 현황',
                '크레딧 소각(Retire)으로 배출량 직접 상계',
                '탄소중립 로드맵 탭에서 연도별 감축 목표 설정 및 달성률 추적',
              ],
            },
          ],
        },
        {
          id: 'download',
          title: '데이터 다운로드',
          description: '수집 데이터를 CSV, Excel, JSON으로 내보내는 방법입니다.',
          body: [
            { type: 'p', text: '분석 > 데이터 다운로드에서 원하는 형식으로 측정 데이터를 내보냅니다.' },
            {
              type: 'steps',
              items: [
                '기간(시작일~종료일)을 선택합니다.',
                '사이트·메트릭 필터를 적용합니다.',
                '출력 형식(CSV / Excel / JSON)을 선택합니다.',
                '"다운로드" 버튼을 클릭하면 파일이 즉시 생성됩니다.',
              ],
            },
            {
              type: 'tip',
              text: '파일명은 [EMS]_원시데이터_YYYYMMDD_HHMM.csv 형식으로 자동 지정됩니다.',
            },
          ],
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 4. 설비 제어
    // ──────────────────────────────────────────────
    {
      id: 'control',
      title: '설비 제어',
      icon: 'Zap',
      color: 'text-blue-400',
      articles: [
        {
          id: 'manual-control',
          title: '수동 제어',
          description: '개별 설비에 직접 제어 명령을 보내는 방법을 설명합니다.',
          body: [
            { type: 'p', text: '설비 제어 > 수동 제어에서 개별 설비에 즉시 명령을 전송합니다.' },
            {
              type: 'steps',
              items: [
                '설비 목록에서 제어할 디바이스를 선택합니다.',
                '동작(ON / OFF / 출력 조절 등)을 선택합니다.',
                '"제어 실행" 버튼을 클릭합니다.',
                '명령 전송 결과(성공/실패/타임아웃)가 즉시 표시됩니다.',
              ],
            },
            {
              type: 'warn',
              text: '모든 제어 명령은 감사 추적 로그에 자동 기록됩니다. 승인이 필요한 제어는 관리자 확인 후 실행됩니다.',
            },
          ],
        },
        {
          id: 'schedule',
          title: '스케줄 제어',
          description: '시간 기반 자동 제어 스케줄을 설정하는 방법입니다.',
          body: [
            { type: 'p', text: '설비 제어 > 스케줄에서 반복 제어 스케줄을 등록합니다.' },
            {
              type: 'list',
              items: [
                '일회성 / 매일 / 매주 / Cron 표현식 반복 방식 지원',
                '대상 설비·제어 동작·파라미터 설정',
                '우선순위(1~10) 설정 — 충돌 시 높은 순위 우선',
                '활성화/비활성화 토글로 임시 중지 가능',
              ],
            },
            {
              type: 'tip',
              text: '예) 평일 22시 조명 소등: 반복=매주, 요일=월~금, 시간=22:00, 동작=OFF',
            },
          ],
        },
        {
          id: 'ai-optimize',
          title: 'AI 최적 제어',
          description: 'AI가 에너지 효율을 최적화하는 자동 제어 기능입니다.',
          body: [
            {
              type: 'p',
              text: '설비 제어 > 최적화에서 AI 엔진이 생성한 운전 최적화 전략을 확인하고 적용합니다.',
            },
            {
              type: 'list',
              items: [
                '피크 회피: 피크 시간대 자동 부하 이동',
                '부하 이동: 낮은 요금대로 에너지 소비 이전',
                'ESS 최적 충·방전: 충방전 시점 자동 결정',
                '권장 조치를 선택 후 "적용" 클릭으로 즉시 실행',
              ],
            },
          ],
        },
        {
          id: 'dr',
          title: '수요반응(DR) 참여',
          description: '수요반응 이벤트 참여 및 관리 방법을 안내합니다.',
          body: [
            { type: 'p', text: '설비 제어 > 수요반응에서 DR 이벤트를 관리합니다.' },
            {
              type: 'list',
              items: [
                'DR 이벤트 목록: 상태(예정/진행/완료/취소), 목표 감축량, 인센티브',
                '이벤트 실행: 감축 명령 전송 및 실시간 달성률 확인',
                'DR 성과 요약: 참여 횟수, 총 감축량(kWh), 보상금 합계',
              ],
            },
            {
              type: 'tip',
              text: '한국전력 DR 이벤트 발생 시 시스템이 자동으로 알림을 발송합니다. 알림 > 규칙에서 DR 카테고리 알림을 설정하세요.',
            },
          ],
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 5. 운영 관리
    // ──────────────────────────────────────────────
    {
      id: 'management',
      title: '운영 관리',
      icon: 'Settings',
      color: 'text-purple-400',
      articles: [
        {
          id: 'notifications',
          title: '알림 설정',
          description: '이메일, SMS, 웹훅 알림 규칙 설정 방법입니다.',
          body: [
            { type: 'p', text: '설정 > 알림에서 이상 상황 발생 시 즉시 통보받을 규칙을 설정합니다.' },
            {
              type: 'list',
              items: [
                '알림 채널: 이메일 / SMS / 웹훅(Webhook) / 푸시 알림',
                '카테고리: 에너지 / 설비 / 시스템 / 보안 / DR / 탄소 / 비용',
                '심각도: 정보(info) / 경고(warning) / 위험(critical)',
                '임계값 조건: 초과(>), 이상(≥), 미만(<), 이하(≤), 같음(=)',
              ],
            },
            {
              type: 'tip',
              text: '"테스트 발송" 버튼으로 규칙 저장 전 알림이 정상 수신되는지 확인하세요.',
            },
          ],
        },
        {
          id: 'api-keys',
          title: 'API 키 관리',
          description: '외부 시스템 연동을 위한 API 키 생성 및 관리 방법입니다.',
          body: [
            { type: 'p', text: '설정 > API 키에서 외부 시스템 연동용 키를 발급합니다.' },
            {
              type: 'steps',
              items: [
                '"새 API 키 발급" 버튼을 클릭합니다.',
                '키 이름, 권한 범위(읽기/쓰기), 만료일을 설정합니다.',
                '"발급" 클릭 후 표시된 키를 즉시 복사합니다. (재확인 불가)',
                '외부 시스템 요청 시 Authorization: Bearer ea_live_... 헤더로 전송합니다.',
              ],
            },
            {
              type: 'warn',
              text: 'API 키는 발급 직후 한 번만 표시됩니다. 분실 시 재발급이 필요하며 기존 키는 즉시 무효화됩니다.',
            },
          ],
        },
        {
          id: 'subscription',
          title: '구독 관리',
          description: '플랜 변경, 결제 이력, 사용량 확인 방법입니다.',
          body: [
            { type: 'p', text: '설정 > 구독 관리에서 현재 플랜과 결제 상태를 확인합니다.' },
            {
              type: 'list',
              items: [
                '현재 플랜: Trial / Basic / Pro / Enterprise',
                '사용 현황: 사이트 수 / 디바이스 수 / 사용자 수',
                '결제 이력: 일자·금액·상태(완료/실패/환불)',
                '플랜 변경: 상위 플랜 즉시 업그레이드, 하위 플랜은 만료 후 적용',
              ],
            },
            {
              type: 'tip',
              text: '부가가치세(VAT) 10%는 표시 금액에 별도 부과됩니다. 사업자 등록번호 입력 시 세금계산서가 발행됩니다.',
            },
          ],
        },
      ],
    },

    // ──────────────────────────────────────────────
    // 6. 규제 & 컴플라이언스
    // ──────────────────────────────────────────────
    {
      id: 'compliance',
      title: '규제 & 컴플라이언스',
      icon: 'Shield',
      color: 'text-amber-400',
      articles: [
        {
          id: 'audit-trail',
          title: '감사 추적',
          description: '시스템 활동 기록 조회 및 감사 로그 관리 방법입니다.',
          body: [
            {
              type: 'p',
              text: '규제/컴플라이언스 > 감사 추적에서 모든 시스템 활동 이력을 조회합니다.',
            },
            {
              type: 'list',
              items: [
                '기록 대상: 로그인/로그아웃, 제어 명령, 사용자 관리, 설정 변경',
                '필터: 기간·사용자·액션 유형·대상',
                '엑셀 내보내기 지원',
              ],
            },
            {
              type: 'warn',
              text: '감사 로그는 최소 2년간 보존되며 수정 및 삭제가 불가합니다. (법적 증거 효력)',
            },
          ],
        },
        {
          id: 'emission-factors',
          title: '배출계수 관리',
          description: '탄소 배출 계산에 사용되는 배출계수 설정 방법입니다.',
          body: [
            { type: 'p', text: '탄소 배출량 계산에 사용할 배출계수를 테넌트별로 설정합니다.' },
            {
              type: 'list',
              items: [
                '기본 배출계수: 한국 전력(0.4593 tCO₂/MWh), 경유(2.68 tCO₂/kL) 등 시스템 기본값 제공',
                '사용자 정의: 테넌트별 실측 배출계수 등록 가능',
                '버전 관리: 연도·지역·유효 기간 추적',
              ],
            },
          ],
        },
        {
          id: 'reports',
          title: '규제 리포트',
          description: '법정 보고서 생성 및 제출 관리 방법을 설명합니다.',
          body: [
            { type: 'p', text: '리포트 메뉴에서 에너지·탄소·비용 리포트를 PDF·Excel로 생성합니다.' },
            {
              type: 'list',
              items: [
                '온실가스 명세서 (Scope 1/2/3)',
                'RE100 진행 현황 리포트',
                '에너지관리공단 제출용 에너지사용 현황',
                'ISO 14064 감사 대응 자료',
              ],
            },
            {
              type: 'steps',
              items: [
                '리포트 종류와 기간을 선택합니다.',
                '출력 형식(PDF / Excel)을 선택합니다.',
                '"생성" 버튼 클릭 후 완료되면 자동 다운로드됩니다.',
              ],
            },
          ],
        },
      ],
    },
  ],
};

// ──────────────────────────────────────────────
// 유틸리티 함수
// ──────────────────────────────────────────────

/** 챕터 ID로 챕터 조회 */
export function getChapter(chapterId: string): Chapter | undefined {
  return MANUAL_DATA.chapters.find((c) => c.id === chapterId);
}

/** 챕터 ID + 아티클 ID로 아티클 조회 */
export function getArticle(
  chapterId: string,
  articleId: string
): Article | undefined {
  return getChapter(chapterId)?.articles.find((a) => a.id === articleId);
}

/** 이전 / 다음 아티클 (챕터 경계 넘어서 탐색) */
export function getAdjacentArticles(
  chapterId: string,
  articleId: string
): { prev: { chapterId: string; article: Article } | null; next: { chapterId: string; article: Article } | null } {
  const flat: { chapterId: string; article: Article }[] = [];
  for (const chapter of MANUAL_DATA.chapters) {
    for (const article of chapter.articles) {
      flat.push({ chapterId: chapter.id, article });
    }
  }
  const idx = flat.findIndex(
    (f) => f.chapterId === chapterId && f.article.id === articleId
  );
  return {
    prev: idx > 0 ? flat[idx - 1]! : null,
    next: idx < flat.length - 1 ? flat[idx + 1]! : null,
  };
}

/** 전체 콘텐츠 검색 (챕터 제목 + 아티클 제목 + description + 본문 텍스트) */
export interface SearchResult {
  chapterId: string;
  chapterTitle: string;
  article: Article;
  matchIn: 'title' | 'description' | 'body';
}

export function searchManual(query: string): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const chapter of MANUAL_DATA.chapters) {
    for (const article of chapter.articles) {
      if (article.title.toLowerCase().includes(q)) {
        results.push({ chapterId: chapter.id, chapterTitle: chapter.title, article, matchIn: 'title' });
        continue;
      }
      if (article.description.toLowerCase().includes(q)) {
        results.push({ chapterId: chapter.id, chapterTitle: chapter.title, article, matchIn: 'description' });
        continue;
      }
      const bodyMatch = article.body.some((b) => {
        if (b.type === 'p' || b.type === 'tip' || b.type === 'warn') return b.text.toLowerCase().includes(q);
        if (b.type === 'steps' || b.type === 'list') return b.items.some((i) => i.toLowerCase().includes(q));
        if (b.type === 'roles') return b.items.some((i) => i.role.toLowerCase().includes(q) || i.desc.toLowerCase().includes(q));
        return false;
      });
      if (bodyMatch) {
        results.push({ chapterId: chapter.id, chapterTitle: chapter.title, article, matchIn: 'body' });
      }
    }
  }
  return results;
}
