-- ==============================================================================
-- FashionIQ Database Migration - Sequence: 4 of 4 (Password Reset & Account Recovery)
-- Target: Apply to existing baseline schema (database/FashionIQ_Full_Database_pre_phase4_backup.sql)
-- Prerequisites: Baseline table `user` must exist.
-- Execution Order:
--   1. migration_orders.sql
--   2. migration_wardrobe.sql
--   3. migration_outfit.sql
--   4. migration_password_reset.sql (THIS FILE)
-- Repeatability: Safely repeatable in MySQL 8.0+ via CREATE TABLE IF NOT EXISTS.
-- Data Safety: Preserves existing data; does not drop or recreate tables.
-- ==============================================================================

USE `fashioniq`;

-- Table: password_reset_token
-- Stores single-use, cryptographically secure time-limited password reset tokens.
CREATE TABLE IF NOT EXISTS `password_reset_token` (
    `reset_id` INT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `token_hash` VARCHAR(64) NOT NULL,
    `expires_at` DATETIME NOT NULL,
    `used_at` DATETIME NULL DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,
    INDEX `idx_prt_token_hash` (`token_hash`),
    INDEX `idx_prt_user_id` (`user_id`),
    CONSTRAINT `fk_prt_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
