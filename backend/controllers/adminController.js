const db = require("../config/db");

// ==============================================================================
// 1. Dashboard Statistics & Analytics
// ==============================================================================

/**
 * GET /api/admin/dashboard
 * Aggregated statistics derived directly from live MySQL tables.
 */
const getDashboardStats = async (req, res) => {
    try {
        // 1. User metrics
        const [userStats] = await db.query(`
            SELECT
                COUNT(*) AS total_users,
                SUM(CASE WHEN role = 'ADMIN' THEN 1 ELSE 0 END) AS admin_users,
                SUM(CASE WHEN role = 'USER' THEN 1 ELSE 0 END) AS customer_users
            FROM USER
        `);

        // 2. Catalog & Inventory metrics
        const [catalogStats] = await db.query(`
            SELECT
                (SELECT COUNT(*) FROM PRODUCT) AS total_products,
                (SELECT COUNT(*) FROM CATEGORY) AS total_categories,
                (SELECT COUNT(*) FROM BRAND) AS total_brands,
                (SELECT COUNT(*) FROM PRODUCT_VARIANT) AS total_variants,
                (SELECT COUNT(*) FROM PRODUCT_VARIANT WHERE stock_quantity > 0 AND stock_quantity <= 10) AS low_stock_variants,
                (SELECT COUNT(*) FROM PRODUCT_VARIANT WHERE stock_quantity = 0) AS out_of_stock_variants,
                (SELECT COALESCE(SUM(stock_quantity), 0) FROM PRODUCT_VARIANT) AS total_inventory_units
        `);

        // 3. Order metrics & Status breakdown
        const [orderStats] = await db.query(`
            SELECT
                COUNT(*) AS total_orders,
                SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending_orders,
                SUM(CASE WHEN status = 'PROCESSING' THEN 1 ELSE 0 END) AS processing_orders,
                SUM(CASE WHEN status = 'SHIPPED' THEN 1 ELSE 0 END) AS shipped_orders,
                SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) AS delivered_orders,
                SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_orders,

                -- REVENUE RULES (STRICT & AUDITED):
                -- 1. Genuine Recognized Revenue:
                --    - payment_method != 'SIMULATED_CARD' (excludes simulation / test cards)
                --    - payment_status = 'PAID'
                --    - status != 'CANCELLED' (cancelled orders contribute zero revenue)
                --    - For Cash on Delivery (COD), payment is only recognized when physically DELIVERED and collected
                COALESCE(SUM(CASE
                    WHEN payment_method != 'SIMULATED_CARD'
                         AND payment_status = 'PAID'
                         AND status != 'CANCELLED'
                         AND (payment_method != 'COD' OR status = 'DELIVERED')
                    THEN total_amount
                    ELSE 0
                END), 0) AS recognized_revenue,

                -- 2. Count of genuine recognized paid orders:
                COALESCE(SUM(CASE
                    WHEN payment_method != 'SIMULATED_CARD'
                         AND payment_status = 'PAID'
                         AND status != 'CANCELLED'
                         AND (payment_method != 'COD' OR status = 'DELIVERED')
                    THEN 1
                    ELSE 0
                END), 0) AS total_paid_recognized_orders,

                -- 3. Pending Revenue: uncollected funds (payment_status = 'PENDING') for non-cancelled orders
                COALESCE(SUM(CASE WHEN payment_status = 'PENDING' AND status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) AS pending_revenue,

                -- 4. Simulated Card Revenue: payments completed via test card gateway (tracked strictly separately)
                COALESCE(SUM(CASE WHEN payment_method = 'SIMULATED_CARD' AND payment_status = 'PAID' AND status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) AS simulated_card_revenue,

                -- 5. COD Pending Collections: cash to be collected upon physical delivery
                COALESCE(SUM(CASE WHEN payment_method = 'COD' AND payment_status = 'PENDING' AND status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) AS cod_pending_revenue,

                -- 6. COD Collected Revenue: cash collected and confirmed delivered
                COALESCE(SUM(CASE WHEN payment_method = 'COD' AND payment_status = 'PAID' AND status = 'DELIVERED' THEN total_amount ELSE 0 END), 0) AS cod_paid_revenue,

                -- 7. Total Order Value across all active non-cancelled orders
                COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) AS total_order_value
            FROM ORDERS
        `);

        // 4. Recent orders (last 5)
        const [recentOrders] = await db.query(`
            SELECT
                o.order_id,
                o.user_id,
                o.total_amount,
                o.status,
                o.payment_method,
                o.payment_status,
                o.created_at,
                u.first_name,
                u.last_name,
                u.email
            FROM ORDERS o
            JOIN USER u ON o.user_id = u.user_id
            ORDER BY o.created_at DESC
            LIMIT 5
        `);

        // 5. Recent registered users (last 5)
        const [recentUsers] = await db.query(`
            SELECT
                u.user_id,
                u.first_name,
                u.last_name,
                u.email,
                u.role,
                u.city,
                u.state,
                COALESCE(up.created_at, NOW()) AS created_at
            FROM USER u
            LEFT JOIN USER_PROFILE up ON u.user_id = up.user_id
            ORDER BY u.user_id DESC
            LIMIT 5
        `);

        const dashboardPayload = {
            users: {
                total: Number(userStats[0].total_users) || 0,
                admins: Number(userStats[0].admin_users) || 0,
                customers: Number(userStats[0].customer_users) || 0,
            },
            catalog: {
                total_products: Number(catalogStats[0].total_products) || 0,
                total_categories: Number(catalogStats[0].total_categories) || 0,
                total_brands: Number(catalogStats[0].total_brands) || 0,
                total_variants: Number(catalogStats[0].total_variants) || 0,
                low_stock_variants: Number(catalogStats[0].low_stock_variants) || 0,
                out_of_stock_variants: Number(catalogStats[0].out_of_stock_variants) || 0,
                total_inventory_units: Number(catalogStats[0].total_inventory_units) || 0,
            },
            products: {
                total: Number(catalogStats[0].total_products) || 0,
                low_stock: Number(catalogStats[0].low_stock_variants) || 0,
                out_of_stock_variants: Number(catalogStats[0].out_of_stock_variants) || 0,
            },
            categories: {
                total: Number(catalogStats[0].total_categories) || 0,
            },
            brands: {
                total: Number(catalogStats[0].total_brands) || 0,
            },
            orders: {
                total: Number(orderStats[0].total_orders) || 0,
                pending: Number(orderStats[0].pending_orders) || 0,
                processing: Number(orderStats[0].processing_orders) || 0,
                shipped: Number(orderStats[0].shipped_orders) || 0,
                delivered: Number(orderStats[0].delivered_orders) || 0,
                cancelled: Number(orderStats[0].cancelled_orders) || 0,
            },
            revenue: {
                recognized_revenue: Number(orderStats[0].recognized_revenue) || 0,
                total_paid_orders: Number(orderStats[0].total_paid_recognized_orders) || 0,
                pending_revenue: Number(orderStats[0].pending_revenue) || 0,
                total_pending_orders: Number(orderStats[0].pending_orders) || 0,
                simulated_card_revenue: Number(orderStats[0].simulated_card_revenue) || 0,
                cod_pending_revenue: Number(orderStats[0].cod_pending_revenue) || 0,
                cod_paid_revenue: Number(orderStats[0].cod_paid_revenue) || 0,
                total_order_value: Number(orderStats[0].total_order_value) || 0,
                accounting_policy: "Recognized revenue requires payment_status = 'PAID' on active non-cancelled orders, excluding SIMULATED_CARD test transactions. For COD, revenue is recognized only upon DELIVERED status and confirmed collection.",
                note: "SIMULATED_CARD test transactions are tracked separately and strictly excluded from recognized revenue. Pending COD orders represent pending collections.",
            },
            recent_activity: {
                orders: recentOrders.map((o) => ({
                    order_id: o.order_id,
                    customer_name: `${o.first_name || ""} ${o.last_name || ""}`.trim() || "Customer",
                    customer_email: o.email,
                    total_amount: Number(o.total_amount),
                    status: o.status,
                    payment_method: o.payment_method,
                    payment_status: o.payment_status,
                    created_at: o.created_at,
                })),
                registrations: recentUsers.map((u) => ({
                    user_id: u.user_id,
                    first_name: u.first_name,
                    last_name: u.last_name,
                    email: u.email,
                    role: u.role,
                    created_at: u.created_at,
                })),
            },
            recent_orders: recentOrders,
            recent_users: recentUsers,
            accounting_policy: "Recognized revenue requires payment_status = 'PAID' on active non-cancelled orders, excluding SIMULATED_CARD test transactions. For COD, revenue is recognized only upon DELIVERED status and confirmed collection.",
        };

        return res.json({
            success: true,
            dashboard: dashboardPayload,
            ...dashboardPayload,
        });
    } catch (err) {
        console.error("Dashboard stats error:", err.message);
        return res.status(500).json({ success: false, message: "Failed to retrieve dashboard statistics." });
    }
};

