# 성능 개선 사항

## 📋 문제점

### 1. 로그인/회원가입 속도 문제
- **증상**: 로그인 및 회원가입이 너무 느림
- **원인**:
  - bcrypt 해싱 라운드가 12로 설정 (프로덕션 수준)
  - 개발 환경에서 약 150-250ms 소요
  - 여러 데이터베이스 쿼리 순차 실행

### 2. 사이드바 메뉴 로딩 문제
- **증상**: 로그인 후 사이드바가 "Loading..." 상태로 멈춤
- **원인**:
  - NextAuth 세션이 없거나 로딩 중일 때 메뉴 API를 호출하지 않음
  - `isLoading` 상태가 `true`로 유지됨
  - API 에러 발생 시 사용자에게 피드백 없음

---

## ✅ 적용된 해결책

### 1. bcrypt 라운드 최적화

**파일**: `app/api/auth/register/route.ts` (line 122-124)

```typescript
// 변경 전
const passwordHash = await bcrypt.hash(validated.password, 12);

// 변경 후
const bcryptRounds = process.env.NODE_ENV === 'production' ? 12 : 10;
const passwordHash = await bcrypt.hash(validated.password, bcryptRounds);
```

**효과**:
- 개발 환경에서 bcrypt 라운드 12 → 10
- 약 50-100ms 성능 개선
- 프로덕션 환경에서는 여전히 12 (보안 유지)

---

### 2. Sidebar 에러 처리 개선

**파일**: `components/layout/Sidebar.tsx`

#### 변경 사항

**A) 세션 상태 추적 추가**
```typescript
// 변경 전
const { data: session } = useSession();

// 변경 후
const { data: session, status } = useSession();
const [error, setError] = useState<string | null>(null);
```

**B) 로딩 로직 개선**
```typescript
// 세션 상태에 따라 적절하게 처리
if (status === 'loading') {
  setIsLoading(true);
} else if (status === 'authenticated' && session) {
  fetchMenus(); // 인증된 경우에만 API 호출
} else if (status === 'unauthenticated') {
  setIsLoading(false);
  setError('로그인이 필요합니다.');
}
```

**C) API 에러 처리 강화**
```typescript
const response = await fetch('/api/menus');

if (!response.ok) {
  if (response.status === 401) {
    throw new Error('인증이 필요합니다. 다시 로그인해주세요.');
  }
  throw new Error(`메뉴를 불러올 수 없습니다 (${response.status})`);
}
```

**D) UI 개선**
```tsx
{isLoading ? (
  <div className="text-center text-gray-400 py-8">메뉴 로딩 중...</div>
) : error ? (
  <div className="text-center text-red-400 py-8 px-4">
    <p className="text-sm mb-2">{error}</p>
    <button onClick={() => window.location.reload()}>새로고침</button>
  </div>
) : menuGroups.length === 0 ? (
  <div className="text-center text-gray-400 py-8">메뉴가 없습니다.</div>
) : (
  // 메뉴 렌더링
)}
```

**효과**:
- ✅ 세션이 없을 때 적절한 에러 메시지 표시
- ✅ API 호출 실패 시 사용자 피드백 제공
- ✅ "Loading..." 무한 로딩 문제 해결
- ✅ 메뉴가 비어있을 때 빈 화면 대신 안내 메시지 표시

---

## 📊 성능 비교

### 회원가입 성능

| 환경 | bcrypt 라운드 | 예상 소요 시간 |
|------|---------------|----------------|
| 개발 (변경 전) | 12 | ~200ms |
| 개발 (변경 후) | 10 | ~100ms |
| 프로덕션 | 12 | ~200ms |

### 로그인 성능

| 단계 | 소요 시간 |
|------|----------|
| 1. 사용자 조회 | ~10ms |
| 2. bcrypt.compare (개발) | ~100ms |
| 3. lastLoginAt 업데이트 | ~10ms |
| **총합 (개발)** | **~120ms** |

---

## 🔍 추가 최적화 권장 사항

### 1. NextAuth 세션 전략 최적화

**현재 설정 확인**:
```typescript
// lib/auth/session.ts
export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt', // 또는 'database'
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};
```

**권장**:
- JWT 전략 사용 시: 빠르지만 세션 무효화 어려움
- Database 전략 사용 시: 유연하지만 매 요청마다 DB 쿼리 발생
- 현재 프로젝트에는 JWT가 적합

