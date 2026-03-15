-- ============================================================
-- Phase 4: Carbon Extensions — VCM / 블록체인 토큰 / 테넌트 지갑
-- ============================================================
-- 적용 대상: 탄소 거래 v2 확장 (carbon_credit_registry 기존 유지)
-- 새 테이블: carbon_vcm_project, carbon_token_record, tenant_carbon_wallet
-- ============================================================

-- ------------------------------------------------------------
-- 1. carbon_vcm_project
--    자발적 탄소 시장(VCM) 프로젝트 메타데이터
--    carbon_credit_registry 1:1 확장
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `carbon_vcm_project` (
  `id`                        VARCHAR(36)   NOT NULL,
  `registry_id`               VARCHAR(36)   NOT NULL,
  `project_category`          VARCHAR(50)   NOT NULL,
  `verra_project_id`          VARCHAR(50)   NULL,
  `gold_standard_id`          VARCHAR(50)   NULL,
  `country_code`              VARCHAR(3)    NOT NULL,
  `project_start_date`        DATE          NOT NULL,
  `monitoring_period_start`   DATE          NOT NULL,
  `monitoring_period_end`     DATE          NOT NULL,
  `addiionality_rating`       VARCHAR(10)   NOT NULL DEFAULT 'unrated',
  `permanence_risk`           VARCHAR(10)   NOT NULL DEFAULT 'medium',
  `sdg_goals`                 JSON          NOT NULL DEFAULT (JSON_ARRAY()),
  `biodiversity_impact`       BOOLEAN       NOT NULL DEFAULT FALSE,
  `community_benefit`         BOOLEAN       NOT NULL DEFAULT FALSE,
  `water_conservation`        BOOLEAN       NOT NULL DEFAULT FALSE,
  `livelihood_improvement`    BOOLEAN       NOT NULL DEFAULT FALSE,
  `co_benefit_description`    TEXT          NULL,
  `third_party_verifier`      VARCHAR(100)  NULL,
  `verification_report_url`   VARCHAR(500)  NULL,
  `baseline_methodology`      VARCHAR(100)  NULL,
  `expected_annual_reductions` DECIMAL(15,2) NULL,
  `created_at`                DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`                DATETIME(3)   NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE KEY `carbon_vcm_project_registry_id_key` (`registry_id`),
  INDEX `carbon_vcm_project_project_category_idx` (`project_category`),
  INDEX `carbon_vcm_project_country_code_idx` (`country_code`),

  CONSTRAINT `carbon_vcm_project_registry_fk`
    FOREIGN KEY (`registry_id`)
    REFERENCES `carbon_credit_registry` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 2. carbon_token_record
--    블록체인 토큰화 탄소 크레딧 레코드
--    Toucan/KlimaDAO/C3 온체인 토큰과 연결
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `carbon_token_record` (
  `id`                  VARCHAR(36)    NOT NULL,
  `tenant_id`           VARCHAR(36)    NOT NULL,
  `registry_id`         VARCHAR(36)    NOT NULL,
  `wallet_address`      VARCHAR(100)   NOT NULL,
  `token_standard`      VARCHAR(20)    NOT NULL,     -- ERC-20|ERC-1155|ERC-721|SPL
  `network`             VARCHAR(30)    NOT NULL,     -- ethereum|polygon|celo|solana
  `protocol`            VARCHAR(20)    NOT NULL DEFAULT 'custom',  -- toucan|klimadao|c3|custom
  `contract_address`    VARCHAR(100)   NOT NULL,
  `token_id`            VARCHAR(100)   NULL,         -- ERC-1155/721 전용
  `tokenized_quantity`  DECIMAL(20,6)  NOT NULL,
  `on_chain_status`     VARCHAR(30)    NOT NULL,     -- pending|confirmed|bridging|retired_on_chain|failed|syncing
  `tx_hash`             VARCHAR(100)   NULL,
  `block_number`        BIGINT         NULL,
  `bridged_at`          DATETIME(3)    NULL,
  `retired_on_chain_at` DATETIME(3)    NULL,
  `metadata`            JSON           NULL,
  `created_at`          DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`          DATETIME(3)    NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `carbon_token_record_tenant_status_idx`  (`tenant_id`, `on_chain_status`),
  INDEX `carbon_token_record_registry_id_idx`    (`registry_id`),
  INDEX `carbon_token_record_wallet_address_idx` (`wallet_address`),
  INDEX `carbon_token_record_tenant_network_idx` (`tenant_id`, `network`),

  CONSTRAINT `carbon_token_record_tenant_fk`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `tenant` (`id`)
    ON DELETE CASCADE,

  CONSTRAINT `carbon_token_record_registry_fk`
    FOREIGN KEY (`registry_id`)
    REFERENCES `carbon_credit_registry` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 3. tenant_carbon_wallet
--    테넌트별 블록체인 지갑 주소 관리
--    멀티테넌트: 테넌트당 1개 (UNIQUE tenant_id)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tenant_carbon_wallet` (
  `id`              VARCHAR(36)   NOT NULL,
  `tenant_id`       VARCHAR(36)   NOT NULL,
  `network`         VARCHAR(30)   NOT NULL,    -- ethereum|polygon|celo|solana
  `wallet_address`  VARCHAR(100)  NOT NULL,
  `is_verified`     BOOLEAN       NOT NULL DEFAULT FALSE,
  `verified_at`     DATETIME(3)   NULL,
  `created_at`      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`      DATETIME(3)   NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE KEY `tenant_carbon_wallet_tenant_id_key` (`tenant_id`),
  INDEX `tenant_carbon_wallet_network_idx` (`network`),

  CONSTRAINT `tenant_carbon_wallet_tenant_fk`
    FOREIGN KEY (`tenant_id`)
    REFERENCES `tenant` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
