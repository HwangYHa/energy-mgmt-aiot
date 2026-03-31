-- ================================================================
-- Migration: 20260324_super_admin_retention
-- 목적: Super Admin 리텐션/이탈예측 시스템
--   - tenant_churn_score   : 일별 이탈 예측 점수
--   - retention_event      : 행동 이벤트 트래킹
--   - onboarding_milestone : TTFV 온보딩 마일스톤
--   - retention_action     : 자동 리텐션 액션 이력
--   - kakao_alimtalk_log   : 카카오 알림톡 발송 이력
-- ================================================================

-- ──────────────────────────────────────────
-- 1. tenant_churn_score
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `tenant_churn_score` (
  `id`                VARCHAR(36)  NOT NULL,
  `tenant_id`         VARCHAR(36)  NOT NULL,
  `period`            VARCHAR(10)  NOT NULL COMMENT 'YYYY-MM-DD',

  -- 총점 (0=건강, 100=즉시이탈위험)
  `churn_score`       INT          NOT NULL DEFAULT 0,
  `risk_level`        VARCHAR(20)  NOT NULL DEFAULT 'normal' COMMENT 'normal|warning|critical',

  -- 세부 점수 요소 (0~100 환산값, 가중치 적용 전)
  `onboarding_score`   INT NOT NULL DEFAULT 0 COMMENT '가중치 20%',
  `engagement_score`   INT NOT NULL DEFAULT 0 COMMENT '가중치 25%',
  `organization_score` INT NOT NULL DEFAULT 0 COMMENT '가중치 15%',
  `roi_score`          INT NOT NULL DEFAULT 0 COMMENT '가중치 20%',
  `support_score`      INT NOT NULL DEFAULT 0 COMMENT '가중치 10%',
  `payment_score`      INT NOT NULL DEFAULT 0 COMMENT '가중치 10%',

  `score_reasons`     JSON         NULL COMMENT '점수 계산 근거',

  `action_taken`      TINYINT(1)   NOT NULL DEFAULT 0,
  `action_taken_at`   DATETIME(3)  NULL,
  `created_at`        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_churn_score_tenant_period` (`tenant_id`, `period`),
  INDEX `idx_churn_score_desc`  (`churn_score` DESC, `created_at` DESC),
  INDEX `idx_churn_risk_level`  (`risk_level`, `created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────
-- 2. retention_event
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `retention_event` (
  `id`           VARCHAR(36)  NOT NULL,
  `tenant_id`    VARCHAR(36)  NOT NULL,
  `user_id`      VARCHAR(36)  NULL,
  `event_type`   VARCHAR(80)  NOT NULL COMMENT 'login|device_connected|iot_data_received|ai_analysis_run|report_generated|...',
  `properties`   JSON         NULL,
  `occurred_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `idx_re_tenant_type_time` (`tenant_id`, `event_type`, `occurred_at` DESC),
  INDEX `idx_re_user_time`        (`user_id`, `occurred_at` DESC),
  INDEX `idx_re_type_time`        (`event_type`, `occurred_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────
-- 3. onboarding_milestone
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `onboarding_milestone` (
  `id`                  VARCHAR(36)  NOT NULL,
  `tenant_id`           VARCHAR(36)  NOT NULL,

  `iot_connected_at`    DATETIME(3)  NULL,
  `first_data_at`       DATETIME(3)  NULL,
  `first_ai_analysis_at` DATETIME(3) NULL,
  `first_report_at`     DATETIME(3)  NULL,
  `first_alert_at`      DATETIME(3)  NULL,

  `ttfv_seconds`        INT          NULL COMMENT 'IoT연결→첫데이터(초)',
  `completion_pct`      INT          NOT NULL DEFAULT 0 COMMENT '0~100',

  `created_at`          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_onboarding_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────
-- 4. retention_action
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `retention_action` (
  `id`               VARCHAR(36)   NOT NULL,
  `tenant_id`        VARCHAR(36)   NOT NULL,

  `trigger`          VARCHAR(80)   NOT NULL COMMENT 'churn_critical|no_login_7d|onboarding_stuck|payment_failed_3|roi_negative',
  `churn_score`      INT           NOT NULL DEFAULT 0,
  `channel`          VARCHAR(30)   NOT NULL COMMENT 'email|sms|kakao|slack',
  `template_id`      VARCHAR(80)   NOT NULL,

  `recipient_id`     VARCHAR(36)   NULL,
  `recipient_phone`  VARCHAR(20)   NULL,
  `recipient_email`  VARCHAR(200)  NULL,

  `status`           VARCHAR(20)   NOT NULL DEFAULT 'sent' COMMENT 'sent|delivered|read|failed',
  `sent_at`          DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `read_at`          DATETIME(3)   NULL,

  `responded`        TINYINT(1)    NOT NULL DEFAULT 0,
  `responded_at`     DATETIME(3)   NULL,
  `metadata`         JSON          NULL,

  PRIMARY KEY (`id`),
  INDEX `idx_ra_tenant_time` (`tenant_id`, `sent_at` DESC),
  INDEX `idx_ra_trigger_time` (`trigger`, `sent_at` DESC),
  INDEX `idx_ra_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────
-- 5. kakao_alimtalk_log
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `kakao_alimtalk_log` (
  `id`           VARCHAR(36)   NOT NULL,
  `tenant_id`    VARCHAR(36)   NULL,
  `user_id`      VARCHAR(36)   NULL,
  `phone`        VARCHAR(20)   NOT NULL,
  `template_id`  VARCHAR(80)   NOT NULL,
  `variables`    JSON          NULL,
  `status`       VARCHAR(20)   NOT NULL DEFAULT 'pending' COMMENT 'pending|sent|delivered|failed',
  `msg_key`      VARCHAR(100)  NULL COMMENT 'Solapi 메시지 키',
  `fail_reason`  TEXT          NULL,
  `sent_at`      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `idx_kal_tenant_time` (`tenant_id`, `sent_at` DESC),
  INDEX `idx_kal_status_time` (`status`, `sent_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────
-- 6. Super Admin 메뉴 등록
-- ──────────────────────────────────────────
INSERT IGNORE INTO `menu_group`
  (`id`, `name`, `display_name`, `icon`, `display_order`, `min_role`, `is_active`, `created_at`, `updated_at`)
VALUES
  ('super_admin_main', 'super_admin', 'Super Admin', 'Shield', 99, 'super_admin', 1, NOW(), NOW());

INSERT IGNORE INTO `menu_item`
  (`id`, `menu_group_id`, `name`, `display_name`, `path`, `icon`, `display_order`, `min_role`, `is_active`, `is_visible`, `created_at`, `updated_at`)
VALUES
  ('super_admin_dashboard', 'super_admin_main', 'super_admin_dashboard', '리텐션 대시보드', '/super-admin', 'BarChart3', 1, 'super_admin', 1, 1, NOW(), NOW()),
  ('super_admin_tenants',   'super_admin_main', 'super_admin_tenants',   '테넌트 관리',    '/admin/tenants', 'Building2', 2, 'super_admin', 1, 1, NOW(), NOW());
