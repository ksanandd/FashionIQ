/*
FASHIONIQ - CONSOLIDATED SQL DOCUMENTATION
Database: FashionIQ

This is a reference script reconstructed from SQL statements, screenshots,
and successful outputs shared in the conversation. It is NOT a guaranteed
full database rebuild script. The original CREATE DATABASE, CREATE TABLE,
and sample-data INSERT statements were not available and are not fabricated.

The trigger, procedure, and view definitions are reconstructed templates.
Compare them with the live definitions before recreating or replacing them.
The composite index statement is optional; check existing indexes first.
Transaction examples modify PRODUCT.product_id = 1. Use a backup/test DB.
*/

-- 01. Select schema and list physical tables
USE FashionIQ;

SHOW FULL TABLES
WHERE Table_type = 'BASE TABLE';

-- Expected in the shared screenshot: 13 base tables:
-- brand, category, outfit, outfit_item, product, product_price_audit,
-- product_variant, recommendation, user, user_interaction, user_profile,
-- wardrobe, wardrobe_item.

-- 02. Inspect table structure
DESCRIBE USER_INTERACTION;
SHOW CREATE TABLE USER_INTERACTION;

-- 03. List foreign-key relationships and referential actions
SELECT
    rc.TABLE_NAME,
    kcu.COLUMN_NAME,
    rc.CONSTRAINT_NAME,
    kcu.REFERENCED_TABLE_NAME,
    kcu.REFERENCED_COLUMN_NAME,
    rc.UPDATE_RULE,
    rc.DELETE_RULE
FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS AS rc
JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE AS kcu
    ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
   AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
   AND rc.TABLE_NAME = kcu.TABLE_NAME
WHERE rc.CONSTRAINT_SCHEMA = 'FashionIQ'
ORDER BY rc.TABLE_NAME, kcu.ORDINAL_POSITION;

-- Shared output: 18 foreign-key relationships.
-- USER_INTERACTION: user_id -> user.user_id;
-- product_id -> product.product_id; variant_id -> product_variant.variant_id.
-- The variant relationship showed ON DELETE SET NULL.

-- 04. Inspect indexes
SHOW INDEX FROM PRODUCT;
SHOW INDEX FROM RECOMMENDATION;
SHOW INDEX FROM PRODUCT_VARIANT;
SHOW INDEX FROM USER_INTERACTION;

-- OPTIONAL composite index example. Check SHOW INDEX first to avoid duplicates.
-- CREATE INDEX idx_interaction_product_type
-- ON USER_INTERACTION (product_id, interaction_type);

-- 05. EXPLAIN: aggregate interactions by product and type
EXPLAIN
SELECT
    product_id,
    interaction_type,
    COUNT(*) AS interaction_count
FROM USER_INTERACTION
GROUP BY product_id, interaction_type;

-- EXPLAIN: retrieve one user's recommendations, newest first
EXPLAIN
SELECT
    recommendation_id,
    user_id,
    product_id,
    variant_id,
    outfit_id
FROM RECOMMENDATION
WHERE user_id = 1
ORDER BY recommendation_id DESC;

-- Shared recommendation plan showed fk_rec_user selected.

-- 06. Transaction: COMMIT
-- CAUTION: this changes the stored price for product_id = 1.
START TRANSACTION;

UPDATE PRODUCT
SET price = price + 1
WHERE product_id = 1;

SELECT product_id, product_name, price
FROM PRODUCT
WHERE product_id = 1;

COMMIT;

SELECT product_id, product_name, price
FROM PRODUCT
WHERE product_id = 1;

-- Shared test: price changed from 1499.00 to 1500.00.

-- 07. Transaction: ROLLBACK
START TRANSACTION;

UPDATE PRODUCT
SET price = price + 1
WHERE product_id = 1;

SELECT product_id, product_name, price
FROM PRODUCT
WHERE product_id = 1;

ROLLBACK;

SELECT product_id, product_name, price
FROM PRODUCT
WHERE product_id = 1;

