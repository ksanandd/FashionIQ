-- ==============================================================================
-- FashionIQ Database Migration - Sequence: 2 of 4 (Phase 5: Digital Wardrobe Extensions)
-- Target: Apply to existing baseline schema (database/FashionIQ_Full_Database_pre_phase4_backup.sql)
-- Prerequisites: Baseline table `wardrobe_item` must exist.
-- Execution Order:
--   1. migration_orders.sql
--   2. migration_wardrobe.sql (THIS FILE)
--   3. migration_outfit.sql
--   4. migration_password_reset.sql
-- Repeatability: Safely repeatable in MySQL 8.0+ via stored procedure checking information_schema.
-- Data Safety: Preserves existing data; does not drop or recreate tables or columns.
-- ==============================================================================

USE `fashioniq`;

DROP PROCEDURE IF EXISTS `fashioniq_migrate_wardrobe`;

DELIMITER //

CREATE PROCEDURE `fashioniq_migrate_wardrobe`()
BEGIN
  -- 1. Add season column if it does not already exist
  IF NOT EXISTS (
    SELECT 1 FROM `information_schema`.`columns`
    WHERE `table_schema` = DATABASE()
      AND `table_name` = 'wardrobe_item'
      AND `column_name` = 'season'
  ) THEN
    ALTER TABLE `wardrobe_item`
      ADD COLUMN `season` ENUM('Summer', 'Winter', 'Monsoon', 'All Season') NOT NULL DEFAULT 'All Season';
  END IF;

  -- 2. Add source_type column if it does not already exist
  IF NOT EXISTS (
    SELECT 1 FROM `information_schema`.`columns`
    WHERE `table_schema` = DATABASE()
      AND `table_name` = 'wardrobe_item'
      AND `column_name` = 'source_type'
  ) THEN
    ALTER TABLE `wardrobe_item`
      ADD COLUMN `source_type` ENUM('PURCHASED', 'SAVED') NOT NULL DEFAULT 'SAVED';
  END IF;

  -- 3. Add unique constraint (wardrobe_id, variant_id) if it does not already exist
  IF NOT EXISTS (
    SELECT 1 FROM `information_schema`.`table_constraints`
    WHERE `table_schema` = DATABASE()
      AND `table_name` = 'wardrobe_item'
      AND `constraint_name` = 'uq_wardrobe_variant'
  ) THEN
    ALTER TABLE `wardrobe_item`
      ADD CONSTRAINT `uq_wardrobe_variant` UNIQUE (`wardrobe_id`, `variant_id`);
  END IF;

  -- 4. Add idx_wardrobe_item_season index if it does not already exist
  IF NOT EXISTS (
    SELECT 1 FROM `information_schema`.`statistics`
    WHERE `table_schema` = DATABASE()
      AND `table_name` = 'wardrobe_item'
      AND `index_name` = 'idx_wardrobe_item_season'
  ) THEN
    ALTER TABLE `wardrobe_item`
      ADD KEY `idx_wardrobe_item_season` (`wardrobe_id`, `season`);
  END IF;

  -- 5. Add idx_wardrobe_item_source index if it does not already exist
  IF NOT EXISTS (
    SELECT 1 FROM `information_schema`.`statistics`
    WHERE `table_schema` = DATABASE()
      AND `table_name` = 'wardrobe_item'
      AND `index_name` = 'idx_wardrobe_item_source'
  ) THEN
    ALTER TABLE `wardrobe_item`
      ADD KEY `idx_wardrobe_item_source` (`wardrobe_id`, `source_type`);
  END IF;
END //

DELIMITER ;

CALL `fashioniq_migrate_wardrobe`();
DROP PROCEDURE IF EXISTS `fashioniq_migrate_wardrobe`;
