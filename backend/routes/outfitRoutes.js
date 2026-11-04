const express = require("express");
const router = express.Router();
const outfitController = require("../controllers/outfitController");
const authMiddleware = require("../middleware/authMiddleware");

// 1. Personalized Outfits for Authenticated User
router.get("/recommendations", authMiddleware, outfitController.getPersonalizedOutfits);

// 2. Outfits Anchored by Digital Wardrobe (Owned Items + Suggestions)
router.get("/from-wardrobe", authMiddleware, outfitController.getWardrobeOutfits);

// 3. 'Complete the Look' for a specific product
router.get("/product/:productId", authMiddleware.optional, outfitController.getProductOutfits);

// 4. Dynamic custom outfit generation
router.post("/generate", authMiddleware.optional, outfitController.generateCustomOutfits);

// 5. Save an outfit to user's collection
router.post("/save", authMiddleware, outfitController.saveOutfit);

// 6. Retrieve saved outfits
router.get("/saved", authMiddleware, outfitController.getSavedOutfits);

// 7. Delete saved outfit
router.delete("/saved/:outfitId", authMiddleware, outfitController.deleteSavedOutfit);

module.exports = router;
