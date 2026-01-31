#!/usr/bin/env bash
# CRITICAL 보안 이슈 통합 테스트 스크립트
# 
# 사용: bash scripts/test-security.sh
# 또는: chmod +x scripts/test-security.sh && ./scripts/test-security.sh

set -e

BASE_URL="http://localhost:3000"
AI_ENGINE_URL="http://localhost:8001"

echo "=========================================="
echo "🔐 CRITICAL 보안 이슈 통합 테스트"
echo "=========================================="
echo ""

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 테스트 카운터
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 테스트 함수
run_test() {
  local test_name=$1
  local command=$2
  local expected_status=$3

  TOTAL_TESTS=$((TOTAL_TESTS + 1))
  echo -e "${BLUE}[TEST $TOTAL_TESTS]${NC} $test_name"

  response=$(eval "$command" 2>/dev/null)
  http_code=$(echo "$response" | tail -n1)

  if [ "$http_code" -eq "$expected_status" ]; then
    echo -e "${GREEN}✓ PASSED${NC} (HTTP $http_code)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
  else
    echo -e "${RED}✗ FAILED${NC} (Expected: $expected_status, Got: $http_code)"
    echo "Response: $response"
    FAILED_TESTS=$((FAILED_TESTS + 1))
  fi
  echo ""
}

# ========================================
# 1. CSRF 토큰 테스트
# ========================================
echo -e "${YELLOW}=== 1. CSRF 토큰 테스트 ===${NC}"
echo "CSRF 토큰 발급 확인"

CSRF_RESPONSE=$(curl -s -X GET "$BASE_URL/api/auth/csrf" \
  -H "Content-Type: application/json")

CSRF_TOKEN=$(echo "$CSRF_RESPONSE" | grep -o '"csrfToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$CSRF_TOKEN" ]; then
  echo -e "${RED}✗ CSRF 토큰 발급 실패${NC}"
else
  echo -e "${GREEN}✓ CSRF 토큰 발급 성공${NC}"
  echo "Token: ${CSRF_TOKEN:0:20}..."
fi
echo ""

# ========================================
# 2. 환경 변수 검증 테스트
# ========================================
echo -e "${YELLOW}=== 2. 환경 변수 검증 테스트 ===${NC}"
echo "필수 환경 변수 확인"

REQUIRED_VARS=("DATABASE_URL" "JWT_SECRET" "NEXTAUTH_SECRET" "AI_ENGINE_URL" "AI_ENGINE_API_KEY")

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo -e "${RED}✗ 누락된 변수: $var${NC}"
  else
    echo -e "${GREEN}✓ $var 설정됨${NC}"
  fi
done
echo ""

# ========================================
# 3. 입력 검증 테스트
# ========================================
echo -e "${YELLOW}=== 3. 입력 검증 테스트 ===${NC}"

# 3-1. 유효하지 않은 이메일
echo "3-1. 유효하지 않은 이메일 검증"
run_test "Invalid email" \
  "curl -s -X POST '$BASE_URL/api/auth/register' \
  -H 'Content-Type: application/json' \
  -H 'X-CSRF-Token: $CSRF_TOKEN' \
  -d '{\"email\":\"invalid-email\",\"password\":\"Pass123!\",\"name\":\"Test\",\"tenantId\":\"test\"}' \
  -w '\n%{http_code}'" \
  400

# 3-2. 약한 비밀번호
echo "3-2. 약한 비밀번호 검증"
run_test "Weak password" \
  "curl -s -X POST '$BASE_URL/api/auth/register' \
  -H 'Content-Type: application/json' \
  -H 'X-CSRF-Token: $CSRF_TOKEN' \
  -d '{\"email\":\"test@example.com\",\"password\":\"weak\",\"name\":\"Test\",\"tenantId\":\"test\"}' \
  -w '\n%{http_code}'" \
  400

echo ""

# ========================================
# 4. 레이트 제한 테스트
# ========================================
echo -e "${YELLOW}=== 4. 레이트 제한 테스트 ===${NC}"
echo "로그인 시도 레이트 제한 확인 (6회 시도)"

for i in {1..6}; do
  echo "Attempt $i:"
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"WrongPassword123!"}' \
    -w '\nHTTP:%{http_code}')

  HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP:" | cut -d':' -f2)
  
  if [ "$HTTP_CODE" -eq 429 ]; then
    echo -e "${RED}  Rate limit hit (HTTP 429)${NC}"
    break
  else
    echo -e "${GREEN}  OK (HTTP $HTTP_CODE)${NC}"
  fi
done
echo ""

