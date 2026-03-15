-- ============================================================
-- Migration: RBAC Feature & PlanFeature Tables
-- Phase: RBAC + Subscription + Feature Flag Refactoring
-- Date: 2026-03-07
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. feature — 기능 단위 정의 테이블
-- ──────────────────────────────────────────────────────────
CREATE TABLE `feature` (
  `id`          VARCHAR(36)  NOT NULL,
  `code`        VARCHAR(100) NOT NULL,
  `name`        VARCHAR(200) NOT NULL,
  `description` TEXT         NULL,
  `category`    VARCHAR(50)  NOT NULL,
  `is_active`   TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`  DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `feature_code_key` (`code`),
  INDEX `feature_category_is_active_idx` (`category`, `is_active`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────
-- 2. plan_feature — Plan × Feature 매핑 테이블
-- ──────────────────────────────────────────────────────────
CREATE TABLE `plan_feature` (
  `id`           VARCHAR(36)  NOT NULL,
  `plan_id`      VARCHAR(36)  NOT NULL,
  `feature_code` VARCHAR(100) NOT NULL,
  `limit_value`  INT          NULL,
  `limit_unit`   VARCHAR(30)  NULL,
  `created_at`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `plan_feature_plan_id_feature_code_key` (`plan_id`, `feature_code`),
  INDEX `plan_feature_plan_id_idx` (`plan_id`),
  INDEX `plan_feature_feature_code_idx` (`feature_code`),
  CONSTRAINT `plan_feature_plan_id_fkey`
    FOREIGN KEY (`plan_id`) REFERENCES `plan` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `plan_feature_feature_code_fkey`
    FOREIGN KEY (`feature_code`) REFERENCES `feature` (`code`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────
-- 3. 기본 Feature 데이터 시드
-- ──────────────────────────────────────────────────────────
INSERT INTO `feature` (`id`, `code`, `name`, `description`, `category`, `is_active`, `created_at`, `updated_at`) VALUES
  -- analytics
  (UUID(), 'energy_monitoring',   '에너지 모니터링',          '실시간 에너지 사용량 모니터링',                 'analytics', 1, NOW(), NOW()),
  (UUID(), 'cost_analysis',       '비용 분석',                '에너지 비용 분석 및 리포트',                   'analytics', 1, NOW(), NOW()),
  (UUID(), 'carbon_analytics',    '탄소 분석',                '탄소 배출량 분석 및 추적',                     'analytics', 1, NOW(), NOW()),
  (UUID(), 'carbon_trading',      '탄소 거래',                'K-ETS 및 VCM 탄소 크레딧 거래',               'analytics', 1, NOW(), NOW()),
  (UUID(), 'compliance_report',   '규제 준수 보고',           'K-MRV, GHG Protocol 등 규제 보고서 생성',     'analytics', 1, NOW(), NOW()),
  (UUID(), 'advanced_analytics',  '고급 분석',                '원데이터 접근 및 커스텀 분석',                 'analytics', 1, NOW(), NOW()),
  -- ai
  (UUID(), 'ai_anomaly',          'AI 이상 탐지',             'AI 기반 에너지 이상 패턴 탐지',               'ai',        1, NOW(), NOW()),
  (UUID(), 'ai_forecast',         'AI 수요 예측',             'AI 기반 에너지 수요 예측',                    'ai',        1, NOW(), NOW()),
  (UUID(), 'ai_optimize',         'AI 최적화',                'AI 기반 설비 제어 최적화',                    'ai',        1, NOW(), NOW()),
  -- control
  (UUID(), 'device_control',      '설비 제어',                '설비 원격 제어 및 스케줄링',                  'control',   1, NOW(), NOW()),
  (UUID(), 'digital_twin',        '디지털 트윈',              '3D 디지털 트윈 시각화',                       'control',   1, NOW(), NOW()),
  (UUID(), 'edge_gateway',        'Edge Gateway',            'Edge Gateway 관리 및 데이터 수집',            'control',   1, NOW(), NOW()),
  -- report
  (UUID(), 'esg_report',          'ESG 보고서',               'ESG/GHG 보고서 생성 및 PDF/Excel 출력',       'report',    1, NOW(), NOW()),
  (UUID(), 'xbrl_export',         'XBRL 내보내기',            'XBRL 형식 규제 보고서 내보내기',              'report',    1, NOW(), NOW()),
  (UUID(), 'blockchain_retire',   '블록체인 탄소 소각',       '온체인 탄소 크레딧 소각 (Toucan/KlimaDAO)',   'report',    1, NOW(), NOW()),
  -- admin
  (UUID(), 'api_access',          'API 접근',                 '외부 API 및 웹훅 접근',                       'admin',     1, NOW(), NOW()),
  (UUID(), 'multi_site',          '다중 사업장',              '2개 이상의 사업장 관리',                      'admin',     1, NOW(), NOW()),
  (UUID(), 'white_label',         '화이트 레이블',            '브랜드 커스터마이징',                         'admin',     1, NOW(), NOW()),
  (UUID(), 'partner_portal',      '파트너 포털',              '리셀러/파트너 포털 접근',                     'admin',     1, NOW(), NOW());
