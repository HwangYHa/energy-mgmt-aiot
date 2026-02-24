-- CreateTable
CREATE TABLE IF NOT EXISTS `tenant_compliance_setting` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `region` VARCHAR(191) NOT NULL DEFAULT 'KR',
    `reporting_standard` VARCHAR(191) NOT NULL DEFAULT 'GHG Protocol',
    `factor_source` VARCHAR(191) NOT NULL DEFAULT '환경부',
    `default_engine_version` VARCHAR(191) NULL,
    `electricity_factor` DECIMAL(65, 30) NOT NULL DEFAULT 0.4567,
    `base_year` INTEGER NOT NULL DEFAULT 2020,
    `target_reduction_pct` DECIMAL(65, 30) NULL,
    `reporting_frequency` VARCHAR(191) NOT NULL DEFAULT 'monthly',
    `fiscal_year_start` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tenant_compliance_setting_tenant_id_key`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `emissions_record` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NULL,
    `engine_version_id` VARCHAR(191) NOT NULL,
    `emission_factor_id` VARCHAR(191) NOT NULL,
    `emission_factor_value` DECIMAL(65, 30) NOT NULL,
    `emission_factor_unit` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL,
    `source_type` VARCHAR(191) NOT NULL,
    `activity_data` DECIMAL(65, 30) NOT NULL,
    `activity_unit` VARCHAR(191) NOT NULL,
    `emissions` DECIMAL(65, 30) NOT NULL,
    `unit` VARCHAR(191) NOT NULL DEFAULT 'tCO2eq',
    `period` VARCHAR(191) NOT NULL,
    `is_archived` BOOLEAN NOT NULL DEFAULT false,
    `archived_at` DATETIME(3) NULL,
    `archived_by` VARCHAR(191) NULL,
    `archive_reason` VARCHAR(191) NULL,
    `parent_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` VARCHAR(191) NULL,

    INDEX `emissions_record_tenant_id_period_idx`(`tenant_id`, `period`),
    INDEX `emissions_record_tenant_id_is_archived_idx`(`tenant_id`, `is_archived`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tenant_compliance_setting` ADD CONSTRAINT `tenant_compliance_setting_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emissions_record` ADD CONSTRAINT `emissions_record_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emissions_record` ADD CONSTRAINT `emissions_record_engine_version_id_fkey` FOREIGN KEY (`engine_version_id`) REFERENCES `calc_engine_version`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emissions_record` ADD CONSTRAINT `emissions_record_emission_factor_id_fkey` FOREIGN KEY (`emission_factor_id`) REFERENCES `emission_factor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