/**
 * GET /api/admin/analytics
 * Comprehensive visual analytics dataset.
 */
const getAnalytics = async (req, res) => {
    try {
        // 1. Monthly revenue & order trends following strict accounting policy
        const [monthlyTrends] = await db.query(`
            SELECT
                DATE_FORMAT(created_at, '%Y-%m') AS month,
                COUNT(*) AS total_orders,
                -- Genuine recognized revenue (real payment, paid, non-cancelled, COD only if delivered)
                COALESCE(SUM(CASE
                    WHEN payment_method != 'SIMULATED_CARD'
                         AND payment_status = 'PAID'
                         AND status != 'CANCELLED'
                         AND (payment_method != 'COD' OR status = 'DELIVERED')
                    THEN total_amount
                    ELSE 0
                END), 0) AS recognized_revenue,
                -- Backward compatibility alias
                COALESCE(SUM(CASE
                    WHEN payment_method != 'SIMULATED_CARD'
                         AND payment_status = 'PAID'
                         AND status != 'CANCELLED'
                         AND (payment_method != 'COD' OR status = 'DELIVERED')
                    THEN total_amount
                    ELSE 0
                END), 0) AS paid_revenue,
                -- Simulated revenue tracked separately
                COALESCE(SUM(CASE
                    WHEN payment_method = 'SIMULATED_CARD'
                         AND payment_status = 'PAID'
                         AND status != 'CANCELLED'
                    THEN total_amount
                    ELSE 0
                END), 0) AS simulated_revenue,
                COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN total_amount ELSE 0 END), 0) AS total_order_value
            FROM ORDERS
            GROUP BY DATE_FORMAT(created_at, '%Y-%m')
            ORDER BY month ASC
            LIMIT 12
        `);

        // 2. Orders by status distribution
        const [statusDist] = await db.query(`
            SELECT status, COUNT(*) AS count
            FROM ORDERS
            GROUP BY status
        `);

        // 3. Payment method distribution
        const [paymentDist] = await db.query(`
            SELECT
                payment_method,
                payment_status,
                COUNT(*) AS order_count,
                COALESCE(SUM(total_amount), 0) AS total_amount
            FROM ORDERS
            WHERE status != 'CANCELLED'
            GROUP BY payment_method, payment_status
        `);

        // 4. Top selling products
        const [topProducts] = await db.query(`
            SELECT
                p.product_id,
                p.product_name,
                b.brand_name,
                c.category_name,
                COALESCE(SUM(oi.quantity), 0) AS total_sold,
                COALESCE(SUM(oi.quantity), 0) AS total_units_sold,
                COALESCE(SUM(oi.subtotal), 0) AS total_revenue
            FROM ORDER_ITEM oi
            JOIN PRODUCT p ON oi.product_id = p.product_id
            JOIN BRAND b ON p.brand_id = b.brand_id
            JOIN CATEGORY c ON p.category_id = c.category_id
            JOIN ORDERS o ON oi.order_id = o.order_id
            WHERE o.status != 'CANCELLED'
            GROUP BY p.product_id, p.product_name, b.brand_name, c.category_name
            ORDER BY total_sold DESC
            LIMIT 5
        `);

        // 5. Category distribution
        const [categoryDist] = await db.query(`
            SELECT
                c.category_id,
                c.category_name,
                COUNT(DISTINCT p.product_id) AS product_count,
                COALESCE(SUM(oi.quantity), 0) AS items_sold,
                COALESCE(SUM(oi.quantity), 0) AS units_sold,
                COALESCE(SUM(oi.subtotal), 0) AS revenue
            FROM CATEGORY c
            LEFT JOIN PRODUCT p ON c.category_id = p.category_id
            LEFT JOIN ORDER_ITEM oi ON p.product_id = oi.product_id
            GROUP BY c.category_id, c.category_name
            ORDER BY product_count DESC
        `);

        // 6. Inventory Stock Health Overview
        // Guarantees all 3 stock tiers (Out of Stock, Low Stock, In Stock) are always returned
        const [stockOverview] = await db.query(`
            SELECT
                'Out of Stock' AS stock_level,
                COALESCE(COUNT(CASE WHEN pv.stock_quantity = 0 THEN 1 END), 0) AS variant_count,
                COALESCE(SUM(CASE WHEN pv.stock_quantity = 0 THEN pv.stock_quantity ELSE 0 END), 0) AS total_stock
            FROM PRODUCT_VARIANT pv
            UNION ALL
            SELECT
                'Low Stock (1-10 units)' AS stock_level,
                COALESCE(COUNT(CASE WHEN pv.stock_quantity > 0 AND pv.stock_quantity <= 10 THEN 1 END), 0) AS variant_count,
                COALESCE(SUM(CASE WHEN pv.stock_quantity > 0 AND pv.stock_quantity <= 10 THEN pv.stock_quantity ELSE 0 END), 0) AS total_stock
            FROM PRODUCT_VARIANT pv
            UNION ALL
            SELECT
                'In Stock (>10 units)' AS stock_level,
                COALESCE(COUNT(CASE WHEN pv.stock_quantity > 10 THEN 1 END), 0) AS variant_count,
                COALESCE(SUM(CASE WHEN pv.stock_quantity > 10 THEN pv.stock_quantity ELSE 0 END), 0) AS total_stock
            FROM PRODUCT_VARIANT pv
        `);

        return res.json({
            success: true,
            analytics: {
                monthly_trends: monthlyTrends.map((m) => ({
                    ...m,
                    paid_revenue: Number(m.paid_revenue) || 0,
                    total_order_value: Number(m.total_order_value) || 0,
                })),
                order_status_distribution: statusDist || [],
                payment_distribution: paymentDist.map((p) => ({
                    ...p,
                    total_amount: Number(p.total_amount) || 0,
                    order_count: Number(p.order_count) || 0,
                })),
                top_products: topProducts.map((p) => ({
                    ...p,
                    total_sold: Number(p.total_sold) || 0,
                    total_units_sold: Number(p.total_units_sold ?? p.total_sold) || 0,
                    total_revenue: Number(p.total_revenue) || 0,
                })),
                category_distribution: categoryDist.map((c) => ({
                    ...c,
                    product_count: Number(c.product_count) || 0,
                    items_sold: Number(c.items_sold) || 0,
                    units_sold: Number(c.units_sold ?? c.items_sold) || 0,
                    revenue: Number(c.revenue) || 0,
                })),
                stock_overview: (stockOverview || []).map((s) => {
                    const rawLevel = s.stock_level ? String(s.stock_level).trim() : "";
                    const variantCount = Number(s.variant_count) || 0;
                    const totalStock = Number(s.total_stock) || 0;

                    let stockLevel = rawLevel;
                    if (!stockLevel) {
                        if (totalStock === 0 || variantCount === 0) {
                            stockLevel = "Out of Stock";
                        } else if (totalStock <= 10) {
                            stockLevel = "Low Stock (1-10 units)";
                        } else {
                            stockLevel = "In Stock (>10 units)";
                        }
                    }

                    return {
                        ...s,
                        stock_level: stockLevel,
                        variant_count: variantCount,
                        total_stock: totalStock,
                    };
                }),
            },
        });
    } catch (err) {
        console.error("Analytics retrieval error:", err.message);
        return res.status(500).json({ success: false, message: "Failed to retrieve analytics data." });
    }
};

