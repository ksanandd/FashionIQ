CREATE DATABASE  IF NOT EXISTS `fashioniq` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `fashioniq`;
-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: fashioniq
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `brand`
--

DROP TABLE IF EXISTS `brand`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `brand` (
  `brand_id` int NOT NULL AUTO_INCREMENT,
  `brand_name` varchar(100) NOT NULL,
  `website` varchar(255) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`brand_id`),
  UNIQUE KEY `brand_name` (`brand_name`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `brand`
--

LOCK TABLES `brand` WRITE;
/*!40000 ALTER TABLE `brand` DISABLE KEYS */;
INSERT INTO `brand` VALUES (1,'Nike','https://www.nike.com','USA'),(2,'Adidas','https://www.adidas.com','Germany'),(3,'Zara','https://www.zara.com','Spain'),(4,'H&M','https://www.hm.com','Sweden');
/*!40000 ALTER TABLE `brand` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `category`
--

DROP TABLE IF EXISTS `category`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `category` (
  `category_id` int NOT NULL AUTO_INCREMENT,
  `category_name` varchar(100) NOT NULL,
  `parent_category_id` int DEFAULT NULL,
  `description` text,
  PRIMARY KEY (`category_id`),
  KEY `parent_category_id` (`parent_category_id`),
  CONSTRAINT `category_ibfk_1` FOREIGN KEY (`parent_category_id`) REFERENCES `category` (`category_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `category`
--

LOCK TABLES `category` WRITE;
/*!40000 ALTER TABLE `category` DISABLE KEYS */;
INSERT INTO `category` VALUES (1,'Clothing',NULL,'Fashion clothing'),(2,'Footwear',NULL,'Shoes and footwear'),(3,'Accessories',NULL,'Fashion accessories'),(4,'Tops',1,'T-shirts, shirts and tops'),(5,'Bottoms',1,'Jeans, trousers and skirts'),(6,'Outerwear',1,'Jackets and coats'),(7,'Clothing',NULL,'Fashion clothing'),(8,'Footwear',NULL,'Shoes and footwear'),(9,'Accessories',NULL,'Fashion accessories'),(10,'Tops',1,'T-shirts, shirts and tops'),(11,'Bottoms',1,'Jeans, trousers and skirts'),(12,'Outerwear',1,'Jackets and coats'),(13,'Clothing',NULL,'Fashion clothing'),(14,'Footwear',NULL,'Shoes and footwear'),(15,'Accessories',NULL,'Fashion accessories'),(16,'Tops',1,'T-shirts, shirts and tops'),(17,'Bottoms',1,'Jeans, trousers and skirts'),(18,'Outerwear',1,'Jackets and coats'),(19,'Clothing',NULL,'Fashion clothing'),(20,'Footwear',NULL,'Shoes and footwear'),(21,'Accessories',NULL,'Fashion accessories'),(22,'Tops',1,'T-shirts, shirts and tops'),(23,'Bottoms',1,'Jeans, trousers and skirts'),(24,'Outerwear',1,'Jackets and coats'),(25,'Clothing',NULL,'Fashion clothing'),(26,'Footwear',NULL,'Shoes and footwear'),(27,'Accessories',NULL,'Fashion accessories'),(28,'Tops',1,'T-shirts, shirts and tops'),(29,'Bottoms',1,'Jeans, trousers and skirts'),(30,'Outerwear',1,'Jackets and coats'),(31,'Clothing',NULL,'Fashion clothing'),(32,'Footwear',NULL,'Shoes and footwear'),(33,'Accessories',NULL,'Fashion accessories'),(34,'Tops',1,'T-shirts, shirts and tops'),(35,'Bottoms',1,'Jeans, trousers and skirts'),(36,'Outerwear',1,'Jackets and coats');
/*!40000 ALTER TABLE `category` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `outfit`
--

DROP TABLE IF EXISTS `outfit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `outfit` (
  `outfit_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `outfit_name` varchar(100) NOT NULL,
  `occasion` varchar(100) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`outfit_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `outfit_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `outfit`
--

LOCK TABLES `outfit` WRITE;
/*!40000 ALTER TABLE `outfit` DISABLE KEYS */;
INSERT INTO `outfit` VALUES (1,1,'Casual Everyday Look','Casual','2026-10-16 00:48:44'),(2,1,'College Outfit','College','2026-10-16 00:48:44'),(3,2,'Party Outfit','Party','2026-10-16 00:48:44'),(4,2,'Formal Office Look','Formal','2026-10-16 00:48:44');
/*!40000 ALTER TABLE `outfit` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `outfit_item`
--

DROP TABLE IF EXISTS `outfit_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `outfit_item` (
  `outfit_item_id` int NOT NULL AUTO_INCREMENT,
  `outfit_id` int NOT NULL,
  `variant_id` int NOT NULL,
  `role` enum('Top','Bottom','Shoes','Outerwear','Accessory','Other') NOT NULL,
  `sequence` int DEFAULT NULL,
  PRIMARY KEY (`outfit_item_id`),
  KEY `outfit_id` (`outfit_id`),
  KEY `variant_id` (`variant_id`),
  CONSTRAINT `outfit_item_ibfk_1` FOREIGN KEY (`outfit_id`) REFERENCES `outfit` (`outfit_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `outfit_item_ibfk_2` FOREIGN KEY (`variant_id`) REFERENCES `product_variant` (`variant_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `outfit_item_chk_1` CHECK (((`sequence` is null) or (`sequence` > 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `outfit_item`
--

LOCK TABLES `outfit_item` WRITE;
/*!40000 ALTER TABLE `outfit_item` DISABLE KEYS */;
/*!40000 ALTER TABLE `outfit_item` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product`
--

DROP TABLE IF EXISTS `product`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product` (
  `product_id` int NOT NULL AUTO_INCREMENT,
  `category_id` int NOT NULL,
  `brand_id` int NOT NULL,
  `product_name` varchar(150) NOT NULL,
  `description` text,
  `price` decimal(10,2) NOT NULL,
  `gender` enum('Men','Women','Unisex') NOT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`product_id`),
  KEY `category_id` (`category_id`),
  KEY `brand_id` (`brand_id`),
  CONSTRAINT `product_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `category` (`category_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `product_ibfk_2` FOREIGN KEY (`brand_id`) REFERENCES `brand` (`brand_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `product_chk_1` CHECK ((`price` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product`
--

LOCK TABLES `product` WRITE;
/*!40000 ALTER TABLE `product` DISABLE KEYS */;
INSERT INTO `product` VALUES (1,4,1,'Nike Dri-FIT T-Shirt','Breathable casual sports t-shirt',1500.00,'Unisex','https://placehold.co/400x500?text=Nike+Tshirt'),(2,5,2,'Adidas Track Pants','Comfortable everyday track pants',1999.00,'Unisex','https://placehold.co/400x500?text=Track+Pants'),(3,4,3,'Zara Casual Shirt','Smart casual shirt for everyday wear',2299.00,'Men','https://placehold.co/400x500?text=Zara+Shirt'),(4,6,4,'H&M Lightweight Jacket','Versatile lightweight casual jacket',2499.00,'Women','https://placehold.co/400x500?text=HM+Jacket');
/*!40000 ALTER TABLE `product` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `after_product_price_update` AFTER UPDATE ON `product` FOR EACH ROW BEGIN
    IF OLD.price <> NEW.price THEN
        INSERT INTO PRODUCT_PRICE_AUDIT
            (product_id, old_price, new_price)
        VALUES
            (OLD.product_id, OLD.price, NEW.price);
    END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Temporary view structure for view `product_engagement_view`
--

DROP TABLE IF EXISTS `product_engagement_view`;
/*!50001 DROP VIEW IF EXISTS `product_engagement_view`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `product_engagement_view` AS SELECT 
 1 AS `product_id`,
 1 AS `product_name`,
 1 AS `category_name`,
 1 AS `total_interactions`,
 1 AS `unique_users`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `product_price_audit`
--

DROP TABLE IF EXISTS `product_price_audit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_price_audit` (
  `audit_id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `old_price` decimal(10,2) NOT NULL,
  `new_price` decimal(10,2) NOT NULL,
  `changed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`audit_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_price_audit`
--

LOCK TABLES `product_price_audit` WRITE;
/*!40000 ALTER TABLE `product_price_audit` DISABLE KEYS */;
INSERT INTO `product_price_audit` VALUES (2,1,1499.00,1500.00,'2026-10-29 17:56:33'),(3,1,1500.00,1499.00,'2026-10-29 17:59:13'),(4,1,1499.00,1500.00,'2026-10-29 18:14:18');
/*!40000 ALTER TABLE `product_price_audit` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_variant`
--

DROP TABLE IF EXISTS `product_variant`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_variant` (
  `variant_id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `color` varchar(50) DEFAULT NULL,
  `size` varchar(20) DEFAULT NULL,
  `stock_quantity` int NOT NULL DEFAULT '0',
  `price` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`variant_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `product_variant_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `product` (`product_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `product_variant_chk_1` CHECK ((`stock_quantity` >= 0)),
  CONSTRAINT `product_variant_chk_2` CHECK (((`price` is null) or (`price` >= 0)))
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_variant`
--

LOCK TABLES `product_variant` WRITE;
/*!40000 ALTER TABLE `product_variant` DISABLE KEYS */;
INSERT INTO `product_variant` VALUES (1,1,'White','M',20,1499.00),(2,1,'Black','L',15,1499.00),(3,2,'Black','M',10,1999.00),(4,2,'Blue','L',12,1999.00),(5,3,'Blue','M',18,2299.00),(6,3,'White','L',10,2299.00),(7,4,'Grey','M',8,2499.00),(8,4,'Black','L',6,2499.00);
/*!40000 ALTER TABLE `product_variant` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `recommendation`
--

DROP TABLE IF EXISTS `recommendation`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recommendation` (
  `recommendation_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `product_id` int DEFAULT NULL,
  `variant_id` int DEFAULT NULL,
  `outfit_id` int DEFAULT NULL,
  `score` decimal(5,2) DEFAULT NULL,
  `recommendation_type` enum('PRODUCT','VARIANT','OUTFIT') NOT NULL,
  `recommended_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`recommendation_id`),
  KEY `fk_rec_user` (`user_id`),
  KEY `fk_rec_product` (`product_id`),
  KEY `fk_rec_variant` (`variant_id`),
  KEY `fk_rec_outfit` (`outfit_id`),
  CONSTRAINT `fk_rec_outfit` FOREIGN KEY (`outfit_id`) REFERENCES `outfit` (`outfit_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_rec_product` FOREIGN KEY (`product_id`) REFERENCES `product` (`product_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_rec_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_rec_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variant` (`variant_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `chk_rec_score` CHECK (((`score` is null) or ((`score` >= 0) and (`score` <= 100))))
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `recommendation`
--

LOCK TABLES `recommendation` WRITE;
/*!40000 ALTER TABLE `recommendation` DISABLE KEYS */;
INSERT INTO `recommendation` VALUES (1,1,1,1,1,0.95,'PRODUCT','2026-10-16 00:49:16'),(2,1,2,3,1,0.88,'VARIANT','2026-10-16 00:49:16'),(3,1,3,5,2,0.92,'OUTFIT','2026-10-16 00:49:16'),(4,2,4,7,4,0.85,'PRODUCT','2026-10-16 00:49:16');
/*!40000 ALTER TABLE `recommendation` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user`
--

DROP TABLE IF EXISTS `user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('USER','ADMIN') NOT NULL DEFAULT 'USER',
  `street` varchar(100) DEFAULT NULL,
  `city` varchar(50) DEFAULT NULL,
  `state` varchar(50) DEFAULT NULL,
  `pincode` varchar(10) DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user`
--

LOCK TABLES `user` WRITE;
/*!40000 ALTER TABLE `user` DISABLE KEYS */;
INSERT INTO `user` VALUES (1,'Anand','Sharma','anand.demo@example.com','demo_hash_1','USER','MG Road','Bengaluru','Karnataka','560001'),(2,'Priya','Rao','priya.demo@example.com','demo_hash_2','USER','Brigade Road','Bengaluru','Karnataka','560002'),(3,'Admin','FashionIQ','admin.demo@example.com','demo_hash_3','ADMIN','Church Street','Bengaluru','Karnataka','560003'),(8,'Anand','S','anand.test@example.com','$2b$12$BSrfGfYM5jYloB4byl/k/eEtcDN/KR5M.bE8eQpRRmIuxqRIo736i','USER','456 Fashion Avenue','Bengaluru','Karnataka','560001');
/*!40000 ALTER TABLE `user` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_interaction`
--

DROP TABLE IF EXISTS `user_interaction`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_interaction` (
  `interaction_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `product_id` int NOT NULL,
  `variant_id` int DEFAULT NULL,
  `interaction_type` enum('VIEW','LIKE','DISLIKE','ADD_TO_CART','PURCHASE') NOT NULL,
  `interaction_date` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`interaction_id`),
  KEY `user_id` (`user_id`),
  KEY `variant_id` (`variant_id`),
  KEY `idx_interaction_product_type` (`product_id`,`interaction_type`),
  CONSTRAINT `user_interaction_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_interaction_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `product` (`product_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_interaction_ibfk_3` FOREIGN KEY (`variant_id`) REFERENCES `product_variant` (`variant_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_interaction`
--

LOCK TABLES `user_interaction` WRITE;
/*!40000 ALTER TABLE `user_interaction` DISABLE KEYS */;
INSERT INTO `user_interaction` VALUES (1,1,1,1,'VIEW','2026-10-16 00:46:28'),(2,1,2,3,'LIKE','2026-10-16 00:46:28'),(3,2,3,5,'ADD_TO_CART','2026-10-16 00:46:28'),(4,2,4,7,'VIEW','2026-10-16 00:46:28'),(5,1,1,1,'VIEW','2026-10-16 00:47:02'),(6,1,2,3,'LIKE','2026-10-16 00:47:02'),(7,2,3,5,'ADD_TO_CART','2026-10-16 00:47:02'),(8,2,4,7,'VIEW','2026-10-16 00:47:02'),(9,1,1,1,'VIEW','2026-10-16 00:47:43'),(10,1,2,3,'LIKE','2026-10-16 00:47:43'),(11,2,3,5,'ADD_TO_CART','2026-10-16 00:47:43'),(12,2,4,7,'VIEW','2026-10-16 00:47:43'),(13,1,1,1,'VIEW','2026-10-16 00:48:44'),(14,1,2,3,'LIKE','2026-10-16 00:48:44'),(15,2,3,5,'ADD_TO_CART','2026-10-16 00:48:44'),(16,2,4,7,'VIEW','2026-10-16 00:48:44'),(17,8,1,1,'VIEW','2026-11-01 12:09:02'),(18,8,1,1,'LIKE','2026-11-01 12:11:03');
/*!40000 ALTER TABLE `user_interaction` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_profile`
--

DROP TABLE IF EXISTS `user_profile`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_profile` (
  `profile_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `height` decimal(5,2) DEFAULT NULL,
  `weight` decimal(5,2) DEFAULT NULL,
  `body_type` varchar(30) DEFAULT NULL,
  `style_preferences` text,
  `budget_range_min` decimal(10,2) DEFAULT NULL,
  `budget_range_max` decimal(10,2) DEFAULT NULL,
  `preferred_brands` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`profile_id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `user_profile_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `user_profile_chk_1` CHECK (((`budget_range_min` is null) or (`budget_range_min` >= 0))),
  CONSTRAINT `user_profile_chk_2` CHECK (((`budget_range_max` is null) or (`budget_range_max` >= 0))),
  CONSTRAINT `user_profile_chk_3` CHECK (((`budget_range_min` is null) or (`budget_range_max` is null) or (`budget_range_min` <= `budget_range_max`)))
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_profile`
--

LOCK TABLES `user_profile` WRITE;
/*!40000 ALTER TABLE `user_profile` DISABLE KEYS */;
INSERT INTO `user_profile` VALUES (1,1,175.00,70.00,'Athletic','Casual, Streetwear',1000.00,5000.00,'Nike, Adidas','2026-10-16 00:15:16'),(2,2,162.00,55.00,'Regular','Minimalist, Ethnic',1500.00,6000.00,'Zara, H&M','2026-10-16 00:15:16'),(3,8,175.00,70.00,'Athletic','Casual, Streetwear',1000.00,5000.00,'Nike, Adidas','2026-10-31 23:39:07');
/*!40000 ALTER TABLE `user_profile` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `wardrobe`
--

DROP TABLE IF EXISTS `wardrobe`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wardrobe` (
  `wardrobe_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `wardrobe_name` varchar(100) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`wardrobe_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `wardrobe_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wardrobe`
--

LOCK TABLES `wardrobe` WRITE;
/*!40000 ALTER TABLE `wardrobe` DISABLE KEYS */;
INSERT INTO `wardrobe` VALUES (1,1,'Casual Wardrobe','2026-10-16 00:38:24'),(2,2,'College Wardrobe','2026-10-16 00:38:24'),(3,1,'Party Wear','2026-10-16 00:38:24'),(4,1,'Casual Wardrobe','2026-10-16 00:39:14'),(5,2,'College Wardrobe','2026-10-16 00:39:14'),(6,1,'Party Wear','2026-10-16 00:39:14'),(7,8,'My College Wardrobe','2026-11-01 10:51:47');
/*!40000 ALTER TABLE `wardrobe` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `wardrobe_item`
--

DROP TABLE IF EXISTS `wardrobe_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wardrobe_item` (
  `wardrobe_item_id` int NOT NULL AUTO_INCREMENT,
  `wardrobe_id` int NOT NULL,
  `variant_id` int NOT NULL,
  `quantity` int NOT NULL DEFAULT '1',
  `date_added` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`wardrobe_item_id`),
  KEY `wardrobe_id` (`wardrobe_id`),
  KEY `variant_id` (`variant_id`),
  CONSTRAINT `wardrobe_item_ibfk_1` FOREIGN KEY (`wardrobe_id`) REFERENCES `wardrobe` (`wardrobe_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `wardrobe_item_ibfk_2` FOREIGN KEY (`variant_id`) REFERENCES `product_variant` (`variant_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `wardrobe_item_chk_1` CHECK ((`quantity` > 0))
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wardrobe_item`
--

LOCK TABLES `wardrobe_item` WRITE;
/*!40000 ALTER TABLE `wardrobe_item` DISABLE KEYS */;
INSERT INTO `wardrobe_item` VALUES (1,1,1,1,'2026-10-16 00:43:52'),(2,1,3,1,'2026-10-16 00:43:52'),(3,2,5,1,'2026-10-16 00:43:52'),(4,2,7,1,'2026-10-16 00:43:52');
/*!40000 ALTER TABLE `wardrobe_item` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'fashioniq'
--

--
-- Dumping routines for database 'fashioniq'
--
/*!50003 DROP PROCEDURE IF EXISTS `GetProductEngagement` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `GetProductEngagement`(
    IN p_product_id INT
)
BEGIN
    SELECT *
    FROM product_engagement_view
    WHERE product_id = p_product_id;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Final view structure for view `product_engagement_view`
--

/*!50001 DROP VIEW IF EXISTS `product_engagement_view`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `product_engagement_view` AS select `p`.`product_id` AS `product_id`,`p`.`product_name` AS `product_name`,`c`.`category_name` AS `category_name`,count(`ui`.`interaction_id`) AS `total_interactions`,count(distinct `ui`.`user_id`) AS `unique_users` from ((`product` `p` join `category` `c` on((`p`.`category_id` = `c`.`category_id`))) left join `user_interaction` `ui` on((`p`.`product_id` = `ui`.`product_id`))) group by `p`.`product_id`,`p`.`product_name`,`c`.`category_name` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-01 18:09:21
