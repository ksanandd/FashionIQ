
const db = require("../config/db");

// Get all categories
const getAllCategories = async (req, res) => {
    try {
        const [categories] = await db.query(
            "SELECT * FROM CATEGORY ORDER BY category_id"
        );

        res.status(200).json({
            success: true,
            count: categories.length,
            categories
        });

    } catch (error) {
        console.error("Error fetching categories:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to retrieve categories"
        });
    }
};

// Get category by ID
const getCategoryById = async (req, res) => {
    try {
        const categoryId = Number(req.params.id);

        if (!Number.isInteger(categoryId) || categoryId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid category ID"
            });
        }

        const [categories] = await db.query(
            "SELECT * FROM CATEGORY WHERE category_id = ?",
            [categoryId]
        );

        if (categories.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        res.status(200).json({
            success: true,
            category: categories[0]
        });

    } catch (error) {
        console.error("Error fetching category:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to retrieve category"
        });
    }
};

module.exports = {
    getAllCategories,
    getCategoryById
};
