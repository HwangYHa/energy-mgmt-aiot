# 탄소이음 SEO 전략 & 운영 가이드

> 도메인: carboneum.kr | 서비스: 에너지 관리 EMS SaaS | 타깃: B2B 제조업·빌딩·데이터센터

---

## 1. 전체 SEO 아키텍처

```
app/
├── sitemap.ts                    # /sitemap.xml (정적+블로그 동적 생성)
├── robots.ts                     # /robots.txt
├── feed.xml/route.ts             # /feed.xml (RSS 2.0 — 네이버 수집용)
├── layout.tsx                    # 루트 메타데이터 + JSON-LD 3종
│                                 #   SoftwareApplication / Organization / WebSite
├── (public)/
│   ├── blog/
│   │   ├── page.tsx              # 블로그 허브 (BreadcrumbList JSON-LD)
│   │   └── [slug]/page.tsx      # 포스트 상세 (BlogPosting JSON-LD, SSG)
│   ├── calculator/
│   │   ├── page.tsx              # ROI/전기요금 계산기 (FAQPage JSON-LD)
│   │   └── CalculatorClient.tsx  # 계산 로직 (클라이언트)
│   ├── solutions/
│   │   ├── manufacturing/        # 제조업 랜딩 (BreadcrumbList)
│   │   ├── building/             # 빌딩 랜딩
│   │   ├── datacenter/           # 데이터센터 랜딩
│   │   └── industrial/           # 산업단지 랜딩
│   ├── features/                 # 기능 소개 (Product JSON-LD)
│   ├── pricing/                  # 가격 비교 (FAQPage JSON-LD)
│   └── faq/                      # FAQ 허브 (FAQPage JSON-LD)
lib/
├── seo/
│   ├── jsonld.ts                 # JSON-LD 유틸 (8종 스키마)
│   ├── metadata.ts               # generateMetadata 헬퍼
│   └── keywords.ts               # 100+ 키워드 클러스터
└── blog/
    └── posts.ts                  # 블로그 데이터 (CMS 전환 준비)
components/
├── seo/
│   └── Breadcrumb.tsx            # 시각적 브레드크럼 (microdata)
└── analytics/
    └── Analytics.tsx             # GTM + GA4 + 네이버 + Clarity
```

---

## 2. TOFU / MOFU / BOFU 키워드 퍼널

### TOFU (인지 단계 — 블로그 유입)
| 키워드 | 검색량 | 페이지 |
|--------|-------|--------|
| 에너지 관리 시스템 | 높음 | /features |
| 탄소 배출량 측정 | 중간 | /blog/scope1-2-3-guide |
| ESG 경영이란 | 높음 | /blog/esg-guide |
| K-ETS 배출권 거래제 | 중간 | /blog/k-ets-guide |
| CBAM 대응 | 중간 | /blog/cbam-guide |
| 전기요금 절감 방법 | 높음 | /blog/electricity-cost-reduction-guide |

### MOFU (검토 단계 — 솔루션/기능 페이지)
| 키워드 | 전환율 | 페이지 |
|--------|-------|--------|
| 공장 전력 모니터링 | 중간 | /solutions/manufacturing |
| 빌딩 에너지 관리 | 중간 | /solutions/building |
| AI 전력 예측 | 중간 | /features |
| 에너지 절감 ROI | 높음 | /calculator |
| 에너지 관리 SaaS 비교 | 중간 | /pricing |

### BOFU (구매 결정 — 전환 페이지)
| 키워드 | 전환율 | 페이지 |
|--------|-------|--------|
| 전기요금 절감 계산기 | 높음 | /calculator |
| EMS 무료 체험 | 최고 | /trial |
| 에너지 관리 데모 신청 | 최고 | /demo |
| EMS ROI 계산기 | 높음 | /calculator |

---

## 3. 구현된 JSON-LD 스키마

| 스키마 | 위치 | 효과 |
|--------|------|------|
| `SoftwareApplication` | 루트 layout | Rich Result: 소프트웨어 앱 카드 |
| `Organization` | 루트 layout | 지식 패널, 브랜드 정보 |
| `WebSite` | 루트 layout | Sitelinks Search Box |
| `BreadcrumbList` | 각 공개 페이지 | 검색 결과 URL 경로 표시 |
| `BlogPosting` | /blog/[slug] | 기사 Rich Result |
| `FAQPage` | /faq, /calculator, /pricing | FAQ 아코디언 |
| `Product` | /features, /pricing | 제품/서비스 Rich Result |
| `HowTo` | /docs/getting-started | 단계별 가이드 Rich Result |

---

## 4. Core Web Vitals 최적화

### 적용된 최적화
- **LCP**: `<link rel="preconnect">` 외부 도메인 사전 연결
- **LCP**: Next.js `images.formats: ['avif', 'webp']` + `minimumCacheTTL: 7일`
- **CLS**: `font-display: swap` (시스템 폰트 폴백 우선)
- **INP**: 클라이언트 컴포넌트 최소화, 서버 컴포넌트 우선
- **TTFB**: HTTP Cache-Control 헤더 (`/_next/static`: 1년 immutable)
- **Bundle**: 페이지별 코드 스플리팅 (App Router 자동)

