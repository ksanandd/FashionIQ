const db = require("../config/db");

// Category group to outfit role mapping
const ROLE_TAXONOMY = {
    Top: ["tops", "t-shirts", "t-shirt", "shirts", "shirt", "polos", "polo", "tanks", "tank", "tee"],
    Bottom: ["bottoms", "pants", "track pants", "jeans", "trousers", "shorts", "skirts", "skirt", "leggings"],
    Outerwear: ["outerwear", "jackets", "jacket", "coats", "coat", "hoodies", "hoodie", "blazers", "blazer", "sweaters"],
    Shoes: ["footwear", "shoes", "sneakers", "boots", "sandals"],
    Accessory: ["accessories", "bags", "belts", "caps", "hats", "watches"],
};

function getClothingRole(categoryName) {
    const cat = (categoryName || "").toLowerCase().trim();
    for (const [role, keywords] of Object.entries(ROLE_TAXONOMY)) {
        if (keywords.includes(cat) || keywords.some((kw) => cat.includes(kw))) {
            return role;
        }
    }
    return "Other";
}

/**
 * Fallback SQL-based personalized outfit generator when AI microservice is offline.
 */
const getPersonalizedOutfitsFallback = async (userId, { occasion, season, budgetMax, limit = 5 } = {}) => {
    try {
        const safeLimit = Math.max(1, Math.min(Number(limit) || 5, 20));

        // 1. Fetch user budget if not specified
        let effectiveBudget = budgetMax ? Number(budgetMax) : null;
        if (!effectiveBudget && userId) {
            const [profile] = await db.query(
                `SELECT budget_range_max FROM USER_PROFILE WHERE user_id = ?`,
                [userId]
            );
            if (profile.length > 0 && profile[0].budget_range_max) {
                effectiveBudget = Number(profile[0].budget_range_max);
            }
        }

        // 2. Fetch active products with in-stock variants
        const [products] = await db.query(`
            SELECT
                p.product_id,
                p.product_name,
                p.price,
                p.gender,
                p.image_url,
                c.category_name,
                b.brand_name,
                pv.variant_id,
                pv.color,
                pv.size,
                pv.stock_quantity,
                COALESCE(pv.price, p.price) AS variant_price
            FROM PRODUCT p
            JOIN CATEGORY c ON p.category_id = c.category_id
            JOIN BRAND b ON p.brand_id = b.brand_id
            JOIN PRODUCT_VARIANT pv ON p.product_id = pv.product_id
            WHERE pv.stock_quantity > 0
            AND p.product_id NOT IN (
                SELECT product_id FROM USER_INTERACTION WHERE user_id = ? AND interaction_type = 'DISLIKE'
            )
            ORDER BY p.product_id ASC, pv.variant_id ASC
        `, [userId || 0]);

        if (!products.length) return [];

        const tops = products.filter((p) => getClothingRole(p.category_name) === "Top");
        const bottoms = products.filter((p) => getClothingRole(p.category_name) === "Bottom");
        const outerwear = products.filter((p) => getClothingRole(p.category_name) === "Outerwear");

        if (!tops.length || !bottoms.length) return [];

        const outfits = [];

        // Build 2-piece outfits (Top + Bottom)
        for (const t of tops) {
            for (const b of bottoms) {
                const totalPrice = Number(t.variant_price) + Number(b.variant_price);
                if (effectiveBudget && effectiveBudget > 0 && totalPrice > effectiveBudget) {
                    continue;
                }

                outfits.push({
                    outfit_name: `${t.brand_name} & ${b.brand_name} Coordinated Look`,
                    occasion: occasion || "Casual",
                    season: season || "All Season",
                    match_score: 0.88,
                    color_score: 0.90,
                    color_rationale: `Harmonious pairing of ${t.color} Top with ${b.color} Bottom`,
                    description: `Classic styling pairing ${t.product_name} (${t.color}) with ${b.product_name} (${b.color}).`,
                    total_retail_price: totalPrice,
                    purchase_price: totalPrice,
                    owned_savings: 0.0,
                    owned_items_count: 0,
                    items_count: 2,
                    items: [
                        {
                            sequence: 1,
                            role: "Top",
                            product_id: t.product_id,
                            product_name: t.product_name,
                            brand_name: t.brand_name,
                            category_name: t.category_name,
                            gender: t.gender,
                            variant_id: t.variant_id,
                            color: t.color,
                            size: t.size,
                            image_url: t.image_url,
                            price: Number(t.variant_price),
                            is_owned: false,
                        },
                        {
                            sequence: 2,
                            role: "Bottom",
                            product_id: b.product_id,
                            product_name: b.product_name,
                            brand_name: b.brand_name,
                            category_name: b.category_name,
                            gender: b.gender,
                            variant_id: b.variant_id,
                            color: b.color,
                            size: b.size,
                            image_url: b.image_url,
                            price: Number(b.variant_price),
                            is_owned: false,
                        },
                    ],
                });

                if (outfits.length >= safeLimit) break;
            }
            if (outfits.length >= safeLimit) break;
        }

        return outfits;
    } catch (err) {
        console.error("Personalized outfits fallback error:", err.message);
        return [];
    }
};

