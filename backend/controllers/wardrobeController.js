const db = require("../config/db");

const VALID_SEASONS = ["Summer", "Winter", "Monsoon", "All Season"];
const VALID_SOURCES = ["PURCHASED", "SAVED"];

// Helper: Ensure user has at least one default wardrobe
const ensureDefaultWardrobe = async (userId) => {
    const [existing] = await db.execute(
        `SELECT wardrobe_id, wardrobe_name, created_at
         FROM WARDROBE
         WHERE user_id = ?
         ORDER BY created_at ASC
         LIMIT 1`,
        [userId]
    );

    if (existing.length > 0) {
        return existing[0];
    }

    const [created] = await db.execute(
        `INSERT INTO WARDROBE (user_id, wardrobe_name)
         VALUES (?, 'My Wardrobe')`,
        [userId]
    );

    return {
        wardrobe_id: created.insertId,
        wardrobe_name: "My Wardrobe",
        created_at: new Date()
    };
};

// POST /api/wardrobes - Create a new wardrobe collection
const createWardrobe = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { wardrobe_name } = req.body;

        if (!wardrobe_name || typeof wardrobe_name !== "string" || !wardrobe_name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Wardrobe collection name is required."
            });
        }

        const trimmedName = wardrobe_name.trim();

        if (trimmedName.length > 100) {
            return res.status(400).json({
                success: false,
                message: "Wardrobe name cannot exceed 100 characters."
            });
        }

        // Check if a wardrobe with the same name already exists for this user
        const [existing] = await db.execute(
            `SELECT wardrobe_id FROM WARDROBE WHERE user_id = ? AND LOWER(wardrobe_name) = LOWER(?)`,
            [userId, trimmedName]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: `You already have a wardrobe collection named "${trimmedName}".`
            });
        }

        const [result] = await db.execute(
            `INSERT INTO WARDROBE (user_id, wardrobe_name)
             VALUES (?, ?)`,
            [userId, trimmedName]
        );

        return res.status(201).json({
            success: true,
            message: "Wardrobe collection created successfully",
            wardrobe: {
                wardrobe_id: result.insertId,
                wardrobe_name: trimmedName,
                user_id: userId,
                item_count: 0
            }
        });

    } catch (error) {
        console.error("Create wardrobe error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// GET /api/wardrobes - Get all wardrobes belonging to the logged-in user
const getUserWardrobes = async (req, res) => {
    try {
        const userId = req.user.user_id;

        // Auto-provision a default wardrobe if user has none
        await ensureDefaultWardrobe(userId);

        const [rows] = await db.execute(
            `SELECT
                w.wardrobe_id,
                w.wardrobe_name,
                w.created_at,
                COUNT(wi.wardrobe_item_id) AS item_count
             FROM WARDROBE w
             LEFT JOIN WARDROBE_ITEM wi ON w.wardrobe_id = wi.wardrobe_id
             WHERE w.user_id = ?
             GROUP BY w.wardrobe_id, w.wardrobe_name, w.created_at
             ORDER BY w.created_at ASC`,
            [userId]
        );

        return res.status(200).json({
            success: true,
            count: rows.length,
            wardrobes: rows.map(r => ({
                ...r,
                item_count: Number(r.item_count)
            }))
        });

    } catch (error) {
        console.error("Get wardrobes error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// GET /api/wardrobes/:wardrobe_id/items - Get rich items in a specific wardrobe with filters
const getWardrobeItems = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const wardrobeId = Number(req.params.wardrobe_id);

        if (!Number.isInteger(wardrobeId) || wardrobeId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid wardrobe ID provided."
            });
        }

        // Verify wardrobe ownership
        const [wardrobes] = await db.execute(
            `SELECT wardrobe_id, wardrobe_name
             FROM WARDROBE
             WHERE wardrobe_id = ? AND user_id = ?`,
            [wardrobeId, userId]
        );

        if (wardrobes.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Wardrobe not found or access denied."
            });
        }

        const wardrobe = wardrobes[0];

        // Build dynamic query with filters
        const { category_id, season, source_type } = req.query;
        const queryParams = [wardrobeId, userId];
        let filterClauses = "";

        if (category_id) {
            const catId = Number(category_id);
            if (Number.isInteger(catId) && catId > 0) {
                filterClauses += " AND p.category_id = ?";
                queryParams.push(catId);
            }
        }

        if (season) {
            if (VALID_SEASONS.includes(season)) {
                filterClauses += " AND wi.season = ?";
                queryParams.push(season);
            }
        }

        if (source_type) {
            const upperSource = source_type.toUpperCase();
            if (VALID_SOURCES.includes(upperSource)) {
                filterClauses += " AND wi.source_type = ?";
                queryParams.push(upperSource);
            }
        }

        const [items] = await db.execute(
            `SELECT
                wi.wardrobe_item_id,
                wi.wardrobe_id,
                wi.variant_id,
                wi.quantity,
                wi.season,
                wi.source_type,
                wi.date_added,
                pv.product_id,
                pv.color,
                pv.size,
                pv.stock_quantity,
                COALESCE(pv.price, p.price) AS price,
                p.product_name,
                p.description,
                p.image_url,
                p.category_id,
                c.category_name,
                p.brand_id,
                b.brand_name
             FROM WARDROBE_ITEM wi
             INNER JOIN WARDROBE w ON wi.wardrobe_id = w.wardrobe_id
             INNER JOIN PRODUCT_VARIANT pv ON wi.variant_id = pv.variant_id
             INNER JOIN PRODUCT p ON pv.product_id = p.product_id
             LEFT JOIN CATEGORY c ON p.category_id = c.category_id
             LEFT JOIN BRAND b ON p.brand_id = b.brand_id
             WHERE w.wardrobe_id = ?
               AND w.user_id = ?
               ${filterClauses}
             ORDER BY wi.date_added DESC`,
            queryParams
        );

        return res.status(200).json({
            success: true,
            wardrobe: {
                wardrobe_id: wardrobe.wardrobe_id,
                wardrobe_name: wardrobe.wardrobe_name
            },
            count: items.length,
            items
        });

    } catch (error) {
        console.error("Get wardrobe items error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// POST /api/wardrobes/items - Add a product variant to a wardrobe
const addWardrobeItem = async (req, res) => {
    try {
        const userId = req.user.user_id;
        let { wardrobe_id, product_id, variant_id, quantity, season, source_type } = req.body;

        const vId = Number(variant_id);
        if (!Number.isInteger(vId) || vId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid product variant ID is required."
            });
        }

        // Auto-resolve wardrobe if not provided
        let targetWardrobeId = wardrobe_id ? Number(wardrobe_id) : null;
        if (!targetWardrobeId) {
            const defaultWardrobe = await ensureDefaultWardrobe(userId);
            targetWardrobeId = defaultWardrobe.wardrobe_id;
        } else {
            // Verify wardrobe ownership
            const [wardrobes] = await db.execute(
                `SELECT wardrobe_id FROM WARDROBE WHERE wardrobe_id = ? AND user_id = ?`,
                [targetWardrobeId, userId]
            );

            if (wardrobes.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Wardrobe collection not found or access denied."
                });
            }
        }

        // Verify variant existence in catalog
        const [variants] = await db.execute(
            `SELECT pv.variant_id, pv.product_id, p.product_name, pv.color, pv.size
             FROM PRODUCT_VARIANT pv
             JOIN PRODUCT p ON pv.product_id = p.product_id
             WHERE pv.variant_id = ?`,
            [vId]
        );

        if (variants.length === 0) {
            return res.status(400).json({
                success: false,
                message: `Product variant #${vId} does not exist.`
            });
        }

        const variant = variants[0];

        // Verify product-to-variant relationship if product_id is supplied
        if (product_id !== undefined && product_id !== null) {
            const pId = Number(product_id);
            if (!Number.isInteger(pId) || pId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid product ID provided."
                });
            }
            if (variant.product_id !== pId) {
                return res.status(400).json({
                    success: false,
                    message: `Product variant #${vId} does not belong to product #${pId}.`
                });
            }
        }

        // Validate quantity
        const qty = quantity ? Number(quantity) : 1;
        if (!Number.isInteger(qty) || qty <= 0 || qty > 50) {
            return res.status(400).json({
                success: false,
                message: "Quantity must be a positive integer between 1 and 50."
            });
        }

        // Validate season
        const selectedSeason = season || "All Season";
        if (!VALID_SEASONS.includes(selectedSeason)) {
            return res.status(400).json({
                success: false,
                message: `Invalid season. Allowed values: ${VALID_SEASONS.join(", ")}.`
            });
        }

        // Security check: normal manual additions must be SAVED.
        // Users cannot forge PURCHASED status; that is strictly reserved for verified order-import.
        if (source_type) {
            const upper = source_type.toUpperCase();
            if (upper === "PURCHASED") {
                return res.status(403).json({
                    success: false,
                    message: "Items cannot be manually marked as 'PURCHASED'. Purchased items can only be synchronized via verified order import."
                });
            }
            if (upper !== "SAVED") {
                return res.status(400).json({
                    success: false,
                    message: "Invalid source type. Manual wardrobe additions only support 'SAVED'."
                });
            }
        }
        const selectedSource = "SAVED";

        // Duplicate check: prevent duplicate variant in the same wardrobe
        const [existingItem] = await db.execute(
            `SELECT wardrobe_item_id FROM WARDROBE_ITEM WHERE wardrobe_id = ? AND variant_id = ?`,
            [targetWardrobeId, vId]
        );

        if (existingItem.length > 0) {
            return res.status(409).json({
                success: false,
                message: `"${variant.product_name}" (${variant.color}, Size ${variant.size}) is already in this wardrobe collection.`
            });
        }

        const [result] = await db.execute(
            `INSERT INTO WARDROBE_ITEM
                (wardrobe_id, variant_id, quantity, season, source_type)
             VALUES (?, ?, ?, ?, ?)`,
            [targetWardrobeId, vId, qty, selectedSeason, selectedSource]
        );

        return res.status(201).json({
            success: true,
            message: `Added "${variant.product_name}" to your wardrobe.`,
            wardrobe_item_id: result.insertId,
            wardrobe_id: targetWardrobeId,
            variant_id: vId,
            season: selectedSeason,
            source_type: selectedSource
        });

    } catch (error) {
        console.error("Add wardrobe item error:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                success: false,
                message: "This item is already in your wardrobe."
            });
        }
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// DELETE /api/wardrobes/items/:wardrobe_item_id - Remove an item from wardrobe
const removeWardrobeItem = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const itemId = Number(req.params.wardrobe_item_id);

        if (!Number.isInteger(itemId) || itemId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid wardrobe item ID."
            });
        }

        const [result] = await db.execute(
            `DELETE wi
             FROM WARDROBE_ITEM wi
             INNER JOIN WARDROBE w ON wi.wardrobe_id = w.wardrobe_id
             WHERE wi.wardrobe_item_id = ?
               AND w.user_id = ?`,
            [itemId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Wardrobe item not found or you do not have permission to remove it."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Item removed from wardrobe successfully."
        });

    } catch (error) {
        console.error("Remove wardrobe item error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// POST /api/wardrobes/items/from-order/:order_id - Add all items from a purchased order into wardrobe
const addOrderItemsToWardrobe = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const orderId = Number(req.params.order_id);

        if (!Number.isInteger(orderId) || orderId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid order ID."
            });
        }

        // Verify order ownership
        const [orders] = await db.execute(
            `SELECT order_id FROM \`orders\` WHERE order_id = ? AND user_id = ?`,
            [orderId, userId]
        );

        if (orders.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Order not found."
            });
        }

        // Fetch order items
        const [orderItems] = await db.execute(
            `SELECT variant_id, quantity FROM \`order_item\` WHERE order_id = ?`,
            [orderId]
        );

        if (orderItems.length === 0) {
            return res.status(400).json({
                success: false,
                message: "This order contains no items to add."
            });
        }

        // Resolve target wardrobe
        let targetWardrobeId = req.body?.wardrobe_id ? Number(req.body.wardrobe_id) : null;
        if (!targetWardrobeId) {
            const defaultWardrobe = await ensureDefaultWardrobe(userId);
            targetWardrobeId = defaultWardrobe.wardrobe_id;
        } else {
            const [wardrobes] = await db.execute(
                `SELECT wardrobe_id FROM WARDROBE WHERE wardrobe_id = ? AND user_id = ?`,
                [targetWardrobeId, userId]
            );
            if (wardrobes.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Selected wardrobe not found."
                });
            }
        }

        let addedCount = 0;
        for (const item of orderItems) {
            try {
                const [insertResult] = await db.execute(
                    `INSERT INTO WARDROBE_ITEM
                        (wardrobe_id, variant_id, quantity, season, source_type)
                     VALUES (?, ?, ?, 'All Season', 'PURCHASED')
                     ON DUPLICATE KEY UPDATE source_type = 'PURCHASED'`,
                    [targetWardrobeId, item.variant_id, item.quantity]
                );
                if (insertResult.affectedRows > 0) {
                    addedCount++;
                }
            } catch (itemErr) {
                console.warn(`Failed to insert variant #${item.variant_id} into wardrobe:`, itemErr.message);
            }
        }

        return res.status(200).json({
            success: true,
            message: `Successfully synchronized ${addedCount} purchased item(s) to your wardrobe.`,
            added_count: addedCount,
            wardrobe_id: targetWardrobeId
        });

    } catch (error) {
        console.error("Add order items to wardrobe error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

module.exports = {
    createWardrobe,
    getUserWardrobes,
    getWardrobeItems,
    addWardrobeItem,
    removeWardrobeItem,
    addOrderItemsToWardrobe
};
