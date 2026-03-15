-- Phase 3: ESG Report Audit Trail Tables
-- Big4 감사 대응: 리포트 생성 감사, 상태 변경 감사, 데이터 출처 추적
-- Date: 2026-03-06
-- Backward compatible: 기존 esg_report 테이블 무수정

-- ─── 1. report_generation_log ─────────────────────────────────────────────────
-- 리포트 생성 시도 감사 로그 (성공/실패 모두 기록)
CREATE TABLE IF NOT EXISTS `report_generation_log` (
  `id`            VARCHAR(36)  NOT NULL,
  `tenant_id`     VARCHAR(36)  NOT NULL,
  `report_id`     VARCHAR(36)  NULL COMMENT '성공 시만 연결',
  `standard`      VARCHAR(50)  NOT NULL,
  `period`        VARCHAR(10)  NOT NULL,
  `status`        VARCHAR(20)  NOT NULL COMMENT 'pending|success|failed',
  `duration_ms`   INT          NULL,
  `error_message` TEXT         NULL,
  `triggered_by`  VARCHAR(36)  NOT NULL,
  `input_hash`    VARCHAR(64)  NULL COMMENT 'SHA-256 of GenerateESGReportInput',
  `created_at`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `report_generation_log_tenant_id_created_at_idx` (`tenant_id`, `created_at`),
  INDEX `report_generation_log_report_id_idx` (`report_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='리포트 생성 감사 로그 — Append-only';

-- ─── 2. report_audit_log ─────────────────────────────────────────────────────
-- 리포트 상태 변경 감사 로그 (Append-only, 수정/삭제 불가)
CREATE TABLE IF NOT EXISTS `report_audit_log` (
  `id`           VARCHAR(36)  NOT NULL,
  `report_id`    VARCHAR(36)  NOT NULL,
  `tenant_id`    VARCHAR(36)  NOT NULL,
  `action`       VARCHAR(50)  NOT NULL COMMENT 'generate|submit_review|approve|publish|withdraw|reissue',
  `from_status`  VARCHAR(30)  NULL,
  `to_status`    VARCHAR(30)  NULL,
  `performed_by` VARCHAR(36)  NOT NULL,
  `note`         TEXT         NULL,
  `metadata`     JSON         NULL,
  `created_at`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `report_audit_log_report_id_created_at_idx` (`report_id`, `created_at`),
  INDEX `report_audit_log_tenant_id_action_idx` (`tenant_id`, `action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='리포트 상태 변경 감사 로그 — Append-only';

-- ─── 3. report_data_source ────────────────────────────────────────────────────
-- 리포트에 사용된 원본 데이터 출처 추적 (데이터 계보/Lineage)
CREATE TABLE IF NOT EXISTS `report_data_source` (
  `id`            VARCHAR(36)    NOT NULL,
  `report_id`     VARCHAR(36)    NOT NULL,
  `tenant_id`     VARCHAR(36)    NOT NULL,
  `source_type`   VARCHAR(50)    NOT NULL COMMENT 'emissions_record|manual_input|invoice|meter_reading',
  `source_id`     VARCHAR(36)    NOT NULL COMMENT '원본 레코드 ID',
  `scope`         VARCHAR(30)    NOT NULL COMMENT 'scope1|scope2_location|scope2_market|scope3',
  `period`        VARCHAR(10)    NOT NULL,
  `activity_data` DECIMAL(20,6)  NOT NULL,
  `activity_unit` VARCHAR(20)    NOT NULL,
  `emissions`     DECIMAL(20,6)  NOT NULL,
  `data_quality`  VARCHAR(20)    NOT NULL COMMENT 'sensor|manual|estimated',
  `metadata`      JSON           NULL,
  `created_at`    DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `report_data_source_report_id_idx` (`report_id`),
  INDEX `report_data_source_tenant_id_period_idx` (`tenant_id`, `period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='리포트 데이터 출처 계보 — 감사 추적용';
