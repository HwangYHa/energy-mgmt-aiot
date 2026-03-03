-- ================================================
-- Phase 1: 배출계수 버전 관리 (Semantic Versioning)
-- ================================================

-- 1. EmissionFactor 테이블 수정
-- version INT -> STRING, @unique 제거, 새 칼럼 추가
-- 기존 version 칼럼은 이미 존재하므로, 필요한 칼럼만 추가
ALTER TABLE `emission_factor`
  ADD COLUMN `parent_id` VARCHAR(191) AFTER `version`,
  ADD COLUMN `is_custom` BOOLEAN DEFAULT false AFTER `region`,
  ADD COLUMN `is_active` BOOLEAN DEFAULT true AFTER `is_default`,
  ADD COLUMN `created_by` VARCHAR(191) AFTER `valid_to`,
  ADD COLUMN `approved_by` VARCHAR(191) AFTER `created_by`,
  ADD COLUMN `approved_at` DATETIME AFTER `approved_by`;

-- 2. 기존 unique constraint 제거 (code)
ALTER TABLE `emission_factor` DROP INDEX `emission_factor_code_key`;

-- 3. 새 unique constraint 추가 (code + version)
ALTER TABLE `emission_factor` ADD UNIQUE KEY `emission_factor_code_version_key` (`code`, `version`);

-- 4. validFrom/validTo 인덱스 추가
ALTER TABLE `emission_factor` ADD INDEX `emission_factor_valid_from_to_idx` (`valid_from`, `valid_to`);

-- 5. parent_id FK 추가
ALTER TABLE `emission_factor`
  ADD CONSTRAINT `emission_factor_parent_id_fkey`
  FOREIGN KEY (`parent_id`) REFERENCES `emission_factor`(`id`);

-- ================================================
-- Phase 1: 배출계수 감사 로그 테이블 생성 (Hash-chain)
-- ================================================

CREATE TABLE `emission_factor_audit_log` (
  `id` VARCHAR(191) NOT NULL,
  `emission_factor_id` VARCHAR(191) NOT NULL,
  `old_value` DECIMAL(15, 8),
  `new_value` DECIMAL(15, 8),
  `change_type` VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `change_reason` LONGTEXT COLLATE utf8mb4_unicode_ci,
  `previous_hash` VARCHAR(64) COLLATE utf8mb4_unicode_ci,
  `current_hash` VARCHAR(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `requested_by` VARCHAR(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `requested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `approved_by` VARCHAR(191),
  `approved_at` DATETIME(3),

  PRIMARY KEY (`id`),
  KEY `emission_factor_audit_log_emission_factor_id_idx` (`emission_factor_id`),
  KEY `emission_factor_audit_log_change_type_idx` (`change_type`),
  KEY `emission_factor_audit_log_requested_at_idx` (`requested_at` DESC),
  CONSTRAINT `emission_factor_audit_log_emission_factor_id_fkey`
    FOREIGN KEY (`emission_factor_id`) REFERENCES `emission_factor`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- Phase 1: EmissionsRecord 테이블 향상
-- ================================================

-- 1. 기존 칼럼 유지 및 새 칼럼 추가
ALTER TABLE `emissions_record`
  ADD COLUMN `emission_factor_version` VARCHAR(20) COLLATE utf8mb4_unicode_ci AFTER `emission_factor_id`,
  ADD COLUMN `calculation_method` VARCHAR(50) COLLATE utf8mb4_unicode_ci DEFAULT 'location-based' AFTER `emission_factor_value`,
  ADD COLUMN `data_source` VARCHAR(50) COLLATE utf8mb4_unicode_ci DEFAULT 'sensor' AFTER `calculation_method`,
  ADD COLUMN `data_quality` VARCHAR(20) COLLATE utf8mb4_unicode_ci DEFAULT 'good' AFTER `data_source`,
  ADD COLUMN `activity_data_snapshot` JSON AFTER `activity_unit`,
  ADD COLUMN `recorded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) AFTER `period`,
  ADD COLUMN `calculated_by` VARCHAR(191) COLLATE utf8mb4_unicode_ci DEFAULT 'system' AFTER `archive_reason`,
  ADD COLUMN `data_submitted_by` VARCHAR(191) AFTER `calculated_by`;

-- 2. Scope 필드 값 업데이트 (scope2 -> scope2_location)
UPDATE `emissions_record` SET `scope` = 'scope2_location' WHERE `scope` = 'scope2';

-- 3. 인덱스 추가
ALTER TABLE `emissions_record` ADD INDEX `emissions_record_data_quality_idx` (`data_quality`);

