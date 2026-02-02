# 🎨 인증 UI 디자인 시스템 문서

## 📋 개요

에너지 관리 플랫폼의 로그인, 회원가입, 비밀번호 찾기 페이지를 현대적인 글래스모피즘(Glassmorphism) 스타일로 완전히 재설계했습니다.

## 🎨 디자인 컨셉

### 색상 시스템

**다크 베이스 컬러**
- `dark-bg`: `#0a0a0f` - 메인 배경
- `dark-surface`: `#111118` - 서브 배경
- `dark-card`: `#1a1a24` - 카드 배경
- `dark-border`: `#2a2a3a` - 테두리

**네온 글로우 컬러**
- `neon-blue`: `#00d4ff` - 주요 액션 (로그인)
- `neon-purple`: `#a855f7` - 보조 액션 (회원가입)
- `neon-green`: `#10b981` - 성공/링크
- `neon-cyan`: `#06b6d4` - 호버 상태

### 시각 효과

1. **Glassmorphism**
   - 반투명 배경 (`bg-white/5`)
   - 백드롭 블러 (`backdrop-blur-xl`)
   - 미묘한 테두리 (`border-white/10`)

2. **글로우 효과**
   - 버튼 호버 시 네온 글로우 (`shadow-glow-blue`)
   - 배경 원형 요소들의 부드러운 글로우

3. **애니메이션**
   - 부드러운 플로팅 효과 (`animate-float`)
   - 페이드 인/슬라이드 인 (`animate-in`)
   - 로딩 스피너 (`animate-spin`)

## 📁 파일 구조

```
components/auth/
├── AuthBackground.tsx    # 배경 및 애니메이션 효과
├── AuthCard.tsx          # 글래스모피즘 카드 컨테이너
├── AuthInput.tsx         # 입력 필드 (비밀번호 토글 포함)
├── AuthButton.tsx        # 그라데이션 버튼
└── SocialButton.tsx      # 소셜 로그인 버튼

app/(auth)/
├── layout.tsx            # 인증 레이아웃
├── login/page.tsx        # 로그인 페이지
├── register/page.tsx     # 회원가입 페이지
└── forgot-password/page.tsx  # 비밀번호 찾기 페이지
```

## 🎯 주요 기능

### 1. 로그인 페이지 (`/login`)

**기능**
- 이메일/비밀번호 로그인
- "Remember me" 체크박스
- 비밀번호 보기/숨기기 토글
- Google 소셜 로그인 (UI만, 실제 연동 필요)
- 회원가입 성공 시 알림 표시

**UX 특징**
- 이메일 입력 시 지우기 버튼 표시
- 실시간 에러 표시
- 로딩 상태 명확히 표시
- 키보드 접근성 고려

### 2. 회원가입 페이지 (`/register`)

**기능**
- 이름, 이메일, 비밀번호, 비밀번호 확인 입력
- 실시간 유효성 검사
- 비밀번호 강도 표시 (대문자, 소문자, 숫자 포함)
- 이용약관 동의 체크박스
- Google 소셜 회원가입 (UI만)

**UX 특징**
- 필드별 개별 에러 메시지
- 비밀번호 일치 실시간 확인
- 접근성 고려한 체크박스 레이블

### 3. 비밀번호 찾기 페이지 (`/forgot-password`)

**기능**
- 이메일 입력으로 비밀번호 재설정 링크 요청
- 성공 시 확인 화면 표시
- 로그인으로 돌아가기 링크

**UX 특징**
- 단계별 상태 표시 (요청 → 성공)
- 명확한 안내 메시지
- 스팸 폴더 확인 안내

## 🎨 컴포넌트 상세

### AuthBackground

**역할**: 전체 배경 및 애니메이션 효과

**특징**
- 다크 그라데이션 배경
- 부드럽게 움직이는 글로우 원형 요소들
- 별 효과 (20개 랜덤 위치)
- 반응형 z-index 관리

### AuthCard

**역할**: 글래스모피즘 카드 컨테이너

**특징**
- 반투명 배경 + 백드롭 블러
- 미묘한 테두리 및 그림자
- 반응형 패딩 (모바일: p-8, 데스크톱: p-10)

### AuthInput

**역할**: 통일된 입력 필드

**특징**
- 글래스모피즘 스타일
- 포커스 시 네온 글로우
- 에러 상태 시 빨간색 테두리
- 비밀번호 필드 토글 버튼
- 접근성 속성 포함

### AuthButton

**역할**: 그라데이션 액션 버튼

**Variants**
- `primary`: 블루-시안 그라데이션 (로그인)
- `secondary`: 퍼플-블루 그라데이션 (회원가입)
- `outline`: 아웃라인 스타일

**Glow 효과**
- `blue`: 블루 글로우
- `purple`: 퍼플 글로우
- `green`: 그린 글로우

### SocialButton

**역할**: 소셜 로그인 버튼

**특징**
- 글래스모피즘 스타일
- 아이콘 + 텍스트 + 화살표
- 호버 시 배경 밝기 증가

## 📱 반응형 디자인

### 브레이크포인트

- **모바일** (< 768px): 전체 너비, 작은 패딩
- **태블릿** (768px - 1024px): 최대 너비 유지
- **데스크톱** (> 1024px): 최대 너비 유지, 큰 패딩

### 접근성

- ✅ 키보드 네비게이션 지원
- ✅ ARIA 레이블 포함
- ✅ 포커스 링 명확히 표시
- ✅ 색상 대비 WCAG AA 준수
- ✅ 스크린 리더 친화적

## 🚀 사용 방법

### 기본 사용

```tsx
import { AuthBackground } from '@/components/auth/AuthBackground';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthInput } from '@/components/auth/AuthInput';
import { AuthButton } from '@/components/auth/AuthButton';

export default function MyAuthPage() {
  return (
    <AuthBackground>
      <AuthCard title="Welcome" subtitle="Sign in">
        <form>
          <AuthInput
            label="Email"
            type="email"
            placeholder="user@example.com"
          />
          <AuthButton type="submit">Sign in</AuthButton>
        </form>
      </AuthCard>
    </AuthBackground>
  );
}
```

## 🔧 커스터마이징

### 색상 변경

`tailwind.config.js`에서 색상 값 수정:

```js
colors: {
  neon: {
    blue: '#00d4ff',  // 원하는 색상으로 변경
    purple: '#a855f7',
    green: '#10b981',
  },
}
```

### 애니메이션 조정

`tailwind.config.js`의 `keyframes` 섹션에서 애니메이션 속도/효과 조정 가능.

## ⚠️ 주의사항

1. **소셜 로그인**: 현재 UI만 구현되어 있음. 실제 OAuth 연동 필요.
2. **비밀번호 찾기 API**: `/api/auth/forgot-password` 엔드포인트 구현 필요.
3. **환경 변수**: 프로덕션에서 소셜 로그인 클라이언트 ID 등 설정 필요.

## 🎯 향후 개선 사항

- [ ] 다크/라이트 모드 토글
- [ ] 추가 소셜 로그인 (Apple, Facebook 등)
- [ ] 2FA (이중 인증) UI
- [ ] 비밀번호 강도 표시기
- [ ] 로그인 히스토리 표시

## 📝 참고

- **디자인 레퍼런스**: 첨부된 이미지들 (글래스모피즘, 다크 테마)
- **기술 스택**: Next.js 14 App Router, Tailwind CSS, Lucide React
- **접근성**: WCAG 2.1 AA 준수 목표

---

**작성일**: 2026-01-31  
**버전**: 1.0.0
