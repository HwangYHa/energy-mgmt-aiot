-- 랜섬웨어 대응 메뉴 항목 삭제 (보안 모니터링 탭으로 통합됨)
DELETE FROM `menu_item` WHERE `code` = 'admin_ransomware';
