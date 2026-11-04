const express = require("express");
const router = express.Router();

const {
    getUserRecommendations,
    getSimilarProducts,
    getWardrobeRecommendations,
    triggerProductIndexing,
} = require("../controllers/recommendationController");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// 1. Similar products (public)
router.get("/similar/:productId", getSimilarProducts);

// 2. User personalized recommendations (optional auth: uses token if logged in, falls back to catalog if guest)
router.get("/user", authMiddleware.optional, getUserRecommendations);

// 3. Wardrobe complementary recommendations (requires authenticated user)
router.get("/wardrobe", authMiddleware, getWardrobeRecommendations);

// 4. Trigger product indexing into ChromaDB (Admin only)
router.post("/index", authMiddleware, roleMiddleware("ADMIN"), triggerProductIndexing);

// 5. Backwards-compatible route: GET /api/recommendations/:userId
router.get("/:userId", authMiddleware.optional, getUserRecommendations);

module.exports = router;