// ==============================================================================
// 2. Product Management
// ==============================================================================

/**
 * GET /api/admin/products
 */
const getProducts = async (req, res) => {
    try {
        const { search, category_id, brand_id, gender } = req.query;

        let query = `
            SELECT
                p.product_id,
                p.product_name,
                p.description,
                p.price,
                p.gender,
                p.image_url,
                p.category_id,
                c.category_name,
                p.brand_id,
                b.brand_name,
                COUNT(pv.variant_id) AS variant_count,
                COALESCE(SUM(pv.stock_quantity), 0) AS total_stock
            FROM PRODUCT p
            JOIN CATEGORY c ON p.category_id = c.category_id
            JOIN BRAND b ON p.brand_id = b.brand_id
            LEFT JOIN PRODUCT_VARIANT pv ON p.product_id = pv.product_id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ` AND (p.product_name LIKE ? OR p.description LIKE ? OR b.brand_name LIKE ?)`;
            const term = `%${search.trim()}%`;
            params.push(term, term, term);
        }
        if (category_id) {
            query += ` AND p.category_id = ?`;
            params.push(Number(category_id));
        }
        if (brand_id) {
            query += ` AND p.brand_id = ?`;
            params.push(Number(brand_id));
        }
        if (gender) {
            const normalizedG = normalizeGender(gender) || gender;
            query += ` AND p.gender = ?`;
            params.push(normalizedG);
        }

        query += ` GROUP BY p.product_id ORDER BY p.product_id DESC`;

        const [products] = await db.query(query, params);
        return res.json({
            success: true,
            count: products.length,
            products: products.map((p) => ({
                ...p,
                price: Number(p.price),
                total_stock: Number(p.total_stock),
                variant_count: Number(p.variant_count),
            })),
        });
    } catch (err) {
        console.error("Admin getProducts error:", err.message);
        return res.status(500).json({ success: false, message: "Failed to fetch products." });
    }
};

/**
 * GET /api/admin/products/:id
 */
const getProductById = async (req, res) => {
    try {
        const productId = Number(req.params.id);
        if (!productId || productId <= 0) {
            return res.status(400).json({ success: false, message: "Invalid product ID." });
        }

        const [products] = await db.query(`
            SELECT
                p.product_id,
                p.product_name,
                p.description,
                p.price,
                p.gender,
                p.image_url,
                p.category_id,
                c.category_name,
                p.brand_id,
                b.brand_name
            FROM PRODUCT p
            JOIN CATEGORY c ON p.category_id = c.category_id
            JOIN BRAND b ON p.brand_id = b.brand_id
            WHERE p.product_id = ?
        `, [productId]);

        if (!products.length) {
            return res.status(404).json({ success: false, message: "Product not found." });
        }

        const [variants] = await db.query(`
            SELECT
                variant_id,
                product_id,
                color,
                size,
                stock_quantity,
                price
            FROM PRODUCT_VARIANT
            WHERE product_id = ?
            ORDER BY variant_id ASC
        `, [productId]);

        return res.json({
            success: true,
            product: {
                ...products[0],
                price: Number(products[0].price),
                variants: variants.map((v) => ({
                    ...v,
                    price: Number(v.price || products[0].price),
                })),
            },
        });
    } catch (err) {
        console.error("Admin getProductById error:", err.message);
        return res.status(500).json({ success: false, message: "Failed to fetch product details." });
    }
};

/**
 * Normalizes gender input case-insensitively into strict MySQL ENUM ('Men', 'Women', 'Unisex')
 */
const normalizeGender = (g) => {
    if (!g || typeof g !== "string") return null;
    const lower = g.trim().toLowerCase();
    if (lower === "men" || lower === "man" || lower === "male") return "Men";
    if (lower === "women" || lower === "woman" || lower === "female") return "Women";
    if (lower === "unisex" || lower === "all") return "Unisex";
    return null;
};

/**
 * POST /api/admin/products
 */
const createProduct = async (req, res) => {
    try {
        const { product_name, description, price, gender, category_id, brand_id, image_url, initial_variant, variants } = req.body;

        if (!product_name || typeof product_name !== "string" || !product_name.trim()) {
            return res.status(400).json({ success: false, message: "Valid product name is required." });
        }
        const parsedPrice = Number(price);
        if (isNaN(parsedPrice) || parsedPrice <= 0) {
            return res.status(400).json({ success: false, message: "Price must be a positive number." });
        }
        const normalizedGender = normalizeGender(gender);
        if (!normalizedGender) {
            return res.status(400).json({ success: false, message: "Gender must be 'Men', 'Women', or 'Unisex'." });
        }

        // Verify category exists
        const [catCheck] = await db.query("SELECT category_id FROM CATEGORY WHERE category_id = ?", [Number(category_id)]);
        if (!catCheck.length) {
            return res.status(400).json({ success: false, message: "Referenced category does not exist." });
        }

        // Verify brand exists
        const [brandCheck] = await db.query("SELECT brand_id FROM BRAND WHERE brand_id = ?", [Number(brand_id)]);
        if (!brandCheck.length) {
            return res.status(400).json({ success: false, message: "Referenced brand does not exist." });
        }

        // Validate multiple variants if provided
        const variantsToInsert = [];
        if (Array.isArray(variants) && variants.length > 0) {
            const seenCombos = new Set();
            for (let idx = 0; idx < variants.length; idx++) {
                const v = variants[idx];
                if (!v || typeof v !== "object") {
                    return res.status(400).json({ success: false, message: `Invalid variant data at row ${idx + 1}.` });
                }
                const vColor = typeof v.color === "string" ? v.color.trim() : "";
                const vSize = typeof v.size === "string" ? v.size.trim() : "";
                if (!vColor) {
                    return res.status(400).json({ success: false, message: `Variant color is required at row ${idx + 1}.` });
                }
                if (!vSize) {
                    return res.status(400).json({ success: false, message: `Variant size is required at row ${idx + 1}.` });
                }
                const vStock = parseInt(v.stock_quantity, 10);
                if (isNaN(vStock) || vStock < 0) {
                    return res.status(400).json({ success: false, message: `Stock quantity for variant '${vColor} - ${vSize}' must be a non-negative integer.` });
                }
                let vPrice = parsedPrice;
                if (v.price !== undefined && v.price !== null && String(v.price).trim() !== "") {
                    const parsedVPrice = Number(v.price);
                    if (isNaN(parsedVPrice) || parsedVPrice <= 0) {
                        return res.status(400).json({ success: false, message: `Price for variant '${vColor} - ${vSize}' must be a positive number.` });
                    }
                    vPrice = parsedVPrice;
                }

                const comboKey = `${vColor.toLowerCase()}:::${vSize.toLowerCase()}`;
                if (seenCombos.has(comboKey)) {
                    return res.status(400).json({
                        success: false,
                        message: `Duplicate variant combination: '${vColor}' with size '${vSize}' already specified. Each variant must have a unique color/size combination.`,
                    });
                }
                seenCombos.add(comboKey);

                variantsToInsert.push({
                    color: vColor,
                    size: vSize,
                    stock_quantity: vStock,
                    price: vPrice,
                });
            }
        } else if (initial_variant && typeof initial_variant === "object") {
            const vColor = typeof initial_variant.color === "string" && initial_variant.color.trim() ? initial_variant.color.trim() : "Standard";
            const vSize = typeof initial_variant.size === "string" && initial_variant.size.trim() ? initial_variant.size.trim() : "M";
            const stockQty = Math.max(0, parseInt(initial_variant.stock_quantity, 10) || 0);
            const vPrice = initial_variant.price && Number(initial_variant.price) > 0 ? Number(initial_variant.price) : parsedPrice;
            variantsToInsert.push({
                color: vColor,
                size: vSize,
                stock_quantity: stockQty,
                price: vPrice,
            });
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [result] = await connection.query(`
                INSERT INTO PRODUCT (product_name, description, price, gender, category_id, brand_id, image_url)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                product_name.trim(),
                description || "",
                parsedPrice,
                normalizedGender,
                Number(category_id),
                Number(brand_id),
                image_url || "/placeholder-product.png",
            ]);

            const newProductId = result.insertId;

            // Insert all variants
            for (const v of variantsToInsert) {
                await connection.query(`
                    INSERT INTO PRODUCT_VARIANT (product_id, color, size, stock_quantity, price)
                    VALUES (?, ?, ?, ?, ?)
                `, [
                    newProductId,
                    v.color,
                    v.size,
                    v.stock_quantity,
                    v.price,
                ]);
            }

            await connection.commit();
            return res.status(201).json({
                success: true,
                message: "Product created successfully.",
                product_id: newProductId,
                variants_count: variantsToInsert.length,
            });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error("Admin createProduct error:", err.message);
        return res.status(500).json({ success: false, message: "Failed to create product." });
    }
};

