-- Migration: 리텐션 대시보드 메뉴 경로 정규화
-- Date: 2026-03-24
--
-- /super-admin → /admin/retention 으로 경로 통일
-- (Next.js App Router 기준 실제 경로: app/(tenant)/admin/retention/page.tsx)

-- ① 기존 잘못된 경로(/super-admin, /admin/super-admin) 비활성화
UPDATE `menu_item`
SET `is_active` = 0, `is_visible` = 0, `updated_at` = NOW()
WHERE `path` IN ('/super-admin', '/admin/super-admin')
  AND `code` != 'super_admin_retention';

-- ② 올바른 경로로 upsert
INSERT INTO `menu_item` (
  `id`, `code`, `name`, `icon`, `path`, `menu_group_id`, `display_order`, `level`,
  `min_role`, `subscription_required`, `is_active`, `is_visible`, `badge_type`,
  `created_at`, `updated_at`
)
SELECT
  UUID(), 'super_admin_retention', '리텐션 대시보드', 'BarChart3',
  '/admin/retention', mg.`id`, 97, 1,
  'super_admin', 0, 1, 1, 'none', NOW(), NOW()
FROM `menu_group` mg
WHERE mg.`code` = 'super_admin'
ON DUPLICATE KEY UPDATE
  `path`          = '/admin/retention',
  `name`          = '리텐션 대시보드',
  `icon`          = 'BarChart3',
  `is_active`     = 1,
  `is_visible`    = 1,
  `display_order` = 97,
  `updated_at`    = NOW();
