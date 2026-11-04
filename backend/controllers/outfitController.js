const outfitService = require("../services/outfitService");

const getAiServiceUrl = () => process.env.AI_SERVICE_URL || "http://localhost:8000";

const getAiServiceKey = () => {
    const key = process.env.AI_SERVICE_SECRET_KEY || process.env.AI_SERVICE_KEY;
    if (!key) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("CRITICAL SECURITY CONFIGURATION ERROR: AI_SERVICE_SECRET_KEY or AI_SERVICE_KEY must be configured in production.");
        }
        return null;
    }
    return key;
};

/**
 * Helper to call FastAPI with timeout
 */
async function callFastApi(endpoint, options = {}) {
    const serviceKey = getAiServiceKey();
    if (!serviceKey) {
        throw new Error("Internal AI service credentials not configured; denying service call.");
    }

    const url = `${getAiServiceUrl()}${endpoint}`;
    const headers = {
        "Content-Type": "application/json",
        "X-Internal-Service-Key": serviceKey,
        ...(options.headers || {}),
    };

    const response = await fetch(url, {
        ...options,
        headers,
        signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
        throw new Error(`FastAPI returned status ${response.status}`);
    }

    return await response.json();
}

/**
 * GET /api/outfits/recommendations
 * Personalized outfits for authenticated user.
 */
const getPersonalizedOutfits = async (req, res) => {
    const userId = req.user?.user_id;
    if (!userId) {
        return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { occasion, season, budget_max, limit } = req.query;

    try {
        const queryParams = new URLSearchParams();
        if (occasion) queryParams.set("occasion", occasion);
        if (season) queryParams.set("season", season);
        if (budget_max) queryParams.set("budget_max", budget_max);
        if (limit) queryParams.set("limit", limit);

        const data = await callFastApi(`/outfits/recommendations/${userId}?${queryParams.toString()}`);
        return res.json({
            success: true,
            source: "ai",
            count: data.count,
            outfits: data.outfits,
        });
    } catch (err) {
        console.warn(`[AI Service Offline / Unavailable] Falling back to MySQL for personalized outfits: ${err.message}`);
        const fallbackOutfits = await outfitService.getPersonalizedOutfitsFallback(userId, {
            occasion,
            season,
            budgetMax: budget_max,
            limit,
        });
        return res.json({
            success: true,
            source: "fallback",
            count: fallbackOutfits.length,
            outfits: fallbackOutfits,
        });
    }
};

/**
 * GET /api/outfits/from-wardrobe
 * Outfits anchored by user's Digital Wardrobe.
 */
const getWardrobeOutfits = async (req, res) => {
    const userId = req.user?.user_id;
    if (!userId) {
        return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { occasion, season, budget_max, limit } = req.query;

    try {
        const queryParams = new URLSearchParams();
        if (occasion) queryParams.set("occasion", occasion);
        if (season) queryParams.set("season", season);
        if (budget_max) queryParams.set("budget_max", budget_max);
        if (limit) queryParams.set("limit", limit);

        const data = await callFastApi(`/outfits/from-wardrobe/${userId}?${queryParams.toString()}`);
        return res.json({
            success: true,
            source: "ai",
            count: data.count,
            outfits: data.outfits,
        });
    } catch (err) {
        console.warn(`[AI Service Offline / Unavailable] Falling back to MySQL for wardrobe outfits: ${err.message}`);
        const fallbackOutfits = await outfitService.getWardrobeOutfitsFallback(userId, {
            occasion,
            season,
            budgetMax: budget_max,
            limit,
        });
        return res.json({
            success: true,
            source: "fallback",
            count: fallbackOutfits.length,
            outfits: fallbackOutfits,
        });
    }
};

/**
 * GET /api/outfits/product/:productId
 * 'Complete the Look' for a specific product.
 */
const getProductOutfits = async (req, res) => {
    const { productId } = req.params;
    const pid = parseInt(productId, 10);
    if (!pid || pid <= 0) {
        return res.status(400).json({ success: false, message: "Invalid product ID" });
    }

    const { limit } = req.query;

    try {
        const queryParams = new URLSearchParams();
        if (limit) queryParams.set("limit", limit);

        const data = await callFastApi(`/outfits/product/${pid}?${queryParams.toString()}`);
        return res.json({
            success: true,
            source: "ai",
            query_product_id: pid,
            count: data.count,
            outfits: data.outfits,
        });
    } catch (err) {
        console.warn(`[AI Service Offline / Unavailable] Falling back to MySQL for product outfits: ${err.message}`);
        const fallbackOutfits = await outfitService.getProductOutfitsFallback(pid, { limit });
        return res.json({
            success: true,
            source: "fallback",
            query_product_id: pid,
            count: fallbackOutfits.length,
            outfits: fallbackOutfits,
        });
    }
};

/**
 * POST /api/outfits/generate
 * Dynamic custom outfit generator.
 */
const generateCustomOutfits = async (req, res) => {
    const userId = req.user?.user_id || 0;
    const { occasion, season, budget_max, limit } = req.body || {};

    try {
        const data = await callFastApi(`/outfits/generate`, {
            method: "POST",
            body: JSON.stringify({
                user_id: userId,
                occasion,
                season,
                budget_max,
                limit: limit || 5,
            }),
        });
        return res.json({
            success: true,
            source: "ai",
            count: data.count,
            outfits: data.outfits,
        });
    } catch (err) {
        console.warn(`[AI Service Offline / Unavailable] Falling back for custom outfits: ${err.message}`);
        const fallbackOutfits = await outfitService.getPersonalizedOutfitsFallback(userId, {
            occasion,
            season,
            budgetMax: budget_max,
            limit,
        });
        return res.json({
            success: true,
            source: "fallback",
            count: fallbackOutfits.length,
            outfits: fallbackOutfits,
        });
    }
};

/**
 * POST /api/outfits/save
 * Save an outfit to user's saved outfits.
 */
const saveOutfit = async (req, res) => {
    const userId = req.user?.user_id;
    if (!userId) {
        return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { outfit_name, occasion, season, total_price, description, items } = req.body || {};

    if (!outfit_name || !items || !Array.isArray(items) || items.length < 2) {
        return res.status(400).json({
            success: false,
            message: "An outfit must have a name and contain at least 2 clothing pieces.",
        });
    }

    const validRoles = new Set(["Top", "Bottom", "Shoes", "Outerwear", "Accessory", "Other"]);
    const seenVariants = new Set();
    for (const it of items) {
        if (!it.variant_id || !validRoles.has(it.role)) {
            return res.status(400).json({
                success: false,
                message: "Each outfit item must have a valid variant_id and role (Top, Bottom, Shoes, Outerwear, Accessory, Other).",
            });
        }
        if (seenVariants.has(it.variant_id)) {
            return res.status(400).json({
                success: false,
                message: "Duplicate variant IDs in the same outfit are not permitted.",
            });
        }
        seenVariants.add(it.variant_id);
    }

    try {
        const outfitId = await outfitService.saveUserOutfit(userId, {
            outfit_name,
            occasion: occasion || "Casual",
            season: season || "All Season",
            total_price: Number(total_price) || 0.0,
            description: description || "",
            items,
        });

        return res.status(201).json({
            success: true,
            message: "Outfit saved successfully.",
            outfit_id: outfitId,
        });
    } catch (err) {
        console.error("Save outfit error:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to save outfit to account.",
        });
    }
};

/**
 * GET /api/outfits/saved
 * Retrieve all saved outfits for authenticated user.
 */
const getSavedOutfits = async (req, res) => {
    const userId = req.user?.user_id;
    if (!userId) {
        return res.status(401).json({ success: false, message: "Authentication required" });
    }

    try {
        const outfits = await outfitService.getUserSavedOutfits(userId);
        return res.json({
            success: true,
            count: outfits.length,
            outfits,
        });
    } catch (err) {
        console.error("Get saved outfits error:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve saved outfits.",
        });
    }
};

/**
 * DELETE /api/outfits/saved/:outfitId
 * Delete a saved outfit belonging to authenticated user.
 */
const deleteSavedOutfit = async (req, res) => {
    const userId = req.user?.user_id;
    if (!userId) {
        return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { outfitId } = req.params;
    const oid = parseInt(outfitId, 10);
    if (!oid) {
        return res.status(400).json({ success: false, message: "Invalid outfit ID" });
    }

    try {
        const deleted = await outfitService.deleteUserOutfit(userId, oid);
        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: "Outfit not found or does not belong to the user.",
            });
        }

        return res.json({
            success: true,
            message: "Outfit deleted successfully.",
        });
    } catch (err) {
        console.error("Delete saved outfit error:", err.message);
        return res.status(500).json({
            success: false,
            message: "Failed to delete saved outfit.",
        });
    }
};

module.exports = {
    getPersonalizedOutfits,
    getWardrobeOutfits,
    getProductOutfits,
    generateCustomOutfits,
    saveOutfit,
    getSavedOutfits,
    deleteSavedOutfit,
};
