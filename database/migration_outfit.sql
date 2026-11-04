-- ==============================================================================
-- FashionIQ Database Migration - Sequence: 3 of 4 (Phase 7: Complete Outfit Recommendations)
-- Target: Apply to existing baseline schema (database/FashionIQ_Full_Database_pre_phase4_backup.sql)
-- Prerequisites: Baseline tables `outfit` and `outfit_item` must exist.
-- Execution Order:
--   1. migration_orders.sql
--   2. migration_wardrobe.sql
--   3. migration_outfit.sql (THIS FILE)
--   4. migration_password_reset.sql
-- Repeatability: Safely repeatable in MySQL 8.0+ via stored procedure checking information_schema.
-- Data Safety: Preserves existing data; does not drop or recreate tables or columns.
-- ==============================================================================

USE `fashioniq`;

DROP PROCEDURE IF EXISTS `fashioniq_migrate_outfit`;

DELIMITER //

CREATE PROCEDURE `fashioniq_migrate_outfit`()
BEGIN
  -- 1. Extend outfit table with season, total_price, description, and is_generated
  IF NOT EXISTS (
    SELECT 1 FROM `information_schema`.`columns`
    WHERE `table_schema` = DATABASE()
      AND `table_name` = 'outfit'
      AND `column_name` = 'season'
  ) THEN
    ALTER TABLE `outfit`
      ADD COLUMN `season` ENUM('Summer', 'Winter', 'Monsoon', 'All Season') NOT NULL DEFAULT 'All Season';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM `information_schema`.`columns`
    WHERE `table_schema` = DATABASE()
      AND `table_name` = 'outfit'
      AND `column_name` = 'total_price'
  ) THEN
    ALTER TABLE `outfit`
      ADD COLUMN `total_price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM `information_schema`.`columns`
    WHERE `table_schema` = DATABASE()
      AND `table_name` = 'outfit'
      AND `column_name` = 'description'
  ) THEN
    ALTER TABLE `outfit`
      ADD COLUMN `description` TEXT DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM `information_schema`.`columns`
    WHERE `table_schema` = DATABASE()
      AND `table_name` = 'outfit'
      AND `column_name` = 'is_generated'
  ) THEN
    ALTER TABLE `outfit`
      ADD COLUMN `is_generated` TINYINT(1) NOT NULL DEFAULT 1;
  END IF;

  -- 2. Extend outfit_item table with is_owned and price snapshot
  IF NOT EXISTS (
    SELECT 1 FROM `information_schema`.`columns`
    WHERE `table_schema` = DATABASE()
      AND `table_name` = 'outfit_item'
      AND `column_name` = 'is_owned'
  ) THEN
    ALTER TABLE `outfit_item`
      ADD COLUMN `is_owned` TINYINT(1) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM `information_schema`.`columns`
    WHERE `table_schema` = DATABASE()
      AND `table_name` = 'outfit_item'
      AND `column_name` = 'price'
  ) THEN
    ALTER TABLE `outfit_item`
      ADD COLUMN `price` DECIMAL(10, 2) NOT NULL DEFAULT 0.00;
  END IF;

  -- 3. Prevent duplicate variants in the same outfit
  IF NOT EXISTS (
    SELECT 1 FROM `information_schema`.`table_constraints`
    WHERE `table_schema` = DATABASE()
      AND `table_name` = 'outfit_item'
      AND `constraint_name` = 'uq_outfit_variant'
  ) THEN
    ALTER TABLE `outfit_item`
      ADD CONSTRAINT `uq_outfit_variant` UNIQUE (`outfit_id`, `variant_id`);
  END IF;

  -- 4. Add index idx_outfit_user_occasion if it does not already exist
  IF NOT EXISTS (
    SELECT 1 FROM `information_schema`.`statistics`
    WHERE `table_schema` = DATABASE()
      AND `table_name` = 'outfit'
      AND `index_name` = 'idx_outfit_user_occasion'
  ) THEN
    ALTER TABLE `outfit`
      ADD KEY `idx_outfit_user_occasion` (`user_id`, `occasion`);
  END IF;

  -- 5. Add index idx_outfit_user_season if it does not already exist
  IF NOT EXISTS (
    SELECT 1 FROM `information_schema`.`statistics`
    WHERE `table_schema` = DATABASE()
      AND `table_name` = 'outfit'
      AND `index_name` = 'idx_outfit_user_season'
  ) THEN
    ALTER TABLE `outfit`
      ADD KEY `idx_outfit_user_season` (`user_id`, `season`);
  END IF;
END //

DELIMITER ;

CALL `fashioniq_migrate_outfit`();
DROP PROCEDURE IF EXISTS `fashioniq_migrate_outfit`;