### Cloudflare 설정 (배포 시)
```
Cache Rules:
  - /_next/static/*     → Cache Everything, Edge TTL 1년
  - /images/*           → Cache Everything, Edge TTL 7일
  - /sitemap.xml        → Cache Everything, Edge TTL 1시간
  - /feed.xml           → Cache Everything, Edge TTL 1시간
  - /api/*              → Bypass Cache

Page Rules:
  - www.carboneum.kr → carboneum.kr (301)
  - HTTPS Always On
  - Brotli 압축 활성화
```

---

## 5. 콘텐츠 SEO 로드맵

### 블로그 카테고리 구조 (IA)
```
/blog
├── 에너지 절감 가이드
│   ├── 전기요금 절감 방법 TOP 10
│   ├── 최대수요전력 요금 절감 완전 가이드
│   ├── 피크 부하 관리 시스템
│   └── 수요반응(DR) 자동 참여 가이드
├── 탄소중립 전략
│   ├── Scope 1·2·3 완전 가이드
│   ├── K-ETS 배출권 거래제 기업 대응
│   ├── RE100 이행 로드맵
│   └── EU CBAM 대응 전략
├── ESG 규제 대응
│   ├── ESG 경영 완전 가이드
│   ├── GHG Protocol 설명서
│   ├── TCFD 기후 공시 가이드
│   └── CDP 보고서 작성 방법
├── 기술 인사이트
│   ├── AI 에너지 예측 기술 설명
│   ├── IoT 센서 선택 가이드
│   ├── MQTT 프로토콜 에너지 활용
│   └── 에너지 빅데이터 분석 방법
├── 산업별 사례
│   ├── 제조업 에너지 절감 사례
│   ├── 빌딩 BEMS 도입 사례
│   ├── 데이터센터 PUE 개선 사례
│   └── 프랜차이즈 다점포 관리 사례
└── 제품 업데이트
    └── 신기능 출시 노트
```

---

## 6. 네이버 SEO 전략

### 네이버 검색 대응 체크리스트
- [ ] **네이버 웹마스터 등록**: search.naver.com/info/sitemap.html
- [ ] **네이버 사이트 소유 확인**: `.env` `NEXT_PUBLIC_NAVER_SITE_VERIFICATION` 입력
- [ ] **네이버 블로그 미러링**: 핵심 포스트를 네이버 블로그에 동시 발행
- [ ] **네이버 지식인 답변**: 에너지 관리 관련 Q&A에 전문 답변 + 링크
- [ ] **네이버 카페 활동**: 에너지·ESG 관련 카페 참여
- [ ] **RSS 등록**: `/feed.xml` → 네이버 웹마스터 RSS 등록
- [ ] **네이버 쇼핑·비즈니스**: 서비스 등록 (기업 정보 노출)

---

## 7. 전환 SEO (검색 → 리드)

### 전환 퍼널
```
검색 유입
  ↓ (TOFU 블로그 포스트)
브랜드 인지 + 이메일 구독
  ↓ (MOFU 솔루션/기능 페이지)
데모 신청 or 계산기 사용
  ↓ (BOFU /trial, /demo)
무료 체험 시작 or 상담 예약
  ↓
유료 전환
```

### CTA 위치별 역할
| 위치 | CTA | 목적 |
|------|-----|------|
| 블로그 포스트 하단 | "무료 계산기 →" | 계산기로 연결 |
| 블로그 사이드바 | "무료 에너지 진단" | 계산기로 연결 |
| 계산기 결과 | "전문가 정밀 분석 신청" | 데모 신청 |
| 솔루션 페이지 | "무료 체험 시작" | Trial 전환 |
| 가격 페이지 | "14일 무료 체험" | Trial 전환 |
| 홈 Hero | "데모 신청" + "무료 시작" | 이중 CTA |

### UTM 파라미터 설계
```
/trial?utm_source=blog&utm_medium=organic&utm_campaign=electricity-guide
/demo?utm_source=naver&utm_medium=cpc&utm_campaign=ems-brand
/calculator?utm_source=google&utm_medium=organic&utm_campaign=roi-calculator
```

---

## 8. GTM / GA4 이벤트 설계

### 주요 전환 이벤트
| 이벤트 | 트리거 | GA4 파라미터 |
|--------|--------|-------------|
| `demo_request` | 데모 신청 버튼 클릭 | source, plan |
| `trial_start` | 무료 체험 시작 | plan |
| `calculator_used` | 계산기 결과 조회 | industry |
| `pricing_click` | 가격 플랜 선택 | plan, billing_cycle |
| `blog_read_complete` | 블로그 75% 스크롤 | slug, category |
| `purchase` | 결제 완료 | plan, value |

