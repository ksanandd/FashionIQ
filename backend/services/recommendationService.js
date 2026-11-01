const db = require("../config/db");

const getRecommendations = async (userId) => {
    const [rows] = await db.query(
           `SELECT
            p.product_id,
            p.product_name,
            p.description,
            p.price,
            p.gender,
            p.image_url,
            c.category_name,
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
        ORDER BY p.product_id
        LIMIT 10`,
        [userId]
    );

    return rows;
};

module.exports = {
    getRecommendations
};