/**
 * Fallback SQL-based wardrobe-first outfit generator when AI microservice is offline.
 */
const getWardrobeOutfitsFallback = async (userId, { occasion, season, budgetMax, limit = 5 } = {}) => {
    try {
        const safeLimit = Math.max(1, Math.min(Number(limit) || 5, 20));

        // 1. Fetch user wardrobe items
        const [wardrobe] = await db.query(`
            SELECT
                wi.wardrobe_item_id,
                wi.variant_id,
                wi.season,
                pv.product_id,
                pv.color,
                pv.size,
                p.product_name,
                c.category_name,
                b.brand_name,
                p.gender,
                p.price,
                COALESCE(pv.price, p.price) AS variant_price,
                p.image_url
            FROM WARDROBE_ITEM wi
            JOIN WARDROBE w ON wi.wardrobe_id = w.wardrobe_id
            JOIN PRODUCT_VARIANT pv ON wi.variant_id = pv.variant_id
            JOIN PRODUCT p ON pv.product_id = p.product_id
            JOIN CATEGORY c ON p.category_id = c.category_id
            JOIN BRAND b ON p.brand_id = b.brand_id
            WHERE w.user_id = ?
            ORDER BY wi.date_added DESC
        `, [userId]);

        if (!wardrobe.length) {
            return getPersonalizedOutfitsFallback(userId, { occasion, season, budgetMax, limit });
        }

        const ownedVariantIds = new Set(wardrobe.map((w) => w.variant_id));
        const ownedTops = wardrobe.filter((w) => getClothingRole(w.category_name) === "Top");
        const ownedBottoms = wardrobe.filter((w) => getClothingRole(w.category_name) === "Bottom");

        const outfits = [];

        // Strategy A: 100% Wardrobe Outfit
        for (const t of ownedTops) {
            for (const b of ownedBottoms) {
                const totalValue = Number(t.variant_price) + Number(b.variant_price);
                outfits.push({
                    outfit_name: `Wardrobe Look: ${t.brand_name} & ${b.brand_name}`,
                    occasion: occasion || "Casual",
                    season: season || "All Season",
                    match_score: 0.95,
                    color_score: 0.92,
                    color_rationale: `Harmonious pairing of your ${t.color} Top with ${b.color} Bottom`,
                    description: `Complete outfit styled entirely from your Digital Wardrobe (₹0 new purchase).`,
                    total_retail_price: totalValue,
                    purchase_price: 0.0,
                    owned_savings: totalValue,
                    owned_items_count: 2,
                    items_count: 2,
                    items: [
                        {
                            sequence: 1,
                            role: "Top",
                            product_id: t.product_id,
                            product_name: t.product_name,
                            brand_name: t.brand_name,
                            category_name: t.category_name,
                            gender: t.gender,
                            variant_id: t.variant_id,
                            color: t.color,
                            size: t.size,
                            image_url: t.image_url,
                            price: Number(t.variant_price),
                            is_owned: true,
                        },
                        {
                            sequence: 2,
                            role: "Bottom",
                            product_id: b.product_id,
                            product_name: b.product_name,
                            brand_name: b.brand_name,
                            category_name: b.category_name,
                            gender: b.gender,
                            variant_id: b.variant_id,
                            color: b.color,
                            size: b.size,
                            image_url: b.image_url,
                            price: Number(b.variant_price),
                            is_owned: true,
                        },
                    ],
                });
            }
        }

        // Strategy B: Mixed Outfit (Owned Top + Suggested Catalog Bottom)
        const [catalogBottoms] = await db.query(`
            SELECT
                p.product_id, p.product_name, p.gender, p.image_url,
                c.category_name, b.brand_name,
                pv.variant_id, pv.color, pv.size,
                COALESCE(pv.price, p.price) AS variant_price
            FROM PRODUCT p
            JOIN CATEGORY c ON p.category_id = c.category_id
            JOIN BRAND b ON p.brand_id = b.brand_id
            JOIN PRODUCT_VARIANT pv ON p.product_id = pv.product_id
            WHERE pv.stock_quantity > 0
        `);

        const unownedBottoms = catalogBottoms.filter(
            (b) => getClothingRole(b.category_name) === "Bottom" && !ownedVariantIds.has(b.variant_id)
        );

        for (const t of ownedTops) {
            for (const b of unownedBottoms) {
                const buyPrice = Number(b.variant_price);
                if (budgetMax && budgetMax > 0 && buyPrice > budgetMax) continue;

                const totalValue = Number(t.variant_price) + buyPrice;
                outfits.push({
                    outfit_name: `Style with ${b.brand_name} ${b.product_name}`,
                    occasion: occasion || "Casual",
                    season: season || "All Season",
                    match_score: 0.89,
                    color_score: 0.88,
                    color_rationale: `Clean pairing of your ${t.color} Top with ${b.color} Bottom`,
                    description: `Pair your owned ${t.product_name} with matching ${b.brand_name} ${b.product_name}.`,
                    total_retail_price: totalValue,
                    purchase_price: buyPrice,
                    owned_savings: Number(t.variant_price),
                    owned_items_count: 1,
                    items_count: 2,
                    items: [
                        {
                            sequence: 1,
                            role: "Top",
                            product_id: t.product_id,
                            product_name: t.product_name,
                            brand_name: t.brand_name,
                            category_name: t.category_name,
                            gender: t.gender,
                            variant_id: t.variant_id,
                            color: t.color,
                            size: t.size,
                            image_url: t.image_url,
                            price: Number(t.variant_price),
                            is_owned: true,
                        },
                        {
                            sequence: 2,
                            role: "Bottom",
                            product_id: b.product_id,
                            product_name: b.product_name,
                            brand_name: b.brand_name,
                            category_name: b.category_name,
                            gender: b.gender,
                            variant_id: b.variant_id,
                            color: b.color,
                            size: b.size,
                            image_url: b.image_url,
                            price: buyPrice,
                            is_owned: false,
                        },
                    ],
                });

                if (outfits.length >= safeLimit) break;
            }
            if (outfits.length >= safeLimit) break;
        }

        return outfits.slice(0, safeLimit);
    } catch (err) {
        console.error("Wardrobe outfits fallback error:", err.message);
        return [];
    }
};

