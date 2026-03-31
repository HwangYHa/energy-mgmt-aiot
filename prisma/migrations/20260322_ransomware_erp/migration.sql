-- Migration: 랜섬웨어 대응 + ERP (인보이스, KPI 스냅샷) 테이블 추가
-- Date: 2026-03-22

-- ── 1. 랜섬웨어 알림 테이블 ─────────────────────────────────
CREATE TABLE IF NOT EXISTS `ransomware_alert` (
  `id`          VARCHAR(36)  NOT NULL,
  `tenant_id`   VARCHAR(36)  NULL,
  `alert_type`  VARCHAR(50)  NOT NULL,
  `severity`    VARCHAR(20)  NOT NULL,
  `description` TEXT         NOT NULL,
  `source_ip`   VARCHAR(45)  NULL,
  `user_id`     VARCHAR(36)  NULL,
  `metadata`    JSON         NULL,
  `status`      VARCHAR(20)  NOT NULL DEFAULT 'open',
  `resolved_by` VARCHAR(36)  NULL,
  `resolved_at` DATETIME(3)  NULL,
  `created_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `ransomware_alert_tenant_status_created_idx` (`tenant_id`, `status`, `created_at`),
  INDEX `ransomware_alert_type_severity_idx`        (`alert_type`, `severity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 2. 백업 기록 테이블 ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS `backup_record` (
  `id`            VARCHAR(36)   NOT NULL,
  `backup_type`   VARCHAR(20)   NOT NULL,
  `status`        VARCHAR(20)   NOT NULL,
  `size_bytes`    BIGINT        NULL,
  `storage_path`  VARCHAR(500)  NOT NULL,
  `checksum`      VARCHAR(64)   NULL,
  `is_immutable`  TINYINT(1)    NOT NULL DEFAULT 1,
  `expires_at`    DATETIME(3)   NULL,
  `started_at`    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completed_at`  DATETIME(3)   NULL,
  `metadata`      JSON          NULL,
  PRIMARY KEY (`id`),
  INDEX `backup_record_type_status_idx` (`backup_type`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 3. 인보이스 테이블 ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS `invoice` (
  `id`              VARCHAR(36)    NOT NULL,
  `invoice_no`      VARCHAR(30)    NOT NULL,
  `tenant_id`       VARCHAR(36)    NOT NULL,
  `subscription_id` VARCHAR(36)    NULL,
  `period_start`    VARCHAR(10)    NOT NULL,
  `period_end`      VARCHAR(10)    NOT NULL,
  `subtotal`        DECIMAL(12,2)  NOT NULL,
  `tax_rate`        DECIMAL(5,4)   NOT NULL DEFAULT 0.1000,
  `tax_amount`      DECIMAL(12,2)  NOT NULL,
  `total`           DECIMAL(12,2)  NOT NULL,
  `currency`        VARCHAR(3)     NOT NULL DEFAULT 'KRW',
  `status`          VARCHAR(20)    NOT NULL DEFAULT 'draft',
  `due_date`        DATETIME(3)    NOT NULL,
  `paid_at`         DATETIME(3)    NULL,
  `notes`           TEXT           NULL,
  `created_at`      DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `invoice_invoice_no_key`          (`invoice_no`),
  INDEX `invoice_tenant_id_status_idx`           (`tenant_id`, `status`),
  INDEX `invoice_period_start_status_idx`        (`period_start`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 4. 인보이스 라인 아이템 테이블 ──────────────────────────
CREATE TABLE IF NOT EXISTS `invoice_line_item` (
  `id`          VARCHAR(36)    NOT NULL,
  `invoice_id`  VARCHAR(36)    NOT NULL,
  `description` VARCHAR(500)   NOT NULL,
  `quantity`    INT            NOT NULL DEFAULT 1,
  `unit_price`  DECIMAL(12,2)  NOT NULL,
  `amount`      DECIMAL(12,2)  NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `invoice_line_item_invoice_id_fkey`
    FOREIGN KEY (`invoice_id`) REFERENCES `invoice` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 5. KPI 스냅샷 테이블 ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS `kpi_snapshot` (
  `id`               VARCHAR(36)   NOT NULL,
  `tenant_id`        VARCHAR(36)   NOT NULL,
  `period`           VARCHAR(7)    NOT NULL,
  `total_kwh`        DECIMAL(15,3) NOT NULL,
  `peak_kw`          DECIMAL(10,3) NOT NULL,
  `baseline_kwh`     DECIMAL(15,3) NULL,
  `saved_kwh`        DECIMAL(15,3) NULL,
  `total_co2_kg`     DECIMAL(15,3) NOT NULL,
  `saved_co2_kg`     DECIMAL(15,3) NULL,
  `energy_cost_krw`  DECIMAL(15,2) NULL,
  `saved_cost_krw`   DECIMAL(15,2) NULL,
  `investment_krw`   DECIMAL(15,2) NULL,
  `roi_percent`      DECIMAL(8,2)  NULL,
  `payback_months`   DECIMAL(6,1)  NULL,
  `created_at`       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `kpi_snapshot_tenant_id_period_key` (`tenant_id`, `period`),
  INDEX `kpi_snapshot_period_idx`                  (`period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
