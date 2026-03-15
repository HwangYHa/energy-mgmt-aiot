-- ============================================================
-- Migration: 20260307_sequential_codes
-- 목적: 각 엔티티 테이블에 화면별 채번 코드 컬럼 추가 (IF NOT EXISTS)
-- 형식: {PREFIX}-{YYYYMMDD}-{NNNN}  (예: GW-20260307-0001)
-- ============================================================

-- 게이트웨이 (GW)
ALTER TABLE `gateway`
  ADD COLUMN IF NOT EXISTS `code` VARCHAR(50) NULL COMMENT '채번 코드 (GW-YYYYMMDD-NNNN)';

-- DR 이벤트 (DR)
ALTER TABLE `dr_event`
  ADD COLUMN IF NOT EXISTS `code` VARCHAR(50) NULL COMMENT '채번 코드 (DR-YYYYMMDD-NNNN)';

-- 알람 규칙 (AL)
ALTER TABLE `alert_rule`
  ADD COLUMN IF NOT EXISTS `code` VARCHAR(50) NULL COMMENT '채번 코드 (AL-YYYYMMDD-NNNN)';

-- 알림 규칙 (NR)
ALTER TABLE `notification_rule`
  ADD COLUMN IF NOT EXISTS `code` VARCHAR(50) NULL COMMENT '채번 코드 (NR-YYYYMMDD-NNNN)';

-- 제어 스케줄 (CS)
ALTER TABLE `control_schedule`
  ADD COLUMN IF NOT EXISTS `code` VARCHAR(50) NULL COMMENT '채번 코드 (CS-YYYYMMDD-NNNN)';

-- 배출량 수동 등록 (ED)
ALTER TABLE `emissions_data`
  ADD COLUMN IF NOT EXISTS `code` VARCHAR(50) NULL COMMENT '채번 코드 (ED-YYYYMMDD-NNNN)';

-- 탄소 거래 내역 (CG)
ALTER TABLE `carbon_trade`
  ADD COLUMN IF NOT EXISTS `code` VARCHAR(50) NULL COMMENT '채번 코드 (CG-YYYYMMDD-NNNN)';

-- 지원/문의 (SI)
ALTER TABLE `support_inquiry`
  ADD COLUMN IF NOT EXISTS `code` VARCHAR(50) NULL COMMENT '채번 코드 (SI-YYYYMMDD-NNNN)';

-- 장비 제품 (EP)
ALTER TABLE `equipment_product`
  ADD COLUMN IF NOT EXISTS `code` VARCHAR(50) NULL COMMENT '채번 코드 (EP-YYYYMMDD-NNNN)';

-- 탄소 로드맵 마일스톤 (CM)
ALTER TABLE `milestone`
  ADD COLUMN IF NOT EXISTS `code` VARCHAR(50) NULL COMMENT '채번 코드 (CM-YYYYMMDD-NNNN)';