/**
 * Fallback for single product 'Complete the Look'.
 */
const getProductOutfitsFallback = async (productId, { limit = 4 } = {}) => {
    try {
        const safeLimit = Math.max(1, Math.min(Number(limit) || 4, 10));

        const [prods] = await db.query(`
            SELECT
                p.product_id, p.product_name, p.gender, p.image_url,
                c.category_name, b.brand_name,
                pv.variant_id, pv.color, pv.size,
                COALESCE(pv.price, p.price) AS variant_price
            FROM PRODUCT p
            JOIN CATEGORY c ON p.category_id = c.category_id
            JOIN BRAND b ON p.brand_id = b.brand_id
            JOIN PRODUCT_VARIANT pv ON p.product_id = pv.product_id
            WHERE pv.stock_quantity > 0
            ORDER BY p.product_id ASC
        `);

        const anchorItem = prods.find((p) => p.product_id === Number(productId));
        if (!anchorItem) return [];

        const anchorRole = getClothingRole(anchorItem.category_name);
        const complements = prods.filter((p) => {
            if (p.product_id === Number(productId)) return false;
            const r = getClothingRole(p.category_name);
            if (anchorRole === "Top") return r === "Bottom" || r === "Outerwear";
            if (anchorRole === "Bottom") return r === "Top" || r === "Outerwear";
            return r === "Top" || r === "Bottom";
        });

        const outfits = [];
        for (const comp of complements) {
            const totalPrice = Number(anchorItem.variant_price) + Number(comp.variant_price);
            outfits.push({
                outfit_name: `Complete the Look with ${comp.product_name}`,
                occasion: "Casual",
                season: "All Season",
                match_score: 0.88,
                color_score: 0.90,
                color_rationale: `Pairing ${anchorItem.color} with ${comp.color}`,
                description: `Styled ensemble pairing ${anchorItem.product_name} with ${comp.product_name}.`,
                total_retail_price: totalPrice,
                purchase_price: totalPrice,
                owned_savings: 0.0,
                owned_items_count: 0,
                items_count: 2,
                items: [
                    {
                        sequence: 1,
                        role: anchorRole,
                        product_id: anchorItem.product_id,
                        product_name: anchorItem.product_name,
                        brand_name: anchorItem.brand_name,
                        category_name: anchorItem.category_name,
                        gender: anchorItem.gender,
                        variant_id: anchorItem.variant_id,
                        color: anchorItem.color,
                        size: anchorItem.size,
                        image_url: anchorItem.image_url,
                        price: Number(anchorItem.variant_price),
                        is_owned: false,
                    },
                    {
                        sequence: 2,
                        role: getClothingRole(comp.category_name),
                        product_id: comp.product_id,
                        product_name: comp.product_name,
                        brand_name: comp.brand_name,
                        category_name: comp.category_name,
                        gender: comp.gender,
                        variant_id: comp.variant_id,
                        color: comp.color,
                        size: comp.size,
                        image_url: comp.image_url,
                        price: Number(comp.variant_price),
                        is_owned: false,
                    },
                ],
            });
            if (outfits.length >= safeLimit) break;
        }

        return outfits;
    } catch (err) {
        console.error("Product outfit fallback error:", err.message);
        return [];
    }
};