/**
 * PUT /api/admin/products/:id
 */
const updateProduct = async (req, res) => {
    try {
        const productId = Number(req.params.id);
        if (!productId || productId <= 0) {
            return res.status(400).json({ success: false, message: "Invalid product ID." });
        }

        const { product_name, description, price, gender, category_id, brand_id, image_url } = req.body;

        if (!product_name || typeof product_name !== "string" || !product_name.trim()) {
            return res.status(400).json({ success: false, message: "Valid product name is required." });
        }
        const parsedPrice = Number(price);
        if (isNaN(parsedPrice) || parsedPrice <= 0) {
            return res.status(400).json({ success: false, message: "Price must be a positive number." });
        }
        const normalizedGender = normalizeGender(gender);
        if (!normalizedGender) {
            return res.status(400).json({ success: false, message: "Gender must be 'Men', 'Women', or 'Unisex'." });
        }

        // Verify category exists
        const [catCheck] = await db.query("SELECT category_id FROM CATEGORY WHERE category_id = ?", [Number(category_id)]);
        if (!catCheck.length) {
            return res.status(400).json({ success: false, message: "Referenced category does not exist." });
        }

        // Verify brand exists
        const [brandCheck] = await db.query("SELECT brand_id FROM BRAND WHERE brand_id = ?", [Number(brand_id)]);
        if (!brandCheck.length) {
            return res.status(400).json({ success: false, message: "Referenced brand does not exist." });
        }

        const [result] = await db.query(`
            UPDATE PRODUCT
            SET product_name = ?, description = ?, price = ?, gender = ?, category_id = ?, brand_id = ?, image_url = ?
            WHERE product_id = ?
        `, [
            product_name.trim(),
            description || "",
            parsedPrice,
            normalizedGender,
            Number(category_id),
            Number(brand_id),
            image_url || "/placeholder-product.png",
            productId,
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Product not found." });
        }

        return res.json({
            success: true,
            message: "Product updated successfully.",
        });
    } catch (err) {
        console.error("Admin updateProduct error:", err.message);
        return res.status(500).json({ success: false, message: "Failed to update product." });
    }
};

/**
 * DELETE /api/admin/products/:id
 */
const deleteProduct = async (req, res) => {
    try {
        const productId = Number(req.params.id);
        if (!productId || productId <= 0) {
            return res.status(400).json({ success: false, message: "Invalid product ID." });
        }

        // 1. Check order references
        const [orderCheck] = await db.query("SELECT COUNT(*) AS count FROM ORDER_ITEM WHERE product_id = ?", [productId]);
        if (orderCheck[0].count > 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete product associated with existing customer orders. Preserve sales history.",
            });
        }

        // 2. Check wardrobe references
        const [wardrobeCheck] = await db.query(`
            SELECT COUNT(*) AS count
            FROM WARDROBE_ITEM wi
            JOIN PRODUCT_VARIANT pv ON wi.variant_id = pv.variant_id
            WHERE pv.product_id = ?
        `, [productId]);
        if (wardrobeCheck[0].count > 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete product present in user Digital Wardrobes.",
            });
        }

        // Delete product (cascades variants)
        const [result] = await db.query("DELETE FROM PRODUCT WHERE product_id = ?", [productId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Product not found." });
        }

        return res.json({
            success: true,
            message: "Product deleted successfully.",
        });
    } catch (err) {
        console.error("Admin deleteProduct error:", err.message);
        return res.status(500).json({ success: false, message: "Failed to delete product." });
    }
};

// ==============================================================================
// 3. Variant & Inventory Management
// ==============================================================================

/**
 * GET /api/admin/variants
 */
const getVariants = async (req, res) => {
    try {
        const { product_id, low_stock, out_of_stock, search } = req.query;

        let query = `
            SELECT
                pv.variant_id,
                pv.product_id,
                pv.color,
                pv.size,
                pv.stock_quantity,
                COALESCE(pv.price, p.price) AS price,
                p.product_name,
                p.image_url,
                b.brand_name,
                c.category_name
            FROM PRODUCT_VARIANT pv
            JOIN PRODUCT p ON pv.product_id = p.product_id
            JOIN BRAND b ON p.brand_id = b.brand_id
            JOIN CATEGORY c ON p.category_id = c.category_id
            WHERE 1=1
        `;
        const params = [];

        if (product_id) {
            query += ` AND pv.product_id = ?`;
            params.push(Number(product_id));
        }
        if (low_stock === "true") {
            query += ` AND pv.stock_quantity > 0 AND pv.stock_quantity <= 10`;
        }
        if (out_of_stock === "true") {
            query += ` AND pv.stock_quantity = 0`;
        }
        if (search) {
            query += ` AND (p.product_name LIKE ? OR pv.color LIKE ? OR pv.size LIKE ?)`;
            const term = `%${search.trim()}%`;
            params.push(term, term, term);
        }

        query += ` ORDER BY pv.product_id ASC, pv.variant_id ASC`;

        const [variants] = await db.query(query, params);
        return res.json({
            success: true,
            count: variants.length,
            variants: variants.map((v) => ({
                ...v,
                price: Number(v.price),
                stock_quantity: Number(v.stock_quantity),
            })),
        });
    } catch (err) {
        console.error("Admin getVariants error:", err.message);
        return res.status(500).json({ success: false, message: "Failed to fetch variants." });
    }
};

