const db = require("../config/db");

// Tracking sets for concurrency locking and recent successful order debouncing
const activeUserOrders = new Set();
const recentSuccessfulOrders = new Map();

// POST /api/orders - Place a new order with atomic transaction & stock deduction
const createOrder = async (req, res) => {
    const userId = req.user.user_id;

    // Guard 1: Prevent concurrent submissions in-flight for the same user
    if (activeUserOrders.has(userId)) {
        return res.status(429).json({
            success: false,
            message: "An order submission is already in progress. Please wait a moment."
        });
    }

    // Guard 2: Prevent rapid duplicate successful submissions (within 3 seconds)
    const now = Date.now();
    const lastOrderTime = recentSuccessfulOrders.get(userId);
    if (lastOrderTime && (now - lastOrderTime) < 3000) {
        return res.status(429).json({
            success: false,
            message: "A recent order was just placed. Please wait a moment before submitting again."
        });
    }

    activeUserOrders.add(userId);
    let connection;
    try {
        const { items, shipping_address, payment_method } = req.body;

        // 1. Validate request payload
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Cart items are required to place an order."
            });
        }

        for (const item of items) {
            const vId = Number(item.variant_id);
            const qty = Number(item.quantity);

            if (!Number.isInteger(vId) || vId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid product variant ID provided."
                });
            }

            if (!Number.isInteger(qty) || qty <= 0 || qty > 50) {
                return res.status(400).json({
                    success: false,
                    message: "Item quantity must be a positive integer between 1 and 50."
                });
            }

            if (item.product_id !== undefined && item.product_id !== null) {
                const pId = Number(item.product_id);
                if (!Number.isInteger(pId) || pId <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid product ID provided."
                    });
                }
            }
        }

        // Validate shipping address
        if (
            !shipping_address ||
            typeof shipping_address !== "object" ||
            typeof shipping_address.street !== "string" || !shipping_address.street.trim() ||
            typeof shipping_address.city !== "string" || !shipping_address.city.trim() ||
            typeof shipping_address.state !== "string" || !shipping_address.state.trim() ||
            typeof shipping_address.pincode !== "string" || !shipping_address.pincode.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "A complete shipping address (street, city, state, pincode) is required."
            });
        }

        const allowedPaymentMethods = ["COD", "SIMULATED_CARD"];
        if (payment_method && !allowedPaymentMethods.includes(payment_method)) {
            return res.status(400).json({
                success: false,
                message: `Invalid payment method. Allowed methods: ${allowedPaymentMethods.join(", ")}.`
            });
        }
        const selectedPayment = payment_method || "COD";

        const initialStatus = selectedPayment === "SIMULATED_CARD" ? "PROCESSING" : "PENDING";
        const initialPaymentStatus = selectedPayment === "SIMULATED_CARD" ? "PAID" : "PENDING";

        // Get DB connection for transaction
        connection = await db.getConnection();

        // 2. Start atomic database transaction
        await connection.beginTransaction();

        // 3. Lock inventory rows using SELECT ... FOR UPDATE
        const uniqueVariantIds = Array.from(new Set(items.map((item) => Number(item.variant_id))));
        const placeholders = uniqueVariantIds.map(() => "?").join(",");

        const [lockedVariants] = await connection.query(
            `SELECT
                pv.variant_id,
                pv.product_id,
                pv.stock_quantity,
                COALESCE(pv.price, p.price) AS price,
                p.product_name,
                pv.color,
                pv.size
             FROM PRODUCT_VARIANT pv
             JOIN PRODUCT p ON pv.product_id = p.product_id
             WHERE pv.variant_id IN (${placeholders})
             FOR UPDATE`,
            uniqueVariantIds
        );

        const variantMap = new Map(lockedVariants.map((v) => [v.variant_id, v]));

        // Check cumulative quantity per variant to prevent duplicate-item stock bypass
        const requestedQuantityPerVariant = new Map();
        for (const item of items) {
            const vId = Number(item.variant_id);
            const qty = Number(item.quantity);
            const currentTotal = requestedQuantityPerVariant.get(vId) || 0;
            requestedQuantityPerVariant.set(vId, currentTotal + qty);
        }

        for (const [vId, totalRequested] of requestedQuantityPerVariant.entries()) {
            const variant = variantMap.get(vId);
            if (!variant) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Product variant #${vId} is invalid or no longer available.`
                });
            }
            if (variant.stock_quantity < totalRequested) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for "${variant.product_name}" (${variant.color}, Size ${variant.size}). Requested: ${totalRequested}, Available: ${variant.stock_quantity}`
                });
            }
        }

        // 4. Verify product relationship and calculate verified totals server-side
        let verifiedTotalAmount = 0;
        const verifiedItems = [];

        for (const reqItem of items) {
            const vId = Number(reqItem.variant_id);
            const variant = variantMap.get(vId);

            // Cross-check: variant must belong to submitted product_id if provided
            if (reqItem.product_id !== undefined && reqItem.product_id !== null) {
                const reqPId = Number(reqItem.product_id);
                if (variant.product_id !== reqPId) {
                    await connection.rollback();
                    return res.status(400).json({
                        success: false,
                        message: `Product variant #${vId} does not belong to product #${reqPId}.`
                    });
                }
            }

            const unitPrice = Number(variant.price);
            const itemSubtotal = Math.round(unitPrice * reqItem.quantity * 100) / 100;
            verifiedTotalAmount = Math.round((verifiedTotalAmount + itemSubtotal) * 100) / 100;

            verifiedItems.push({
                product_id: variant.product_id,
                variant_id: variant.variant_id,
                product_name: variant.product_name,
                color: variant.color,
                size: variant.size,
                quantity: reqItem.quantity,
                price_at_purchase: unitPrice,
                subtotal: itemSubtotal
            });
        }

        // 5. Insert order record with shipping snapshot
        const [orderResult] = await connection.execute(
            `INSERT INTO \`orders\`
                (user_id, total_amount, status, payment_method, payment_status,
                 shipping_street, shipping_city, shipping_state, shipping_pincode)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                verifiedTotalAmount,
                initialStatus,
                selectedPayment,
                initialPaymentStatus,
                shipping_address.street.trim(),
                shipping_address.city.trim(),
                shipping_address.state.trim(),
                shipping_address.pincode.trim()
            ]
        );

        const orderId = orderResult.insertId;

        // 6. Insert order items and decrement stock atomically
        for (const item of verifiedItems) {
            await connection.execute(
                `INSERT INTO \`order_item\`
                    (order_id, product_id, variant_id, quantity, price_at_purchase, subtotal)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    orderId,
                    item.product_id,
                    item.variant_id,
                    item.quantity,
                    item.price_at_purchase,
                    item.subtotal
                ]
            );

            const [updateResult] = await connection.execute(
                `UPDATE PRODUCT_VARIANT
                 SET stock_quantity = stock_quantity - ?
                 WHERE variant_id = ? AND stock_quantity >= ?`,
                [item.quantity, item.variant_id, item.quantity]
            );

            if (updateResult.affectedRows === 0) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Inventory change conflict for "${item.product_name}". Please try again.`
                });
            }
        }

        // 7. Commit transaction
        await connection.commit();

        // Record successful order timestamp for debounce protection
        recentSuccessfulOrders.set(userId, Date.now());

        // 8. Record PURCHASE telemetry in user_interaction
        for (const item of verifiedItems) {
            try {
                await db.execute(
                    `INSERT INTO USER_INTERACTION
                        (user_id, product_id, variant_id, interaction_type)
                     VALUES (?, ?, ?, 'PURCHASE')`,
                    [userId, item.product_id, item.variant_id]
                );
            } catch (interactionError) {
                console.warn("Failed to record purchase interaction:", interactionError.message);
            }
        }

        return res.status(201).json({
            success: true,
            message: "Order placed successfully",
            order: {
                order_id: orderId,
                total_amount: verifiedTotalAmount,
                status: initialStatus,
                payment_method: selectedPayment,
                payment_status: initialPaymentStatus,
                items: verifiedItems,
                shipping_address
            }
        });

    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rbErr) {
                console.error("Rollback error:", rbErr);
            }
        }
        console.error("Order creation error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to place order. Database transaction was rolled back."
        });
    } finally {
        activeUserOrders.delete(userId);
        if (connection) {
            connection.release();
        }
    }
};

