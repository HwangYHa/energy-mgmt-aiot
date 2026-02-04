# 사이드바 RBAC 구현 확인 가이드

## 📋 구현 완료 항목

### 1. 데이터베이스 기반 메뉴 시스템
- ✅ `menu_group` 테이블에서 메뉴 그룹 조회
- ✅ `menu_item` 테이블에서 메뉴 아이템 조회
- ✅ 역할 기반 필터링 (min_role 필드 기반)
- ✅ 디지털 트윈 대시보드 메뉴 항목 추가

### 2. API 엔드포인트
- ✅ `GET /api/menus` - 사용자 역할에 따른 메뉴 조회
- ✅ RBAC 필터링 로직 적용
- ✅ 빈 그룹 자동 제거

### 3. 사이드바 컴포넌트
- ✅ 데이터베이스에서 메뉴 데이터 동적 로딩
- ✅ 역할별 뱃지 표시
- ✅ 아이콘 동적 매핑
- ✅ 그룹 접기/펼치기 기능

### 4. 데이터베이스 시드
- ✅ 6개 메뉴 그룹 생성
- ✅ 16개 메뉴 아이템 생성 (디지털 트윈 포함)
- ✅ 역할별 최소 권한 설정

---

## 🧪 테스트 방법

### 1. 개발 서버 실행 확인
```bash
# 현재 포트 3003에서 실행 중
http://localhost:3003
```

### 2. 역할별 메뉴 확인

#### Viewer (읽기 전용)
**표시되는 메뉴:**
- 대시보드 (개요, 실시간 모니터링, 디지털 트윈)
- 모니터링 (사이트 조회, 설비 모니터링)
- 분석 & 리포트 (에너지 분석, AI 예측, 리포트)
- 설정 (계정 설정, 알림 설정, 매뉴얼)

**숨겨지는 메뉴:**
- 제어 (전체)
- 관리 (전체)

#### Operator (운영자)
**추가로 표시되는 메뉴:**
- 제어 (수동 제어)
  - DR 참여는 여전히 숨김 (tenant_admin 필요)

#### Site Manager (사이트 관리자)
**추가로 표시되는 메뉴:**
- 관리 (사이트 관리)
  - 사용자 관리와 구독 관리는 여전히 숨김 (tenant_admin 필요)

#### Tenant Admin (테넌트 관리자)
**모든 메뉴 표시:**
- 대시보드 (전체)
- 모니터링 (전체)
- 제어 (전체 - DR 참여 포함)
- 분석 & 리포트 (전체)
- 관리 (전체 - 사용자 관리, 구독 관리 포함)
- 설정 (전체)

---

## 📊 데이터베이스 구조

### menu_group 테이블
```sql
SELECT * FROM menu_group ORDER BY display_order;
```

| code | name | icon | min_role | display_order |
|------|------|------|----------|---------------|
| dashboard | 대시보드 | LayoutDashboard | viewer | 1 |
| monitoring | 모니터링 | Activity | viewer | 2 |
| control | 제어 | Zap | operator | 3 |
| analytics | 분석 & 리포트 | BarChart3 | viewer | 4 |
| management | 관리 | Settings | site_manager | 5 |
| settings | 설정 | Settings | viewer | 6 |

### menu_item 테이블 (주요 항목)
```sql
SELECT mi.code, mi.name, mi.path, mi.min_role, mg.name as group_name
FROM menu_item mi
JOIN menu_group mg ON mi.menu_group_id = mg.id
ORDER BY mg.display_order, mi.display_order;
```

| code | name | path | min_role | group_name |
|------|------|------|----------|------------|
| dashboard_overview | 개요 | /dashboard | viewer | 대시보드 |
| dashboard_realtime | 실시간 모니터링 | /dashboard/realtime | viewer | 대시보드 |
| dashboard_digital_twin | 디지털 트윈 | /digital-twin | viewer | 대시보드 |
| control_manual | 수동 제어 | /control/manual | operator | 제어 |
| control_dr | DR 참여 | /control/dr | tenant_admin | 제어 |
| management_users | 사용자 관리 | /settings/users | tenant_admin | 관리 |
| management_subscription | 구독 관리 | /settings/subscription | tenant_admin | 관리 |

---

## 🔍 API 테스트

