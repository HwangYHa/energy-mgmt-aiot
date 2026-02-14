-- ============================================
-- 메뉴 정리 및 신규 메뉴 추가 SQL
-- 테이블: menu_group (code, name, icon, display_order, level, min_role, is_visible, ...)
-- 테이블: menu_item (code, name, path, icon, display_order, level, min_role, is_visible, menu_group_id, ...)
-- ============================================

-- 1. 중복 사이트 메뉴 정리: monitoring_sites 삭제 (management_sites만 유지)
DELETE FROM menu_item WHERE code = 'monitoring_sites';

-- 2. management_sites의 min_role을 viewer로 변경 (모든 사용자 접근 가능)
UPDATE menu_item SET min_role = 'viewer' WHERE code = 'management_sites';

-- 3. 설비 목록 메뉴 활성화
UPDATE menu_item SET is_visible = 1 WHERE code = 'monitoring_equipment';

-- 4. 구독 관리 경로 수정 (/payment → /settings/subscription)
UPDATE menu_item SET path = '/settings/subscription' WHERE code = 'management_subscription';

-- 5. 센서 관리 메뉴 추가
INSERT INTO menu_item (id, code, name, path, icon, display_order, min_role, is_visible, menu_group_id, `level`, subscription_required, badge_type, created_at, updated_at)
VALUES (UUID(), 'management_sensors', '센서 관리', '/sensors', 'Radio', 25, 'operator', 1,
        (SELECT id FROM menu_group WHERE code = 'management'), 1, 1, 'none', NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE name = '센서 관리', path = '/sensors', icon = 'Radio', min_role = 'operator', is_visible = 1;

-- 6. 시스템 설정 메뉴 추가
INSERT INTO menu_item (id, code, name, path, icon, display_order, min_role, is_visible, menu_group_id, `level`, subscription_required, badge_type, created_at, updated_at)
VALUES (UUID(), 'settings_system', '시스템 설정', '/settings/system', 'Settings', 5, 'viewer', 1,
        (SELECT id FROM menu_group WHERE code = 'settings'), 1, 1, 'none', NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE name = '시스템 설정', path = '/settings/system', icon = 'Settings', is_visible = 1;

-- 7. Super Admin 메뉴 그룹 추가
INSERT INTO menu_group (id, code, name, icon, display_order, `level`, min_role, is_visible, subscription_required, is_active, created_at, updated_at)
VALUES (UUID(), 'admin', 'Super Admin', 'Shield', 70, 1, 'super_admin', 1, 0, 1, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE name = 'Super Admin', icon = 'Shield', display_order = 70, min_role = 'super_admin';

-- 8. Super Admin - 테넌트 관리 메뉴
INSERT INTO menu_item (id, code, name, path, icon, display_order, min_role, is_visible, menu_group_id, `level`, subscription_required, badge_type, created_at, updated_at)
VALUES (UUID(), 'admin_tenants', '테넌트 관리', '/admin/tenants', 'Building2', 10, 'super_admin', 1,
        (SELECT id FROM menu_group WHERE code = 'admin'), 1, 0, 'none', NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE name = '테넌트 관리', path = '/admin/tenants', icon = 'Building2', min_role = 'super_admin';
