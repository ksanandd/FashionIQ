
const db = require("../config/db");

// Get all products
const getAllProducts = async (req, res) => {
    try {
        const [products] = await db.query(`
            SELECT
                product_id,
                category_id,
                brand_id,
                product_name,
                description,
                price,
                gender,
                image_url
            FROM PRODUCT
            ORDER BY product_id ASC
        `);

        res.status(200).json({
            success: true,
            count: products.length,
            products: products
        });

    } catch (error) {
        console.error("Error fetching products:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to retrieve products"
        });
    }
};


const getProductById = async (req, res) => {
    try {
        const productId = Number(req.params.id);

        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        const [products] = await db.query(
            `SELECT * FROM PRODUCT WHERE product_id = ?`,
            [productId]
        );

        if (products.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        res.status(200).json({
            success: true,
            product: products[0]
        });

    } catch (error) {
        console.error("Error fetching product:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to retrieve product"
        });
    }
};


module.exports = {
    getAllProducts,
    getProductById
};
