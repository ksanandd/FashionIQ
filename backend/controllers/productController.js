
const db = require("../config/db");

// Get all products

const getAllProducts = async (req, res) => {
    try {
        const {
            category_id,
            brand_id,
            gender,
            search,
            min_price,
            max_price
        } = req.query;

        let sql = "SELECT * FROM PRODUCT WHERE 1=1";
        const params = [];

        if (category_id !== undefined) {
            const id = Number(category_id);

            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid category ID"
                });
            }

            sql += " AND category_id = ?";
            params.push(id);
        }

        if (brand_id !== undefined) {
            const id = Number(brand_id);

            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid brand ID"
                });
            }

            sql += " AND brand_id = ?";
            params.push(id);
        }

        if (gender !== undefined) {
            if (typeof gender !== "string" || !gender.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid gender"
                });
            }

            sql += " AND gender = ?";
            params.push(gender.trim());
        }

        if (search !== undefined) {
            if (typeof search !== "string") {
                return res.status(400).json({
                    success: false,
                    message: "Invalid search query"
                });
            }

            sql += " AND (product_name LIKE ? OR description LIKE ?)";
            const term = `%${search.trim()}%`;
            params.push(term, term);
        }

        const parsePrice = (value) => {
            if (typeof value !== "string" || !value.trim()) {
                return null;
            }

            const price = Number(value);
            return Number.isFinite(price) && price >= 0
                ? price
                : null;
        };

        const minPrice = min_price === undefined
            ? undefined
            : parsePrice(min_price);

        const maxPrice = max_price === undefined
            ? undefined
            : parsePrice(max_price);

        if (minPrice === null || maxPrice === null) {
            return res.status(400).json({
                success: false,
                message: "Invalid price filter"
            });
        }

        if (
            minPrice !== undefined &&
            maxPrice !== undefined &&
            minPrice > maxPrice
        ) {
            return res.status(400).json({
                success: false,
                message: "Minimum price cannot exceed maximum price"
            });
        }

        if (minPrice !== undefined) {
            sql += " AND price >= ?";
            params.push(minPrice);
        }

        if (maxPrice !== undefined) {
            sql += " AND price <= ?";
            params.push(maxPrice);
        }

        sql += " ORDER BY product_id ASC";

        const [products] = await db.query(sql, params);

        res.status(200).json({
            success: true,
            count: products.length,
            products
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
