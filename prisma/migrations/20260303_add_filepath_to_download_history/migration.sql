-- AddColumn filepath to download_history
ALTER TABLE `download_history` ADD COLUMN `filepath` VARCHAR(500);
