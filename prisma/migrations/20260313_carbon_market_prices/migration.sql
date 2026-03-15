-- CreateTable: carbon_market_price
-- 탄소 시장 가격 이력 테이블 (K-ETS / EU-ETS / VCM 등)
-- env KETS_MARKET_PRICE를 DB 기반으로 대체

CREATE TABLE `carbon_market_price` (
  `id`          VARCHAR(36)    NOT NULL,
  `market`      VARCHAR(20)    NOT NULL COMMENT 'KETS | EU_ETS | VCM | GOLD_STANDARD',
  `price_date`  DATE           NOT NULL,
  `price`       DECIMAL(15,4)  NOT NULL,
  `currency`    VARCHAR(10)    NOT NULL DEFAULT 'KRW',
  `unit`        VARCHAR(20)    NOT NULL DEFAULT 'tCO2',
  `source`      VARCHAR(200)   NULL COMMENT 'KAU | KCU | CBL | 수기입력 등',
  `change_rate` DECIMAL(10,4)  NULL COMMENT '전일 대비 등락률(%)',
  `volume`      INT            NULL COMMENT '거래량',
  `notes`       TEXT           NULL,
  `created_at`  DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`  DATETIME(3)    NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_market_date` (`market`, `price_date`),
  INDEX `carbon_market_price_market_price_date_idx` (`market`, `price_date` DESC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed: 초기 K-ETS 가격 데이터 (2026년 최근 30일)
INSERT INTO `carbon_market_price` (`id`, `market`, `price_date`, `price`, `currency`, `unit`, `source`, `change_rate`, `created_at`, `updated_at`) VALUES
  (UUID(), 'KETS', '2026-02-10', 11800.0000, 'KRW', 'tCO2', 'KAU', NULL,       NOW(), NOW()),
  (UUID(), 'KETS', '2026-02-11', 11850.0000, 'KRW', 'tCO2', 'KAU', 0.4237,    NOW(), NOW()),
  (UUID(), 'KETS', '2026-02-12', 11900.0000, 'KRW', 'tCO2', 'KAU', 0.4219,    NOW(), NOW()),
  (UUID(), 'KETS', '2026-02-13', 11750.0000, 'KRW', 'tCO2', 'KAU', -1.2605,   NOW(), NOW()),
  (UUID(), 'KETS', '2026-02-14', 11800.0000, 'KRW', 'tCO2', 'KAU', 0.4255,    NOW(), NOW()),
  (UUID(), 'KETS', '2026-02-17', 11950.0000, 'KRW', 'tCO2', 'KAU', 1.2712,    NOW(), NOW()),
  (UUID(), 'KETS', '2026-02-18', 12000.0000, 'KRW', 'tCO2', 'KAU', 0.4184,    NOW(), NOW()),
  (UUID(), 'KETS', '2026-02-19', 12100.0000, 'KRW', 'tCO2', 'KAU', 0.8333,    NOW(), NOW()),
  (UUID(), 'KETS', '2026-02-20', 12050.0000, 'KRW', 'tCO2', 'KAU', -0.4132,   NOW(), NOW()),
  (UUID(), 'KETS', '2026-02-21', 12200.0000, 'KRW', 'tCO2', 'KAU', 1.2448,    NOW(), NOW()),
  (UUID(), 'KETS', '2026-02-24', 12150.0000, 'KRW', 'tCO2', 'KAU', -0.4098,   NOW(), NOW()),
  (UUID(), 'KETS', '2026-02-25', 12300.0000, 'KRW', 'tCO2', 'KAU', 1.2346,    NOW(), NOW()),
  (UUID(), 'KETS', '2026-02-26', 12250.0000, 'KRW', 'tCO2', 'KAU', -0.4065,   NOW(), NOW()),
  (UUID(), 'KETS', '2026-02-27', 12400.0000, 'KRW', 'tCO2', 'KAU', 1.2245,    NOW(), NOW()),
  (UUID(), 'KETS', '2026-02-28', 12350.0000, 'KRW', 'tCO2', 'KAU', -0.4032,   NOW(), NOW()),
  (UUID(), 'KETS', '2026-03-03', 12500.0000, 'KRW', 'tCO2', 'KAU', 1.2146,    NOW(), NOW()),
  (UUID(), 'KETS', '2026-03-04', 12450.0000, 'KRW', 'tCO2', 'KAU', -0.4000,   NOW(), NOW()),
  (UUID(), 'KETS', '2026-03-05', 12600.0000, 'KRW', 'tCO2', 'KAU', 1.2048,    NOW(), NOW()),
  (UUID(), 'KETS', '2026-03-06', 12550.0000, 'KRW', 'tCO2', 'KAU', -0.3968,   NOW(), NOW()),
  (UUID(), 'KETS', '2026-03-07', 12700.0000, 'KRW', 'tCO2', 'KAU', 1.1952,    NOW(), NOW()),
  (UUID(), 'KETS', '2026-03-10', 12650.0000, 'KRW', 'tCO2', 'KAU', -0.3937,   NOW(), NOW()),
  (UUID(), 'KETS', '2026-03-11', 12800.0000, 'KRW', 'tCO2', 'KAU', 1.1858,    NOW(), NOW()),
  (UUID(), 'KETS', '2026-03-12', 12750.0000, 'KRW', 'tCO2', 'KAU', -0.3906,   NOW(), NOW()),
  (UUID(), 'KETS', '2026-03-13', 12900.0000, 'KRW', 'tCO2', 'KAU', 1.1765,    NOW(), NOW()),
  -- EU-ETS 참조 가격 (EUR → KRW 환산, 대략 1EUR=1,450KRW)
  (UUID(), 'EU_ETS', '2026-03-13', 72.5000, 'EUR', 'tCO2', 'EUA', NULL,        NOW(), NOW()),
  -- VCM (자발적 탄소 시장) 참조 가격
  (UUID(), 'VCM',    '2026-03-13', 8500.0000, 'KRW', 'tCO2', 'VER', NULL,      NOW(), NOW());