// GET /api/orders - Get logged-in user's order history
const getUserOrders = async (req, res) => {
    try {
        const userId = req.user.user_id;

        // Fetch user orders
        const [orders] = await db.execute(
            `SELECT
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
                o.updated_at
             FROM \`orders\` o
             WHERE o.user_id = ?
             ORDER BY o.created_at DESC`,
            [userId]
        );

        if (orders.length === 0) {
            return res.status(200).json({
                success: true,
                count: 0,
                orders: []
            });
        }

        // Fetch items for all user orders
        const orderIds = orders.map((o) => o.order_id);
        const placeholders = orderIds.map(() => "?").join(",");

        const [items] = await db.query(
            `SELECT
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
                pv.color,
                pv.size
             FROM \`order_item\` oi
             JOIN \`product\` p ON oi.product_id = p.product_id
             LEFT JOIN \`brand\` b ON p.brand_id = b.brand_id
             LEFT JOIN \`product_variant\` pv ON oi.variant_id = pv.variant_id
             WHERE oi.order_id IN (${placeholders})
             ORDER BY oi.order_item_id ASC`,
            orderIds
        );

        // Group items by order_id
        const itemsByOrderId = new Map();
        for (const item of items) {
            if (!itemsByOrderId.has(item.order_id)) {
                itemsByOrderId.set(item.order_id, []);
            }
            itemsByOrderId.get(item.order_id).push(item);
        }

        const enrichedOrders = orders.map((o) => ({
            ...o,
            items: itemsByOrderId.get(o.order_id) || []
        }));

        return res.status(200).json({
            success: true,
            count: enrichedOrders.length,
            orders: enrichedOrders
        });

    } catch (error) {
        console.error("Get user orders error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// GET /api/orders/:id - Get specific order details with strict ownership verification
const getOrderById = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const userRole = req.user.role;
        const orderId = Number(req.params.id);

        if (!Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID"
            });
        }

        const [orders] = await db.execute(
            `SELECT * FROM \`orders\` WHERE order_id = ?`,
            [orderId]
        );

        if (orders.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        const order = orders[0];

        // Enforce ownership: only the owner or an ADMIN can view this order
        if (order.user_id !== userId && userRole !== "ADMIN") {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        // Fetch detailed order items
        const [items] = await db.execute(
            `SELECT
                oi.order_item_id,
                oi.order_id,
                oi.product_id,
                oi.variant_id,
                oi.quantity,
                oi.price_at_purchase,
                oi.subtotal,
                p.product_name,
                p.image_url,
                p.description,
                b.brand_name,
                pv.color,
                pv.size
             FROM \`order_item\` oi
             JOIN \`product\` p ON oi.product_id = p.product_id
             LEFT JOIN \`brand\` b ON p.brand_id = b.brand_id
             LEFT JOIN \`product_variant\` pv ON oi.variant_id = pv.variant_id
             WHERE oi.order_id = ?
             ORDER BY oi.order_item_id ASC`,
            [orderId]
        );

        return res.status(200).json({
            success: true,
            order: {
                ...order,
                items
            }
        });

    } catch (error) {
        console.error("Get order by ID error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

module.exports = {
    createOrder,
    getUserOrders,
    getOrderById
};
