#!/usr/bin/env bash
# DB에 이미 적용된 마이그레이션을 Prisma 히스토리에 등록합니다.
# DB 재시작 후 실행하세요.
#
# 사용: bash prisma/migrations/resolve-migrations.sh

set -e

echo "▶ 마이그레이션 히스토리 등록 중..."

npx prisma migrate resolve --applied 20260201000000_add_extended_models
echo "  ✓ add_extended_models 등록 완료"

npx prisma migrate resolve --applied 20260220000000_add_carbon_trading
echo "  ✓ add_carbon_trading 등록 완료"

echo ""
npx prisma migrate status
echo ""
echo "완료! 위 상태를 확인하세요."
