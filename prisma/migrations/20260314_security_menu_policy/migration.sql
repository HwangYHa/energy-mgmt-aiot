-- ============================================================
-- Migration: 보안 모니터링 메뉴 + 패스워드 정책 컬럼 추가
-- Date: 2026-03-14
-- ============================================================

-- ──────────────────────────────────────────────────
-- 1. 보안 모니터링 MenuItem 추가 (Super Admin 전용)
-- ──────────────────────────────────────────────────
INSERT IGNORE INTO `menu_item` (
  `id`, `code`, `name`, `icon`, `path`,
  `menu_group_id`, `display_order`, `level`,
  `min_role`, `subscription_required`, `is_active`, `is_visible`,
  `badge_type`, `created_at`, `updated_at`
) VALUES (
  UUID(), 'admin_security', '보안 모니터링', 'Shield', '/admin/security',
  (SELECT `id` FROM `menu_group` WHERE `code` = 'admin' LIMIT 1),
  (SELECT IFNULL(MAX(mi.display_order), 0) + 1 FROM `menu_item` mi WHERE mi.menu_group_id = (SELECT `id` FROM `menu_group` WHERE `code` = 'admin' LIMIT 1)),
  1,
  'super_admin', 0, 1, 1,
  'none', NOW(), NOW()
);

-- ──────────────────────────────────────────────────
-- 2. audit_log: security 이벤트 인덱스 최적화 (없을 때만 생성)
-- ──────────────────────────────────────────────────
SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'audit_log'
    AND INDEX_NAME = 'idx_audit_log_security'
);
SET @idx_sql = IF(@idx_exists = 0,
  'CREATE INDEX `idx_audit_log_security` ON `audit_log` (`action`(30), `ip_address`(45), `created_at`)',
  'SELECT 1'
);
PREPARE idx_stmt FROM @idx_sql;
EXECUTE idx_stmt;
DEALLOCATE PREPARE idx_stmt;

-- ──────────────────────────────────────────────────
-- 3. 패스워드 정책: 기존 사용자 password_changed_at 컬럼 (선택)
-- ──────────────────────────────────────────────────
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'user'
    AND COLUMN_NAME = 'password_changed_at'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `user` ADD COLUMN `password_changed_at` DATETIME NULL AFTER `password_hash`',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
