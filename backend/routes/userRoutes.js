const express = require("express");
const router = express.Router();

const {
    getUserProfile,
    updateFashionProfile,
    updateUserAddress
} = require("../controllers/userController");

const authMiddleware = require("../middleware/authMiddleware");

// Get logged-in user's profile
router.get("/profile", authMiddleware, getUserProfile);

// Create or update fashion profile
router.put("/profile", authMiddleware, updateFashionProfile);

// Update user's address
router.put("/address", authMiddleware, updateUserAddress);

module.exports = router;