/**
 * POST /api/admin/variants
 */
const createVariant = async (req, res) => {
    try {
        const { product_id, color, size, stock_quantity, price } = req.body;

        const pid = Number(product_id);
        if (!pid || pid <= 0) {
            return res.status(400).json({ success: false, message: "Valid product_id is required." });
        }
        if (!color || !color.trim()) {
            return res.status(400).json({ success: false, message: "Variant color is required." });
        }
        if (!size || !size.trim()) {
            return res.status(400).json({ success: false, message: "Variant size is required." });
        }

        const stock = parseInt(stock_quantity, 10);
        if (isNaN(stock) || stock < 0) {
            return res.status(400).json({ success: false, message: "Stock quantity must be a non-negative integer." });
        }

        // Verify product exists
        const [prodCheck] = await db.query("SELECT product_id, price FROM PRODUCT WHERE product_id = ?", [pid]);
        if (!prodCheck.length) {
            return res.status(404).json({ success: false, message: "Referenced product does not exist." });
        }

        // Duplicate check on product + color + size
        const [dupCheck] = await db.query(
            "SELECT variant_id FROM PRODUCT_VARIANT WHERE product_id = ? AND LOWER(TRIM(color)) = LOWER(?) AND LOWER(TRIM(size)) = LOWER(?)",
            [pid, color.trim(), size.trim()]
        );
        if (dupCheck.length > 0) {
            return res.status(400).json({
                success: false,
                message: `A variant with color '${color.trim()}' and size '${size.trim()}' already exists for this product.`,
            });
        }

        const variantPrice = price !== undefined && price !== null && Number(price) > 0
            ? Number(price)
            : Number(prodCheck[0].price);

        const [result] = await db.query(`
            INSERT INTO PRODUCT_VARIANT (product_id, color, size, stock_quantity, price)
            VALUES (?, ?, ?, ?, ?)
        `, [pid, color.trim(), size.trim(), stock, variantPrice]);

        return res.status(201).json({
            success: true,
            message: "Variant created successfully.",
            variant_id: result.insertId,
        });
    } catch (err) {
        console.error("Admin createVariant error:", err.message);
        return res.status(500).json({ success: false, message: "Failed to create variant." });
    }
};

/**
 * PUT /api/admin/variants/:id
 */
const updateVariant = async (req, res) => {
    try {
        const variantId = Number(req.params.id);
        if (!variantId || variantId <= 0) {
            return res.status(400).json({ success: false, message: "Invalid variant ID." });
        }

        const [current] = await db.query(
            "SELECT product_id, color, size FROM PRODUCT_VARIANT WHERE variant_id = ?",
            [variantId]
        );
        if (!current.length) {
            return res.status(404).json({ success: false, message: "Variant not found." });
        }

        const { color, size, stock_quantity, price } = req.body;

        const effectiveColor = color !== undefined ? color.trim() : current[0].color;
        const effectiveSize = size !== undefined ? size.trim() : current[0].size;

        if (color !== undefined || size !== undefined) {
            if (!effectiveColor) return res.status(400).json({ success: false, message: "Color cannot be empty." });
            if (!effectiveSize) return res.status(400).json({ success: false, message: "Size cannot be empty." });

            const [dupCheck] = await db.query(
                "SELECT variant_id FROM PRODUCT_VARIANT WHERE product_id = ? AND LOWER(TRIM(color)) = LOWER(?) AND LOWER(TRIM(size)) = LOWER(?) AND variant_id != ?",
                [current[0].product_id, effectiveColor, effectiveSize, variantId]
            );
            if (dupCheck.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Another variant with color '${effectiveColor}' and size '${effectiveSize}' already exists for this product.`,
                });
            }
        }

        const updates = [];
        const params = [];

        if (color !== undefined) {
            updates.push("color = ?");
            params.push(effectiveColor);
        }
        if (size !== undefined) {
            updates.push("size = ?");
            params.push(effectiveSize);
        }
        if (stock_quantity !== undefined) {
            const stock = parseInt(stock_quantity, 10);
            if (isNaN(stock) || stock < 0) {
                return res.status(400).json({ success: false, message: "Stock quantity must be a non-negative integer." });
            }
            updates.push("stock_quantity = ?");
            params.push(stock);
        }
        if (price !== undefined) {
            const p = Number(price);
            if (isNaN(p) || p <= 0) {
                return res.status(400).json({ success: false, message: "Price must be a positive number." });
            }
            updates.push("price = ?");
            params.push(p);
        }

        if (!updates.length) {
            return res.status(400).json({ success: false, message: "No valid update fields provided." });
        }

        params.push(variantId);
        const [result] = await db.query(`UPDATE PRODUCT_VARIANT SET ${updates.join(", ")} WHERE variant_id = ?`, params);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Variant not found." });
        }

        return res.json({
            success: true,
            message: "Variant updated successfully.",
        });
    } catch (err) {
        console.error("Admin updateVariant error:", err.message);
        return res.status(500).json({ success: false, message: "Failed to update variant." });
    }
};

/**
 * DELETE /api/admin/variants/:id
 */
const deleteVariant = async (req, res) => {
    try {
        const variantId = Number(req.params.id);
        if (!variantId || variantId <= 0) {
            return res.status(400).json({ success: false, message: "Invalid variant ID." });
        }

        // Check order history
        const [orderCheck] = await db.query("SELECT COUNT(*) AS count FROM ORDER_ITEM WHERE variant_id = ?", [variantId]);
        if (orderCheck[0].count > 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete variant associated with existing customer order items.",
            });
        }

        // Check wardrobe
        const [wardrobeCheck] = await db.query("SELECT COUNT(*) AS count FROM WARDROBE_ITEM WHERE variant_id = ?", [variantId]);
        if (wardrobeCheck[0].count > 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete variant saved in customer Digital Wardrobes.",
            });
        }

        // Check saved outfits
        const [outfitCheck] = await db.query("SELECT COUNT(*) AS count FROM OUTFIT_ITEM WHERE variant_id = ?", [variantId]);
        if (outfitCheck[0].count > 0) {
            return res.status(400).json({
                success: false,
                message: "Cannot delete variant included in saved outfit collections.",
            });
        }

        const [result] = await db.query("DELETE FROM PRODUCT_VARIANT WHERE variant_id = ?", [variantId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Variant not found." });
        }

        return res.json({
            success: true,
            message: "Variant deleted successfully.",
        });
    } catch (err) {
        if (err.code === "ER_ROW_IS_REFERENCED_2") {
            return res.status(400).json({
                success: false,
                message: "Cannot delete variant referenced by existing customer records or collections.",
            });
        }
        console.error("Admin deleteVariant error:", err.message);
        return res.status(500).json({ success: false, message: "Failed to delete variant." });
    }
};

// ==============================================================================
// 4. Category Management
// ==============================================================================

/**
 * GET /api/admin/categories
 */
const getCategories = async (req, res) => {
    try {
        const [categories] = await db.query(`
            SELECT
                c.category_id,
                c.category_name,
                c.parent_category_id,
                c.description,
                COUNT(p.product_id) AS product_count
            FROM CATEGORY c
            LEFT JOIN PRODUCT p ON c.category_id = p.category_id
            GROUP BY c.category_id
            ORDER BY c.category_name ASC
        `);

        return res.json({
            success: true,
            count: categories.length,
            categories: categories.map((c) => ({
                ...c,
                product_count: Number(c.product_count),
            })),
        });
    } catch (err) {
        console.error("Admin getCategories error:", err.message);
        return res.status(500).json({ success: false, message: "Failed to fetch categories." });
    }
};

/**
 * POST /api/admin/categories
 */
const createCategory = async (req, res) => {
    try {
        const { category_name, description, parent_category_id } = req.body;

        if (!category_name || typeof category_name !== "string" || !category_name.trim()) {
            return res.status(400).json({ success: false, message: "Category name is required." });
        }

        // Duplicate check
        const [existing] = await db.query("SELECT category_id FROM CATEGORY WHERE LOWER(category_name) = LOWER(?)", [category_name.trim()]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: "A category with this name already exists." });
        }

        const [result] = await db.query(`
            INSERT INTO CATEGORY (category_name, description, parent_category_id)
            VALUES (?, ?, ?)
        `, [
            category_name.trim(),
            description || "",
            parent_category_id ? Number(parent_category_id) : null,
        ]);

        return res.status(201).json({
            success: true,
            message: "Category created successfully.",
            category_id: result.insertId,
        });
    } catch (err) {
        console.error("Admin createCategory error:", err.message);
        return res.status(500).json({ success: false, message: "Failed to create category." });
    }
};

/**
 * PUT /api/admin/categories/:id
 */
const updateCategory = async (req, res) => {
    try {
        const categoryId = Number(req.params.id);
        if (!categoryId || categoryId <= 0) {
            return res.status(400).json({ success: false, message: "Invalid category ID." });
        }

        const { category_name, description, parent_category_id } = req.body;
        if (!category_name || typeof category_name !== "string" || !category_name.trim()) {
            return res.status(400).json({ success: false, message: "Category name is required." });
        }

        // Duplicate check against other categories
        const [existing] = await db.query("SELECT category_id FROM CATEGORY WHERE LOWER(category_name) = LOWER(?) AND category_id != ?", [
            category_name.trim(),
            categoryId,
        ]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: "Another category already uses this name." });
        }

        const [result] = await db.query(`
            UPDATE CATEGORY
            SET category_name = ?, description = ?, parent_category_id = ?
            WHERE category_id = ?
        `, [
            category_name.trim(),
            description || "",
            parent_category_id ? Number(parent_category_id) : null,
            categoryId,
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Category not found." });
        }

        return res.json({
            success: true,
            message: "Category updated successfully.",
        });
    } catch (err) {
        console.error("Admin updateCategory error:", err.message);
        return res.status(500).json({ success: false, message: "Failed to update category." });
    }
};

/**
 * DELETE /api/admin/categories/:id
 */
const deleteCategory = async (req, res) => {
    try {
        const categoryId = Number(req.params.id);
        if (!categoryId || categoryId <= 0) {
            return res.status(400).json({ success: false, message: "Invalid category ID." });
        }

        // Prevent deletion if products exist in category
        const [prodCheck] = await db.query("SELECT COUNT(*) AS count FROM PRODUCT WHERE category_id = ?", [categoryId]);
        if (prodCheck[0].count > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete category containing ${prodCheck[0].count} active products. Reassign or delete products first.`,
            });
        }

        const [result] = await db.query("DELETE FROM CATEGORY WHERE category_id = ?", [categoryId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Category not found." });
        }

        return res.json({
            success: true,
            message: "Category deleted successfully.",
        });
    } catch (err) {
        console.error("Admin deleteCategory error:", err.message);
        return res.status(500).json({ success: false, message: "Failed to delete category." });
    }
};

