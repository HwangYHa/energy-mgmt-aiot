-- ============================================================
-- Migration: 20260307_site_control_resource
-- 1. ControlLog: reason 필수화, siteId 추가
-- 2. EquipmentLot: siteId 추가
-- 3. MenuItem: 자원 관리 메뉴 추가
-- ============================================================

-- ControlLog: reason NOT NULL 변경 (기존 NULL → '' 기본값으로 처리)
ALTER TABLE `control_log`
  MODIFY COLUMN `reason` TEXT NOT NULL DEFAULT '';

-- ControlLog: siteId 컬럼 추가
ALTER TABLE `control_log`
  ADD COLUMN `site_id` VARCHAR(36) NULL AFTER `reason`;

-- ControlLog: siteId 인덱스
CREATE INDEX `control_log_site_id_requested_at_idx`
  ON `control_log` (`site_id`, `requested_at` DESC);

-- EquipmentLot: siteId 컬럼 추가
ALTER TABLE `equipment_lot`
  ADD COLUMN `site_id` VARCHAR(36) NULL AFTER `tenant_id`;

-- EquipmentLot: siteId 인덱스
CREATE INDEX `equipment_lot_site_id_idx`
  ON `equipment_lot` (`site_id`);

-- MenuItem: 자원 관리 메뉴 추가
-- (멱등: 이미 존재하면 업데이트)
INSERT INTO `menu_item` (
  `id`, `code`, `name`, `icon`, `path`,
  `menu_group_id`, `display_order`, `level`,
  `min_role`, `subscription_required`,
  `is_active`, `is_visible`, `badge_type`,
  `created_at`, `updated_at`
)
SELECT
  UUID(),
  'admin_equipment',
  '자원 관리',
  'Package',
  '/admin/equipment',
  mg.id,
  6,
  1,
  'super_admin',
  FALSE,
  TRUE,
  TRUE,
  'none',
  NOW(),
  NOW()
FROM `menu_group` mg
WHERE mg.code = 'admin'
ON DUPLICATE KEY UPDATE
  `name`          = '자원 관리',
  `icon`          = 'Package',
  `path`          = '/admin/equipment',
  `display_order` = 6,
  `min_role`      = 'super_admin',
  `is_active`     = TRUE,
  `updated_at`    = NOW();
