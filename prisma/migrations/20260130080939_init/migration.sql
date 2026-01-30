-- CreateTable
CREATE TABLE `tenant` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `business_number` VARCHAR(50) NULL,
    `domain` VARCHAR(100) NULL,
    `industry_type` ENUM('manufacturing', 'building', 'industrial_complex', 'datacenter', 'other') NOT NULL DEFAULT 'manufacturing',
    `address` TEXT NULL,
    `city` VARCHAR(100) NULL,
    `country` VARCHAR(50) NOT NULL DEFAULT 'KR',
    `timezone` VARCHAR(50) NOT NULL DEFAULT 'Asia/Seoul',
    `status` ENUM('active', 'suspended', 'terminated') NOT NULL DEFAULT 'active',
    `settings` JSON NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tenant_business_number_key`(`business_number`),
    UNIQUE INDEX `tenant_domain_key`(`domain`),
    INDEX `tenant_status_idx`(`status`),
    INDEX `tenant_industry_type_idx`(`industry_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plan` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `tier` ENUM('trial', 'basic', 'pro', 'enterprise') NOT NULL,
    `monthly_price` DECIMAL(12, 2) NULL,
    `yearly_price` DECIMAL(12, 2) NULL,
    `setup_fee` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `max_sites` INTEGER NULL,
    `max_devices` INTEGER NULL,
    `max_users` INTEGER NULL,
    `data_retention_days` INTEGER NOT NULL DEFAULT 90,
    `api_rate_limit` INTEGER NOT NULL DEFAULT 1000,
    `features` JSON NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_public` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `plan_id` VARCHAR(191) NOT NULL,
    `status` ENUM('PRE_PAYMENT', 'PAID', 'INSTALL_SCHEDULED', 'INSTALLED', 'ACTIVE', 'EXPIRE_SOON', 'EXPIRED', 'SUSPENDED', 'TERMINATED') NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `trial_end_date` DATE NULL,
    `payment_status` ENUM('pending', 'paid', 'failed', 'refunded') NULL,
    `payment_method` VARCHAR(50) NULL,
    `billing_cycle` ENUM('monthly', 'yearly', 'lifetime') NULL,
    `installation_scheduled_date` DATE NULL,
    `installation_completed_date` DATE NULL,
    `first_data_received_at` DATETIME(3) NULL,
    `auto_renew` BOOLEAN NOT NULL DEFAULT true,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `subscription_tenant_id_idx`(`tenant_id`),
    INDEX `subscription_status_idx`(`status`),
    INDEX `subscription_end_date_idx`(`end_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(50) NULL,
    `role` ENUM('super_admin', 'tenant_admin', 'site_manager', 'operator', 'viewer') NOT NULL DEFAULT 'viewer',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_email_verified` BOOLEAN NOT NULL DEFAULT false,
    `mfa_enabled` BOOLEAN NOT NULL DEFAULT false,
    `mfa_secret` VARCHAR(255) NULL,
    `last_login_at` DATETIME(3) NULL,
    `last_login_ip` VARCHAR(45) NULL,
    `login_attempts` INTEGER NOT NULL DEFAULT 0,
    `locked_until` DATETIME(3) NULL,
    `refresh_token` VARCHAR(500) NULL,
    `refresh_token_expires_at` DATETIME(3) NULL,
    `reset_token` VARCHAR(255) NULL,
    `reset_token_expires_at` DATETIME(3) NULL,
    `token_version` INTEGER NOT NULL DEFAULT 0,
    `preferences` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `user_email_key`(`email`),
    INDEX `user_tenant_id_idx`(`tenant_id`),
    INDEX `user_email_idx`(`email`),
    INDEX `user_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `site` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `code` VARCHAR(50) NULL,
    `address` TEXT NULL,
    `city` VARCHAR(100) NULL,
    `country` VARCHAR(50) NOT NULL DEFAULT 'KR',
    `latitude` DECIMAL(10, 8) NULL,
    `longitude` DECIMAL(11, 8) NULL,
    `timezone` VARCHAR(50) NOT NULL DEFAULT 'Asia/Seoul',
    `site_type` ENUM('factory', 'office', 'warehouse', 'retail', 'mixed') NOT NULL DEFAULT 'factory',
    `area_sqm` DECIMAL(10, 2) NULL,
    `floors` INTEGER NULL,
    `operating_hours` JSON NULL,
    `peak_power_kw` DECIMAL(10, 2) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `manager_id` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `site_tenant_id_idx`(`tenant_id`),
    INDEX `site_site_type_idx`(`site_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gateway` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NOT NULL,
    `serial_number` VARCHAR(100) NOT NULL,
    `name` VARCHAR(100) NULL,
    `model` VARCHAR(50) NULL,
    `firmware_version` VARCHAR(20) NULL,
    `ip_address` VARCHAR(45) NULL,
    `mac_address` VARCHAR(17) NULL,
    `vpn_address` VARCHAR(45) NULL,
    `primary_connection` ENUM('ethernet', 'lte', 'wifi') NOT NULL DEFAULT 'ethernet',
    `fallback_connection` ENUM('lte', 'wifi', 'none') NOT NULL DEFAULT 'lte',
    `status` ENUM('online', 'offline', 'error', 'maintenance') NOT NULL DEFAULT 'offline',
    `last_seen_at` DATETIME(3) NULL,
    `last_heartbeat_at` DATETIME(3) NULL,
    `buffer_size_mb` INTEGER NOT NULL DEFAULT 100,
    `buffered_records` INTEGER NOT NULL DEFAULT 0,
    `config` JSON NULL,
    `ownership` ENUM('company', 'customer') NOT NULL DEFAULT 'company',
    `installation_date` DATE NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `gateway_serial_number_key`(`serial_number`),
    INDEX `gateway_tenant_id_idx`(`tenant_id`),
    INDEX `gateway_site_id_idx`(`site_id`),
    INDEX `gateway_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `device` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NOT NULL,
    `gateway_id` VARCHAR(191) NULL,
    `name` VARCHAR(200) NOT NULL,
    `code` VARCHAR(50) NULL,
    `device_type` VARCHAR(50) NOT NULL,
    `manufacturer` VARCHAR(100) NULL,
    `model` VARCHAR(100) NULL,
    `protocol` ENUM('modbus_tcp', 'modbus_rtu', 'bacnet', 'opcua', 'mqtt', 'http') NOT NULL,
    `connection_config` JSON NOT NULL,
    `control_capable` BOOLEAN NOT NULL DEFAULT false,
    `control_mode` ENUM('auto', 'manual', 'disabled') NOT NULL DEFAULT 'disabled',
    `status` ENUM('online', 'offline', 'error', 'maintenance') NOT NULL DEFAULT 'offline',
    `last_seen_at` DATETIME(3) NULL,
    `poll_interval_ms` INTEGER NOT NULL DEFAULT 5000,
    `response_time_ms` INTEGER NULL,
    `installation_date` DATE NULL,
    `warranty_end_date` DATE NULL,
    `location` VARCHAR(200) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `device_tenant_id_idx`(`tenant_id`),
    INDEX `device_site_id_idx`(`site_id`),
    INDEX `device_gateway_id_idx`(`gateway_id`),
    INDEX `device_device_type_idx`(`device_type`),
    INDEX `device_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `metric` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `device_id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `name` VARCHAR(200) NULL,
    `data_type` ENUM('float', 'int', 'boolean', 'string') NOT NULL DEFAULT 'float',
    `unit` VARCHAR(20) NULL,
    `register_address` INTEGER NULL,
    `register_type` ENUM('holding', 'input', 'coil', 'discrete') NULL,
    `scale_factor` DECIMAL(10, 6) NOT NULL DEFAULT 1.0,
    `min_value` DECIMAL(15, 4) NULL,
    `max_value` DECIMAL(15, 4) NULL,
    `access_level` ENUM('read', 'write') NOT NULL DEFAULT 'read',
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `metric_tenant_id_idx`(`tenant_id`),
    INDEX `metric_key_idx`(`key`),
    UNIQUE INDEX `metric_device_id_key_key`(`device_id`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `measurement` (
    `time` DATETIME(3) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `metric_id` VARCHAR(191) NOT NULL,
    `value` DECIMAL(15, 4) NOT NULL,
    `quality` ENUM('good', 'bad', 'uncertain') NOT NULL DEFAULT 'good',
    `source` ENUM('sensor', 'calculated', 'estimated', 'manual') NOT NULL DEFAULT 'sensor',
    `gateway_id` VARCHAR(191) NULL,
    `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `measurement_tenant_id_time_idx`(`tenant_id`, `time` DESC),
    INDEX `measurement_gateway_id_time_idx`(`gateway_id`, `time` DESC),
    PRIMARY KEY (`metric_id`, `time`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alert_rule` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `category` ENUM('system', 'energy', 'device', 'security', 'dr', 'carbon', 'cost') NOT NULL,
    `severity` ENUM('info', 'warning', 'critical') NOT NULL,
    `scope` ENUM('tenant', 'site', 'device', 'metric') NOT NULL,
    `scope_id` VARCHAR(191) NULL,
    `condition` JSON NOT NULL,
    `channels` JSON NULL,
    `recipients` JSON NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `alert_rule_tenant_id_idx`(`tenant_id`),
    INDEX `alert_rule_category_idx`(`category`),
    INDEX `alert_rule_enabled_idx`(`enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_log` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NULL,
    `user_id` VARCHAR(191) NULL,
    `action` VARCHAR(100) NOT NULL,
    `resource_type` VARCHAR(50) NULL,
    `resource_id` VARCHAR(191) NULL,
    `changes` JSON NULL,
    `result` ENUM('success', 'failure', 'partial') NULL,
    `error_message` TEXT NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,
    `request_id` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_log_tenant_id_created_at_idx`(`tenant_id`, `created_at` DESC),
    INDEX `audit_log_user_id_created_at_idx`(`user_id`, `created_at` DESC),
    INDEX `audit_log_action_idx`(`action`),
    INDEX `audit_log_resource_type_resource_id_idx`(`resource_type`, `resource_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `menu_group` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `icon` VARCHAR(50) NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `level` INTEGER NOT NULL DEFAULT 1,
    `min_role` ENUM('super_admin', 'tenant_admin', 'site_manager', 'operator', 'viewer') NOT NULL DEFAULT 'viewer',
    `subscription_required` BOOLEAN NOT NULL DEFAULT true,
    `min_subscription_status` VARCHAR(50) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_visible` BOOLEAN NOT NULL DEFAULT true,
    `description` TEXT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `menu_group_code_key`(`code`),
    INDEX `menu_group_is_active_display_order_idx`(`is_active`, `display_order`),
    INDEX `menu_group_min_role_idx`(`min_role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `menu_item` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `icon` VARCHAR(50) NULL,
    `path` VARCHAR(200) NULL,
    `external_url` VARCHAR(500) NULL,
    `menu_group_id` VARCHAR(191) NULL,
    `parent_id` VARCHAR(191) NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `level` INTEGER NOT NULL DEFAULT 1,
    `min_role` ENUM('super_admin', 'tenant_admin', 'site_manager', 'operator', 'viewer') NOT NULL DEFAULT 'viewer',
    `allowed_roles` JSON NULL,
    `subscription_required` BOOLEAN NOT NULL DEFAULT true,
    `min_subscription_status` VARCHAR(50) NULL,
    `feature_required` VARCHAR(100) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_visible` BOOLEAN NOT NULL DEFAULT true,
    `badge_type` ENUM('none', 'count', 'dot', 'new') NOT NULL DEFAULT 'none',
    `badge_color` VARCHAR(20) NULL,
    `description` TEXT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `menu_item_code_key`(`code`),
    INDEX `menu_item_menu_group_id_display_order_idx`(`menu_group_id`, `display_order`),
    INDEX `menu_item_parent_id_display_order_idx`(`parent_id`, `display_order`),
    INDEX `menu_item_is_active_is_visible_idx`(`is_active`, `is_visible`),
    INDEX `menu_item_min_role_idx`(`min_role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_menu_favorite` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `menu_item_id` VARCHAR(191) NOT NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_menu_favorite_user_id_display_order_idx`(`user_id`, `display_order`),
    UNIQUE INDEX `user_menu_favorite_user_id_menu_item_id_key`(`user_id`, `menu_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `menu_access_log` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `menu_item_id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NULL,
    `accessed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `session_id` VARCHAR(100) NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` TEXT NULL,

    INDEX `menu_access_log_user_id_accessed_at_idx`(`user_id`, `accessed_at` DESC),
    INDEX `menu_access_log_menu_item_id_accessed_at_idx`(`menu_item_id`, `accessed_at` DESC),
    INDEX `menu_access_log_tenant_id_accessed_at_idx`(`tenant_id`, `accessed_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `control_log` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `device_id` VARCHAR(191) NOT NULL,
    `action` VARCHAR(100) NOT NULL,
    `parameters` JSON NULL,
    `target_value` DECIMAL(15, 4) NULL,
    `actual_value` DECIMAL(15, 4) NULL,
    `status` ENUM('pending', 'sent', 'success', 'failed', 'timeout', 'cancelled') NOT NULL DEFAULT 'pending',
    `requires_approval` BOOLEAN NOT NULL DEFAULT false,
    `approved_by` VARCHAR(191) NULL,
    `approved_at` DATETIME(3) NULL,
    `executed_by` VARCHAR(191) NOT NULL,
    `execution_mode` ENUM('manual', 'scheduled', 'automated', 'dr') NOT NULL,
    `ip_address` VARCHAR(45) NULL,
    `requested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `control_log_tenant_id_requested_at_idx`(`tenant_id`, `requested_at` DESC),
    INDEX `control_log_device_id_requested_at_idx`(`device_id`, `requested_at` DESC),
    INDEX `control_log_executed_by_idx`(`executed_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dr_event` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `start_time` DATETIME(3) NOT NULL,
    `end_time` DATETIME(3) NOT NULL,
    `target_reduction_kw` DECIMAL(10, 2) NOT NULL,
    `actual_reduction_kw` DECIMAL(10, 2) NULL,
    `revenue` DECIMAL(12, 2) NULL,
    `status` ENUM('scheduled', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'scheduled',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `dr_event_tenant_id_start_time_idx`(`tenant_id`, `start_time`),
    INDEX `dr_event_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `emissions_data` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `device_id` VARCHAR(191) NULL,
    `emission_type` ENUM('scope1', 'scope2', 'scope3') NOT NULL,
    `source_type` VARCHAR(50) NOT NULL,
    `amount` DECIMAL(15, 3) NOT NULL,
    `unit` VARCHAR(20) NOT NULL,
    `emission_factor` DECIMAL(10, 6) NOT NULL,
    `calculated_emission` DECIMAL(15, 3) NOT NULL,
    `period` VARCHAR(7) NOT NULL,
    `calculation_method` ENUM('auto', 'manual') NOT NULL DEFAULT 'manual',
    `data_source` ENUM('MANUAL', 'SENSOR', 'HYBRID') NOT NULL DEFAULT 'MANUAL',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `emissions_data_tenant_id_period_idx`(`tenant_id`, `period`),
    INDEX `emissions_data_emission_type_idx`(`emission_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Report` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NOT NULL,
    `siteId` VARCHAR(191) NULL,
    `generatedBy` VARCHAR(191) NOT NULL,
    `data` JSON NOT NULL,
    `fileUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Report_tenantId_idx`(`tenantId`),
    INDEX `Report_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `regulation_report` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `report_type` VARCHAR(50) NOT NULL,
    `report_name` VARCHAR(200) NOT NULL,
    `period` VARCHAR(7) NOT NULL,
    `status` ENUM('draft', 'submitted', 'approved', 'rejected') NOT NULL DEFAULT 'draft',
    `due_date` DATE NOT NULL,
    `submitted_date` DATETIME(3) NULL,
    `submitted_by` VARCHAR(191) NULL,
    `approved_date` DATETIME(3) NULL,
    `approved_by` VARCHAR(191) NULL,
    `total_emissions` DECIMAL(15, 3) NOT NULL DEFAULT 0,
    `scope1` DECIMAL(15, 3) NOT NULL DEFAULT 0,
    `scope2` DECIMAL(15, 3) NOT NULL DEFAULT 0,
    `scope3` DECIMAL(15, 3) NOT NULL DEFAULT 0,
    `file_url` VARCHAR(500) NULL,
    `pdf_url` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `regulation_report_tenant_id_period_idx`(`tenant_id`, `period`),
    INDEX `regulation_report_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ForecastResult` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `siteId` VARCHAR(191) NULL,
    `horizon` VARCHAR(191) NOT NULL,
    `predictions` JSON NOT NULL,
    `accuracy` DOUBLE NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ForecastResult_tenantId_idx`(`tenantId`),
    INDEX `ForecastResult_siteId_idx`(`siteId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_setting` (
    `id` VARCHAR(191) NOT NULL,
    `category` VARCHAR(50) NOT NULL,
    `setting_key` VARCHAR(100) NOT NULL,
    `setting_value` TEXT NOT NULL,
    `value_type` ENUM('string', 'number', 'boolean', 'json', 'array') NOT NULL DEFAULT 'string',
    `display_name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `unit` VARCHAR(20) NULL,
    `min_value` DECIMAL(15, 2) NULL,
    `max_value` DECIMAL(15, 2) NULL,
    `default_value` TEXT NULL,
    `is_required` BOOLEAN NOT NULL DEFAULT false,
    `is_readonly` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `updated_by` VARCHAR(50) NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `system_setting_setting_key_key`(`setting_key`),
    INDEX `system_setting_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `subscription` ADD CONSTRAINT `subscription_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription` ADD CONSTRAINT `subscription_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `plan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user` ADD CONSTRAINT `user_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `site` ADD CONSTRAINT `site_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `site` ADD CONSTRAINT `site_manager_id_fkey` FOREIGN KEY (`manager_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gateway` ADD CONSTRAINT `gateway_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gateway` ADD CONSTRAINT `gateway_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `site`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `device` ADD CONSTRAINT `device_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `device` ADD CONSTRAINT `device_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `site`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `device` ADD CONSTRAINT `device_gateway_id_fkey` FOREIGN KEY (`gateway_id`) REFERENCES `gateway`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `metric` ADD CONSTRAINT `metric_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `metric` ADD CONSTRAINT `metric_device_id_fkey` FOREIGN KEY (`device_id`) REFERENCES `device`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `measurement` ADD CONSTRAINT `measurement_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `measurement` ADD CONSTRAINT `measurement_metric_id_fkey` FOREIGN KEY (`metric_id`) REFERENCES `metric`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `measurement` ADD CONSTRAINT `measurement_gateway_id_fkey` FOREIGN KEY (`gateway_id`) REFERENCES `gateway`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alert_rule` ADD CONSTRAINT `alert_rule_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `menu_item` ADD CONSTRAINT `menu_item_menu_group_id_fkey` FOREIGN KEY (`menu_group_id`) REFERENCES `menu_group`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `menu_item` ADD CONSTRAINT `menu_item_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `menu_item`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_menu_favorite` ADD CONSTRAINT `user_menu_favorite_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_menu_favorite` ADD CONSTRAINT `user_menu_favorite_menu_item_id_fkey` FOREIGN KEY (`menu_item_id`) REFERENCES `menu_item`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `menu_access_log` ADD CONSTRAINT `menu_access_log_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `menu_access_log` ADD CONSTRAINT `menu_access_log_menu_item_id_fkey` FOREIGN KEY (`menu_item_id`) REFERENCES `menu_item`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Report` ADD CONSTRAINT `Report_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Report` ADD CONSTRAINT `Report_generatedBy_fkey` FOREIGN KEY (`generatedBy`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ForecastResult` ADD CONSTRAINT `ForecastResult_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
