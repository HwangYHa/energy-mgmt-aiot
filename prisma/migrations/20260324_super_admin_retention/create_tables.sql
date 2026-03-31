CREATE TABLE IF NOT EXISTS `tenant_churn_score` (
  `id` VARCHAR(36) NOT NULL,
  `tenant_id` VARCHAR(36) NOT NULL,
  `period` VARCHAR(10) NOT NULL,
  `churn_score` INT NOT NULL DEFAULT 0,
  `risk_level` VARCHAR(20) NOT NULL DEFAULT 'normal',
  `onboarding_score` INT NOT NULL DEFAULT 0,
  `engagement_score` INT NOT NULL DEFAULT 0,
  `organization_score` INT NOT NULL DEFAULT 0,
  `roi_score` INT NOT NULL DEFAULT 0,
  `support_score` INT NOT NULL DEFAULT 0,
  `payment_score` INT NOT NULL DEFAULT 0,
  `score_reasons` JSON NULL,
  `action_taken` TINYINT(1) NOT NULL DEFAULT 0,
  `action_taken_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_churn_score_tenant_period` (`tenant_id`, `period`),
  INDEX `idx_churn_score_desc` (`churn_score` DESC, `created_at` DESC),
  INDEX `idx_churn_risk_level` (`risk_level`, `created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `retention_event` (
  `id` VARCHAR(36) NOT NULL,
  `tenant_id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NULL,
  `event_type` VARCHAR(80) NOT NULL,
  `properties` JSON NULL,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_re_tenant_type_time` (`tenant_id`, `event_type`, `occurred_at` DESC),
  INDEX `idx_re_user_time` (`user_id`, `occurred_at` DESC),
  INDEX `idx_re_type_time` (`event_type`, `occurred_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `onboarding_milestone` (
  `id` VARCHAR(36) NOT NULL,
  `tenant_id` VARCHAR(36) NOT NULL,
  `iot_connected_at` DATETIME(3) NULL,
  `first_data_at` DATETIME(3) NULL,
  `first_ai_analysis_at` DATETIME(3) NULL,
  `first_report_at` DATETIME(3) NULL,
  `first_alert_at` DATETIME(3) NULL,
  `ttfv_seconds` INT NULL,
  `completion_pct` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_onboarding_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `retention_action` (
  `id` VARCHAR(36) NOT NULL,
  `tenant_id` VARCHAR(36) NOT NULL,
  `trigger_type` VARCHAR(80) NOT NULL,
  `churn_score` INT NOT NULL DEFAULT 0,
  `channel` VARCHAR(30) NOT NULL,
  `template_id` VARCHAR(80) NOT NULL,
  `recipient_id` VARCHAR(36) NULL,
  `recipient_phone` VARCHAR(20) NULL,
  `recipient_email` VARCHAR(200) NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'sent',
  `sent_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `read_at` DATETIME(3) NULL,
  `responded` TINYINT(1) NOT NULL DEFAULT 0,
  `responded_at` DATETIME(3) NULL,
  `metadata` JSON NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_ra_tenant_time` (`tenant_id`, `sent_at` DESC),
  INDEX `idx_ra_trigger_time` (`trigger_type`, `sent_at` DESC),
  INDEX `idx_ra_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `kakao_alimtalk_log` (
  `id` VARCHAR(36) NOT NULL,
  `tenant_id` VARCHAR(36) NULL,
  `user_id` VARCHAR(36) NULL,
  `phone` VARCHAR(20) NOT NULL,
  `template_id` VARCHAR(80) NOT NULL,
  `variables` JSON NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `msg_key` VARCHAR(100) NULL,
  `fail_reason` TEXT NULL,
  `sent_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `idx_kal_tenant_time` (`tenant_id`, `sent_at` DESC),
  INDEX `idx_kal_status_time` (`status`, `sent_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
