# 탄소이음 — 사업 정보 관리

> 작성일: 2026-03-24
> 이 문서는 사업자 등록, 도메인, 법인 정보를 관리합니다.

---

## 1. 회사 기본 정보

| 항목 | 내용 | 상태 |
|------|------|------|
| **법인명** | 탄소이음 | - |
| **영문명** | Carbonieum | - |
| **슬로건** | 에너지 데이터로 세상을 잇다 | - |
| **브랜드 철학** | 기술이 아니라 연결 | - |
| **이메일** | carbonieum.official@gmail.com | ✅ 운영 중 |
| **전화번호** | (사업자 등록 완료 후 기재) | ⏳ 대기 |
| **사업자등록번호** | (사업자 등록 완료 후 기재) | ⏳ 대기 |
| **사업장 주소** | (사업자 등록 완료 후 기재) | ⏳ 대기 |

---

## 2. 사업자 등록 계획

### 현황
- 사업자 등록 전 단계
- **임시 방안**: 아버지 회사 사업장 주소로 우선 등록 예정
- 등록 완료 시 아래 파일들에서 주석 해제 필요:

### 등록 완료 후 수정할 파일 목록

| 파일 | 위치 | 수정 내용 |
|------|------|-----------|
| `components/landing/LegalModal.tsx` | L149~153, L248~251 | 전화번호, 주소 주석 해제 |
| `app/(public)/support/page.tsx` | L47~57 | 전화 상담 카드 주석 해제 |

#### LegalModal.tsx 수정 방법
```tsx
// 현재 (주석 처리됨)
{/* 사업자 등록 완료 후 기재 예정
<li>전화: 000-0000-0000</li>
<li>주소: (사업자 등록 주소 기재 예정)</li>
*/}

// 등록 완료 후 → 실제 값으로 교체
<li>전화: 02-XXXX-XXXX</li>
<li>주소: 서울특별시 OO구 OO로 XXX</li>
<li>사업자등록번호: XXX-XX-XXXXX</li>
```

#### support/page.tsx 수정 방법
```tsx
// 현재 (주석 처리됨)
// 사업자 등록 완료 후 전화번호 기재 예정
// {
//   icon: Phone,
//   title: '전화 상담',
//   ...
// }

// 등록 완료 후 → 주석 해제하고 실제 전화번호 입력
```

---

## 3. 도메인 정보

### 구매 계획
- **등록처**: [hosting.kr](https://www.hosting.kr)
- **우선순위 도메인 후보**:
  1. `carbonieum.co.kr` (영문, B2B 인지도 용이)
  2. `carbonieum.kr`
  3. `탄소이음.kr` (한글 도메인)

### 도메인 구매 후 설정 단계

```
1. hosting.kr에서 도메인 구매
2. 네임서버 변경:
   - Vercel 사용 시: Vercel 네임서버로 변경
     → ns1.vercel-dns.com
     → ns2.vercel-dns.com
   - Cloudflare 사용 시: Cloudflare 네임서버로 변경 (CDN + 무료 SSL)
     → 변경 후 Cloudflare에서 A 레코드 → 서버 IP 지정

3. Vercel Dashboard → Settings → Domains → 도메인 추가
4. SSL 인증서 자동 발급 (Let's Encrypt)

5. 환경변수 업데이트:
   NEXTAUTH_URL=https://carbonieum.co.kr

6. Google OAuth 설정 업데이트:
   Google Cloud Console → OAuth 2.0 클라이언트 → 승인된 리디렉션 URI 추가
   → https://carbonieum.co.kr/api/auth/callback/google
```

### DNS 레코드 설정 예시 (Cloudflare)

```
타입  이름    값                  프록시
A    @      [서버 IP]            ✅ (Cloudflare CDN)
A    www    [서버 IP]            ✅ (Cloudflare CDN)
MX   @      mail.google.com      (Gmail 사용 시)
TXT  @      v=spf1 include:...   (이메일 인증)
```

---

## 4. Google OAuth 앱 등록

**Google Cloud Console** → APIs & Services → Credentials → OAuth 2.0 Client IDs

```
승인된 JavaScript 원본:
  https://carbonieum.co.kr

승인된 리디렉션 URI:
  https://carbonieum.co.kr/api/auth/callback/google
  http://localhost:3000/api/auth/callback/google  ← 개발용
```

---

## 5. 토스페이먼츠 상점 등록

1. [developers.tosspayments.com](https://developers.tosspayments.com) 가입
2. 상점 등록 시 사업자등록번호 필요 → **사업자 등록 완료 후 진행**
3. 등록 완료 후 환경변수:
   ```
   NEXT_PUBLIC_TOSS_CLIENT_KEY=live_ck_xxxxxxxxx
   TOSS_SECRET_KEY=live_sk_xxxxxxxxx
   ```
   현재는 테스트키 사용: `test_ck_...`, `test_sk_...`

---

## 6. Solapi (SMS/알림톡) 계정 설정

1. [solapi.com](https://solapi.com) 가입
2. 발신번호 등록 (사업자 전화번호 필요)
3. 카카오 알림톡 채널 등록:
   - 카카오 비즈니스 채널 개설 필요
   - pfId(채널 ID), senderKey 발급
4. 환경변수:
   ```
   SOLAPI_API_KEY=
   SOLAPI_API_SECRET=
   SOLAPI_SENDER_PHONE=010-XXXX-XXXX
   KAKAO_CHANNEL_ID=
   KAKAO_SENDER_KEY=
   ```

---

## 7. 체크리스트

### 사업자 등록 전
- [x] 이메일 운영 (carbonieum.official@gmail.com)
- [ ] 도메인 구매 (hosting.kr)
- [ ] Google OAuth 앱 등록
- [ ] 토스페이먼츠 테스트 환경 설정

### 사업자 등록 완료 후
- [ ] LegalModal.tsx — 전화번호, 주소 주석 해제
- [ ] support/page.tsx — 전화 상담 카드 주석 해제
- [ ] 토스페이먼츠 실환경 키 교체
- [ ] Solapi 발신번호 등록
- [ ] 카카오 비즈니스 채널 개설 → 알림톡 템플릿 승인
- [ ] 사업자등록번호 LegalModal에 추가
