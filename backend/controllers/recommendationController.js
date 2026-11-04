const recommendationService = require("../services/recommendationService");

const getAiServiceUrl = () => process.env.AI_SERVICE_URL || "http://localhost:8000";

const getAiServiceKey = () => {
    const key = process.env.AI_SERVICE_KEY || process.env.AI_SERVICE_SECRET_KEY;
    if (!key) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("CRITICAL SECURITY CONFIGURATION ERROR: AI_SERVICE_KEY or AI_SERVICE_SECRET_KEY must be configured in production.");
        }
        return null;
    }
    return key;
};

const AI_TIMEOUT_MS = 3500;

/**
 * Helper to call FastAPI microservice with timeout and error handling.
 */
async function callAiService(endpoint, options = {}) {
    const serviceKey = getAiServiceKey();
    if (!serviceKey) {
        console.warn(`[AI Service Gateway] Denied ${endpoint}: Internal service key is not configured.`);
        return null;
    }

    const url = `${getAiServiceUrl()}${endpoint}`;
    try {
        const response = await fetch(url, {
            ...options,
            signal: AbortSignal.timeout(AI_TIMEOUT_MS),
            headers: {
                Accept: "application/json",
                "X-Internal-Service-Key": serviceKey,
                ...(options.headers || {}),
            },
        });

        if (!response.ok) {
            console.warn(`[AI Service] HTTP ${response.status} from ${endpoint}`);
            return null;
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.warn(`[AI Service Offline / Unavailable] ${endpoint}: ${error.message}`);
        return null;
    }
}

/**
 * GET /api/recommendations/similar/:productId
 * Fetches semantically and visually similar products via ChromaDB vector embeddings.
 * Falls back to SQL category/brand matching if AI service is offline.
 */
const getSimilarProducts = async (req, res) => {
    try {
        const productId = Number(req.params.productId);
        const limit = Number(req.query.limit) || 8;
        const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
        const gender = req.query.gender || undefined;

        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID",
            });
        }

        let queryParams = new URLSearchParams({ limit: String(limit) });
        if (categoryId) queryParams.append("category_id", String(categoryId));
        if (gender) queryParams.append("gender", gender);

        // Try AI microservice
        const aiData = await callAiService(`/recommendations/similar/${productId}?${queryParams.toString()}`);

        if (aiData && aiData.success && Array.isArray(aiData.recommendations) && aiData.recommendations.length > 0) {
            return res.status(200).json({
                success: true,
                source: "ai",
                count: aiData.recommendations.length,
                recommendations: aiData.recommendations,
            });
        }

        // Fallback to database logic
        const fallbackItems = await recommendationService.getSimilarProductsFallback(
            productId,
            limit,
            categoryId,
            gender
        );

        return res.status(200).json({
            success: true,
            source: "fallback",
            count: fallbackItems.length,
            recommendations: fallbackItems,
        });
    } catch (error) {
        console.error("getSimilarProducts error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch similar product recommendations",
        });
    }
};

/**
 * GET /api/recommendations/user or GET /api/recommendations/:userId
 * Personalized recommendations based on style, interactions, and budget.
 * Security: Normal users cannot access another user's recommendations by changing URL param.
 */
const getUserRecommendations = async (req, res) => {
    try {
        const requestedUserId = req.params.userId !== undefined ? Number(req.params.userId) : null;
        let userId = null;

        if (requestedUserId !== null) {
            // Legacy route: /api/recommendations/:userId
            if (!Number.isInteger(requestedUserId) || requestedUserId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid user ID provided",
                });
            }

            // Authentication required to access a specific user's personalized recommendations
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "Authentication required to access personalized recommendations for a user ID",
                });
            }

            // Normal users cannot access another user's recommendations by changing URL parameter
            if (req.user.role !== "ADMIN" && req.user.user_id !== requestedUserId) {
                return res.status(403).json({
                    success: false,
                    message: "Access forbidden: You cannot view recommendations for another user",
                });
            }

            userId = requestedUserId;
        } else {
            // General route: /api/recommendations/user
            userId = req.user ? req.user.user_id : null;
        }

        const limit = Number(req.query.limit) || 10;

        if (!userId) {
            // Unauthenticated/guest user fallback: return popular catalog items
            const popularItems = await recommendationService.getPopularProductsFallback(limit);
            return res.status(200).json({
                success: true,
                source: "popular_fallback",
                count: popularItems.length,
                recommendations: popularItems,
            });
        }

        // Try AI microservice
        const aiData = await callAiService(`/recommendations/user/${userId}?limit=${limit}`);

        if (aiData && aiData.success && Array.isArray(aiData.recommendations) && aiData.recommendations.length > 0) {
            return res.status(200).json({
                success: true,
                source: "ai",
                count: aiData.recommendations.length,
                recommendations: aiData.recommendations,
            });
        }

        // Fallback to database logic (excluding DISLIKED items)
        const fallbackItems = await recommendationService.getRecommendations(userId, limit);

        return res.status(200).json({
            success: true,
            source: "fallback",
            count: fallbackItems.length,
            recommendations: fallbackItems,
        });
    } catch (error) {
        console.error("getUserRecommendations error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to generate user recommendations",
        });
    }
};

/**
 * GET /api/recommendations/wardrobe
 * Recommends items that complement the user's Digital Wardrobe collection.
 * Security: Derives user ID strictly from the verified JWT token.
 */
const getWardrobeRecommendations = async (req, res) => {
    try {
        if (!req.user || !req.user.user_id) {
            return res.status(401).json({
                success: false,
                message: "Authentication required for wardrobe recommendations",
            });
        }

        const userId = req.user.user_id;
        const limit = Number(req.query.limit) || 8;

        // Try AI microservice
        const aiData = await callAiService(`/recommendations/wardrobe/${userId}?limit=${limit}`);

        if (aiData && aiData.success && Array.isArray(aiData.recommendations) && aiData.recommendations.length > 0) {
            return res.status(200).json({
                success: true,
                source: "ai",
                count: aiData.recommendations.length,
                recommendations: aiData.recommendations,
            });
        }

        // Fallback to database wardrobe complement logic
        const fallbackItems = await recommendationService.getWardrobeRecommendationsFallback(userId, limit);

        return res.status(200).json({
            success: true,
            source: "fallback",
            count: fallbackItems.length,
            recommendations: fallbackItems,
        });
    } catch (error) {
        console.error("getWardrobeRecommendations error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch wardrobe recommendations",
        });
    }
};

/**
 * POST /api/recommendations/index
 * Admin-only trigger to sync/re-index MySQL products into ChromaDB.
 */
const triggerProductIndexing = async (req, res) => {
    try {
        const response = await fetch(`${getAiServiceUrl()}/index/products`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Internal-Service-Key": getAiServiceKey(),
            },
            signal: AbortSignal.timeout(60000), // Indexing might take 10-20 seconds on larger catalogs
        });

        if (!response.ok) {
            const errBody = await response.text();
            return res.status(response.status).json({
                success: false,
                message: `AI microservice indexing failed: ${errBody}`,
            });
        }

        const data = await response.json();
        return res.status(200).json(data);
    } catch (error) {
        console.error("triggerProductIndexing error:", error.message);
        return res.status(502).json({
            success: false,
            message: `Could not connect to AI microservice: ${error.message}`,
        });
    }
};

module.exports = {
    getRecommendations: getUserRecommendations, // backwards-compatible alias
    getUserRecommendations,
    getSimilarProducts,
    getWardrobeRecommendations,
    triggerProductIndexing,
};
