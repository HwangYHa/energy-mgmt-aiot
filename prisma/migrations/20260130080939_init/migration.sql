-- CreateTable
CREATE TABLE `tenant` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(30) NULL,
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
    `onboarding_step` INTEGER NOT NULL DEFAULT 0,
    `onboarding_completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `tenant_code_key`(`code`),
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
    `code` VARCHAR(30) NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(50) NULL,
    `country` VARCHAR(10) NOT NULL DEFAULT 'KR',
    `city` VARCHAR(100) NULL,
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

    UNIQUE INDEX `user_code_key`(`code`),
    UNIQUE INDEX `user_email_key`(`email`),
    INDEX `user_tenant_id_idx`(`tenant_id`),
    INDEX `user_email_idx`(`email`),
    INDEX `user_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_history` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(500) NULL,
    `provider` VARCHAR(30) NOT NULL DEFAULT 'credentials',
    `success` BOOLEAN NOT NULL DEFAULT true,
    `fail_reason` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `login_history_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `login_history_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_site_access` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NOT NULL,
    `granted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revoked_at` DATETIME(3) NULL,

    INDEX `user_site_access_tenant_id_site_id_idx`(`tenant_id`, `site_id`),
    UNIQUE INDEX `user_site_access_user_id_site_id_key`(`user_id`, `site_id`),
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
    `sensor_id` VARCHAR(191) NULL,
    `key` VARCHAR(100) NOT NULL,
    `name` VARCHAR(200) NULL,
    `data_type` ENUM('float', 'int', 'boolean', 'string') NOT NULL DEFAULT 'float',
    `unit` VARCHAR(20) NULL,
    `category` ENUM('power_active', 'power_reactive', 'energy_kwh', 'temperature', 'humidity', 'pressure', 'flow', 'co2', 'status', 'other') NOT NULL DEFAULT 'other',
    `register_address` INTEGER NULL,
    `register_type` ENUM('holding', 'input', 'coil', 'discrete') NULL,
    `scale_factor` DECIMAL(10, 6) NOT NULL DEFAULT 1.0,
    `min_value` DECIMAL(15, 4) NULL,
    `max_value` DECIMAL(15, 4) NULL,
    `access_level` ENUM('read', 'write') NOT NULL DEFAULT 'read',
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `metric_tenant_id_idx`(`tenant_id`),
    INDEX `metric_sensor_id_idx`(`sensor_id`),
    INDEX `metric_key_idx`(`key`),
    INDEX `metric_tenant_id_category_idx`(`tenant_id`, `category`),
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
    `reason` TEXT NOT NULL,
    `site_id` VARCHAR(36) NULL,
    `ip_address` VARCHAR(45) NULL,
    `requested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `control_log_tenant_id_requested_at_idx`(`tenant_id`, `requested_at` DESC),
    INDEX `control_log_device_id_requested_at_idx`(`device_id`, `requested_at` DESC),
    INDEX `control_log_site_id_requested_at_idx`(`site_id`, `requested_at` DESC),
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

-- CreateTable
CREATE TABLE `payment_history` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `subscription_id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'KRW',
    `status` ENUM('pending', 'paid', 'failed', 'refunded') NOT NULL,
    `method` VARCHAR(50) NULL,
    `transaction_id` VARCHAR(200) NULL,
    `receipt_url` VARCHAR(500) NULL,
    `fail_reason` TEXT NULL,
    `paid_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payment_history_tenant_id_created_at_idx`(`tenant_id`, `created_at` DESC),
    INDEX `payment_history_subscription_id_idx`(`subscription_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_rule` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `category` ENUM('system', 'energy', 'device', 'security', 'dr', 'carbon', 'cost') NOT NULL,
    `severity` ENUM('info', 'warning', 'critical') NOT NULL,
    `email_enabled` BOOLEAN NOT NULL DEFAULT true,
    `sms_enabled` BOOLEAN NOT NULL DEFAULT false,
    `push_enabled` BOOLEAN NOT NULL DEFAULT false,
    `webhook_url` VARCHAR(500) NULL,
    `threshold` DECIMAL(15, 4) NULL,
    `threshold_unit` VARCHAR(20) NULL,
    `threshold_op` VARCHAR(10) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `notification_rule_tenant_id_user_id_idx`(`tenant_id`, `user_id`),
    INDEX `notification_rule_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_log` (
    `id` VARCHAR(191) NOT NULL,
    `rule_id` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(20) NOT NULL,
    `recipient` VARCHAR(255) NOT NULL,
    `subject` VARCHAR(500) NOT NULL,
    `body` TEXT NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `error_msg` TEXT NULL,
    `sent_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notification_log_rule_id_created_at_idx`(`rule_id`, `created_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sensor` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `device_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `code` VARCHAR(50) NULL,
    `serial_number` VARCHAR(100) NULL,
    `sensor_type` VARCHAR(50) NOT NULL,
    `manufacturer` VARCHAR(100) NULL,
    `model` VARCHAR(100) NULL,
    `unit` VARCHAR(20) NULL,
    `min_range` DECIMAL(15, 4) NULL,
    `max_range` DECIMAL(15, 4) NULL,
    `calibration_date` DATE NULL,
    `next_calibration_date` DATE NULL,
    `status` ENUM('online', 'offline', 'error', 'maintenance') NOT NULL DEFAULT 'offline',
    `last_value` DECIMAL(15, 4) NULL,
    `last_seen_at` DATETIME(3) NULL,
    `install_location` VARCHAR(200) NULL,
    `install_date` DATE NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `sensor_tenant_id_idx`(`tenant_id`),
    INDEX `sensor_device_id_idx`(`device_id`),
    INDEX `sensor_sensor_type_idx`(`sensor_type`),
    INDEX `sensor_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `control_schedule` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `device_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `action` VARCHAR(100) NOT NULL,
    `parameters` JSON NULL,
    `target_value` DECIMAL(15, 4) NULL,
    `schedule_type` ENUM('once', 'daily', 'weekly', 'cron') NOT NULL DEFAULT 'once',
    `cron_expr` VARCHAR(100) NULL,
    `start_at` DATETIME(3) NOT NULL,
    `end_at` DATETIME(3) NULL,
    `repeat_days` JSON NULL,
    `priority` INTEGER NOT NULL DEFAULT 5,
    `allow_overlap` BOOLEAN NOT NULL DEFAULT false,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `status` ENUM('active', 'paused', 'completed', 'expired') NOT NULL DEFAULT 'active',
    `last_run_at` DATETIME(3) NULL,
    `next_run_at` DATETIME(3) NULL,
    `created_by` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `control_schedule_tenant_id_device_id_idx`(`tenant_id`, `device_id`),
    INDEX `control_schedule_status_next_run_at_idx`(`status`, `next_run_at`),
    INDEX `control_schedule_device_id_start_at_idx`(`device_id`, `start_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `emission_factor` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NULL,
    `name` VARCHAR(200) NULL,
    `code` VARCHAR(50) NOT NULL,
    `category` VARCHAR(50) NOT NULL,
    `source_type` VARCHAR(100) NOT NULL,
    `factor_code` VARCHAR(100) NULL,
    `country_code` CHAR(2) NULL,
    `energy_type` VARCHAR(50) NULL,
    `calculation_type` VARCHAR(20) NULL,
    `factor` DECIMAL(20, 10) NOT NULL,
    `unit` VARCHAR(50) NOT NULL,
    `input_unit` VARCHAR(50) NOT NULL,
    `source` VARCHAR(200) NOT NULL,
    `source_name` VARCHAR(200) NULL,
    `source_version` VARCHAR(50) NULL,
    `source_url` VARCHAR(500) NULL,
    `factor_source_type` VARCHAR(30) NULL,
    `year` INTEGER NOT NULL,
    `region` VARCHAR(10) NOT NULL DEFAULT 'KR',
    `version` VARCHAR(20) NOT NULL,
    `parent_id` VARCHAR(191) NULL,
    `is_custom` BOOLEAN NOT NULL DEFAULT false,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT false,
    `approval_status` VARCHAR(30) NOT NULL DEFAULT 'APPROVED',
    `valid_from` DATE NOT NULL,
    `valid_to` DATE NULL,
    `created_by` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `approved_by` VARCHAR(191) NULL,
    `approved_at` DATETIME(3) NULL,
    `rejected_by` VARCHAR(191) NULL,
    `rejected_at` DATETIME(3) NULL,
    `rejection_reason` TEXT NULL,
    `change_reason` TEXT NULL,
    `record_hash` VARCHAR(64) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `emission_factor_tenant_id_factor_code_is_active_idx`(`tenant_id`, `factor_code`, `is_active`),
    INDEX `emission_factor_tenant_id_country_code_energy_type_calculati_idx`(`tenant_id`, `country_code`, `energy_type`, `calculation_type`),
    INDEX `emission_factor_category_idx`(`category`),
    INDEX `emission_factor_tenant_id_idx`(`tenant_id`),
    INDEX `emission_factor_year_region_idx`(`year`, `region`),
    INDEX `emission_factor_valid_from_valid_to_idx`(`valid_from`, `valid_to`),
    INDEX `emission_factor_approval_status_idx`(`approval_status`),
    INDEX `emission_factor_factor_code_valid_from_idx`(`factor_code`, `valid_from` DESC),
    UNIQUE INDEX `emission_factor_code_version_key`(`code`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `emission_factor_audit_log` (
    `id` VARCHAR(191) NOT NULL,
    `emission_factor_id` VARCHAR(191) NOT NULL,
    `change_type` VARCHAR(30) NOT NULL,
    `old_value` DECIMAL(20, 10) NULL,
    `new_value` DECIMAL(20, 10) NULL,
    `change_reason` TEXT NULL,
    `previous_snapshot` JSON NULL,
    `current_snapshot` JSON NULL,
    `previous_hash` VARCHAR(64) NULL,
    `current_hash` VARCHAR(64) NOT NULL,
    `requested_by` VARCHAR(191) NOT NULL,
    `requested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `approved_by` VARCHAR(191) NULL,
    `approved_at` DATETIME(3) NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(500) NULL,
    `audited_by` VARCHAR(191) NULL,
    `audited_at` DATETIME(3) NULL,

    INDEX `emission_factor_audit_log_emission_factor_id_requested_at_idx`(`emission_factor_id`, `requested_at` ASC),
    INDEX `emission_factor_audit_log_change_type_idx`(`change_type`),
    INDEX `emission_factor_audit_log_requested_by_idx`(`requested_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `calc_engine_version` (
    `id` VARCHAR(191) NOT NULL,
    `version` VARCHAR(20) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `methodology` VARCHAR(100) NOT NULL,
    `formula` JSON NULL,
    `parameters` JSON NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `released_at` DATETIME(3) NOT NULL,
    `deprecated_at` DATETIME(3) NULL,
    `changelog` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `calc_engine_version_version_key`(`version`),
    INDEX `calc_engine_version_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `api_key` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `key_hash` VARCHAR(255) NOT NULL,
    `key_prefix` VARCHAR(20) NOT NULL,
    `scopes` JSON NULL,
    `last_used_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `api_key_key_hash_key`(`key_hash`),
    INDEX `api_key_tenant_id_user_id_idx`(`tenant_id`, `user_id`),
    INDEX `api_key_key_hash_idx`(`key_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `support_inquiry` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `category` VARCHAR(50) NOT NULL,
    `subject` VARCHAR(500) NOT NULL,
    `message` TEXT NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `tenant_id` VARCHAR(191) NULL,
    `user_id` VARCHAR(191) NULL,
    `admin_note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `support_inquiry_status_idx`(`status`),
    INDEX `support_inquiry_email_idx`(`email`),
    INDEX `support_inquiry_created_at_idx`(`created_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `physical_space` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `code` VARCHAR(50) NULL,
    `type` ENUM('building', 'floor', 'zone', 'room', 'shaft') NOT NULL,
    `level` INTEGER NOT NULL DEFAULT 0,
    `parent_id` VARCHAR(191) NULL,
    `floor_plan_x` DECIMAL(10, 2) NULL,
    `floor_plan_y` DECIMAL(10, 2) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `physical_space_tenant_id_idx`(`tenant_id`),
    INDEX `physical_space_site_id_type_idx`(`site_id`, `type`),
    INDEX `physical_space_parent_id_idx`(`parent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `twin_node` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `device_id` VARCHAR(191) NOT NULL,
    `space_id` VARCHAR(191) NOT NULL,
    `system_type` ENUM('HVAC', 'ELECTRICAL', 'PLUMBING', 'FIRE_SAFETY', 'LIGHTING', 'MECHANICAL', 'OTHER') NOT NULL,
    `equip_class` ENUM('AHU', 'FCU', 'CHILLER', 'COOLING_TOWER', 'BOILER', 'PUMP', 'FAN', 'TRANSFORMER', 'UPS', 'PANEL', 'METER', 'SENSOR', 'OTHER') NOT NULL,
    `feeds_ids` JSON NULL,
    `fed_by_ids` JSON NULL,
    `computed_metrics` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `twin_node_device_id_key`(`device_id`),
    INDEX `twin_node_tenant_id_idx`(`tenant_id`),
    INDEX `twin_node_space_id_idx`(`space_id`),
    INDEX `twin_node_system_type_idx`(`system_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `carbon_credit` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `vintage` INTEGER NOT NULL,
    `type` VARCHAR(10) NOT NULL,
    `quantity` DOUBLE NOT NULL,
    `avg_cost` DOUBLE NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `carbon_credit_tenant_id_vintage_idx`(`tenant_id`, `vintage`),
    INDEX `carbon_credit_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `carbon_trade` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `credit_id` VARCHAR(191) NOT NULL,
    `trade_type` VARCHAR(10) NOT NULL,
    `quantity` DOUBLE NOT NULL,
    `price` DOUBLE NOT NULL DEFAULT 0,
    `total_amount` DOUBLE NOT NULL DEFAULT 0,
    `memo` TEXT NULL,
    `traded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `carbon_trade_tenant_id_traded_at_idx`(`tenant_id`, `traded_at` DESC),
    INDEX `carbon_trade_credit_id_idx`(`credit_id`),
    INDEX `carbon_trade_trade_type_idx`(`trade_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `carbon_credit_registry` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `registry` VARCHAR(50) NOT NULL,
    `project_id` VARCHAR(100) NOT NULL,
    `serial_number_start` VARCHAR(200) NOT NULL,
    `serial_number_end` VARCHAR(200) NOT NULL,
    `vintage_year` INTEGER NOT NULL,
    `credit_type` VARCHAR(20) NOT NULL,
    `certification_body` VARCHAR(100) NOT NULL,
    `issuance_date` DATE NOT NULL,
    `total_quantity` DECIMAL(20, 6) NOT NULL,
    `available_quantity` DECIMAL(20, 6) NOT NULL,
    `retired_quantity` DECIMAL(20, 6) NOT NULL DEFAULT 0,
    `locked_quantity` DECIMAL(20, 6) NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `carbon_credit_registry_tenant_id_credit_type_vintage_year_idx`(`tenant_id`, `credit_type`, `vintage_year`),
    INDEX `carbon_credit_registry_tenant_id_status_idx`(`tenant_id`, `status`),
    UNIQUE INDEX `carbon_credit_registry_tenant_id_registry_project_id_serial__key`(`tenant_id`, `registry`, `project_id`, `serial_number_start`, `vintage_year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `carbon_ledger_entry` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `registry_id` VARCHAR(191) NOT NULL,
    `event_type` VARCHAR(20) NOT NULL,
    `quantity` DECIMAL(20, 6) NOT NULL,
    `unit_price` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(20, 2) NOT NULL DEFAULT 0,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'KRW',
    `counterparty` VARCHAR(200) NULL,
    `payment_status` VARCHAR(20) NOT NULL DEFAULT 'N/A',
    `settlement_status` VARCHAR(20) NOT NULL DEFAULT 'N/A',
    `idempotency_key` VARCHAR(128) NULL,
    `hash_signature` VARCHAR(64) NOT NULL,
    `prev_hash` VARCHAR(64) NULL,
    `memo` TEXT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `carbon_ledger_entry_idempotency_key_key`(`idempotency_key`),
    INDEX `carbon_ledger_entry_tenant_id_created_at_idx`(`tenant_id`, `created_at` DESC),
    INDEX `carbon_ledger_entry_tenant_id_event_type_idx`(`tenant_id`, `event_type`),
    INDEX `carbon_ledger_entry_registry_id_idx`(`registry_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `carbon_retirement_certificate` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `ledger_entry_id` VARCHAR(191) NOT NULL,
    `registry_id` VARCHAR(191) NOT NULL,
    `retirement_id` VARCHAR(50) NOT NULL,
    `serial_numbers` TEXT NOT NULL,
    `retired_quantity` DECIMAL(20, 6) NOT NULL,
    `retirement_reason` TEXT NOT NULL,
    `beneficiary_company` VARCHAR(200) NOT NULL,
    `retirement_date` DATE NOT NULL,
    `registry_reference` VARCHAR(200) NULL,
    `certificate_pdf_url` VARCHAR(500) NULL,
    `offset_scope` VARCHAR(20) NULL,
    `compliance_period` VARCHAR(10) NULL,
    `kets_submission_id` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `carbon_retirement_certificate_ledger_entry_id_key`(`ledger_entry_id`),
    UNIQUE INDEX `carbon_retirement_certificate_retirement_id_key`(`retirement_id`),
    INDEX `carbon_retirement_certificate_tenant_id_retirement_date_idx`(`tenant_id`, `retirement_date` DESC),
    INDEX `carbon_retirement_certificate_tenant_id_compliance_period_idx`(`tenant_id`, `compliance_period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `carbon_payment` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `ledger_entry_id` VARCHAR(191) NOT NULL,
    `payment_method` VARCHAR(20) NOT NULL,
    `payment_status` VARCHAR(20) NOT NULL DEFAULT 'INITIATED',
    `amount` DECIMAL(20, 2) NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'KRW',
    `pg_provider` VARCHAR(50) NULL,
    `pg_transaction_id` VARCHAR(200) NULL,
    `bank_ref_number` VARCHAR(100) NULL,
    `bank_code` VARCHAR(10) NULL,
    `account_last4` VARCHAR(4) NULL,
    `escrow_release_at` DATETIME(3) NULL,
    `initiated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `settled_at` DATETIME(3) NULL,
    `failed_at` DATETIME(3) NULL,
    `failure_reason` TEXT NULL,
    `metadata` JSON NULL,

    UNIQUE INDEX `carbon_payment_ledger_entry_id_key`(`ledger_entry_id`),
    INDEX `carbon_payment_tenant_id_payment_status_idx`(`tenant_id`, `payment_status`),
    INDEX `carbon_payment_pg_transaction_id_idx`(`pg_transaction_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_compliance_setting` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `region` VARCHAR(10) NOT NULL DEFAULT 'KR',
    `reporting_standard` VARCHAR(100) NOT NULL DEFAULT 'GHG Protocol',
    `factor_source` VARCHAR(200) NOT NULL DEFAULT '환경부',
    `default_engine_version` VARCHAR(20) NULL,
    `electricity_factor` DECIMAL(10, 6) NOT NULL DEFAULT 0.4567,
    `base_year` INTEGER NOT NULL DEFAULT 2020,
    `target_reduction_pct` DECIMAL(5, 2) NULL,
    `reporting_frequency` VARCHAR(20) NOT NULL DEFAULT 'monthly',
    `fiscal_year_start` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tenant_compliance_setting_tenant_id_key`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `emissions_record` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NULL,
    `scope` VARCHAR(10) NOT NULL,
    `source_type` VARCHAR(100) NOT NULL,
    `activity_data` DECIMAL(15, 4) NOT NULL,
    `activity_unit` VARCHAR(50) NOT NULL,
    `activity_data_snapshot` JSON NULL,
    `emissions` DECIMAL(15, 6) NOT NULL,
    `unit` VARCHAR(20) NOT NULL DEFAULT 'tCO2eq',
    `engine_version_id` VARCHAR(191) NOT NULL,
    `emission_factor_id` VARCHAR(191) NOT NULL,
    `emission_factor_version` VARCHAR(20) NOT NULL,
    `emission_factor_value` DECIMAL(15, 8) NOT NULL,
    `calculation_method` VARCHAR(50) NOT NULL,
    `data_source` VARCHAR(50) NOT NULL,
    `data_quality` VARCHAR(20) NOT NULL,
    `period` VARCHAR(7) NOT NULL,
    `recorded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `is_archived` BOOLEAN NOT NULL DEFAULT false,
    `archived_at` DATETIME(3) NULL,
    `archived_by` VARCHAR(191) NULL,
    `archived_reason` TEXT NULL,
    `parent_id` VARCHAR(191) NULL,
    `calculated_by` VARCHAR(191) NOT NULL,
    `data_submitted_by` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `emissions_record_tenant_id_period_idx`(`tenant_id`, `period`),
    INDEX `emissions_record_scope_idx`(`scope`),
    INDEX `emissions_record_is_archived_idx`(`is_archived`),
    INDEX `emissions_record_engine_version_id_idx`(`engine_version_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `esg_report` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `report_no` VARCHAR(30) NOT NULL,
    `report_type` ENUM('compliance', 'sustainability', 'annual', 'interim') NOT NULL,
    `standard` VARCHAR(50) NOT NULL,
    `country_code` VARCHAR(5) NOT NULL DEFAULT 'KR',
    `period` VARCHAR(10) NOT NULL,
    `period_type` VARCHAR(10) NOT NULL,
    `report_year` INTEGER NOT NULL,
    `total_emissions` DECIMAL(15, 6) NOT NULL,
    `scope1` DECIMAL(15, 6) NOT NULL,
    `scope2_location` DECIMAL(15, 6) NOT NULL,
    `scope2_market` DECIMAL(15, 6) NULL,
    `scope3` DECIMAL(15, 6) NOT NULL,
    `emissions_unit` VARCHAR(20) NOT NULL DEFAULT 'tCO2eq',
    `emission_factors_snapshot` JSON NOT NULL,
    `engine_version_snapshot` JSON NOT NULL,
    `calculation_method_snapshot` JSON NOT NULL,
    `boundary_snapshot` JSON NOT NULL,
    `activity_data_snapshot` JSON NULL,
    `applicable_standards` VARCHAR(500) NOT NULL,
    `methodology_notes` TEXT NULL,
    `completeness_score` DECIMAL(5, 2) NULL,
    `data_hash` VARCHAR(64) NOT NULL,
    `is_immutable` BOOLEAN NOT NULL DEFAULT false,
    `xbrl_taxonomy` VARCHAR(100) NULL,
    `xbrl_export_url` VARCHAR(500) NULL,
    `pdf_url` VARCHAR(500) NULL,
    `excel_url` VARCHAR(500) NULL,
    `status` ENUM('draft', 'in_review', 'approved', 'published', 'withdrawn') NOT NULL DEFAULT 'draft',
    `generated_by` VARCHAR(191) NOT NULL,
    `reviewed_by` VARCHAR(191) NULL,
    `reviewed_at` DATETIME(3) NULL,
    `approved_by` VARCHAR(191) NULL,
    `approved_at` DATETIME(3) NULL,
    `previous_report_id` VARCHAR(191) NULL,
    `revision_number` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `esg_report_report_no_key`(`report_no`),
    INDEX `esg_report_tenant_id_report_year_idx`(`tenant_id`, `report_year`),
    INDEX `esg_report_standard_country_code_idx`(`standard`, `country_code`),
    INDEX `esg_report_status_idx`(`status`),
    INDEX `esg_report_is_immutable_idx`(`is_immutable`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `report_generation_log` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `report_id` VARCHAR(191) NULL,
    `standard` VARCHAR(50) NOT NULL,
    `period` VARCHAR(10) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `duration_ms` INTEGER NULL,
    `error_message` TEXT NULL,
    `triggered_by` VARCHAR(191) NOT NULL,
    `input_hash` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `report_generation_log_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    INDEX `report_generation_log_report_id_idx`(`report_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `report_audit_log` (
    `id` VARCHAR(191) NOT NULL,
    `report_id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `action` VARCHAR(50) NOT NULL,
    `from_status` VARCHAR(30) NULL,
    `to_status` VARCHAR(30) NULL,
    `performed_by` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `report_audit_log_report_id_created_at_idx`(`report_id`, `created_at`),
    INDEX `report_audit_log_tenant_id_action_idx`(`tenant_id`, `action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `report_data_source` (
    `id` VARCHAR(191) NOT NULL,
    `report_id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `source_type` VARCHAR(50) NOT NULL,
    `source_id` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(30) NOT NULL,
    `period` VARCHAR(10) NOT NULL,
    `activity_data` DECIMAL(20, 6) NOT NULL,
    `activity_unit` VARCHAR(20) NOT NULL,
    `emissions` DECIMAL(20, 6) NOT NULL,
    `data_quality` VARCHAR(20) NOT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `report_data_source_report_id_idx`(`report_id`),
    INDEX `report_data_source_tenant_id_period_idx`(`tenant_id`, `period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `download_history` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NULL,
    `category` VARCHAR(50) NOT NULL,
    `format` VARCHAR(10) NOT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `start_date` VARCHAR(10) NOT NULL,
    `end_date` VARCHAR(10) NOT NULL,
    `row_count` INTEGER NOT NULL DEFAULT 0,
    `size_bytes` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(20) NOT NULL DEFAULT 'completed',
    `filepath` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `download_history_tenant_id_created_at_idx`(`tenant_id`, `created_at` DESC),
    INDEX `download_history_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `milestone` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `milestone_tenant_id_year_idx`(`tenant_id`, `year`),
    INDEX `milestone_tenant_id_display_order_idx`(`tenant_id`, `display_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_log` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `log_no` VARCHAR(30) NOT NULL,
    `menu_code` VARCHAR(50) NOT NULL,
    `action_type` VARCHAR(50) NOT NULL,
    `action_label` VARCHAR(100) NOT NULL,
    `resource_type` VARCHAR(50) NULL,
    `resource_id` VARCHAR(255) NULL,
    `resource_name` VARCHAR(500) NULL,
    `before_data` JSON NULL,
    `after_data` JSON NULL,
    `metadata` JSON NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'success',
    `error_message` TEXT NULL,
    `user_id` VARCHAR(255) NULL,
    `user_name` VARCHAR(200) NULL,
    `user_email` VARCHAR(200) NULL,
    `user_role` VARCHAR(50) NULL,
    `ip_address` VARCHAR(45) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `activity_log_log_no_key`(`log_no`),
    INDEX `activity_log_tenant_id_created_at_idx`(`tenant_id`, `created_at` DESC),
    INDEX `activity_log_tenant_id_menu_code_created_at_idx`(`tenant_id`, `menu_code`, `created_at` DESC),
    INDEX `activity_log_tenant_id_action_type_idx`(`tenant_id`, `action_type`),
    INDEX `activity_log_tenant_id_user_id_idx`(`tenant_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_log_seq` (
    `prefix` VARCHAR(10) NOT NULL,
    `seq_date` CHAR(8) NOT NULL,
    `seq` INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY (`prefix`, `seq_date`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `carbon_vcm_project` (
    `id` VARCHAR(191) NOT NULL,
    `registry_id` VARCHAR(191) NOT NULL,
    `project_category` VARCHAR(50) NOT NULL,
    `verra_project_id` VARCHAR(50) NULL,
    `gold_standard_id` VARCHAR(50) NULL,
    `country_code` VARCHAR(3) NOT NULL,
    `project_start_date` DATE NOT NULL,
    `monitoring_period_start` DATE NOT NULL,
    `monitoring_period_end` DATE NOT NULL,
    `addiionality_rating` VARCHAR(10) NOT NULL DEFAULT 'unrated',
    `permanence_risk` VARCHAR(10) NOT NULL DEFAULT 'medium',
    `sdg_goals` JSON NOT NULL,
    `biodiversity_impact` BOOLEAN NOT NULL DEFAULT false,
    `community_benefit` BOOLEAN NOT NULL DEFAULT false,
    `water_conservation` BOOLEAN NOT NULL DEFAULT false,
    `livelihood_improvement` BOOLEAN NOT NULL DEFAULT false,
    `co_benefit_description` TEXT NULL,
    `third_party_verifier` VARCHAR(100) NULL,
    `verification_report_url` VARCHAR(500) NULL,
    `baseline_methodology` VARCHAR(100) NULL,
    `expected_annual_reductions` DECIMAL(15, 2) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `carbon_vcm_project_registry_id_key`(`registry_id`),
    INDEX `carbon_vcm_project_project_category_idx`(`project_category`),
    INDEX `carbon_vcm_project_country_code_idx`(`country_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `carbon_token_record` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `registry_id` VARCHAR(191) NOT NULL,
    `wallet_address` VARCHAR(100) NOT NULL,
    `token_standard` VARCHAR(20) NOT NULL,
    `network` VARCHAR(30) NOT NULL,
    `protocol` VARCHAR(20) NOT NULL DEFAULT 'custom',
    `contract_address` VARCHAR(100) NOT NULL,
    `token_id` VARCHAR(100) NULL,
    `tokenized_quantity` DECIMAL(20, 6) NOT NULL,
    `on_chain_status` VARCHAR(30) NOT NULL,
    `tx_hash` VARCHAR(100) NULL,
    `block_number` BIGINT NULL,
    `bridged_at` DATETIME(3) NULL,
    `retired_on_chain_at` DATETIME(3) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `carbon_token_record_tenant_id_on_chain_status_idx`(`tenant_id`, `on_chain_status`),
    INDEX `carbon_token_record_registry_id_idx`(`registry_id`),
    INDEX `carbon_token_record_wallet_address_idx`(`wallet_address`),
    INDEX `carbon_token_record_tenant_id_network_idx`(`tenant_id`, `network`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_carbon_wallet` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `network` VARCHAR(30) NOT NULL,
    `wallet_address` VARCHAR(100) NOT NULL,
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `verified_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tenant_carbon_wallet_tenant_id_key`(`tenant_id`),
    INDEX `tenant_carbon_wallet_network_idx`(`network`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `feature` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(100) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(50) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `feature_code_key`(`code`),
    INDEX `feature_category_is_active_idx`(`category`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plan_feature` (
    `id` VARCHAR(191) NOT NULL,
    `plan_id` VARCHAR(191) NOT NULL,
    `feature_code` VARCHAR(100) NOT NULL,
    `limit_value` INTEGER NULL,
    `limit_unit` VARCHAR(30) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `plan_feature_plan_id_idx`(`plan_id`),
    INDEX `plan_feature_feature_code_idx`(`feature_code`),
    UNIQUE INDEX `plan_feature_plan_id_feature_code_key`(`plan_id`, `feature_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `equipment_product` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `model_number` VARCHAR(100) NOT NULL,
    `manufacturer` VARCHAR(100) NOT NULL,
    `category` ENUM('gateway', 'sensor', 'controller', 'meter', 'display', 'accessory') NOT NULL,
    `facility_types` JSON NOT NULL,
    `specs` JSON NOT NULL,
    `protocols` JSON NOT NULL,
    `unit_price` DECIMAL(12, 2) NULL,
    `description` TEXT NULL,
    `image_url` VARCHAR(500) NULL,
    `install_difficulty` VARCHAR(20) NOT NULL DEFAULT 'medium',
    `warranty_months` INTEGER NOT NULL DEFAULT 12,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `equipment_product_model_number_key`(`model_number`),
    INDEX `equipment_product_category_idx`(`category`),
    INDEX `equipment_product_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `equipment_lot` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `lot_number` VARCHAR(100) NOT NULL,
    `facility_type` VARCHAR(50) NOT NULL,
    `status` ENUM('pending', 'shipped', 'delivered', 'installing', 'installed', 'active', 'returned') NOT NULL DEFAULT 'pending',
    `ordered_at` DATE NULL,
    `shipped_at` DATE NULL,
    `delivered_at` DATE NULL,
    `installed_at` DATE NULL,
    `technician_name` VARCHAR(100) NULL,
    `technician_phone` VARCHAR(50) NULL,
    `site_id` VARCHAR(36) NULL,
    `site_address` TEXT NULL,
    `site_contact` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `equipment_lot_lot_number_key`(`lot_number`),
    INDEX `equipment_lot_tenant_id_idx`(`tenant_id`),
    INDEX `equipment_lot_site_id_idx`(`site_id`),
    INDEX `equipment_lot_status_idx`(`status`),
    INDEX `equipment_lot_facility_type_idx`(`facility_type`),
    INDEX `equipment_lot_delivered_at_idx`(`delivered_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `equipment_lot_item` (
    `id` VARCHAR(191) NOT NULL,
    `lot_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `serial_numbers` JSON NOT NULL,
    `status` ENUM('pending', 'installed', 'active', 'faulty', 'returned') NOT NULL DEFAULT 'pending',
    `device_id` VARCHAR(36) NULL,
    `gateway_id` VARCHAR(36) NULL,
    `defect_note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `equipment_lot_item_lot_id_idx`(`lot_id`),
    INDEX `equipment_lot_item_product_id_idx`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `equipment_stock` (
    `id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(36) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `received_at` DATETIME(3) NOT NULL,
    `supplier` VARCHAR(200) NULL,
    `unit_cost` DECIMAL(15, 2) NULL,
    `batch_no` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    `created_by` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `equipment_stock_product_id_idx`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `regulatory_sandbox` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `description` TEXT NULL,
    `regulation_type` VARCHAR(50) NOT NULL,
    `exemption_scope` TEXT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `applied_at` DATETIME(3) NOT NULL,
    `review_started_at` DATETIME(3) NULL,
    `reviewed_at` DATETIME(3) NULL,
    `reviewed_by` VARCHAR(36) NULL,
    `expire_date` DATE NULL,
    `review_note` TEXT NULL,
    `conditions` JSON NULL,
    `applicant_name` VARCHAR(100) NULL,
    `applicant_email` VARCHAR(200) NULL,
    `contact_phone` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `regulatory_sandbox_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `regulatory_sandbox_status_applied_at_idx`(`status`, `applied_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `carbon_market_price` (
    `id` VARCHAR(191) NOT NULL,
    `market` VARCHAR(20) NOT NULL,
    `price_date` DATE NOT NULL,
    `price` DECIMAL(15, 4) NOT NULL,
    `currency` VARCHAR(10) NOT NULL DEFAULT 'KRW',
    `unit` VARCHAR(20) NOT NULL DEFAULT 'tCO2',
    `source` VARCHAR(200) NULL,
    `change_rate` DECIMAL(10, 4) NULL,
    `volume` INTEGER NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `carbon_market_price_market_price_date_idx`(`market`, `price_date` DESC),
    UNIQUE INDEX `carbon_market_price_market_price_date_key`(`market`, `price_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ransomware_alert` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NULL,
    `user_id` VARCHAR(191) NULL,
    `source_ip` VARCHAR(45) NULL,
    `alert_type` VARCHAR(50) NOT NULL,
    `severity` VARCHAR(20) NOT NULL,
    `description` TEXT NOT NULL,
    `metadata` JSON NULL,
    `status` VARCHAR(30) NOT NULL DEFAULT 'open',
    `resolved_by` VARCHAR(191) NULL,
    `resolved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ransomware_alert_tenant_id_status_created_at_idx`(`tenant_id`, `status`, `created_at`),
    INDEX `ransomware_alert_alert_type_severity_idx`(`alert_type`, `severity`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `backup_record` (
    `id` VARCHAR(191) NOT NULL,
    `backup_type` VARCHAR(20) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `size_bytes` BIGINT NULL,
    `storage_path` VARCHAR(500) NOT NULL,
    `checksum` VARCHAR(64) NULL,
    `is_immutable` BOOLEAN NOT NULL DEFAULT true,
    `expires_at` DATETIME(3) NULL,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,
    `metadata` JSON NULL,

    INDEX `backup_record_backup_type_status_idx`(`backup_type`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice` (
    `id` VARCHAR(191) NOT NULL,
    `invoice_no` VARCHAR(30) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `subscription_id` VARCHAR(191) NULL,
    `period_start` VARCHAR(10) NOT NULL,
    `period_end` VARCHAR(10) NOT NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `tax_rate` DECIMAL(5, 4) NOT NULL DEFAULT 0.1000,
    `tax_amount` DECIMAL(12, 2) NOT NULL,
    `total` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'KRW',
    `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
    `due_date` DATETIME(3) NOT NULL,
    `paid_at` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `invoice_invoice_no_key`(`invoice_no`),
    INDEX `invoice_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `invoice_period_start_status_idx`(`period_start`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_line_item` (
    `id` VARCHAR(191) NOT NULL,
    `invoice_id` VARCHAR(191) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unit_price` DECIMAL(12, 2) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,

    INDEX `invoice_line_item_invoice_id_idx`(`invoice_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kpi_snapshot` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `period` VARCHAR(7) NOT NULL,
    `total_kwh` DECIMAL(15, 3) NOT NULL,
    `peak_kw` DECIMAL(10, 3) NOT NULL,
    `baseline_kwh` DECIMAL(15, 3) NULL,
    `saved_kwh` DECIMAL(15, 3) NULL,
    `total_co2_kg` DECIMAL(15, 3) NOT NULL,
    `saved_co2_kg` DECIMAL(15, 3) NULL,
    `energy_cost_krw` DECIMAL(15, 2) NULL,
    `saved_cost_krw` DECIMAL(15, 2) NULL,
    `investment_krw` DECIMAL(15, 2) NULL,
    `roi_percent` DECIMAL(8, 2) NULL,
    `payback_months` DECIMAL(6, 1) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `kpi_snapshot_period_idx`(`period`),
    UNIQUE INDEX `kpi_snapshot_tenant_id_period_key`(`tenant_id`, `period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_churn_score` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `period` VARCHAR(10) NOT NULL,
    `churn_score` INTEGER NOT NULL DEFAULT 0,
    `risk_level` VARCHAR(20) NOT NULL DEFAULT 'normal',
    `onboarding_score` INTEGER NOT NULL DEFAULT 0,
    `engagement_score` INTEGER NOT NULL DEFAULT 0,
    `organization_score` INTEGER NOT NULL DEFAULT 0,
    `roi_score` INTEGER NOT NULL DEFAULT 0,
    `support_score` INTEGER NOT NULL DEFAULT 0,
    `payment_score` INTEGER NOT NULL DEFAULT 0,
    `score_reasons` JSON NULL,
    `action_taken` BOOLEAN NOT NULL DEFAULT false,
    `action_taken_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tenant_churn_score_churn_score_created_at_idx`(`churn_score` DESC, `created_at` DESC),
    INDEX `tenant_churn_score_risk_level_created_at_idx`(`risk_level`, `created_at` DESC),
    UNIQUE INDEX `tenant_churn_score_tenant_id_period_key`(`tenant_id`, `period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `retention_event` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NULL,
    `event_type` VARCHAR(80) NOT NULL,
    `properties` JSON NULL,
    `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `retention_event_tenant_id_event_type_occurred_at_idx`(`tenant_id`, `event_type`, `occurred_at` DESC),
    INDEX `retention_event_user_id_occurred_at_idx`(`user_id`, `occurred_at` DESC),
    INDEX `retention_event_event_type_occurred_at_idx`(`event_type`, `occurred_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `onboarding_milestone` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `iot_connected_at` DATETIME(3) NULL,
    `first_data_at` DATETIME(3) NULL,
    `first_ai_analysis_at` DATETIME(3) NULL,
    `first_report_at` DATETIME(3) NULL,
    `first_alert_at` DATETIME(3) NULL,
    `ttfv_seconds` INTEGER NULL,
    `completion_pct` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `onboarding_milestone_tenant_id_key`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `retention_action` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NOT NULL,
    `trigger_type` VARCHAR(80) NOT NULL,
    `churn_score` INTEGER NOT NULL DEFAULT 0,
    `channel` VARCHAR(30) NOT NULL,
    `template_id` VARCHAR(80) NOT NULL,
    `recipient_id` VARCHAR(191) NULL,
    `recipient_phone` VARCHAR(20) NULL,
    `recipient_email` VARCHAR(200) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'sent',
    `sent_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `read_at` DATETIME(3) NULL,
    `responded` BOOLEAN NOT NULL DEFAULT false,
    `responded_at` DATETIME(3) NULL,
    `metadata` JSON NULL,

    INDEX `retention_action_tenant_id_sent_at_idx`(`tenant_id`, `sent_at` DESC),
    INDEX `retention_action_trigger_type_sent_at_idx`(`trigger_type`, `sent_at` DESC),
    INDEX `retention_action_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kakao_alimtalk_log` (
    `id` VARCHAR(191) NOT NULL,
    `tenant_id` VARCHAR(191) NULL,
    `user_id` VARCHAR(191) NULL,
    `phone` VARCHAR(20) NOT NULL,
    `template_id` VARCHAR(80) NOT NULL,
    `variables` JSON NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `msg_key` VARCHAR(100) NULL,
    `fail_reason` TEXT NULL,
    `sent_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `kakao_alimtalk_log_tenant_id_sent_at_idx`(`tenant_id`, `sent_at` DESC),
    INDEX `kakao_alimtalk_log_status_sent_at_idx`(`status`, `sent_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `subscription` ADD CONSTRAINT `subscription_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription` ADD CONSTRAINT `subscription_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `plan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user` ADD CONSTRAINT `user_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `login_history` ADD CONSTRAINT `login_history_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `login_history` ADD CONSTRAINT `login_history_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_site_access` ADD CONSTRAINT `user_site_access_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_site_access` ADD CONSTRAINT `user_site_access_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_site_access` ADD CONSTRAINT `user_site_access_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `site`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE `metric` ADD CONSTRAINT `metric_sensor_id_fkey` FOREIGN KEY (`sensor_id`) REFERENCES `sensor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE `Report` ADD CONSTRAINT `Report_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Report` ADD CONSTRAINT `Report_generatedBy_fkey` FOREIGN KEY (`generatedBy`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ForecastResult` ADD CONSTRAINT `ForecastResult_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_history` ADD CONSTRAINT `payment_history_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_history` ADD CONSTRAINT `payment_history_subscription_id_fkey` FOREIGN KEY (`subscription_id`) REFERENCES `subscription`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_rule` ADD CONSTRAINT `notification_rule_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_rule` ADD CONSTRAINT `notification_rule_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_log` ADD CONSTRAINT `notification_log_rule_id_fkey` FOREIGN KEY (`rule_id`) REFERENCES `notification_rule`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sensor` ADD CONSTRAINT `sensor_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sensor` ADD CONSTRAINT `sensor_device_id_fkey` FOREIGN KEY (`device_id`) REFERENCES `device`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emission_factor` ADD CONSTRAINT `emission_factor_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emission_factor` ADD CONSTRAINT `emission_factor_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `emission_factor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emission_factor_audit_log` ADD CONSTRAINT `emission_factor_audit_log_emission_factor_id_fkey` FOREIGN KEY (`emission_factor_id`) REFERENCES `emission_factor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `api_key` ADD CONSTRAINT `api_key_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `api_key` ADD CONSTRAINT `api_key_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `physical_space` ADD CONSTRAINT `physical_space_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `physical_space` ADD CONSTRAINT `physical_space_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `site`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `physical_space` ADD CONSTRAINT `physical_space_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `physical_space`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `twin_node` ADD CONSTRAINT `twin_node_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `twin_node` ADD CONSTRAINT `twin_node_device_id_fkey` FOREIGN KEY (`device_id`) REFERENCES `device`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `twin_node` ADD CONSTRAINT `twin_node_space_id_fkey` FOREIGN KEY (`space_id`) REFERENCES `physical_space`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carbon_credit` ADD CONSTRAINT `carbon_credit_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carbon_trade` ADD CONSTRAINT `carbon_trade_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carbon_trade` ADD CONSTRAINT `carbon_trade_credit_id_fkey` FOREIGN KEY (`credit_id`) REFERENCES `carbon_credit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carbon_credit_registry` ADD CONSTRAINT `carbon_credit_registry_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carbon_ledger_entry` ADD CONSTRAINT `carbon_ledger_entry_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carbon_ledger_entry` ADD CONSTRAINT `carbon_ledger_entry_registry_id_fkey` FOREIGN KEY (`registry_id`) REFERENCES `carbon_credit_registry`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carbon_retirement_certificate` ADD CONSTRAINT `carbon_retirement_certificate_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carbon_retirement_certificate` ADD CONSTRAINT `carbon_retirement_certificate_ledger_entry_id_fkey` FOREIGN KEY (`ledger_entry_id`) REFERENCES `carbon_ledger_entry`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carbon_retirement_certificate` ADD CONSTRAINT `carbon_retirement_certificate_registry_id_fkey` FOREIGN KEY (`registry_id`) REFERENCES `carbon_credit_registry`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carbon_payment` ADD CONSTRAINT `carbon_payment_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carbon_payment` ADD CONSTRAINT `carbon_payment_ledger_entry_id_fkey` FOREIGN KEY (`ledger_entry_id`) REFERENCES `carbon_ledger_entry`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_compliance_setting` ADD CONSTRAINT `tenant_compliance_setting_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emissions_record` ADD CONSTRAINT `emissions_record_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emissions_record` ADD CONSTRAINT `emissions_record_engine_version_id_fkey` FOREIGN KEY (`engine_version_id`) REFERENCES `calc_engine_version`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `emissions_record` ADD CONSTRAINT `emissions_record_emission_factor_id_fkey` FOREIGN KEY (`emission_factor_id`) REFERENCES `emission_factor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `esg_report` ADD CONSTRAINT `esg_report_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `esg_report` ADD CONSTRAINT `esg_report_previous_report_id_fkey` FOREIGN KEY (`previous_report_id`) REFERENCES `esg_report`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE `download_history` ADD CONSTRAINT `download_history_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `milestone` ADD CONSTRAINT `milestone_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_log` ADD CONSTRAINT `activity_log_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carbon_vcm_project` ADD CONSTRAINT `carbon_vcm_project_registry_id_fkey` FOREIGN KEY (`registry_id`) REFERENCES `carbon_credit_registry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carbon_token_record` ADD CONSTRAINT `carbon_token_record_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carbon_token_record` ADD CONSTRAINT `carbon_token_record_registry_id_fkey` FOREIGN KEY (`registry_id`) REFERENCES `carbon_credit_registry`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_carbon_wallet` ADD CONSTRAINT `tenant_carbon_wallet_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plan_feature` ADD CONSTRAINT `plan_feature_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `plan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plan_feature` ADD CONSTRAINT `plan_feature_feature_code_fkey` FOREIGN KEY (`feature_code`) REFERENCES `feature`(`code`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `equipment_lot` ADD CONSTRAINT `equipment_lot_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `equipment_lot_item` ADD CONSTRAINT `equipment_lot_item_lot_id_fkey` FOREIGN KEY (`lot_id`) REFERENCES `equipment_lot`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `equipment_lot_item` ADD CONSTRAINT `equipment_lot_item_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `equipment_product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `equipment_stock` ADD CONSTRAINT `equipment_stock_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `equipment_product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `regulatory_sandbox` ADD CONSTRAINT `regulatory_sandbox_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_line_item` ADD CONSTRAINT `invoice_line_item_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