/**
 * Save user outfit directly to MySQL.
 */
const saveUserOutfit = async (userId, { outfit_name, occasion, season, total_price, description, items }) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [result] = await connection.query(`
            INSERT INTO OUTFIT (user_id, outfit_name, occasion, season, total_price, description, is_generated)
            VALUES (?, ?, ?, ?, ?, ?, 1)
        `, [
            userId,
            outfit_name,
            occasion || "Casual",
            season || "All Season",
            total_price || 0.0,
            description || "",
        ]);

        const outfitId = result.insertId;

        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            await connection.query(`
                INSERT INTO OUTFIT_ITEM (outfit_id, variant_id, role, sequence, is_owned, price)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                outfitId,
                it.variant_id,
                it.role,
                i + 1,
                it.is_owned ? 1 : 0,
                it.price || 0.0,
            ]);
        }

        await connection.commit();
        return outfitId;
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
};

/**
 * Retrieve saved outfits for a specific user from MySQL.
 */
const getUserSavedOutfits = async (userId) => {
    try {
        const [outfits] = await db.query(`
            SELECT
                outfit_id,
                user_id,
                outfit_name,
                occasion,
                season,
                total_price,
                description,
                is_generated,
                created_at
            FROM OUTFIT
            WHERE user_id = ?
            ORDER BY created_at DESC
        `, [userId]);

        if (!outfits.length) return [];

        const outfitIds = outfits.map((o) => o.outfit_id);
        const [items] = await db.query(`
            SELECT
                oi.outfit_item_id,
                oi.outfit_id,
                oi.variant_id,
                oi.role,
                oi.sequence,
                oi.is_owned,
                oi.price,
                pv.product_id,
                pv.color,
                pv.size,
                p.product_name,
                p.image_url,
                b.brand_name,
                c.category_name
            FROM OUTFIT_ITEM oi
            JOIN PRODUCT_VARIANT pv ON oi.variant_id = pv.variant_id
            JOIN PRODUCT p ON pv.product_id = p.product_id
            JOIN BRAND b ON p.brand_id = b.brand_id
            JOIN CATEGORY c ON p.category_id = c.category_id
            WHERE oi.outfit_id IN (?)
            ORDER BY oi.outfit_id, COALESCE(oi.sequence, 99)
        `, [outfitIds]);

        const itemsMap = {};
        for (const it of items) {
            if (!itemsMap[it.outfit_id]) itemsMap[it.outfit_id] = [];
            itemsMap[it.outfit_id].push({
                outfit_item_id: it.outfit_item_id,
                variant_id: it.variant_id,
                product_id: it.product_id,
                product_name: it.product_name,
                brand_name: it.brand_name,
                category_name: it.category_name,
                role: it.role,
                color: it.color,
                size: it.size,
                image_url: it.image_url,
                price: Number(it.price),
                is_owned: Boolean(it.is_owned),
            });
        }

        return outfits.map((o) => ({
            ...o,
            total_price: Number(o.total_price),
            items: itemsMap[o.outfit_id] || [],
        }));
    } catch (err) {
        console.error("Get saved outfits error:", err.message);
        return [];
    }
};

/**
 * Delete a saved outfit belonging to a user.
 */
const deleteUserOutfit = async (userId, outfitId) => {
    try {
        const [result] = await db.query(
            `DELETE FROM OUTFIT WHERE outfit_id = ? AND user_id = ?`,
            [outfitId, userId]
        );
        return result.affectedRows > 0;
    } catch (err) {
        console.error("Delete user outfit error:", err.message);
        return false;
    }
};

module.exports = {
    getPersonalizedOutfitsFallback,
    getWardrobeOutfitsFallback,
    getProductOutfitsFallback,
    saveUserOutfit,
    getUserSavedOutfits,
    deleteUserOutfit,
};