### 1. 메뉴 조회 API 호출
```bash
curl -X GET http://localhost:3003/api/menus \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

### 2. 예상 응답 (Viewer 역할)
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "code": "dashboard",
      "name": "대시보드",
      "icon": "LayoutDashboard",
      "displayOrder": 1,
      "minRole": "viewer",
      "items": [
        {
          "id": "uuid",
          "code": "dashboard_overview",
          "name": "개요",
          "icon": "LayoutDashboard",
          "path": "/dashboard",
          "displayOrder": 1,
          "minRole": "viewer"
        },
        {
          "id": "uuid",
          "code": "dashboard_realtime",
          "name": "실시간 모니터링",
          "icon": "Activity",
          "path": "/dashboard/realtime",
          "displayOrder": 2,
          "minRole": "viewer"
        },
        {
          "id": "uuid",
          "code": "dashboard_digital_twin",
          "name": "디지털 트윈",
          "icon": "Boxes",
          "path": "/digital-twin",
          "displayOrder": 3,
          "minRole": "viewer"
        }
      ]
    }
    // ... 나머지 그룹들
  ],
  "userRole": "viewer"
}
```

---

## 🎨 UI 확인 사항

### 1. 역할 뱃지
사이드바 상단에 현재 사용자의 역할이 표시됩니다:
- Viewer: 🔒 읽기 전용 (회색)
- Operator: 운영자 (파란색)
- Site Manager: 사이트 관리자 (초록색)
- Tenant Admin: 테넌트 관리자 (보라색)

### 2. 메뉴 아이콘
각 메뉴 항목에 lucide-react 아이콘이 표시됩니다:
- LayoutDashboard: 대시보드
- Activity: 실시간 모니터링
- Boxes: 디지털 트윈 (새로 추가)
- Zap: 제어
- Building2: 사이트
- Users: 사용자 관리

### 3. 활성 상태
현재 페이지와 일치하는 메뉴 항목은 파란색 배경으로 강조됩니다.

---

## 🔧 수동 역할 변경 테스트

데이터베이스에서 직접 사용자 역할을 변경하여 테스트:

```sql
-- 현재 사용자 조회
SELECT id, email, name, role FROM user WHERE email = 'your-email@example.com';

-- Viewer로 변경
UPDATE user SET role = 'viewer' WHERE email = 'your-email@example.com';

-- Operator로 변경
UPDATE user SET role = 'operator' WHERE email = 'your-email@example.com';

-- Site Manager로 변경
UPDATE user SET role = 'site_manager' WHERE email = 'your-email@example.com';

-- Tenant Admin으로 변경
UPDATE user SET role = 'tenant_admin' WHERE email = 'your-email@example.com';
```

역할 변경 후 브라우저를 새로고침하면 변경된 메뉴 구조를 확인할 수 있습니다.

---

## ✅ 체크리스트

- [ ] 개발 서버가 정상적으로 실행되는가?
- [ ] 로그인 후 사이드바에 메뉴가 표시되는가?
- [ ] 역할 뱃지가 올바르게 표시되는가?
- [ ] Viewer 역할에서 제어/관리 메뉴가 숨겨지는가?
- [ ] Operator 역할에서 제어 메뉴가 표시되는가?
- [ ] Tenant Admin 역할에서 모든 메뉴가 표시되는가?
- [ ] 디지털 트윈 메뉴가 대시보드 그룹에 있는가?
- [ ] 메뉴 클릭 시 올바른 페이지로 이동하는가?
- [ ] `/api/menus` API가 올바른 데이터를 반환하는가?

---

## 🚀 다음 단계

1. **프론트엔드 권한 가드 추가**
   - 각 페이지에 서버 사이드 권한 검증 추가
   - Unauthorized 페이지 리다이렉션

2. **메뉴 관리 UI 구축**
   - Admin 페이지에서 메뉴 구조 편집 기능
   - 메뉴 순서 변경 (Drag & Drop)

3. **메뉴 접근 로그**
   - `menu_access_log` 테이블 활용
   - 사용자별 메뉴 사용 통계

4. **즐겨찾기 기능**
   - `user_menu_favorite` 테이블 활용
   - 사이드바 상단에 즐겨찾기 메뉴 표시

---

## 📝 참고 파일

- [components/layout/Sidebar.tsx](../components/layout/Sidebar.tsx) - 사이드바 컴포넌트
- [app/api/menus/route.ts](../app/api/menus/route.ts) - 메뉴 API
- [prisma/seed-menus.ts](../prisma/seed-menus.ts) - 메뉴 시드 스크립트
- [lib/constants/roles.ts](../lib/constants/roles.ts) - 역할 정의 및 유틸리티