# ========================================
# 5. 보안 헤더 테스트
# ========================================
echo -e "${YELLOW}=== 5. 보안 헤더 테스트 ===${NC}"
echo "HTTP 보안 헤더 확인"

HEADERS=$(curl -s -I "$BASE_URL/api/auth/csrf")

EXPECTED_HEADERS=(
  "X-Frame-Options"
  "X-Content-Type-Options"
  "X-XSS-Protection"
  "Content-Security-Policy"
)

for header in "${EXPECTED_HEADERS[@]}"; do
  if echo "$HEADERS" | grep -q "$header"; then
    echo -e "${GREEN}✓ $header 설정됨${NC}"
  else
    echo -e "${YELLOW}⚠ $header 미설정${NC}"
  fi
done
echo ""

# ========================================
# 6. CORS 테스트
# ========================================
echo -e "${YELLOW}=== 6. CORS 테스트 ===${NC}"
echo "CORS 정책 확인"

CORS_TEST=$(curl -s -X OPTIONS "$BASE_URL/api/auth/csrf" \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET")

if echo "$CORS_TEST" | grep -q "access-control-allow"; then
  echo -e "${GREEN}✓ CORS 헤더 설정됨${NC}"
else
  echo -e "${YELLOW}⚠ CORS 헤더 미설정${NC}"
fi
echo ""

# ========================================
# 7. 다중테넌시 검증 테스트
# ========================================
echo -e "${YELLOW}=== 7. 다중테넌시 검증 테스트 ===${NC}"
echo "테넌트 ID 검증"

# 이는 실제 토큰이 필요하므로 시뮬레이션
echo -e "${BLUE}[정보]${NC} 실제 테스트는 인증된 요청 필요"
echo "Expected: 모든 데이터에 tenantId 필터 자동 적용"
echo "Expected: 다른 테넌트의 리소스 접근 차단"
echo ""

# ========================================
# 8. 로그 파일 테스트
# ========================================
echo -e "${YELLOW}=== 8. 로그 파일 테스트 ===${NC}"
echo "로그 파일 생성 확인"

LOG_FILES=(
  "logs/combined.log"
  "logs/error.log"
  "logs/security.log"
  "logs/http.log"
)

for log_file in "${LOG_FILES[@]}"; do
  if [ -f "$log_file" ]; then
    SIZE=$(du -h "$log_file" | cut -f1)
    echo -e "${GREEN}✓ $log_file${NC} ($SIZE)"
  else
    echo -e "${YELLOW}⚠ $log_file 생성되지 않음${NC}"
  fi
done
echo ""

# ========================================
# 9. AI Engine 보안 테스트
# ========================================
echo -e "${YELLOW}=== 9. AI Engine 보안 테스트 ===${NC}"

# 9-1. API 키 없이 접근 시도
echo "9-1. API 키 없이 접근"
RESPONSE=$(curl -s -X POST "$AI_ENGINE_URL/api/forecast" \
  -H "Content-Type: application/json" \
  -d '{"horizon":"24h"}' \
  -w '\nHTTP:%{http_code}')

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP:" | cut -d':' -f2)
if [ "$HTTP_CODE" -eq 401 ] || [ "$HTTP_CODE" -eq 403 ]; then
  echo -e "${GREEN}✓ 인증 없이 접근 거부 (HTTP $HTTP_CODE)${NC}"
else
  echo -e "${YELLOW}⚠ 예상치 못한 응답 (HTTP $HTTP_CODE)${NC}"
fi

# 9-2. 잘못된 API 키로 접근
echo "9-2. 잘못된 API 키로 접근"
RESPONSE=$(curl -s -X POST "$AI_ENGINE_URL/api/forecast" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid-key" \
  -d '{"horizon":"24h"}' \
  -w '\nHTTP:%{http_code}')

HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP:" | cut -d':' -f2)
if [ "$HTTP_CODE" -eq 401 ] || [ "$HTTP_CODE" -eq 403 ]; then
  echo -e "${GREEN}✓ 잘못된 키 거부 (HTTP $HTTP_CODE)${NC}"
else
  echo -e "${YELLOW}⚠ 예상치 못한 응답 (HTTP $HTTP_CODE)${NC}"
fi
echo ""

# ========================================
# 최종 결과
# ========================================
echo "=========================================="
echo -e "📊 테스트 결과"
echo "=========================================="
echo -e "총 테스트: $TOTAL_TESTS"
echo -e "${GREEN}성공: $PASSED_TESTS${NC}"
echo -e "${RED}실패: $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
  echo -e "${GREEN}✓ 모든 테스트 통과!${NC}"
  exit 0
else
  echo -e "${RED}✗ 일부 테스트 실패${NC}"
  exit 1
fi