-- Shared test showed the uncommitted change was cancelled and price restored.

-- 08. Trigger verification and audit history
SHOW TRIGGERS
WHERE `Table` = 'PRODUCT';

SELECT
    audit_id,
    product_id,
    old_price,
    new_price,
    changed_at
FROM PRODUCT_PRICE_AUDIT
ORDER BY audit_id DESC
LIMIT 5;

-- Shared trigger name: after_product_price_update (AFTER UPDATE on product).
-- Reconstructed trigger template; compare with SHOW CREATE TRIGGER first.
--
-- DROP TRIGGER IF EXISTS after_product_price_update;
-- DELIMITER //
-- CREATE TRIGGER after_product_price_update
-- AFTER UPDATE ON PRODUCT
-- FOR EACH ROW
-- BEGIN
--     IF OLD.price <> NEW.price THEN
--         INSERT INTO PRODUCT_PRICE_AUDIT
--             (product_id, old_price, new_price)
--         VALUES
--             (OLD.product_id, OLD.price, NEW.price);
--     END IF;
-- END //
-- DELIMITER ;
--
-- Shared audit output showed:
-- 1499.00 -> 1500.00
-- 1500.00 -> 1499.00
-- 1499.00 -> 1500.00

-- 09. Stored procedure verification and execution
SHOW PROCEDURE STATUS
WHERE Db = 'FashionIQ';

SHOW CREATE PROCEDURE GetProductEngagement;

SELECT
    PARAMETER_NAME,
    PARAMETER_MODE,
    DATA_TYPE
FROM INFORMATION_SCHEMA.PARAMETERS
WHERE SPECIFIC_SCHEMA = 'fashioniq'
  AND SPECIFIC_NAME = 'GetProductEngagement'
ORDER BY ORDINAL_POSITION;

CALL GetProductEngagement(1);

-- Verified IN parameter: p_product_id INT.
-- Reconstructed procedure template; compare with live definition first.
--
-- DROP PROCEDURE IF EXISTS GetProductEngagement;
-- DELIMITER //
-- CREATE PROCEDURE GetProductEngagement(IN p_product_id INT)
-- BEGIN
--     SELECT *
--     FROM product_engagement_view
--     WHERE product_id = p_product_id;
-- END //
-- DELIMITER ;
--
-- Shared CALL output: product 1, Nike Dri-FIT T-Shirt, Tops,
-- 4 interactions and 1 unique user.

-- 10. View verification and data
SHOW FULL TABLES
WHERE Table_type = 'VIEW';

SELECT *
FROM product_engagement_view;

-- Reconstructed view template; compare with live view definition first.
--
-- CREATE OR REPLACE VIEW product_engagement_view AS
-- SELECT
--     p.product_id,
--     p.product_name,
--     c.category_name,
--     COUNT(ui.interaction_id) AS total_interactions,
--     COUNT(DISTINCT ui.user_id) AS unique_users
-- FROM PRODUCT AS p
-- JOIN CATEGORY AS c
--     ON p.category_id = c.category_id
-- LEFT JOIN USER_INTERACTION AS ui
--     ON p.product_id = ui.product_id
-- GROUP BY
--     p.product_id,
--     p.product_name,
--     c.category_name;
--
-- Shared view output:
-- Nike Dri-FIT T-Shirt | Tops | 4 | 1
-- Adidas Track Pants | Bottoms | 4 | 1
-- Zara Casual Shirt | Tops | 4 | 1
-- H&M Lightweight Jacket | Outerwear | 4 | 1

-- 11. General database-object verification
SHOW FULL TABLES WHERE Table_type = 'BASE TABLE';
SHOW FULL TABLES WHERE Table_type = 'VIEW';
SHOW PROCEDURE STATUS WHERE Db = 'FashionIQ';
SHOW FUNCTION STATUS WHERE Db = 'FashionIQ';
SHOW TRIGGERS WHERE `Table` = 'PRODUCT';

-- END OF DOCUMENTATION
