const db = require("../config/db");

/**
 * Fallback SQL-based recommendation when AI microservice is offline or cold-starting.
 * Excludes products the user explicitly disliked.
 * Strictly respects user's budget_range_max if configured.
 */
const getRecommendations = async (userId, limit = 10) => {
    try {
        const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 50));

        // Fetch user profile budget if available
        const [profile] = await db.query(
            `SELECT budget_range_max FROM USER_PROFILE WHERE user_id = ?`,
            [userId]
        );
        const budgetMax = profile.length > 0 && profile[0].budget_range_max ? Number(profile[0].budget_range_max) : null;

        let query = `
            SELECT
                p.product_id,
                p.product_name,
                p.description,
                p.price,
                p.gender,
                p.image_url,
                c.category_id,
                c.category_name,
                b.brand_id,
                b.brand_name
            FROM PRODUCT p
            JOIN CATEGORY c ON p.category_id = c.category_id
            JOIN BRAND b ON p.brand_id = b.brand_id
            WHERE p.product_id NOT IN (
                SELECT product_id
                FROM USER_INTERACTION
                WHERE user_id = ?
                AND interaction_type = 'DISLIKE'
            )
        `;
        const params = [userId];

        if (budgetMax && budgetMax > 0) {
            query += ` AND p.price <= ?`;
            params.push(budgetMax);
        }

        query += ` ORDER BY p.product_id DESC LIMIT ?`;
        params.push(safeLimit);

        const [rows] = await db.query(query, params);
        return rows;
    } catch (error) {
        console.error("SQL recommendation fallback error:", error.message);
        return [];
    }
};

/**
 * Fallback for similar products based on shared category.
 * Strictly requires same category (Tops -> Tops, etc.).
 */
const getSimilarProductsFallback = async (productId, limit = 8, categoryId = null, gender = null) => {
    try {
        const safeLimit = Math.max(1, Math.min(Number(limit) || 8, 50));

        // If category is not provided, fetch the category of the target product
        let catId = categoryId;
        let gen = gender;
        if (!catId || !gen) {
            const [target] = await db.query(
                `SELECT category_id, gender FROM PRODUCT WHERE product_id = ?`,
                [productId]
            );
            if (target.length > 0) {
                catId = catId || target[0].category_id;
                gen = gen || target[0].gender;
            }
        }

        if (!catId) return [];

        const query = `
            SELECT
                p.product_id,
                p.product_name,
                p.description,
                p.price,
                p.gender,
                p.image_url,
                c.category_id,
                c.category_name,
                b.brand_id,
                b.brand_name,
                CASE
                    WHEN p.gender = ? THEN 0.85
                    ELSE 0.75
                END AS similarity_score
            FROM PRODUCT p
            JOIN CATEGORY c ON p.category_id = c.category_id
            JOIN BRAND b ON p.brand_id = b.brand_id
            WHERE p.product_id != ?
            AND p.category_id = ?
            ORDER BY similarity_score DESC, p.product_id DESC
            LIMIT ?
        `;

        const [rows] = await db.query(query, [gen || "", productId, catId, safeLimit]);
        return rows;
    } catch (error) {
        console.error("Similar products SQL fallback error:", error.message);
        return [];
    }
};

/**
 * Fallback for wardrobe complementary recommendations.
 * Recommends cross-category complements (e.g. Tops -> Bottoms/Outerwear).
 * Excludes already-owned products.
 */
const getWardrobeRecommendationsFallback = async (userId, limit = 8) => {
    try {
        const safeLimit = Math.max(1, Math.min(Number(limit) || 8, 50));

        // Find products excluding items already in wardrobe and disliked
        const [recommendations] = await db.query(
            `SELECT
                p.product_id,
                p.product_name,
                p.description,
                p.price,
                p.gender,
                p.image_url,
                c.category_id,
                c.category_name,
                b.brand_id,
                b.brand_name
            FROM PRODUCT p
            JOIN CATEGORY c ON p.category_id = c.category_id
            JOIN BRAND b ON p.brand_id = b.brand_id
            WHERE p.product_id NOT IN (
                SELECT pv.product_id
                FROM WARDROBE w
                JOIN WARDROBE_ITEM wi ON w.wardrobe_id = wi.wardrobe_id
                JOIN PRODUCT_VARIANT pv ON wi.variant_id = pv.variant_id
                WHERE w.user_id = ?
            )
            AND p.product_id NOT IN (
                SELECT product_id
                FROM USER_INTERACTION
                WHERE user_id = ?
                AND interaction_type = 'DISLIKE'
            )
            ORDER BY p.product_id DESC
            LIMIT ?`,
            [userId, userId, safeLimit]
        );

        return recommendations;
    } catch (error) {
        console.error("Wardrobe recommendations SQL fallback error:", error.message);
        return [];
    }
};

/**
 * Popular products fallback for guests or empty states.
 */
const getPopularProductsFallback = async (limit = 8) => {
    try {
        const safeLimit = Math.max(1, Math.min(Number(limit) || 8, 50));
        const [rows] = await db.query(
            `SELECT
                p.product_id,
                p.product_name,
                p.description,
                p.price,
                p.gender,
                p.image_url,
                c.category_id,
                c.category_name,
                b.brand_id,
                b.brand_name
            FROM PRODUCT p
            JOIN CATEGORY c ON p.category_id = c.category_id
            JOIN BRAND b ON p.brand_id = b.brand_id
            ORDER BY p.product_id DESC
            LIMIT ?`,
            [safeLimit]
        );
        return rows;
    } catch (error) {
        console.error("Popular products fallback error:", error.message);
        return [];
    }
};

module.exports = {
    getRecommendations,
    getSimilarProductsFallback,
    getWardrobeRecommendationsFallback,
    getPopularProductsFallback,
};
