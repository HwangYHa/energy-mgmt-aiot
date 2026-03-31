-- Migration: 리텐션 대시보드 메뉴 경로 최종 정정
-- Date: 2026-03-25
--
-- 이전 마이그레이션들이 잘못된 그룹(super_admin UUID)에 삽입했거나
-- ON DUPLICATE KEY UPDATE 가 동작하지 않아 항목이 누락된 문제를 최종 수정
-- 올바른 admin 그룹 ID: 48e2e33d-0640-11f1-bc81-10ffe02f0abf

-- ① 잘못된 그룹에 삽입된 항목 비활성화
UPDATE `menu_item`
SET `is_active` = 0, `is_visible` = 0, `updated_at` = NOW()
WHERE `code` = 'super_admin_retention'
  AND `menu_group_id` != '48e2e33d-0640-11f1-bc81-10ffe02f0abf';

-- ② 올바른 admin 그룹에 삽입 (이미 있으면 경로/활성 상태 업데이트)
INSERT INTO `menu_item` (
  `id`, `code`, `name`, `icon`, `path`, `menu_group_id`, `display_order`, `level`,
  `min_role`, `subscription_required`, `is_active`, `is_visible`, `badge_type`,
  `created_at`, `updated_at`
) VALUES (
  UUID(), 'super_admin_retention', '리텐션 대시보드', 'BarChart3',
  '/admin/retention', '48e2e33d-0640-11f1-bc81-10ffe02f0abf', 97, 1,
  'super_admin', 0, 1, 1, 'none', NOW(), NOW()
)
ON DUPLICATE KEY UPDATE
  `path`          = '/admin/retention',
  `name`          = '리텐션 대시보드',
  `icon`          = 'BarChart3',
  `menu_group_id` = '48e2e33d-0640-11f1-bc81-10ffe02f0abf',
  `is_active`     = 1,
  `is_visible`    = 1,
  `display_order` = 97,
  `updated_at`    = NOW();
