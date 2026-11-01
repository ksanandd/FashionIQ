
const db = require("../config/db");

// Create a new wardrobe
const createWardrobe = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { wardrobe_name } = req.body;

        if (!wardrobe_name || !wardrobe_name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Wardrobe name is required"
            });
        }

        const [result] = await db.execute(
            `INSERT INTO WARDROBE (user_id, wardrobe_name)
             VALUES (?, ?)`,
            [userId, wardrobe_name.trim()]
        );

        return res.status(201).json({
            success: true,
            message: "Wardrobe created successfully",
            wardrobe_id: result.insertId
        });

    } catch (error) {
        console.error("Create wardrobe error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// Get all wardrobes belonging to the logged-in user
const getUserWardrobes = async (req, res) => {
    try {
        const userId = req.user.user_id;

        const [rows] = await db.execute(
            `SELECT wardrobe_id, wardrobe_name, created_at
             FROM WARDROBE
             WHERE user_id = ?
             ORDER BY created_at DESC`,
            [userId]
        );

        return res.status(200).json({
            success: true,
            wardrobes: rows
        });

    } catch (error) {
        console.error("Get wardrobes error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// Add a product variant to a wardrobe
const addWardrobeItem = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { wardrobe_id, variant_id, quantity } = req.body;

        if (!wardrobe_id || !variant_id) {
            return res.status(400).json({
                success: false,
                message: "Wardrobe ID and variant ID are required"
            });
        }

        if (
            quantity !== undefined &&
            (!Number.isInteger(quantity) || quantity < 1)
        ) {
            return res.status(400).json({
                success: false,
                message: "Quantity must be a positive integer"
            });
        }

        // Verify that the wardrobe belongs to the logged-in user
        const [wardrobes] = await db.execute(
            `SELECT wardrobe_id
             FROM WARDROBE
             WHERE wardrobe_id = ? AND user_id = ?`,
            [wardrobe_id, userId]
        );

        if (wardrobes.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Wardrobe not found"
            });
        }

        const [result] = await db.execute(
            `INSERT INTO WARDROBE_ITEM
             (wardrobe_id, variant_id, quantity)
             VALUES (?, ?, ?)`,
            [wardrobe_id, variant_id, quantity || 1]
        );

        return res.status(201).json({
            success: true,
            message: "Item added to wardrobe successfully",
            wardrobe_item_id: result.insertId
        });

    } catch (error) {
        console.error("Add wardrobe item error:", error);

        if (error.code === "ER_NO_REFERENCED_ROW_2") {
            return res.status(400).json({
                success: false,
                message: "Invalid wardrobe or product variant ID"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// Get all items in a specific wardrobe
const getWardrobeItems = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { wardrobe_id } = req.params;

        const [rows] = await db.execute(
            `SELECT wi.wardrobe_item_id,
                    wi.wardrobe_id,
                    wi.variant_id,
                    wi.quantity,
                    wi.date_added
             FROM WARDROBE_ITEM wi
             INNER JOIN WARDROBE w
                ON wi.wardrobe_id = w.wardrobe_id
             WHERE w.wardrobe_id = ?
               AND w.user_id = ?
             ORDER BY wi.date_added DESC`,
            [wardrobe_id, userId]
        );

        return res.status(200).json({
            success: true,
            items: rows
        });

    } catch (error) {
        console.error("Get wardrobe items error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// Remove an item from a wardrobe
const removeWardrobeItem = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { wardrobe_item_id } = req.params;

        const [result] = await db.execute(
            `DELETE wi
             FROM WARDROBE_ITEM wi
             INNER JOIN WARDROBE w
                ON wi.wardrobe_id = w.wardrobe_id
             WHERE wi.wardrobe_item_id = ?
               AND w.user_id = ?`,
            [wardrobe_item_id, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Wardrobe item not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Item removed from wardrobe successfully"
        });

    } catch (error) {
        console.error("Remove wardrobe item error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

module.exports = {
    createWardrobe,
    getUserWardrobes,
    addWardrobeItem,
    getWardrobeItems,
    removeWardrobeItem
};
