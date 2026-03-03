-- ================================================
-- ESG Report: Big4 감사 대응 엔터프라이즈급 탄소 보고서
-- ================================================

-- ESG Report 유형 enum (MySQL은 ALTER로 enum 추가)
-- ESGReportType: compliance, sustainability, annual, interim
-- ESGReportStatus: draft, in_review, approved, published, withdrawn

CREATE TABLE `esg_report` (
  `id` VARCHAR(191) NOT NULL,
  `tenant_id` VARCHAR(191) NOT NULL,

  -- ⭐ 보고서 식별
  `report_no` VARCHAR(30) NOT NULL,                    -- ESG-20260303-0001
  `report_type` VARCHAR(30) NOT NULL,                  -- compliance, sustainability, annual, interim
  `standard` VARCHAR(50) NOT NULL,                     -- GHG_PROTOCOL, K_MRV, CDP, ISSB, K_ETS
  `country_code` VARCHAR(5) NOT NULL DEFAULT 'KR',

  -- 보고 기간
  `period` VARCHAR(10) NOT NULL,                       -- YYYY or YYYY-MM
  `period_type` VARCHAR(10) NOT NULL,                  -- annual, monthly, quarterly
  `report_year` INT NOT NULL,

  -- ⭐ 배출량 요약 (tCO2eq)
  `total_emissions` DECIMAL(15, 6) NOT NULL,
  `scope1` DECIMAL(15, 6) NOT NULL,
  `scope2_location` DECIMAL(15, 6) NOT NULL,
  `scope2_market` DECIMAL(15, 6) NULL,                 -- Market-based (선택)
  `scope3` DECIMAL(15, 6) NOT NULL,
  `emissions_unit` VARCHAR(20) NOT NULL DEFAULT 'tCO2eq',

  -- ⭐ 스냅샷 (감사 추적 핵심: 보고서 생성 시점 불변 기록)
  `emission_factors_snapshot` JSON NOT NULL,            -- 사용된 배출계수 목록 + 버전
  `engine_version_snapshot` JSON NOT NULL,              -- 계산엔진 정보
  `calculation_method_snapshot` JSON NOT NULL,          -- 계산방식 (location/market)
  `boundary_snapshot` JSON NOT NULL,                   -- 조직경계, 운영경계 설정
  `activity_data_snapshot` JSON NULL,                  -- 원본 활동 데이터 집계

  -- 규제 준수
  `applicable_standards` VARCHAR(500) NOT NULL,        -- GHG Protocol, ISO 14064, K-ETS
  `methodology_notes` LONGTEXT COLLATE utf8mb4_unicode_ci NULL,
  `completeness_score` DECIMAL(5, 2) NULL,             -- 데이터 완전성 0-100%

  -- ⭐ 무결성 (Tamper resistance)
  `data_hash` VARCHAR(64) NOT NULL,                    -- SHA-256 of immutable content
  `is_immutable` BOOLEAN NOT NULL DEFAULT false,       -- 승인 후 true → 수정 불가

  -- XBRL 확장 (ISSB/IFRS S2 대응)
  `xbrl_taxonomy` VARCHAR(100) NULL,                   -- ifrs-full, ghg-protocol, cdp
  `xbrl_export_url` VARCHAR(500) NULL,

  -- 생성 파일 (PDF, Excel)
  `pdf_url` VARCHAR(500) NULL,
  `excel_url` VARCHAR(500) NULL,

  -- ⭐ 상태 및 승인 워크플로우
  `status` VARCHAR(20) NOT NULL DEFAULT 'draft',       -- draft, in_review, approved, published, withdrawn

  `generated_by` VARCHAR(191) NOT NULL,
  `reviewed_by` VARCHAR(191) NULL,
  `reviewed_at` DATETIME(3) NULL,
  `approved_by` VARCHAR(191) NULL,
  `approved_at` DATETIME(3) NULL,

  -- 버전 재발행 추적
  `previous_report_id` VARCHAR(191) NULL,              -- 재발행 시 이전 보고서 참조
  `revision_number` INT NOT NULL DEFAULT 1,

  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE KEY `esg_report_report_no_key` (`report_no`),

  KEY `esg_report_tenant_id_report_year_idx` (`tenant_id`, `report_year`),
  KEY `esg_report_standard_country_code_idx` (`standard`, `country_code`),
  KEY `esg_report_status_idx` (`status`),
  KEY `esg_report_is_immutable_idx` (`is_immutable`),
  KEY `esg_report_previous_report_id_fkey` (`previous_report_id`),

  CONSTRAINT `esg_report_tenant_id_fkey`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT `esg_report_previous_report_id_fkey`
    FOREIGN KEY (`previous_report_id`) REFERENCES `esg_report`(`id`)
    ON DELETE NO ACTION ON UPDATE NO ACTION

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
