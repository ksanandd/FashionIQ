
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


    // Sorting options
    const sortOptions = {
        price_asc: "price ASC",
        price_desc: "price DESC",
        name_asc: "product_name ASC",
        name_desc: "product_name DESC"
    };

    const sort = req.query.sort || "default";

    const orderBy = sortOptions[sort] || (
        sort === "default" ? "product_id ASC" : null
    );

    if (!orderBy) {
        return res.status(400).json({
            success: false,
            message: "Invalid sorting option"
        });
    }

    // Pagination validation
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);

    if (
        !Number.isInteger(page) ||
        !Number.isInteger(limit) ||
        page < 1 ||
        limit < 1 ||
        limit > 100
    ) {
        return res.status(400).json({
            success: false,
            message: "Invalid page or limit. Limit must be between 1 and 100."
        });
    }

    const offset = (page - 1) * limit;

    // Get total matching products before pagination
    const [countResult] = await db.query(
        `SELECT COUNT(*) AS total FROM PRODUCT WHERE 1=1 ${
            sql.substring(sql.indexOf(" WHERE 1=1") + 10)
        }`,
        params
    );

    const totalProducts = countResult[0].total;
    const totalPages = Math.ceil(totalProducts / limit);

    // Fetch paginated products
    sql += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;

    const [products] = await db.query(
        sql,
        [...params, limit, offset]
    );

    res.status(200).json({
        success: true,
        count: products.length,
        pagination: {
            currentPage: page,
            limit,
            totalProducts,
            totalPages
        },
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

// Get all variants of a specific product
const getProductVariants = async (req, res) => {
    try {
        const productId = Number(req.params.id);

        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid product ID"
            });
        }

        // Check whether the product exists
        const [products] = await db.query(
            "SELECT product_id FROM PRODUCT WHERE product_id = ?",
            [productId]
        );

        if (products.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }

        // Retrieve available variants
        const [variants] = await db.query(
            `SELECT
                variant_id,
                product_id,
                color,
                size,
                stock_quantity,
                price
            FROM PRODUCT_VARIANT
            WHERE product_id = ?
            ORDER BY variant_id ASC`,
            [productId]
        );

        res.status(200).json({
            success: true,
            count: variants.length,
            variants
        });

    } catch (error) {
        console.error("Error fetching product variants:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to retrieve product variants"
        });
    }
};

module.exports = {
    getAllProducts,
    getProductById,
    getProductVariants
};
