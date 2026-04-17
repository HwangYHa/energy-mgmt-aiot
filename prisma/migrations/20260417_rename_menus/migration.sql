-- ============================================================
-- 메뉴명 한국어 최적화 리네이밍 (2026-04-17)
-- ============================================================

-- 1. Super Admin 그룹명 → 플랫폼 관리
UPDATE `menu_group`
SET `name` = '플랫폼 관리',
    `updated_at` = NOW()
WHERE `code` = 'admin';

-- 2. 실시간 현황 → 실시간 모니터링
UPDATE `menu_item`
SET `name` = '실시간 모니터링',
    `updated_at` = NOW()
WHERE `code` = 'dashboard_realtime';

-- 3. 뷰어 대시보드 → 에너지 현황판
UPDATE `menu_item`
SET `name` = '에너지 현황판',
    `updated_at` = NOW()
WHERE `code` = 'dashboard_viewer';

-- 4. 디지털 트윈 → 시설 현황 맵
--    (공간 계층 + 설비 노드 실시간 모니터링이지 실제 디지털 트윈이 아님)
UPDATE `menu_item`
SET `name` = '시설 현황 맵',
    `updated_at` = NOW()
WHERE `code` = 'dashboard_digital_twin';

-- 5. 구독 관리 → 구독 · 요금제
UPDATE `menu_item`
SET `name` = '구독 · 요금제',
    `updated_at` = NOW()
WHERE `code` = 'management_subscription';