### GA4 Conversion 설정
```
Goals:
  1. demo_request → Primary Conversion
  2. trial_start → Primary Conversion
  3. purchase → Primary Conversion
  4. calculator_used → Micro Conversion
```

---

## 9. 90일 SEO 실행 로드맵

### Day 1-30: Quick Wins (즉시 효과)
- [x] sitemap.xml 블로그 포함 업데이트
- [x] robots.ts 최적화
- [x] 루트 JSON-LD 3종 주입
- [x] 블로그 구조 구현 (/blog, /blog/[slug])
- [x] 계산기 페이지 (/calculator) — BOFU 전환
- [x] RSS 피드 (/feed.xml)
- [x] next.config.js 캐싱 헤더
- [x] Breadcrumb 컴포넌트
- [x] Analytics 컴포넌트 (GTM/GA4/Naver)
- [ ] Google Search Console 등록 + sitemap 제출
- [ ] 네이버 웹마스터 등록 + RSS 등록
- [ ] GA4 전환 이벤트 설정

### Day 31-60: Mid-term (콘텐츠 구축)
- [ ] 블로그 포스트 4편 발행 (핵심 키워드 타깃)
  - "전기요금 절감 방법 TOP 7"
  - "K-ETS 완전 가이드 2025"
  - "Scope 1·2·3 측정 방법"
  - "스마트팩토리 에너지 관리"
- [ ] 솔루션 페이지 JSON-LD 추가 (BreadcrumbList)
- [ ] 가격 페이지 FAQ JSON-LD 추가
- [ ] 이미지 alt 텍스트 전수 검토
- [ ] 내부 링킹 전략 실행 (블로그 ↔ 솔루션 ↔ 계산기)

### Day 61-90: Long-term (권위 구축)
- [ ] 블로그 포스트 8편 추가 (총 12편)
- [ ] 외부 링크빌딩: 에너지 협회, ESG 포털 기고
- [ ] 네이버 블로그 동시 발행
- [ ] YouTube 영상 + 임베드 (E-E-A-T 강화)
- [ ] Lighthouse 100점 최적화 (이미지 WebP 변환)
- [ ] 페이지스피드 인사이트 측정 + 개선

---

## 10. KPI 대시보드

### 월간 측정 지표
| 지표 | 도구 | 목표 (3개월) |
|------|------|-------------|
| 오가닉 클릭수 | GSC | +300% |
| 키워드 순위 (Top 10) | GSC | 20개+ |
| 블로그 세션 | GA4 | 500+ |
| 계산기 사용 | GA4 | 50+ |
| 데모 신청 전환율 | GA4 | 3%+ |
| Core Web Vitals (LCP) | PSI | < 2.5s |
| Lighthouse SEO | Lighthouse | 100점 |

---

## 11. 산업별 랜딩페이지 설계안

### 제조업 (/solutions/manufacturing)
- H1: "공장 에너지 비용 30% 절감 — AI 기반 FEMS"
- 핵심 지표: 절감율, 설비 효율, 탄소 감축
- 사례: A제조사 3,200만 원 절감 (6개월)
- CTA: "공장 에너지 진단 신청" → /demo

### 빌딩 (/solutions/building)
- H1: "빌딩 에너지 비용 40% 절감 — BEMS 플랫폼"
- 핵심 지표: 절감율, 탄소 배출 감축, 그린빌딩 인증
- 사례: 서울 오피스 빌딩 41% 절감
- CTA: "빌딩 에너지 진단 신청" → /demo

### 데이터센터 (/solutions/datacenter)
- H1: "데이터센터 PUE 1.2 이하 — 냉각 비용 45% 절감"
- 핵심 지표: PUE, 냉각 효율, Scope 2 감축
- 사례: IDC PUE 1.18 달성
- CTA: "PUE 개선 분석 신청" → /demo

---

## 12. 실무 체크리스트

### 배포 전 필수
- [ ] `NEXT_PUBLIC_SITE_URL=https://carboneum.kr` 설정
- [ ] `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` 입력
- [ ] `NEXT_PUBLIC_NAVER_SITE_VERIFICATION` 입력
- [ ] `NEXT_PUBLIC_GTM_ID` 또는 `NEXT_PUBLIC_GA4_ID` 입력
- [ ] `app/layout.tsx`에 `<Analytics />` 컴포넌트 추가
- [ ] 모든 공개 페이지 Lighthouse 점수 측정

### Google Search Console
1. search.google.com/search-console 접속
2. 도메인 속성 추가 (carboneum.kr)
3. DNS TXT 레코드 또는 메타 태그로 소유 확인
4. `/sitemap.xml` 제출
5. Core Web Vitals 리포트 모니터링

### 네이버 웹마스터
1. searchadvisor.naver.com 접속
2. 사이트 등록
3. HTML 태그 또는 파일로 소유 확인
4. RSS 피드 등록 (/feed.xml)
5. 사이트맵 제출

---

*최종 업데이트: 2026-03-31*
