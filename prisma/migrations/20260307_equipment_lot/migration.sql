-- ============================================================
-- Migration: 20260307_equipment_lot
-- Super Admin 설비 로트 관리 시스템
-- ============================================================

-- EquipmentProduct (제품 카탈로그)
CREATE TABLE `equipment_product` (
  `id`                  VARCHAR(36)      NOT NULL,
  `name`                VARCHAR(200)     NOT NULL,
  `model_number`        VARCHAR(100)     NOT NULL,
  `manufacturer`        VARCHAR(100)     NOT NULL,
  `category`            ENUM('gateway','sensor','controller','meter','display','accessory') NOT NULL,
  `facility_types`      JSON             NOT NULL,
  `specs`               JSON             NOT NULL,
  `protocols`           JSON             NOT NULL,
  `unit_price`          DECIMAL(12,2)    NULL,
  `description`         TEXT             NULL,
  `image_url`           VARCHAR(500)     NULL,
  `install_difficulty`  VARCHAR(20)      NOT NULL DEFAULT 'medium',
  `warranty_months`     INT              NOT NULL DEFAULT 12,
  `is_active`           TINYINT(1)       NOT NULL DEFAULT 1,
  `created_at`          DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`          DATETIME(3)      NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE KEY `equipment_product_model_number_key` (`model_number`),
  INDEX `equipment_product_category_idx` (`category`),
  INDEX `equipment_product_is_active_idx` (`is_active`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- EquipmentLot (납품 로트)
CREATE TABLE `equipment_lot` (
  `id`               VARCHAR(36)   NOT NULL,
  `tenant_id`        VARCHAR(36)   NOT NULL,
  `lot_number`       VARCHAR(100)  NOT NULL,
  `facility_type`    VARCHAR(50)   NOT NULL,
  `status`           ENUM('pending','shipped','delivered','installing','installed','active','returned') NOT NULL DEFAULT 'pending',
  `ordered_at`       DATE          NULL,
  `shipped_at`       DATE          NULL,
  `delivered_at`     DATE          NULL,
  `installed_at`     DATE          NULL,
  `technician_name`  VARCHAR(100)  NULL,
  `technician_phone` VARCHAR(50)   NULL,
  `site_address`     TEXT          NULL,
  `site_contact`     VARCHAR(100)  NULL,
  `notes`            TEXT          NULL,
  `metadata`         JSON          NULL,
  `created_at`       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`       DATETIME(3)   NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE KEY `equipment_lot_lot_number_key` (`lot_number`),
  INDEX `equipment_lot_tenant_id_idx` (`tenant_id`),
  INDEX `equipment_lot_status_idx` (`status`),
  INDEX `equipment_lot_facility_type_idx` (`facility_type`),
  INDEX `equipment_lot_delivered_at_idx` (`delivered_at`),
  CONSTRAINT `equipment_lot_tenant_id_fkey`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenant` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- EquipmentLotItem (로트 품목)
CREATE TABLE `equipment_lot_item` (
  `id`             VARCHAR(36)   NOT NULL,
  `lot_id`         VARCHAR(36)   NOT NULL,
  `product_id`     VARCHAR(36)   NOT NULL,
  `quantity`       INT           NOT NULL DEFAULT 1,
  `serial_numbers` JSON          NOT NULL,
  `status`         ENUM('pending','installed','active','faulty','returned') NOT NULL DEFAULT 'pending',
  `device_id`      VARCHAR(36)   NULL,
  `gateway_id`     VARCHAR(36)   NULL,
  `defect_note`    TEXT          NULL,
  `created_at`     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`     DATETIME(3)   NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `equipment_lot_item_lot_id_idx` (`lot_id`),
  INDEX `equipment_lot_item_product_id_idx` (`product_id`),
  CONSTRAINT `equipment_lot_item_lot_id_fkey`
    FOREIGN KEY (`lot_id`) REFERENCES `equipment_lot` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `equipment_lot_item_product_id_fkey`
    FOREIGN KEY (`product_id`) REFERENCES `equipment_product` (`id`)
    ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