### 2. 데이터베이스 인덱스 확인

```sql
-- 사용자 조회 최적화
CREATE INDEX idx_user_email ON user(email);
CREATE INDEX idx_user_tenant_id ON user(tenantId);

-- 메뉴 조회 최적화
CREATE INDEX idx_menu_group_active ON menu_group(isActive, isVisible);
CREATE INDEX idx_menu_item_active ON menu_item(isActive, isVisible, menuGroupId);
```

### 3. API 응답 캐싱

**메뉴 API 캐싱** (`app/api/menus/route.ts`):
```typescript
import { unstable_cache } from 'next/cache';

export const GET = unstable_cache(
  async (request: NextRequest) => {
    // 메뉴 조회 로직
  },
  ['user-menus'],
  { revalidate: 3600, tags: ['menus'] } // 1시간 캐시
);
```

### 4. 로그인 후 lastLoginAt 업데이트 최적화

**현재 방식**: await로 대기 (느림)
```typescript
await prisma.user.update({
  where: { id: user.id },
  data: { lastLoginAt: new Date() },
});
```

**최적화 방식**: Fire-and-forget (빠름)
```typescript
// 백그라운드에서 업데이트 (응답 속도에 영향 없음)
prisma.user.update({
  where: { id: user.id },
  data: { lastLoginAt: new Date() },
}).catch(console.error); // await 제거
```

---

## 🧪 테스트 방법

### 1. 회원가입 속도 테스트

```bash
# Chrome DevTools Network 탭에서 확인
# 1. 회원가입 폼 작성
# 2. 제출 버튼 클릭
# 3. Network 탭에서 /api/auth/register 요청 시간 확인
# 기대값: 200ms 이하
```

### 2. 로그인 속도 테스트

```bash
# Chrome DevTools Performance 탭에서 확인
# 1. 로그인 폼 작성
# 2. 제출 버튼 클릭
# 3. 로그인 완료까지 시간 측정
# 기대값: 500ms 이하
```

### 3. 사이드바 메뉴 로딩 테스트

**시나리오 1**: 정상 로그인
- 로그인 → 대시보드 이동 → 사이드바 메뉴 표시 확인
- 기대값: "메뉴 로딩 중..." 메시지 후 2초 이내 메뉴 표시

**시나리오 2**: 세션 만료
- 로그아웃 또는 세션 만료 → 대시보드 접근
- 기대값: "로그인이 필요합니다." 에러 메시지 표시

**시나리오 3**: API 실패
- 개발 서버 중지 → 브라우저 새로고침
- 기대값: "메뉴를 불러올 수 없습니다" 에러 메시지 + 새로고침 버튼

---

## 📝 주의사항

### bcrypt 라운드 설정

- **개발 환경**: 10 (빠름, 테스트 용이)
- **프로덕션**: 12 (보안 우선)
- **절대 8 이하로 설정하지 말 것** (보안 취약)

### 세션 전략

- JWT 사용 시: 토큰 무효화가 어려우므로 짧은 maxAge 권장
- Database 사용 시: 세션 테이블 정기 정리 필요

---

## 🚀 향후 개선 계획

1. **Redis 캐싱 도입**
   - 메뉴 데이터 캐싱
   - 세션 데이터 캐싱
   - API 응답 캐싱

2. **데이터베이스 커넥션 풀 최적화**
   - Prisma 커넥션 풀 크기 조정
   - 쿼리 최적화

3. **프론트엔드 최적화**
   - React Query 도입으로 API 캐싱
   - 사이드바 메뉴 로컬 스토리지 캐싱
   - Suspense + ErrorBoundary 적용

4. **모니터링 추가**
   - API 응답 시간 로깅
   - 느린 쿼리 감지
   - 사용자 경험 메트릭 수집

---

## ✅ 체크리스트

- [x] bcrypt 라운드 환경별 최적화
- [x] Sidebar 에러 처리 개선
- [x] 로딩 상태 관리 개선
- [x] 에러 메시지 사용자 친화적으로 변경
- [ ] 데이터베이스 인덱스 추가 (선택사항)
- [ ] API 응답 캐싱 적용 (선택사항)
- [ ] lastLoginAt 업데이트 비동기 처리 (선택사항)
