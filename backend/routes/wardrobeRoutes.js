
const express = require("express");
const router = express.Router();

const {
    createWardrobe,
    getUserWardrobes,
    addWardrobeItem,
    getWardrobeItems,
    removeWardrobeItem
} = require("../controllers/wardrobeController");

const authMiddleware = require("../middleware/authMiddleware");

// Create a wardrobe
router.post("/", authMiddleware, createWardrobe);

// Get all user's wardrobes
router.get("/", authMiddleware, getUserWardrobes);

// Add an item to a wardrobe
router.post("/items", authMiddleware, addWardrobeItem);

// Get items in a specific wardrobe
router.get("/:wardrobe_id/items", authMiddleware, getWardrobeItems);

// Remove an item from a wardrobe
router.delete("/items/:wardrobe_item_id", authMiddleware, removeWardrobeItem);

module.exports = router;
