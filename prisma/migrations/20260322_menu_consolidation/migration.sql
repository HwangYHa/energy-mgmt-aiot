-- Migration: 메뉴 통합 + 신규 메뉴 추가
-- Date: 2026-03-22
--
-- 변경 내용:
--   1. monitoring_realtime 메뉴 비활성화 (대시보드 > 실시간 현황으로 통합)
--   2. Super Admin 전용 menu_group 추가
--   3. admin 그룹에 랜섬웨어 대응 메뉴 추가
--   4. super_admin 그룹에 ERP 대시보드 메뉴 추가

-- ① 중복 메뉴 숨김 처리
UPDATE `menu_item`
SET `is_visible` = 0, `is_active` = 0, `updated_at` = NOW()
WHERE `code` = 'monitoring_realtime';

-- ② Super Admin menu_group 추가
INSERT INTO `menu_group` (
  `id`, `code`, `name`, `icon`, `display_order`, `level`,
  `min_role`, `subscription_required`, `is_active`, `is_visible`,
  `created_at`, `updated_at`
) VALUES (
  UUID(), 'super_admin', 'Super Admin', 'ShieldCheck', 99, 1,
  'super_admin', 0, 1, 1, NOW(), NOW()
) ON DUPLICATE KEY UPDATE `name` = 'Super Admin', `updated_at` = NOW();

-- ③ 랜섬웨어 대응 메뉴 추가 (admin 그룹)
INSERT INTO `menu_item` (
  `id`, `code`, `name`, `icon`, `path`, `menu_group_id`, `display_order`, `level`,
  `min_role`, `subscription_required`, `is_active`, `is_visible`, `badge_type`,
  `created_at`, `updated_at`
)
SELECT UUID(), 'admin_ransomware', '랜섬웨어 대응', 'ShieldAlert',
  '/admin/security/ransomware', `id`, 9, 1,
  'super_admin', 0, 1, 1, 'none', NOW(), NOW()
FROM `menu_group` WHERE `code` = 'admin'
ON DUPLICATE KEY UPDATE `name` = '랜섬웨어 대응', `updated_at` = NOW();

-- ④ ERP 대시보드 메뉴 추가 (admin 그룹 — super_admin 전용)
INSERT INTO `menu_item` (
  `id`, `code`, `name`, `icon`, `path`, `menu_group_id`, `display_order`, `level`,
  `min_role`, `subscription_required`, `is_active`, `is_visible`, `badge_type`,
  `created_at`, `updated_at`
)
SELECT UUID(), 'super_admin_erp', 'ERP 대시보드', 'TrendingUp',
  '/admin/erp', `id`, 98, 1,
  'super_admin', 0, 1, 1, 'none', NOW(), NOW()
FROM `menu_group` WHERE `code` = 'admin'
ON DUPLICATE KEY UPDATE `name` = 'ERP 대시보드', `path` = '/admin/erp', `display_order` = 98, `updated_at` = NOW();