// ==============================================================================
// 5. Brand Management
// ==============================================================================

/**
 * GET /api/admin/brands
 */
const getBrands = async (req, res) => {
    try {
        const [brands] = await db.query(`
            SELECT
                b.brand_id,
                b.brand_name,
                b.website,
                b.country,
                COUNT(p.product_id) AS product_count
            FROM BRAND b
            LEFT JOIN PRODUCT p ON b.brand_id = p.brand_id
            GROUP BY b.brand_id
            ORDER BY b.brand_name ASC
        `);

        return res.json({
            success: true,
            count: brands.length,
            brands: brands.map((b) => ({
                ...b,
                product_count: Number(b.product_count),
            })),
        });
    } catch (err) {
        console.error("Admin getBrands error:", err.message);
        return res.status(500).json({ success: false, message: "Failed to fetch brands." });
    }
};

/**
 * POST /api/admin/brands
 */
const createBrand = async (req, res) => {
    try {
        const { brand_name, website, country } = req.body;

        if (!brand_name || typeof brand_name !== "string" || !brand_name.trim()) {
            return res.status(400).json({ success: false, message: "Brand name is required." });
        }

        // Duplicate check
        const [existing] = await db.query("SELECT brand_id FROM BRAND WHERE LOWER(brand_name) = LOWER(?)", [brand_name.trim()]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: "A brand with this name already exists." });
        }

        const [result] = await db.query(`
            INSERT INTO BRAND (brand_name, website, country)
            VALUES (?, ?, ?)
        `, [
            brand_name.trim(),
            website || "",
            country || "",
        ]);

        return res.status(201).json({
            success: true,
            message: "Brand created successfully.",
            brand_id: result.insertId,
        });
    } catch (err) {
        console.error("Admin createBrand error:", err.message);
        return res.status(500).json({ success: false, message: "Failed to create brand." });
    }
};

/**
 * PUT /api/admin/brands/:id
 */
const updateBrand = async (req, res) => {
    try {
        const brandId = Number(req.params.id);
        if (!brandId || brandId <= 0) {
            return res.status(400).json({ success: false, message: "Invalid brand ID." });
        }

        const { brand_name, website, country } = req.body;
        if (!brand_name || typeof brand_name !== "string" || !brand_name.trim()) {
            return res.status(400).json({ success: false, message: "Brand name is required." });
        }

        // Duplicate check against other brands
        const [existing] = await db.query("SELECT brand_id FROM BRAND WHERE LOWER(brand_name) = LOWER(?) AND brand_id != ?", [
            brand_name.trim(),
            brandId,
        ]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: "Another brand already uses this name." });
        }

        const [result] = await db.query(`
            UPDATE BRAND
            SET brand_name = ?, website = ?, country = ?
            WHERE brand_id = ?
        `, [
            brand_name.trim(),
            website || "",
            country || "",
            brandId,
        ]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Brand not found." });
        }

        return res.json({
            success: true,
            message: "Brand updated successfully.",
        });
    } catch (err) {
        console.error("Admin updateBrand error:", err.message);
        return res.status(500).json({ success: false, message: "Failed to update brand." });
    }
};

/**
 * DELETE /api/admin/brands/:id
 */
