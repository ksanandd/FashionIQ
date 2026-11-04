const express = require("express");
const router = express.Router();

const {
    createOrder,
    getUserOrders,
    getOrderById
} = require("../controllers/orderController");

const authMiddleware = require("../middleware/authMiddleware");

// All order endpoints require authentication
router.post("/", authMiddleware, createOrder);
router.get("/", authMiddleware, getUserOrders);
router.get("/:id", authMiddleware, getOrderById);

module.exports = router;
