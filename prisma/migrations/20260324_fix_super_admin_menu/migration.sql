-- Migration: Super Admin 리텐션 대시보드 메뉴 등록
-- Date: 2026-03-24
--
-- 이전 migration(20260324_super_admin_retention)에서 잘못된 컬럼명(display_name, display_order)으로
-- INSERT IGNORE가 silently 실패했으므로 올바른 컬럼명으로 재등록

-- ① 리텐션 대시보드 메뉴 아이템 추가 (super_admin 그룹)
INSERT INTO `menu_item` (
  `id`, `code`, `name`, `icon`, `path`, `menu_group_id`, `display_order`, `level`,
  `min_role`, `subscription_required`, `is_active`, `is_visible`, `badge_type`,
  `created_at`, `updated_at`
)
SELECT
  UUID(), 'super_admin_retention', '리텐션 대시보드', 'BarChart3',
  '/super-admin', mg.`id`, 97, 1,
  'super_admin', 0, 1, 1, 'none', NOW(), NOW()
FROM `menu_group` mg
WHERE mg.`code` = 'super_admin'
ON DUPLICATE KEY UPDATE
  `name`         = '리텐션 대시보드',
  `path`         = '/super-admin',
  `icon`         = 'BarChart3',
  `is_active`    = 1,
  `is_visible`   = 1,
  `display_order`= 97,
  `updated_at`   = NOW();

-- ② 테넌트 관리 링크 (super_admin 그룹 — 이미 있으면 활성화만)
INSERT INTO `menu_item` (
  `id`, `code`, `name`, `icon`, `path`, `menu_group_id`, `display_order`, `level`,
  `min_role`, `subscription_required`, `is_active`, `is_visible`, `badge_type`,
  `created_at`, `updated_at`
)
SELECT
  UUID(), 'super_admin_tenants_mgmt', '테넌트 관리', 'Building2',
  '/admin/tenants', mg.`id`, 98, 1,
  'super_admin', 0, 1, 1, 'none', NOW(), NOW()
FROM `menu_group` mg
WHERE mg.`code` = 'super_admin'
ON DUPLICATE KEY UPDATE
  `name`         = '테넌트 관리',
  `path`         = '/admin/tenants',
  `is_active`    = 1,
  `is_visible`   = 1,
  `display_order`= 98,
  `updated_at`   = NOW();

-- ③ 이전 migration에서 생긴 잘못된 그룹/아이템 정리 (있으면 비활성화)
UPDATE `menu_item`
SET `is_active` = 0, `is_visible` = 0, `updated_at` = NOW()
WHERE `code` IN ('super_admin_dashboard', 'super_admin_tenants')
  AND `menu_group_id` = 'super_admin_main';
