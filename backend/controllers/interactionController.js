
const db = require("../config/db");

// Record a product interaction
const recordInteraction = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { product_id, variant_id, interaction_type } = req.body;

        if (!product_id || !interaction_type) {
            return res.status(400).json({
                success: false,
                message: "Product ID and interaction type are required"
            });
        }

        const allowedTypes = ["VIEW", "LIKE", "DISLIKE", "ADD_TO_CART"];

        if (!allowedTypes.includes(interaction_type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid interaction type"
            });
        }

        const [result] = await db.execute(
            `INSERT INTO USER_INTERACTION
                (user_id, product_id, variant_id, interaction_type)
             VALUES (?, ?, ?, ?)`,
            [userId, product_id, variant_id || null, interaction_type]
        );

        return res.status(201).json({
            success: true,
            message: "Product interaction recorded successfully",
            interaction_id: result.insertId
        });

    } catch (error) {
        console.error("Record interaction error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// Retrieve logged-in user's interaction history
const getUserInteractions = async (req, res) => {
    try {
        const userId = req.user.user_id;

        const [rows] = await db.execute(
            `SELECT
                interaction_id,
                user_id,
                product_id,
                variant_id,
                interaction_type,
                interaction_date
             FROM USER_INTERACTION
             WHERE user_id = ?
             ORDER BY interaction_id DESC`,
            [userId]
        );

        return res.status(200).json({
            success: true,
            interactions: rows
        });

    } catch (error) {
        console.error("Get interactions error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

module.exports = {
    recordInteraction,
    getUserInteractions
};