const deleteBrand = async (req, res) => {
    try {
        const brandId = Number(req.params.id);
        if (!brandId || brandId <= 0) {
            return res.status(400).json({ success: false, message: "Invalid brand ID." });
        }

        // Prevent deletion if products exist under brand
        const [prodCheck] = await db.query("SELECT COUNT(*) AS count FROM PRODUCT WHERE brand_id = ?", [brandId]);
        if (prodCheck[0].count > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete brand associated with ${prodCheck[0].count} active products.`,
            });
        }

        const [result] = await db.query("DELETE FROM BRAND WHERE brand_id = ?", [brandId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Brand not found." });
        }

        return res.json({
            success: true,
            message: "Brand deleted successfully.",
        });
    } catch (err) {
        console.error("Admin deleteBrand error:", err.message);
        return res.status(500).json({ success: false, message: "Failed to delete brand." });
    }
};

// ==============================================================================
// 6. Order Management
// ==============================================================================

/**
 * GET /api/admin/orders
 */
const getOrders = async (req, res) => {
    try {
        const { status, payment_status, payment_method, search, page = 1, limit = 20 } = req.query;

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, Math.min(parseInt(limit, 10) || 20, 100));
        const offset = (pageNum - 1) * limitNum;

        let query = `
            SELECT
                o.order_id,
                o.user_id,
                o.total_amount,
                o.status,
                o.payment_method,
                o.payment_status,
                o.shipping_street,
                o.shipping_city,
                o.shipping_state,
                o.shipping_pincode,
                o.created_at,
                o.updated_at,
                u.first_name,
                u.last_name,
                u.email,
                COUNT(oi.order_item_id) AS item_count,
                COALESCE(SUM(oi.quantity), 0) AS total_units
            FROM ORDERS o
            JOIN USER u ON o.user_id = u.user_id
            LEFT JOIN ORDER_ITEM oi ON o.order_id = oi.order_id
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            query += ` AND o.status = ?`;
            params.push(status);
        }
        if (payment_status) {
            query += ` AND o.payment_status = ?`;
            params.push(payment_status);
        }
        if (payment_method) {
            query += ` AND o.payment_method = ?`;
            params.push(payment_method);
        }
        if (search) {
            query += ` AND (o.order_id = ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)`;
            const term = `%${search.trim()}%`;
            params.push(Number(search) || 0, term, term, term);
        }

        query += ` GROUP BY o.order_id ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
        params.push(limitNum, offset);

        const [orders] = await db.query(query, params);

        // Get total count
        const [countResult] = await db.query("SELECT COUNT(*) AS total FROM ORDERS");

        return res.json({
            success: true,
            count: orders.length,
            total_orders: countResult[0].total,
            page: pageNum,
            orders: orders.map((o) => ({
                ...o,
                total_amount: Number(o.total_amount),
                total_units: Number(o.total_units),
                item_count: Number(o.item_count),
            })),
        });
    } catch (err) {
        console.error("Admin getOrders error:", err.message);
        return res.status(500).json({ success: false, message: "Failed to fetch orders." });
    }
};

/**
 * GET /api/admin/orders/:id
 */
const getOrderById = async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        if (!orderId || orderId <= 0) {
            return res.status(400).json({ success: false, message: "Invalid order ID." });
        }

        const [orders] = await db.query(`
            SELECT
                o.order_id,
                o.user_id,
                o.total_amount,
                o.status,
                o.payment_method,
                o.payment_status,
                o.shipping_street,
                o.shipping_city,
                o.shipping_state,
                o.shipping_pincode,
                o.created_at,
                o.updated_at,
                u.first_name,
                u.last_name,
                u.email
            FROM ORDERS o
            JOIN USER u ON o.user_id = u.user_id
            WHERE o.order_id = ?
        `, [orderId]);

        if (!orders.length) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        const [items] = await db.query(`
            SELECT
                oi.order_item_id,
                oi.order_id,
                oi.product_id,
                oi.variant_id,
                oi.quantity,
                oi.price_at_purchase,
                oi.subtotal,
                p.product_name,
                p.image_url,
                b.brand_name,
                c.category_name,
                pv.color,
                pv.size
            FROM ORDER_ITEM oi
            JOIN PRODUCT p ON oi.product_id = p.product_id
            JOIN BRAND b ON p.brand_id = b.brand_id
            JOIN CATEGORY c ON p.category_id = c.category_id
            JOIN PRODUCT_VARIANT pv ON oi.variant_id = pv.variant_id
            WHERE oi.order_id = ?
            ORDER BY oi.order_item_id ASC
        `, [orderId]);

        return res.json({
            success: true,
            order: {
                ...orders[0],
                total_amount: Number(orders[0].total_amount),
                items: items.map((it) => ({
                    ...it,
                    price_at_purchase: Number(it.price_at_purchase),
                    subtotal: Number(it.subtotal),
                })),
            },
        });
    } catch (err) {
        console.error("Admin getOrderById error:", err.message);
        return res.status(500).json({ success: false, message: "Failed to fetch order details." });
    }
};

/**
 * PUT /api/admin/orders/:id/status
 */
const updateOrderStatus = async (req, res) => {
    let connection;
    try {
        const orderId = Number(req.params.id);
        if (!orderId || orderId <= 0) {
            return res.status(400).json({ success: false, message: "Invalid order ID." });
        }

        const { status, payment_status, confirm_cod_collection } = req.body;
        const validStatuses = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];

        if (status !== undefined && !validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Status must be one of: ${validStatuses.join(", ")}`,
            });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Pessimistic Row Lock with SELECT ... FOR UPDATE
        // Guarantees serialization and prevents concurrent duplicate cancellations or race conditions
        const [current] = await connection.query(
            "SELECT order_id, status, payment_method, payment_status FROM ORDERS WHERE order_id = ? FOR UPDATE",
            [orderId]
        );

        if (!current.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        const currentStatus = current[0].status;
        const paymentMethod = current[0].payment_method;
        const currentPaymentStatus = current[0].payment_status;

        // Transition restrictions & Order State Machine:
        // 1. Cannot change a CANCELLED order (terminal state)
        if (currentStatus === "CANCELLED") {
            await connection.rollback();
            return res.status(400).json({ success: false, message: "Cannot change the status of an already cancelled order." });
        }

        // 2. Prevent cancellation if order is already SHIPPED or DELIVERED
        if (status === "CANCELLED" && ["SHIPPED", "DELIVERED"].includes(currentStatus)) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: `Cannot cancel an order that has already been ${currentStatus.toLowerCase()}. Use the return and refund workflow.`,
            });
        }

        // 3. Delivered orders cannot be reverted or cancelled
        if (currentStatus === "DELIVERED" && status && status !== "DELIVERED") {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "Delivered orders are final and cannot be reverted or cancelled.",
            });
        }

        // 4. Shipped orders cannot be reverted back to PENDING or PROCESSING
        if (currentStatus === "SHIPPED" && status && ["PENDING", "PROCESSING"].includes(status)) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: "Cannot revert a shipped order back to pending or processing.",
            });
        }

        // 5. COD Cash Collection Validation & Explicit Confirmation:
        // Marking an order DELIVERED does NOT automatically assume cash was collected.
        // Cash collection requires explicit admin confirmation (confirm_cod_collection: true or payment_status: 'PAID').
        const effectiveStatus = status || currentStatus;
        const isConfirmingCod = confirm_cod_collection === true || (payment_status === "PAID" && paymentMethod === "COD");

        if (paymentMethod === "COD" && isConfirmingCod) {
            if (currentPaymentStatus === "PAID") {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: "Cash collection for this COD order has already been confirmed.",
                });
            }
            if (effectiveStatus !== "DELIVERED") {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: "Cannot confirm cash collection for a Cash on Delivery (COD) order before delivery. The order must be DELIVERED first.",
                });
            }
        }

        // Build update statement
        const updates = ["updated_at = NOW()"];
        const updateParams = [];

        if (status) {
            updates.push("status = ?");
            updateParams.push(status);
        }

        if (paymentMethod === "COD") {
            if (isConfirmingCod) {
                updates.push("payment_status = 'PAID'");
            }
            // If delivering without explicit collection confirmation, payment_status stays as current (PENDING)
        } else if (payment_status) {
            updates.push("payment_status = ?");
            updateParams.push(payment_status);
        }

        updateParams.push(orderId);
        await connection.query(`UPDATE ORDERS SET ${updates.join(", ")} WHERE order_id = ?`, updateParams);

        // 6. Atomic Inventory Restoration:
        // Executed ONLY when cancelling from permitted states (PENDING or PROCESSING)
        // Since currentStatus === 'CANCELLED' is rejected above under row lock, inventory can NEVER be restored twice.
        if (status === "CANCELLED" && ["PENDING", "PROCESSING"].includes(currentStatus)) {
            const [items] = await connection.query(
                "SELECT variant_id, quantity FROM ORDER_ITEM WHERE order_id = ?",
                [orderId]
            );
            for (const it of items) {
                await connection.query(
                    "UPDATE PRODUCT_VARIANT SET stock_quantity = stock_quantity + ? WHERE variant_id = ?",
                    [it.quantity, it.variant_id]
                );
            }
        }

        await connection.commit();
        return res.json({
            success: true,
            message: `Order #${orderId} status successfully updated.`,
        });
    } catch (err) {
        if (connection) await connection.rollback().catch(() => {});
        console.error("Admin updateOrderStatus error:", err.message);
        return res.status(500).json({ success: false, message: "Failed to update order status." });
    } finally {
        if (connection) connection.release();
    }
};

