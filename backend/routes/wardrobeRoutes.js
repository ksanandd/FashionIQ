const express = require("express");
const router = express.Router();

const {
    createWardrobe,
    getUserWardrobes,
    addWardrobeItem,
    getWardrobeItems,
    removeWardrobeItem,
    addOrderItemsToWardrobe
} = require("../controllers/wardrobeController");

const authMiddleware = require("../middleware/authMiddleware");

// All wardrobe routes require user authentication
router.post("/", authMiddleware, createWardrobe);
router.get("/", authMiddleware, getUserWardrobes);
router.post("/items", authMiddleware, addWardrobeItem);
router.get("/:wardrobe_id/items", authMiddleware, getWardrobeItems);
router.delete("/items/:wardrobe_item_id", authMiddleware, removeWardrobeItem);
router.post("/items/from-order/:order_id", authMiddleware, addOrderItemsToWardrobe);

module.exports = router;
