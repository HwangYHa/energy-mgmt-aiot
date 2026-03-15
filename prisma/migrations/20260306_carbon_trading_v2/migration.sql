-- Migration: Carbon Trading v2 — Production-grade Registry + Ledger
-- Phase: 4 new tables (carbon_credit_registry, carbon_ledger_entry,
--                       carbon_retirement_certificate, carbon_payment)

-- 1. 탄소 크레딧 레지스트리 (법적 추적 가능 자산)
CREATE TABLE `carbon_credit_registry` (
  `id`                  VARCHAR(191)  NOT NULL,
  `tenant_id`           VARCHAR(191)  NOT NULL,
  `registry`            VARCHAR(50)   NOT NULL,            -- K-ETS | Verra | GoldStandard
  `project_id`          VARCHAR(100)  NOT NULL,
  `serial_number_start` VARCHAR(200)  NOT NULL,
  `serial_number_end`   VARCHAR(200)  NOT NULL,
  `vintage_year`        INT           NOT NULL,
  `credit_type`         VARCHAR(20)   NOT NULL,            -- KAU | KCU | OFFSET | VER
  `certification_body`  VARCHAR(100)  NOT NULL,
  `issuance_date`       DATE          NOT NULL,
  `total_quantity`      DECIMAL(20,6) NOT NULL,
  `available_quantity`  DECIMAL(20,6) NOT NULL,
  `retired_quantity`    DECIMAL(20,6) NOT NULL DEFAULT 0,
  `locked_quantity`     DECIMAL(20,6) NOT NULL DEFAULT 0,
  `version`             INT           NOT NULL DEFAULT 0,  -- 낙관적 잠금
  `status`              VARCHAR(20)   NOT NULL DEFAULT 'active',
  `created_at`          DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`          DATETIME(3)   NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE KEY `carbon_credit_registry_unique` (`tenant_id`, `registry`, `project_id`, `serial_number_start`, `vintage_year`),
  INDEX `carbon_credit_registry_tenant_type_vintage_idx` (`tenant_id`, `credit_type`, `vintage_year`),
  INDEX `carbon_credit_registry_tenant_status_idx` (`tenant_id`, `status`),
  CONSTRAINT `carbon_credit_registry_tenant_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenant` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. 추가전용 거래 원장 (Event Sourcing)
CREATE TABLE `carbon_ledger_entry` (
  `id`                VARCHAR(191)   NOT NULL,
  `tenant_id`         VARCHAR(191)   NOT NULL,
  `registry_id`       VARCHAR(191)   NOT NULL,
  `event_type`        VARCHAR(20)    NOT NULL,             -- BUY | SELL | RETIRE | LOCK | UNLOCK | CANCEL
  `quantity`          DECIMAL(20,6)  NOT NULL,
  `unit_price`        DECIMAL(15,2)  NOT NULL DEFAULT 0,
  `total_amount`      DECIMAL(20,2)  NOT NULL DEFAULT 0,
  `currency`          VARCHAR(3)     NOT NULL DEFAULT 'KRW',
  `counterparty`      VARCHAR(200)   NULL,
  `payment_status`    VARCHAR(20)    NOT NULL DEFAULT 'N/A',
  `settlement_status` VARCHAR(20)    NOT NULL DEFAULT 'N/A',
  `idempotency_key`   VARCHAR(128)   NULL,                 -- 중복 방지
  `hash_signature`    VARCHAR(64)    NOT NULL,             -- SHA-256
  `prev_hash`         VARCHAR(64)    NULL,                 -- 해시 체인
  `memo`              TEXT           NULL,
  `metadata`          JSON           NULL,
  `created_at`        DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE KEY `carbon_ledger_entry_idempotency_key_key` (`idempotency_key`),
  INDEX `carbon_ledger_entry_tenant_created_idx` (`tenant_id`, `created_at` DESC),
  INDEX `carbon_ledger_entry_tenant_event_idx` (`tenant_id`, `event_type`),
  INDEX `carbon_ledger_entry_registry_idx` (`registry_id`),
  CONSTRAINT `carbon_ledger_entry_tenant_fk`   FOREIGN KEY (`tenant_id`)   REFERENCES `tenant` (`id`) ON DELETE CASCADE,
  CONSTRAINT `carbon_ledger_entry_registry_fk` FOREIGN KEY (`registry_id`) REFERENCES `carbon_credit_registry` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 소각(상계) 인증서
CREATE TABLE `carbon_retirement_certificate` (
  `id`                  VARCHAR(191)   NOT NULL,
  `tenant_id`           VARCHAR(191)   NOT NULL,
  `ledger_entry_id`     VARCHAR(191)   NOT NULL,
  `registry_id`         VARCHAR(191)   NOT NULL,
  `retirement_id`       VARCHAR(50)    NOT NULL,           -- RET-YYYYMMDD-NNNNN
  `serial_numbers`      TEXT           NOT NULL,           -- JSON array
  `retired_quantity`    DECIMAL(20,6)  NOT NULL,
  `retirement_reason`   TEXT           NOT NULL,
  `beneficiary_company` VARCHAR(200)   NOT NULL,
  `retirement_date`     DATE           NOT NULL,
  `registry_reference`  VARCHAR(200)   NULL,
  `certificate_pdf_url` VARCHAR(500)   NULL,
  `offset_scope`        VARCHAR(20)    NULL,               -- scope1 | scope2 | scope3
  `compliance_period`   VARCHAR(10)    NULL,               -- "2025"
  `kets_submission_id`  VARCHAR(100)   NULL,
  `created_at`          DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE KEY `carbon_retirement_certificate_ledger_key` (`ledger_entry_id`),
  UNIQUE KEY `carbon_retirement_certificate_retirement_id_key` (`retirement_id`),
  INDEX `carbon_retirement_certificate_tenant_date_idx` (`tenant_id`, `retirement_date` DESC),
  INDEX `carbon_retirement_certificate_tenant_period_idx` (`tenant_id`, `compliance_period`),
  CONSTRAINT `carbon_retirement_cert_tenant_fk`  FOREIGN KEY (`tenant_id`)       REFERENCES `tenant` (`id`) ON DELETE CASCADE,
  CONSTRAINT `carbon_retirement_cert_ledger_fk`  FOREIGN KEY (`ledger_entry_id`) REFERENCES `carbon_ledger_entry` (`id`),
  CONSTRAINT `carbon_retirement_cert_registry_fk` FOREIGN KEY (`registry_id`)   REFERENCES `carbon_credit_registry` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. 결제 라이프사이클
CREATE TABLE `carbon_payment` (
  `id`                VARCHAR(191)   NOT NULL,
  `tenant_id`         VARCHAR(191)   NOT NULL,
  `ledger_entry_id`   VARCHAR(191)   NOT NULL,
  `payment_method`    VARCHAR(20)    NOT NULL,             -- bank_transfer | pg | escrow
  `payment_status`    VARCHAR(20)    NOT NULL DEFAULT 'INITIATED',
  `amount`            DECIMAL(20,2)  NOT NULL,
  `currency`          VARCHAR(3)     NOT NULL DEFAULT 'KRW',
  `pg_provider`       VARCHAR(50)    NULL,
  `pg_transaction_id` VARCHAR(200)   NULL,
  `bank_ref_number`   VARCHAR(100)   NULL,
  `bank_code`         VARCHAR(10)    NULL,
  `account_last4`     VARCHAR(4)     NULL,
  `escrow_release_at` DATETIME(3)    NULL,
  `initiated_at`      DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `settled_at`        DATETIME(3)    NULL,
  `failed_at`         DATETIME(3)    NULL,
  `failure_reason`    TEXT           NULL,
  `metadata`          JSON           NULL,

  PRIMARY KEY (`id`),
  UNIQUE KEY `carbon_payment_ledger_key` (`ledger_entry_id`),
  INDEX `carbon_payment_tenant_status_idx` (`tenant_id`, `payment_status`),
  INDEX `carbon_payment_pg_tx_idx` (`pg_transaction_id`),
  CONSTRAINT `carbon_payment_tenant_fk`  FOREIGN KEY (`tenant_id`)       REFERENCES `tenant` (`id`) ON DELETE CASCADE,
  CONSTRAINT `carbon_payment_ledger_fk`  FOREIGN KEY (`ledger_entry_id`) REFERENCES `carbon_ledger_entry` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