// ==============================================================================
// 7. User Management
// ==============================================================================

/**
 * GET /api/admin/users
 */
const getUsers = async (req, res) => {
    try {
        const { search, role } = req.query;

        let query = `
            SELECT
                u.user_id,
                u.first_name,
                u.last_name,
                u.email,
                u.role,
                u.street,
                u.city,
                u.state,
                u.pincode,
                up.body_type,
                up.style_preferences,
                up.budget_range_max,
                up.preferred_brands,
                COALESCE(up.created_at, NOW()) AS created_at,
                COUNT(o.order_id) AS total_orders,
                COALESCE(SUM(CASE WHEN o.payment_status = 'PAID' AND o.status != 'CANCELLED' THEN o.total_amount ELSE 0 END), 0) AS lifetime_spend
            FROM USER u
            LEFT JOIN USER_PROFILE up ON u.user_id = up.user_id
            LEFT JOIN ORDERS o ON u.user_id = o.user_id
            WHERE 1=1
        `;
        const params = [];

        if (role) {
            query += ` AND u.role = ?`;
            params.push(role);
        }
        if (search) {
            query += ` AND (u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ? OR u.city LIKE ?)`;
            const term = `%${search.trim()}%`;
            params.push(term, term, term, term);
        }

        query += ` GROUP BY u.user_id ORDER BY u.user_id ASC`;

        const [users] = await db.query(query, params);

        return res.json({
            success: true,
            count: users.length,
            users: users.map((u) => ({
                ...u,
                lifetime_spend: Number(u.lifetime_spend),
                total_orders: Number(u.total_orders),
                budget_range_max: u.budget_range_max ? Number(u.budget_range_max) : null,
            })),
        });
    } catch (err) {
        console.error("Admin getUsers error:", err.message);
        return res.status(500).json({ success: false, message: "Failed to fetch users." });
    }
};

/**
 * GET /api/admin/users/:id
 */
const getUserById = async (req, res) => {
    try {
        const userId = Number(req.params.id);
        if (!userId || userId <= 0) {
            return res.status(400).json({ success: false, message: "Invalid user ID." });
        }

        const [users] = await db.query(`
            SELECT
                u.user_id,
                u.first_name,
                u.last_name,
                u.email,
                u.role,
                u.street,
                u.city,
                u.state,
                u.pincode,
                up.height,
                up.weight,
                up.body_type,
                up.style_preferences,
                up.budget_range_min,
                up.budget_range_max,
                up.preferred_brands,
                COALESCE(up.created_at, NOW()) AS created_at
            FROM USER u
            LEFT JOIN USER_PROFILE up ON u.user_id = up.user_id
            WHERE u.user_id = ?
        `, [userId]);

        if (!users.length) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const [orders] = await db.query(`
            SELECT
                order_id,
                total_amount,
                status,
                payment_method,
                payment_status,
                created_at
            FROM ORDERS
            WHERE user_id = ?
            ORDER BY created_at DESC
        `, [userId]);

        return res.json({
            success: true,
            user: {
                ...users[0],
                budget_range_min: users[0].budget_range_min ? Number(users[0].budget_range_min) : null,
                budget_range_max: users[0].budget_range_max ? Number(users[0].budget_range_max) : null,
                orders: orders.map((o) => ({
                    ...o,
                    total_amount: Number(o.total_amount),
                })),
            },
        });
    } catch (err) {
        console.error("Admin getUserById error:", err.message);
        return res.status(500).json({ success: false, message: "Failed to fetch user details." });
    }
};

/**
 * PUT /api/admin/users/:id/role
 */
const updateUserRole = async (req, res) => {
    try {
        const targetUserId = Number(req.params.id);
        const { role } = req.body;

        if (!targetUserId || targetUserId <= 0) {
            return res.status(400).json({ success: false, message: "Invalid user ID." });
        }
        if (!["USER", "ADMIN"].includes(role)) {
            return res.status(400).json({ success: false, message: "Role must be 'USER' or 'ADMIN'." });
        }

        // Safety Rule: Prevent removing the last administrator
        if (role === "USER") {
            const [adminCount] = await db.query("SELECT COUNT(*) AS count FROM USER WHERE role = 'ADMIN'");
            const [targetIsAdmin] = await db.query("SELECT role FROM USER WHERE user_id = ?", [targetUserId]);

            if (targetIsAdmin.length && targetIsAdmin[0].role === "ADMIN" && adminCount[0].count <= 1) {
                return res.status(400).json({
                    success: false,
                    message: "Cannot demote the last remaining administrator account.",
                });
            }
        }

        const [result] = await db.query("UPDATE USER SET role = ? WHERE user_id = ?", [role, targetUserId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        return res.json({
            success: true,
            message: `User #${targetUserId} role updated to ${role}.`,
        });
    } catch (err) {
        console.error("Admin updateUserRole error:", err.message);
        return res.status(500).json({ success: false, message: "Failed to update user role." });
    }
};

module.exports = {
    getDashboardStats,
    getAnalytics,
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    getVariants,
    createVariant,
    updateVariant,
    deleteVariant,
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getBrands,
    createBrand,
    updateBrand,
    deleteBrand,
    getOrders,
    getOrderById,
    updateOrderStatus,
    getUsers,
    getUserById,
    updateUserRole,
};
