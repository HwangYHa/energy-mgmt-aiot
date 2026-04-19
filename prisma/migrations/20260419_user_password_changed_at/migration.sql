-- Add password_changed_at column to user table
-- This column exists in the Prisma schema but was missing from migrations (schema drift fix)
ALTER TABLE `user` ADD COLUMN `password_changed_at` DATETIME(0) NULL;
