
const express = require("express");
const router = express.Router();

const {
    recordInteraction,
    getUserInteractions
} = require("../controllers/interactionController");

const authMiddleware = require("../middleware/authMiddleware");

// Record a product interaction
router.post("/", authMiddleware, recordInteraction);

// Get logged-in user's interaction history
router.get("/", authMiddleware, getUserInteractions);

module.exports = router;
