-- Migration: 20260313_user_access_login_history
-- 사용자 로그인 이력, 사이트 접근 권한, 채번 코드 컬럼 추가

-- ============================================================
-- 1. Tenant에 code 컬럼 추가 (TN-YYYYMMDD-NNNN)
-- ============================================================
ALTER TABLE `tenant`
  ADD COLUMN `code` VARCHAR(30) NULL UNIQUE AFTER `id`;

-- ============================================================
-- 2. User에 code, country, city 컬럼 추가
-- ============================================================
ALTER TABLE `user`
  ADD COLUMN `code`    VARCHAR(30)  NULL UNIQUE AFTER `id`,
  ADD COLUMN `country` VARCHAR(10)  NOT NULL DEFAULT 'KR' AFTER `phone`,
  ADD COLUMN `city`    VARCHAR(100) NULL AFTER `country`;

-- ============================================================
-- 3. 로그인 이력 테이블
-- ============================================================
CREATE TABLE `login_history` (
  `id`          VARCHAR(36)  NOT NULL,
  `user_id`     VARCHAR(36)  NOT NULL,
  `tenant_id`   VARCHAR(36)  NOT NULL,
  `ip_address`  VARCHAR(45)  NULL,
  `user_agent`  VARCHAR(500) NULL,
  `provider`    VARCHAR(30)  NOT NULL DEFAULT 'credentials',
  `success`     TINYINT(1)   NOT NULL DEFAULT 1,
  `fail_reason` VARCHAR(255) NULL,
  `created_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `login_history_user_id_created_at_idx` (`user_id`, `created_at`),
  INDEX `login_history_tenant_id_created_at_idx` (`tenant_id`, `created_at`),
  CONSTRAINT `login_history_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `login_history_tenant_id_fkey`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenant` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. 사용자-사이트 접근 권한 테이블
-- ============================================================
CREATE TABLE `user_site_access` (
  `id`          VARCHAR(36) NOT NULL,
  `user_id`     VARCHAR(36) NOT NULL,
  `tenant_id`   VARCHAR(36) NOT NULL,
  `site_id`     VARCHAR(36) NOT NULL,
  `granted_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `revoked_at`  DATETIME(3) NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `user_site_access_user_id_site_id_key` (`user_id`, `site_id`),
  INDEX `user_site_access_tenant_id_site_id_idx` (`tenant_id`, `site_id`),
  CONSTRAINT `user_site_access_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_site_access_tenant_id_fkey`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenant` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_site_access_site_id_fkey`
    FOREIGN KEY (`site_id`) REFERENCES `site` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
