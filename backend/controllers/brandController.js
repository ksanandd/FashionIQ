
const db = require("../config/db");

// Get all brands
const getAllBrands = async (req, res) => {
    try {
        const [brands] = await db.query(
            "SELECT * FROM BRAND ORDER BY brand_id"
        );

        res.status(200).json({
            success: true,
            count: brands.length,
            brands
        });

    } catch (error) {
        console.error("Error fetching brands:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to retrieve brands"
        });
    }
};

// Get brand by ID
const getBrandById = async (req, res) => {
    try {
        const brandId = Number(req.params.id);

        if (!Number.isInteger(brandId) || brandId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid brand ID"
            });
        }

        const [brands] = await db.query(
            "SELECT * FROM BRAND WHERE brand_id = ?",
            [brandId]
        );

        if (brands.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Brand not found"
            });
        }

        res.status(200).json({
            success: true,
            brand: brands[0]
        });

    } catch (error) {
        console.error("Error fetching brand:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to retrieve brand"
        });
    }
};

module.exports = {
    getAllBrands,
    getBrandById
};
