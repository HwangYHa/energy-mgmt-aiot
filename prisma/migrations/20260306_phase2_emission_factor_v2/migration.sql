-- Phase 2: EmissionFactor v2 — Big4 감사 대응 스키마 확장
-- 모든 변경은 ALTER TABLE ADD COLUMN (nullable) → 기존 데이터 완전 보존
-- 실행 전 DB 백업 필수

-- ============================================================
-- 1. emission_factor 테이블 확장
-- ============================================================

-- 표준화 식별자
ALTER TABLE `emission_factor`
  ADD COLUMN `factor_code` VARCHAR(100) NULL COMMENT '표준 식별자 (예: kr-electricity-grid-location)' AFTER `source_type`,
  ADD COLUMN `country_code` CHAR(2) NULL COMMENT 'ISO 3166-1 국가코드 (KR, US, EU)' AFTER `factor_code`,
  ADD COLUMN `energy_type` VARCHAR(50) NULL COMMENT '에너지 타입 (electricity, diesel, lng, coal...)' AFTER `country_code`,
  ADD COLUMN `calculation_type` VARCHAR(20) NULL COMMENT '계산 방식 (location, market, activity, spend)' AFTER `energy_type`;

-- 출처 추적 강화
ALTER TABLE `emission_factor`
  ADD COLUMN `source_name` VARCHAR(200) NULL COMMENT '공식 기관명 (국가 온실가스 인벤토리 등)' AFTER `source`,
  ADD COLUMN `source_version` VARCHAR(50) NULL COMMENT '출처 버전 (2024년판, AR6 등)' AFTER `source_name`,
  ADD COLUMN `source_url` VARCHAR(500) NULL COMMENT '공식 문서 URL' AFTER `source_version`,
  ADD COLUMN `factor_source_type` VARCHAR(30) NULL COMMENT '계수 출처 유형 (official, international, tenant_custom)' AFTER `source_url`;

-- 승인 상태 머신
ALTER TABLE `emission_factor`
  ADD COLUMN `approval_status` VARCHAR(30) NOT NULL DEFAULT 'APPROVED'
    COMMENT '승인 상태: DRAFT|PENDING_REVIEW|APPROVED|REJECTED' AFTER `is_active`,
  ADD COLUMN `rejected_by` VARCHAR(191) NULL AFTER `approved_at`,
  ADD COLUMN `rejected_at` DATETIME(3) NULL AFTER `rejected_by`,
  ADD COLUMN `rejection_reason` TEXT NULL AFTER `rejected_at`,
  ADD COLUMN `change_reason` TEXT NULL COMMENT '버전 생성 사유' AFTER `rejection_reason`;

-- 레코드 무결성 Hash
ALTER TABLE `emission_factor`
  ADD COLUMN `record_hash` VARCHAR(64) NULL
    COMMENT 'SHA-256(핵심 필드 JSON) — 레코드 변조 탐지용' AFTER `change_reason`;

-- 계수 정밀도 향상: Decimal(15,8) → Decimal(20,10)
-- NOTE: MySQL에서 MODIFY는 기존 데이터 보존
ALTER TABLE `emission_factor`
  MODIFY COLUMN `factor` DECIMAL(20, 10) NOT NULL COMMENT '배출계수 값 (정밀도 10자리)';

-- 인덱스 추가
CREATE INDEX `idx_ef_tenant_factorcode_active`
  ON `emission_factor` (`tenant_id`, `factor_code`, `is_active`);

CREATE INDEX `idx_ef_tenant_country_energy_calc`
  ON `emission_factor` (`tenant_id`, `country_code`, `energy_type`, `calculation_type`);

CREATE INDEX `idx_ef_approval_status`
  ON `emission_factor` (`approval_status`);

CREATE INDEX `idx_ef_factorcode_validfrom`
  ON `emission_factor` (`factor_code`, `valid_from` DESC);

-- ============================================================
-- 2. emission_factor_audit_log 테이블 확장
-- ============================================================

-- 전체 스냅샷 (Big4 감사: 변경 전/후 완전 재현)
ALTER TABLE `emission_factor_audit_log`
  ADD COLUMN `previous_snapshot` JSON NULL
    COMMENT '변경 전 전체 레코드 스냅샷' AFTER `change_reason`,
  ADD COLUMN `current_snapshot` JSON NULL
    COMMENT '변경 후 전체 레코드 스냅샷' AFTER `previous_snapshot`;

-- 법적 증거 필드
ALTER TABLE `emission_factor_audit_log`
  ADD COLUMN `ip_address` VARCHAR(45) NULL COMMENT '요청자 IP (IPv4/IPv6)' AFTER `approved_at`,
  ADD COLUMN `user_agent` VARCHAR(500) NULL COMMENT '요청자 User-Agent' AFTER `ip_address`,
  ADD COLUMN `audited_by` VARCHAR(191) NULL COMMENT '외부 감사인 ID' AFTER `user_agent`,
  ADD COLUMN `audited_at` DATETIME(3) NULL COMMENT '외부 감사 시각' AFTER `audited_by`;

-- 인덱스 재구성
DROP INDEX `emission_factor_audit_log_emission_factor_id_idx`
  ON `emission_factor_audit_log`;

CREATE INDEX `idx_efal_factor_time_asc`
  ON `emission_factor_audit_log` (`emission_factor_id`, `requested_at` ASC);

CREATE INDEX `idx_efal_change_type`
  ON `emission_factor_audit_log` (`change_type`);

CREATE INDEX `idx_efal_requested_by`
  ON `emission_factor_audit_log` (`requested_by`);

-- ============================================================
-- 3. 기존 데이터 마이그레이션
-- ============================================================

-- 기존 활성 계수 → approvalStatus = APPROVED (이미 default로 설정됨)
-- 비활성 계수 → approvalStatus = DRAFT
UPDATE `emission_factor`
  SET `approval_status` = 'DRAFT'
  WHERE `is_active` = 0 AND `approved_at` IS NULL;

-- factorCode 백필: code 기반으로 생성 (없는 경우)
UPDATE `emission_factor`
  SET `factor_code` = LOWER(REPLACE(REPLACE(`code`, '_', '-'), ' ', '-'))
  WHERE `factor_code` IS NULL;

-- countryCode 백필: region 기반
UPDATE `emission_factor`
  SET `country_code` = UPPER(`region`)
  WHERE `country_code` IS NULL AND `region` IS NOT NULL;

-- sourceName 백필: source 기반
UPDATE `emission_factor`
  SET `source_name` = `source`
  WHERE `source_name` IS NULL;
