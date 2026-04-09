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
  description: string;
  body: Block[];
}

export interface Chapter {
  id: string;
  title: string;
  icon: string;
  color: string;
  articles: Article[];
}

export interface ManualData {
  version: string;
  updatedAt: string;
  chapters: Chapter[];
}

export const MANUAL_DATA: ManualData = {
  version: '3.0',
  updatedAt: '2026-04-08',
  chapters: [

    // ══════════════════════════════════════════════
    // 1. 시작하기
    // ══════════════════════════════════════════════
    {
      id: 'getting-started',
      title: '시작하기',
      icon: 'BookOpen',
      color: 'text-cyan-400',
      articles: [
        {
          id: 'overview',
          title: '시스템 개요',
          description: '탄소이음 시스템의 전체 구조와 주요 기능을 설명합니다.',
          body: [
            {
              type: 'p',
              text: '탄소이음은 에너지 데이터로 탄소중립을 실현하는 구독형 에너지 관리 SaaS 플랫폼입니다. 제조업·빌딩·데이터센터를 위한 AI 기반 에너지 관리 솔루션입니다.',
            },
            {
              type: 'list',
              items: [
                '실시간 에너지 모니터링 — Modbus/BACnet/OPC-UA/MQTT 수집 → 초 단위 갱신',
                'AI 부하 예측 — 24h/7d/30d 수요 예측',
                '이상 탐지 — 정상 패턴 이탈 자동 감지',
                '설비 자동 제어 — 스케줄·DR·AI 최적 제어',
                '탄소 배출 관리 — Scope 1/2/3 자동 계산 및 K-ETS 배출권 거래소',
                '수요반응(DR) 참여 — 한전 이벤트 자동 대응',
                'ESG 보고서 — TCFD·EU CSRD·ISSB·CDP·K-MRV 다중 기준 자동 생성',
              ],
            },
            {
              type: 'tip',
              text: '멀티 테넌트 아키텍처로 복수의 사업장과 부서를 하나의 플랫폼에서 통합 관리할 수 있습니다.',
            },
          ],
        },
        {
          id: 'plans',
          title: '구독 플랜 안내',
          description: 'Starter·Basic·Pro·Enterprise 플랜 차이와 선택 기준을 설명합니다.',
          body: [
            {
              type: 'p',
              text: '탄소이음은 네 가지 구독 플랜을 제공합니다. 사업장 규모와 IoT 연동 필요 여부에 따라 선택하세요.',
            },
            {
              type: 'roles',
              items: [
                { role: 'Starter (무료)', desc: '소프트웨어 전용 체험 플랜. IoT 하드웨어 미지원. 고지서 업로드·수동 입력으로 에너지 데이터를 관리합니다. 사이트 1개, 사용자 3명.' },
                { role: 'Basic (₩149,000/월)', desc: '소규모 사업장 IoT 연동. IoT 디바이스 최대 30개, 사이트 3개, 사용자 10명, 1년 데이터 보존. 초기 설치비 별도(₩500,000~).' },
                { role: 'Pro (₩399,000/월)', desc: '중견 기업 이상. IoT 디바이스 최대 150개, 사이트 10개, 사용자 50명, 2년 데이터 보존, 탄소 분석·이상 탐지·AI 제어 포함. 초기 설치비 별도(₩1,800,000~).' },
                { role: 'Enterprise (별도 협의)', desc: '디바이스·사용자 무제한, 무제한 데이터 보존, 전담 기술지원, SLA 보장, API 무제한, 맞춤형 ESG 보고서.' },
              ],
            },
            {
              type: 'warn',
              text: 'Starter 플랜은 IoT 하드웨어(게이트웨이·CT센서)가 지원되지 않습니다. IoT 연동이 필요하면 Basic 이상으로 업그레이드하세요.',
            },
            {
              type: 'tip',
              text: '연간 결제 시 약 2개월분 할인이 적용됩니다. Basic 연간 ₩1,490,000 / Pro 연간 ₩3,990,000.',
            },
          ],
        },
        {
          id: 'onboarding',
          title: '온보딩 및 초기 설정',
          description: '가입 후 첫 사용을 위한 단계별 설정 절차를 안내합니다.',
          body: [
            { type: 'p', text: '가입 완료 후 좌측 메뉴 하단의 "온보딩" 또는 대시보드 안내 배너를 통해 초기 설정을 진행합니다.' },
            {
              type: 'steps',
              items: [
                '계정 설정: 회사명·업종·담당자 이름·연락처를 입력합니다.',
                '사이트 등록: 관리 > 사이트 관리에서 실제 사업장(공장·건물)을 1개 이상 등록합니다.',
                '데이터 연동 방법 선택: IoT 하드웨어 연결(Basic 이상) 또는 고지서·수동 입력(Starter)을 선택합니다.',
                'IoT 연동 시 — 설치 일정 예약: 담당자 연락처·주소·희망 날짜를 입력하면 기술팀이 방문하여 게이트웨이와 CT센서를 설치합니다.',
                '설치 완료 후 관리 > 게이트웨이 관리에서 장치가 온라인인지 확인합니다.',
                '알림 설정: 설정 > 알림에서 피크 초과·설비 오류 알림 규칙을 설정합니다.',
              ],
            },
            {
              type: 'tip',
              text: '설치 일정 예약 후 담당자 이메일로 예약 확인서가 발송됩니다. 설치 전까지는 데모 모드로 플랫폼 기능을 체험할 수 있습니다.',
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
                { role: '사이트 관리자 (Site Manager)', desc: '운영자 권한 + 사이트·설비·센서 관리.' },
                { role: '테넌트 관리자 (Tenant Admin)', desc: '사이트 관리자 권한 + 사용자 초대·구독·결제 관리.' },
                { role: '슈퍼 관리자 (Super Admin)', desc: '전체 테넌트 생성·정지, 플랫폼 전반 설정 관리.' },
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

    // ══════════════════════════════════════════════
    // 2. 모니터링
    // ══════════════════════════════════════════════
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
                'MQTT / HTTP / Modbus / BACnet 연결 상태 (온라인 / 오프라인 / 오류)',
                '데이터 지연(Latency ms) 및 누락 비율(%)',
                '최근 1시간 수신 레코드 수',
                '품질 등급별 분포 (good / uncertain / bad)',
              ],
            },
            {
              type: 'tip',
              text: '특정 디바이스가 오프라인이면 관리 > 설비 관리에서 프로토콜 연결 설정을 확인하세요.',
            },
          ],
        },
      ],
    },

    // ══════════════════════════════════════════════
    // 3. 분석 & 예측
    // ══════════════════════════════════════════════
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
          title: '이상 탐지 (Pro 이상)',
          description: 'AI 기반 에너지 사용 이상 패턴 탐지 기능을 설명합니다.',
          body: [
            { type: 'p', text: 'AI 모델이 정상 소비 패턴을 학습하여 이상 징후를 자동으로 감지합니다.' },
            {
              type: 'list',
              items: [
                '이상 탐지 목록: 날짜·심각도·대상 설비·편차율',
                '원인 분석 힌트 제공 (예: 영업외 시간 가동, 급격한 소비 증가)',
                '이상 항목 클릭 → 해당 시점 측정 데이터 상세 조회',
                '감도 조절 (민감도 슬라이더): 낮은 감도→주요 이상만, 높은 감도→세밀한 탐지',
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
          title: '탄소 분석 & 배출권 거래소 (Pro 이상)',
          description: 'Scope 1/2/3 탄소 배출 관리와 K-ETS 배출권 거래를 설명합니다.',
          body: [
            { type: 'p', text: '분석 > 탄소 분석에서 온실가스 배출량을 Scope별로 관리합니다.' },
            {
              type: 'list',
              items: [
                'Scope 1: 직접 연소 (경유·LNG·LPG 등)',
                'Scope 2: 간접 배출 (구매 전력 소비)',
                'Scope 3: 기타 간접 (운송·출장·원자재 등 15개 카테고리)',
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

    // ══════════════════════════════════════════════
    // 4. 설비 제어
    // ══════════════════════════════════════════════
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
              text: '모든 제어 명령은 감사 추적 로그에 자동 기록됩니다. 제어 가능으로 등록된 설비만 목록에 표시됩니다.',
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

    // ══════════════════════════════════════════════
    // 5. 관리
    // ══════════════════════════════════════════════
    {
      id: 'management',
      title: '관리',
      icon: 'Settings',
      color: 'text-purple-400',
      articles: [
        {
          id: 'sites',
          title: '사이트 관리',
          description: '사업장(공장·건물·캠퍼스)을 등록하고 관리합니다.',
          body: [
            { type: 'p', text: '관리 > 사이트 관리에서 에너지를 관리할 사업장을 등록합니다.' },
            {
              type: 'steps',
              items: [
                '"새 사이트 추가" 버튼을 클릭합니다.',
                '사이트명, 주소, 업종, 계약 전력(kW)을 입력합니다.',
                '저장 후 해당 사이트에 게이트웨이와 설비를 연결합니다.',
              ],
            },
            {
              type: 'tip',
              text: '플랜별 최대 사이트 수: Starter 1개 / Basic 3개 / Pro 10개 / Enterprise 무제한.',
            },
          ],
        },
        {
          id: 'gateways',
          title: '게이트웨이 관리',
          description: '현장 IoT 게이트웨이를 등록하고 네트워크 연결을 관리합니다.',
          body: [
            {
              type: 'p',
              text: '관리 > 게이트웨이 관리에서 현장에 설치된 게이트웨이 장치를 등록하고 상태를 모니터링합니다. 게이트웨이는 Modbus·BACnet·OPC-UA 등 현장 프로토콜을 인터넷으로 변환하는 역할을 합니다.',
            },
            {
              type: 'list',
              items: [
                '게이트웨이 정보: 시리얼 번호, 모델명, 펌웨어 버전, IP/MAC 주소, VPN 주소',
                '연결 방식: Ethernet(기본) / LTE(폴백) / WiFi 선택 가능',
                '상태 모니터링: 온라인/오프라인/오류, 마지막 Heartbeat 시각',
                '버퍼: 네트워크 장애 시 로컬 저장 용량(기본 100MB) 및 현재 버퍼 레코드 수',
                '소유권: 당사 제공(company) 또는 고객 자체 구매(customer)',
              ],
            },
            {
              type: 'steps',
              items: [
                '"게이트웨이 등록" 버튼을 클릭합니다.',
                '시리얼 번호(필수), 사이트, 이름, 모델, IP 주소 등을 입력합니다.',
                '설치일을 입력하고 저장합니다.',
                '현장 게이트웨이가 플랫폼에 접속하면 상태가 "온라인"으로 변경됩니다.',
              ],
            },
            {
              type: 'warn',
              text: '게이트웨이 삭제 시 연결된 설비의 게이트웨이 연결이 해제됩니다. 데이터 수집이 중단되므로 삭제 전 설비를 다른 게이트웨이에 연결하거나 직접 연결로 변경하세요.',
            },
          ],
        },
        {
          id: 'devices',
          title: '설비 관리 및 등록',
          description: '계량기·DDC·PLC·HVAC 등 IoT 설비를 프로토콜별로 등록합니다.',
          body: [
            {
              type: 'p',
              text: '관리 > 설비 관리에서 에너지 측정·제어 대상 설비를 등록합니다. 설비 등록 시 통신 프로토콜을 선택하면 해당 프로토콜에 맞는 연결 설정 항목이 자동으로 표시됩니다.',
            },
            {
              type: 'roles',
              items: [
                { role: 'Modbus TCP/IP', desc: 'IP 주소, Port(기본 502), Unit ID(슬레이브 주소 1-247), Timeout 설정. 가장 일반적인 산업용 전력계·인버터·ESS 통신.' },
                { role: 'Modbus RTU', desc: 'COM 포트(예: COM1, /dev/ttyS0), Baud Rate(9600~115200), Parity(None/Even/Odd), Stop Bits, Unit ID. RS-232/485 직렬 통신.' },
                { role: 'BACnet/IP', desc: 'IP 주소, UDP Port(기본 47808), Device Instance(고유 번호 0-4194303), Network Number. 건물 자동화 시스템(DDC·AHU·칠러) 표준.' },
                { role: 'BACnet MS/TP', desc: 'COM 포트, Baud Rate(9600~76800), MAC Address(0-127), Max Masters, Network Number. RS-485 기반 DDC 직렬 네트워크.' },
                { role: 'OPC-UA', desc: 'Endpoint URL(예: opc.tcp://192.168.1.100:4840), Security Policy, Namespace Index, 인증정보(선택). 고급 PLC·SCADA 시스템 연동.' },
                { role: 'MQTT', desc: 'Topic Prefix(예: ems/site01/device001), QoS(0/1/2), Poll Interval. 브로커는 게이트웨이 또는 시스템 설정에서 구성.' },
                { role: 'HTTP/REST', desc: 'Base URL, 인증 방식(없음/API Key/Basic/Bearer), Poll Interval. REST API를 제공하는 스마트 미터·IoT 기기 연동.' },
                { role: 'Modbus TCP (GW경유)', desc: '게이트웨이의 IP:Port를 입력하고 Unit ID는 RS-485 슬레이브 주소 사용. TCP Wrapper를 통해 RTU 장치에 접근.' },
              ],
            },
            {
              type: 'steps',
              items: [
                '"설비 등록" 버튼을 클릭합니다.',
                '[기본 정보] 탭: 설비명, 사이트, 게이트웨이(선택), 설비 유형, 제조사, 모델, 설치 위치를 입력합니다.',
                '[연결 설정] 탭: 통신 프로토콜을 선택하고, 표시되는 접속 정보(IP/포트/COM포트 등)를 입력합니다.',
                '[상세 정보] 탭: 폴링 주기(데이터 수집 간격), 설치일, 제어 가능 여부를 설정하고 등록 요약을 확인 후 "설비 등록"을 클릭합니다.',
              ],
            },
            {
              type: 'tip',
              text: '제어 가능 설비로 등록해야 수동 제어·스케줄 제어에서 해당 설비를 사용할 수 있습니다. 폴링 주기는 5초(기본)를 권장하며, 너무 짧으면 네트워크 부하가 증가합니다.',
            },
          ],
        },
        {
          id: 'sensors',
          title: '센서 관리',
          description: '설비에 부착된 물리 센서(전력계·온도·습도 등)를 등록합니다.',
          body: [
            {
              type: 'p',
              text: '관리 > 센서 관리에서 각 설비에 연결된 물리 센서를 등록합니다. 센서는 반드시 상위 설비(Device)에 속하며, IP/포트 설정 없이 측정 특성과 교정 정보만 등록합니다.',
            },
            {
              type: 'list',
              items: [
                '센서 유형: 전력계·전력량계·온도·습도·압력·유량·진동·가스·CO₂·조도',
                '측정 범위: 단위(kW, °C, % 등), 최소/최대 범위',
                '교정 정보: 최근 교정일, 다음 교정 예정일',
                '설치 위치: 예) 1층 전기실 2판넬',
                '상태: 온라인/오프라인/오류/유지보수',
              ],
            },
            {
              type: 'steps',
              items: [
                '"센서 등록" 버튼을 클릭합니다.',
                '연결할 상위 설비를 선택합니다.',
                '센서명, 유형, 단위, 측정 범위를 입력합니다.',
                '교정 일자와 설치 위치를 입력하고 저장합니다.',
              ],
            },
          ],
        },
        {
          id: 'users',
          title: '사용자 관리',
          description: '팀원 초대, 역할 변경, 계정 비활성화 방법을 안내합니다.',
          body: [
            { type: 'p', text: '관리 > 사용자 관리에서 조직 구성원의 플랫폼 접근을 관리합니다.' },
            {
              type: 'steps',
              items: [
                '"사용자 초대" 버튼을 클릭합니다.',
                '이메일 주소와 역할(뷰어/운영자/사이트 관리자)을 선택합니다.',
                '초대 메일이 발송되며, 수신자가 링크를 클릭하면 계정이 활성화됩니다.',
                '이미 등록된 사용자의 역할은 목록에서 바로 변경 가능합니다.',
              ],
            },
            {
              type: 'warn',
              text: '비활성화된 사용자는 로그인이 차단되지만 데이터는 보존됩니다. 완전 삭제는 슈퍼 관리자만 가능합니다.',
            },
          ],
        },
        {
          id: 'notifications',
          title: '알림 설정',
          description: '이메일, SMS, 카카오 알림 규칙 설정 방법입니다.',
          body: [
            { type: 'p', text: '설정 > 알림에서 이상 상황 발생 시 즉시 통보받을 규칙을 설정합니다.' },
            {
              type: 'list',
              items: [
                '알림 채널: 이메일 / SMS / 카카오 알림톡(채널 개설 후 활성화)',
                '카테고리: 에너지 / 설비 / 시스템 / 보안 / DR / 탄소 / 비용',
                '심각도: 정보(info) / 경고(warning) / 위험(critical)',
                '전화번호 등록: 설정 > 계정 > 전화번호 입력 후 SMS 수신 가능',
              ],
            },
            {
              type: 'tip',
              text: '"테스트 발송" 버튼으로 규칙 저장 전 이메일·SMS가 정상 수신되는지 확인하세요. 전화번호가 등록되지 않으면 SMS 테스트 발송이 비활성화됩니다.',
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
          title: '구독 및 결제 관리',
          description: '플랜 변경, 결제(토스/Stripe), 설치비 청구 방법입니다.',
          body: [
            { type: 'p', text: '설정 > 구독 관리에서 현재 플랜과 결제 상태를 확인하고 업그레이드합니다.' },
            {
              type: 'list',
              items: [
                '현재 플랜: Starter(무료) / Basic(₩149,000) / Pro(₩399,000) / Enterprise',
                '결제 수단: 토스페이먼츠(국내 카드) 또는 Stripe(해외 카드/VISA/MasterCard)',
                '결제 주기: 월간 또는 연간(할인 적용) 선택 가능',
                '사용 현황: 사이트 수 / 디바이스 수 / 사용자 수',
              ],
            },
            {
              type: 'p',
              text: 'IoT 하드웨어 초기 설치비(Basic ₩500,000~, Pro ₩1,800,000~)는 구독과 별도로 청구됩니다.',
            },
            {
              type: 'list',
              items: [
                '설치비 청구 방식: 현장 방문 후 세금계산서 발행 → 계좌이체',
                '하드웨어(게이트웨이·CT센서) 비용은 별도 견적',
                '설치 일정은 온보딩 > IoT 연동 탭에서 예약',
              ],
            },
            {
              type: 'tip',
              text: 'VAT(부가가치세) 10%는 표시 금액에 별도 부과됩니다. 사업자 등록번호 입력 시 세금계산서가 자동 발행됩니다.',
            },
          ],
        },
      ],
    },

    // ══════════════════════════════════════════════
    // 6. 규제 & 컴플라이언스
    // ══════════════════════════════════════════════
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
                '기록 대상: 로그인/로그아웃, 제어 명령, 사용자 관리, 설정 변경, 결제',
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
                '배출계수 이력은 SHA-256 해시 체인으로 무결성 보장 (Big4 감사 대응)',
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
                '온실가스 명세서 (Scope 1/2/3) — GHG Protocol, K-MRV 기준',
                'ESG 보고서 — TCFD, EU CSRD(ESRS E1), US SEC Climate, ISSB(IFRS S2), CDP',
                'RE100 진행 현황 리포트',
                '에너지관리공단 제출용 에너지사용 현황',
                'ISO 14064 / K-ETS 감사 대응 자료',
              ],
            },
            {
              type: 'steps',
              items: [
                '리포트 종류와 기간을 선택합니다.',
                '출력 형식(PDF / Excel / JSON)을 선택합니다.',
                '"생성" 버튼 클릭 후 완료되면 자동 다운로드됩니다.',
                'ESG 보고서는 승인 워크플로우(초안→검토→승인→발행) 후 발행됩니다.',
              ],
            },
            {
              type: 'tip',
              text: 'ESG 보고서는 SHA-256 무결성 서명이 포함되어 Big4 감사 대응이 가능합니다. 보고서 발행 후 내용 변경이 불가합니다.',
            },
          ],
        },
        {
          id: 'regulatory-sandbox',
          title: '규제 샌드박스',
          description: '신기술·신서비스 규제 특례 신청 및 심사 현황 관리 방법입니다.',
          body: [
            {
              type: 'p',
              text: '관리 > 규제 샌드박스에서 신기술·에너지 서비스의 규제 특례를 신청하고 심사 현황을 추적합니다.',
            },
            {
              type: 'list',
              items: [
                '신청 가능 유형: P2P 전력 거래, 수요반응(DR) 자동화, RE100 PPA 중개, K-ETS 탄소 토큰화, 신규 EMS 서비스',
                '신청 상태: 접수(Pending) → 검토중(Reviewing) → 승인(Approved) / 반려(Rejected)',
                '승인 후 특례 만료일 관리 — 만료 30일 전 알림 자동 발송',
              ],
            },
            {
              type: 'warn',
              text: '승인된 샌드박스 특례는 지정된 만료일 이전에 연장 신청을 완료해야 합니다. 만료 후 서비스 중단 위험이 있습니다.',
            },
          ],
        },
        {
          id: 'esg-report',
          title: 'ESG 보고서 시스템',
          description: 'TCFD, EU CSRD, US SEC, ISSB 등 글로벌 ESG 기준 보고서 생성 방법입니다.',
          body: [
            {
              type: 'p',
              text: '탄소이음 ESG 보고서 시스템은 주요 글로벌 ESG 규제 기준에 맞는 보고서를 자동으로 생성합니다.',
            },
            {
              type: 'roles',
              items: [
                { role: 'GHG Protocol', desc: 'Scope 1/2/3 온실가스 인벤토리 기준 (글로벌 표준)' },
                { role: 'TCFD', desc: '기후 관련 재무 정보공개 태스크포스 — 지배구조·전략·위험·지표 4개 필라' },
                { role: 'EU CSRD', desc: 'ESRS E1 — 유럽 기업지속가능성 보고 지침 (2024년 이후 EU 법인 의무)' },
                { role: 'US SEC', desc: '미국 SEC 기후공시 규칙 (2024) — Scope 1/2 의무, Scope 3 조건부' },
                { role: 'ISSB', desc: 'IFRS S2 — 국제 지속가능성 기준위원회 (한국 적용 추진 중)' },
                { role: 'CDP', desc: '탄소정보공개프로젝트 — 투자자·공급망 기후 정보 제출' },
                { role: 'K-MRV', desc: '한국 온실가스 명세서 (환경부, 연간 제출 의무)' },
              ],
            },
            {
              type: 'tip',
              text: '보고서는 초안(Draft) → 검토(In Review) → 승인(Approved) → 발행(Published) 단계로 관리됩니다. 발행 후 SHA-256 무결성 해시가 생성되어 변조 불가 상태가 됩니다.',
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

export function getChapter(chapterId: string): Chapter | undefined {
  return MANUAL_DATA.chapters.find((c) => c.id === chapterId);
}

export function getArticle(
  chapterId: string,
  articleId: string,
): Article | undefined {
  return getChapter(chapterId)?.articles.find((a) => a.id === articleId);
}

export function getAdjacentArticles(
  chapterId: string,
  articleId: string,
): { prev: { chapterId: string; article: Article } | null; next: { chapterId: string; article: Article } | null } {
  const flat: { chapterId: string; article: Article }[] = [];
  for (const chapter of MANUAL_DATA.chapters) {
    for (const article of chapter.articles) {
      flat.push({ chapterId: chapter.id, article });
    }
  }
  const idx = flat.findIndex(
    (f) => f.chapterId === chapterId && f.article.id === articleId,
  );
  return {
    prev: idx > 0 ? flat[idx - 1]! : null,
    next: idx < flat.length - 1 ? flat[idx + 1]! : null,
  };
}

export function searchManual(query: string): {
  chapterId: string;
  chapterTitle: string;
  article: Article;
  matchIn: 'title' | 'body';
}[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const results: { chapterId: string; chapterTitle: string; article: Article; matchIn: 'title' | 'body' }[] = [];

  for (const chapter of MANUAL_DATA.chapters) {
    for (const article of chapter.articles) {
      if (article.title.toLowerCase().includes(q) || article.description.toLowerCase().includes(q)) {
        results.push({ chapterId: chapter.id, chapterTitle: chapter.title, article, matchIn: 'title' });
        continue;
      }
      const bodyText = article.body.map(b => {
        if (b.type === 'p' || b.type === 'tip' || b.type === 'warn') return b.text;
        if (b.type === 'steps' || b.type === 'list') return b.items.join(' ');
        if (b.type === 'roles') return b.items.map(r => r.role + ' ' + r.desc).join(' ');
        return '';
      }).join(' ').toLowerCase();
      if (bodyText.includes(q)) {
        results.push({ chapterId: chapter.id, chapterTitle: chapter.title, article, matchIn: 'body' });
      }
    }
  }
  return results;
}
