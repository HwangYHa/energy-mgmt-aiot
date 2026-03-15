-- 사용자 로그인 관련 컬럼 추가 (DB에 없는 경우 대비)
-- prisma db push 대신 수동 마이그레이션으로 처리

-- login_attempts, locked_until, last_login_at, last_login_ip
-- is_email_verified 등 초기 push 이후 추가된 컬럼들

SET @col_exists_attempts = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'login_attempts'
);

SET @col_exists_locked = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'locked_until'
);

SET @col_exists_last_login_at = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'last_login_at'
);

SET @col_exists_last_login_ip = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'last_login_ip'
);

SET @col_exists_email_verified = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'is_email_verified'
);

-- login_attempts
SET @sql = IF(@col_exists_attempts = 0,
  'ALTER TABLE `user` ADD COLUMN `login_attempts` INT NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- locked_until
SET @sql = IF(@col_exists_locked = 0,
  'ALTER TABLE `user` ADD COLUMN `locked_until` DATETIME(3) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- last_login_at
SET @sql = IF(@col_exists_last_login_at = 0,
  'ALTER TABLE `user` ADD COLUMN `last_login_at` DATETIME(3) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- last_login_ip
SET @sql = IF(@col_exists_last_login_ip = 0,
  'ALTER TABLE `user` ADD COLUMN `last_login_ip` VARCHAR(45) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- is_email_verified
SET @sql = IF(@col_exists_email_verified = 0,
  'ALTER TABLE `user` ADD COLUMN `is_email_verified` TINYINT(1) NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
