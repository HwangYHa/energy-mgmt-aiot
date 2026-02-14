-- ============================================
-- 신규 메뉴 추가 SQL v2
-- 실시간 모니터링, 스케줄 제어, 규제/컴플라이언스
-- ============================================

-- 1. 모니터링 > 실시간 대시보드
INSERT INTO menu_item (id, code, name, path, icon, display_order, min_role, is_visible, menu_group_id, `level`, subscription_required, badge_type, created_at, updated_at)
VALUES (UUID(), 'monitoring_realtime', '실시간 모니터링', '/dashboard/realtime', 'Activity', 5, 'viewer', 1,
        (SELECT id FROM menu_group WHERE code = 'monitoring'), 1, 1, 'none', NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE name = '실시간 모니터링', path = '/dashboard/realtime', icon = 'Activity', is_visible = 1;

-- 2. 제어 > 스케줄 제어
INSERT INTO menu_item (id, code, name, path, icon, display_order, min_role, is_visible, menu_group_id, `level`, subscription_required, badge_type, created_at, updated_at)
VALUES (UUID(), 'control_schedule', '스케줄 제어', '/control/schedule', 'Calendar', 15, 'operator', 1,
        (SELECT id FROM menu_group WHERE code = 'control'), 1, 1, 'none', NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE name = '스케줄 제어', path = '/control/schedule', icon = 'Calendar', is_visible = 1;

-- 3. 규제/컴플라이언스 메뉴 그룹 추가
INSERT INTO menu_group (id, code, name, icon, display_order, `level`, min_role, is_visible, subscription_required, is_active, created_at, updated_at)
VALUES (UUID(), 'compliance', '규제/컴플라이언스', 'Shield', 55, 1, 'site_manager', 1, 1, 1, NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE name = '규제/컴플라이언스', icon = 'Shield', display_order = 55, min_role = 'site_manager';

-- 4. 컴플라이언스 > 감사 추적
INSERT INTO menu_item (id, code, name, path, icon, display_order, min_role, is_visible, menu_group_id, `level`, subscription_required, badge_type, created_at, updated_at)
VALUES (UUID(), 'compliance_audit', '감사 추적', '/compliance/audit-trail', 'FileText', 10, 'site_manager', 1,
        (SELECT id FROM menu_group WHERE code = 'compliance'), 1, 1, 'none', NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE name = '감사 추적', path = '/compliance/audit-trail', icon = 'FileText', is_visible = 1;

-- 5. 컴플라이언스 > 배출계수 관리
INSERT INTO menu_item (id, code, name, path, icon, display_order, min_role, is_visible, menu_group_id, `level`, subscription_required, badge_type, created_at, updated_at)
VALUES (UUID(), 'compliance_emission_factors', '배출계수 관리', '/compliance/emission-factors', 'Leaf', 20, 'site_manager', 1,
        (SELECT id FROM menu_group WHERE code = 'compliance'), 1, 1, 'none', NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE name = '배출계수 관리', path = '/compliance/emission-factors', icon = 'Leaf', is_visible = 1;

-- 6. 컴플라이언스 > 규제 리포트
INSERT INTO menu_item (id, code, name, path, icon, display_order, min_role, is_visible, menu_group_id, `level`, subscription_required, badge_type, created_at, updated_at)
VALUES (UUID(), 'compliance_reports', '규제 리포트', '/compliance/reports', 'ClipboardList', 30, 'site_manager', 1,
        (SELECT id FROM menu_group WHERE code = 'compliance'), 1, 1, 'none', NOW(3), NOW(3))
ON DUPLICATE KEY UPDATE name = '규제 리포트', path = '/compliance/reports', icon = 'ClipboardList', is_visible = 1;
