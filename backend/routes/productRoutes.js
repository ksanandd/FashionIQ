
const express = require("express");
const router = express.Router();

const {
    getAllProducts,
    getProductById,
    getProductVariants
} = require("../controllers/productController");

// Get all products
router.get("/", getAllProducts);

// Get variants of a specific product
router.get("/:id/variants", getProductVariants);

// Get product by ID
router.get("/:id", getProductById);

module.exports = router;
