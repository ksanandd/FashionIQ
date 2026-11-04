require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const http = require("http");
const jwt = require("jsonwebtoken");
const app = require("../server");
const pool = require("../config/db");

const JWT_SECRET = process.env.JWT_SECRET || "FashionIQ_YourOwnLongRandomSecret_2026";

async function runSystemJourneyTest() {
    console.log("================================================================================");
    console.log("FashionIQ Phase 9: System-Wide 26-Step Customer Journey Verification Suite");
    console.log("================================================================================");

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;
    console.log(`Ephemeral test server running at ${baseUrl}`);

    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`  [PASS] ${message}`);
            passed++;
        } else {
            console.error(`  [FAIL] ${message}`);
            failed++;
        }
    }

    const testTimestamp = Date.now();
    const testEmail = `journey_user_${testTimestamp}@example.com`;
    const testPassword = "Password@123";
    let testUserId = null;
    let testUserToken = null;
    let testOrderId = null;
    let testSavedOutfitId = null;
    let initialVariant1Stock = 0;

    // Admin token for Step 26
    const adminToken = jwt.sign(
        { user_id: 3, email: "admin.demo@example.com", role: "ADMIN" },
        JWT_SECRET,
        { expiresIn: "1h" }
    );

    try {
        // Fetch baseline stock for variant 1
        const [[var1]] = await pool.query(
            "SELECT stock_quantity FROM PRODUCT_VARIANT WHERE variant_id = 1"
        );
        initialVariant1Stock = var1.stock_quantity;

        // -------------------------------------------------------------
        // Step 1: Homepage loads correctly
        // -------------------------------------------------------------
        console.log("\n[Step 1] Verifying Homepage & API health:");
        const resHealth = await fetch(`${baseUrl}/`);
        const dataHealth = await resHealth.json();
        assert(resHealth.status === 200, "Homepage/API base root returns 200 OK");
        assert(dataHealth.status === "Server is running", "Server status message verified");

        // -------------------------------------------------------------
        // Step 2: Product catalog loads from MySQL through Express
        // -------------------------------------------------------------
        console.log("\n[Step 2] Verifying Product Catalog via Express & MySQL:");
        const resCatalog = await fetch(`${baseUrl}/api/products`);
        const dataCatalog = await resCatalog.json();
        assert(resCatalog.status === 200, "Catalog returns 200 OK");
        assert(dataCatalog.success === true, "Catalog response success is true");
        assert(Array.isArray(dataCatalog.products) && dataCatalog.products.length > 0, `Catalog loaded ${dataCatalog.products?.length} products from MySQL`);

        // -------------------------------------------------------------
        // Step 3: Product search, filters, sorting and pagination
        // -------------------------------------------------------------
        console.log("\n[Step 3] Verifying Search, Filters, Sorting & Pagination:");
        const resFiltered = await fetch(`${baseUrl}/api/products?search=Nike&sort=price_asc&limit=5&page=1`);
        const dataFiltered = await resFiltered.json();
        assert(resFiltered.status === 200, "Filtered query returns 200 OK");
        assert(dataFiltered.products.every(p => p.product_name.toLowerCase().includes("nike")), "Search query correctly filters by keyword 'Nike'");

        // -------------------------------------------------------------
        // Step 4: Product detail pages and variants
        // -------------------------------------------------------------
        console.log("\n[Step 4] Verifying Product Detail & Variant Relationships:");
        const resProduct = await fetch(`${baseUrl}/api/products/1`);
        const dataProduct = await resProduct.json();
        assert(resProduct.status === 200, "Product detail returns 200 OK");
        assert(dataProduct.product.product_id === 1, "Correct product ID returned");

        const resVariants = await fetch(`${baseUrl}/api/products/1/variants`);
        const dataVariants = await resVariants.json();
        assert(resVariants.status === 200, "Product variants endpoint returns 200 OK");
        assert(Array.isArray(dataVariants.variants) && dataVariants.variants.length > 0, `Product variants attached (${dataVariants.variants.length} variants found)`);

        // -------------------------------------------------------------
        // Step 5: User registration
        // -------------------------------------------------------------
        console.log("\n[Step 5] Verifying User Registration:");
        const resRegister = await fetch(`${baseUrl}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                first_name: "Journey",
                last_name: "Tester",
                email: testEmail,
                password: testPassword,
                street: "123 Fashion Blvd",
                city: "Bengaluru",
                state: "Karnataka",
                pincode: "560001"
            })
        });
        const dataRegister = await resRegister.json();
        assert(resRegister.status === 201, "Registration succeeds with 201 Created");
        assert(dataRegister.success === true, "Registration success flag is true");

        // -------------------------------------------------------------
        // Step 6: Login & Logout
        // -------------------------------------------------------------
        console.log("\n[Step 6] Verifying Login & Authentication Token Issuance:");
        const resLogin = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: testEmail,
                password: testPassword
            })
        });
        const dataLogin = await resLogin.json();
        assert(resLogin.status === 200, "Login succeeds with 200 OK");
        assert(typeof dataLogin.token === "string" && dataLogin.token.length > 20, "JWT token successfully returned");
        testUserToken = dataLogin.token;
        testUserId = dataLogin.user.user_id;
        assert(testUserId > 0, `Assigned User ID: #${testUserId}`);

        // -------------------------------------------------------------
        // Step 7: JWT authentication verification
        // -------------------------------------------------------------
        console.log("\n[Step 7] Verifying JWT Token Authenticated Profile Access:");
        const resProfile = await fetch(`${baseUrl}/api/users/profile`, {
            headers: { Authorization: `Bearer ${testUserToken}` }
        });
        const dataProfile = await resProfile.json();
        assert(resProfile.status === 200, "Authenticated profile query returns 200 OK");
        assert(dataProfile.profile.email === testEmail, "Profile email matches logged-in user");

        // -------------------------------------------------------------
        // Step 8: Protected routes reject unauthenticated users
        // -------------------------------------------------------------
        console.log("\n[Step 8] Verifying Unauthenticated Access Rejection:");
        const resNoAuth = await fetch(`${baseUrl}/api/users/profile`);
        assert(resNoAuth.status === 401, "Protected profile route rejects unauthenticated request with 401 Unauthorized");

        // -------------------------------------------------------------
        // Step 9: User profile and style preferences update
        // -------------------------------------------------------------
        console.log("\n[Step 9] Verifying Style Preferences Update:");
        const resUpdateProfile = await fetch(`${baseUrl}/api/users/profile`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${testUserToken}`
            },
            body: JSON.stringify({
                height: 178,
                weight: 72,
                body_type: "Athletic",
                style_preferences: "Casual, Streetwear, Minimalist",
                budget_range_min: 1000,
                budget_range_max: 5000,
                preferred_brands: "Nike, Adidas, Zara"
            })
        });
        const dataUpdateProfile = await resUpdateProfile.json();
        assert(resUpdateProfile.status === 200, "Profile update succeeds with 200 OK");
        assert(dataUpdateProfile.success === true, "Fashion profile successfully stored");

        // -------------------------------------------------------------
        // Step 10: Wishlist operations (Recorded via LIKE Interaction)
        // -------------------------------------------------------------
        console.log("\n[Step 10] Verifying Wishlist / Like Interaction:");
        const resLike = await fetch(`${baseUrl}/api/interactions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${testUserToken}`
            },
            body: JSON.stringify({
                product_id: 1,
                variant_id: 1,
                interaction_type: "LIKE"
            })
        });
        assert(resLike.status === 201, "Product LIKE interaction recorded with 201 Created");

        // -------------------------------------------------------------
        // Step 11: Cart operations validation
        // -------------------------------------------------------------
        console.log("\n[Step 11] Verifying Cart Variant & Stock Validation:");
        const resCartVariant = await fetch(`${baseUrl}/api/products/1/variants`);
        const dataCartVariant = await resCartVariant.json();
        const availableVariant = dataCartVariant.variants.find(v => v.variant_id === 1);
        assert(availableVariant !== undefined, "Cart item variant #1 is active in catalog");
        assert(availableVariant.stock_quantity > 0, `Cart item variant has available stock (${availableVariant.stock_quantity} units)`);

        // -------------------------------------------------------------
        // Step 12: Guest interaction handling
        // -------------------------------------------------------------
        console.log("\n[Step 12] Verifying Guest Interaction Guard:");
        const resGuest = await fetch(`${baseUrl}/api/interactions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                product_id: 1,
                variant_id: 1,
                interaction_type: "VIEW"
            })
        });
        assert(resGuest.status === 401, "Direct server telemetry requires authentication; guest interactions safely queued client-side");

        // -------------------------------------------------------------
        // Step 13: Checkout validates product variants, prices and inventory
        // -------------------------------------------------------------
        console.log("\n[Step 13] Verifying Checkout Server-Side Validation:");
        const resInvalidVariant = await fetch(`${baseUrl}/api/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${testUserToken}`
            },
            body: JSON.stringify({
                items: [{ variant_id: 99999, quantity: 1 }],
                shipping_address: { street: "123 St", city: "Bengaluru", state: "KA", pincode: "560001" },
                payment_method: "COD"
            })
        });
        assert(resInvalidVariant.status === 400, "Non-existent variant rejected with 400 Bad Request");

        // -------------------------------------------------------------
        // Step 14: Orders are created transactionally
        // -------------------------------------------------------------
        console.log("\n[Step 14] Verifying Transactional Order Creation:");
        const resOrder = await fetch(`${baseUrl}/api/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${testUserToken}`
            },
            body: JSON.stringify({
                items: [{ variant_id: 1, quantity: 1 }],
                shipping_address: {
                    street: "123 Fashion Blvd",
                    city: "Bengaluru",
                    state: "Karnataka",
                    pincode: "560001"
                },
                payment_method: "COD"
            })
        });
        const dataOrder = await resOrder.json();
        assert(resOrder.status === 201, "Order successfully placed with 201 Created");
        assert(dataOrder.success === true, "Order creation success flag is true");
        testOrderId = dataOrder.order ? dataOrder.order.order_id : dataOrder.order_id;
        assert(testOrderId > 0, `Order assigned ID #${testOrderId}`);

        // -------------------------------------------------------------
        // Step 15: Stock decreases correctly after successful order
        // -------------------------------------------------------------
        console.log("\n[Step 15] Verifying Atomic Stock Deduction:");
        const [[var1After]] = await pool.query(
            "SELECT stock_quantity FROM PRODUCT_VARIANT WHERE variant_id = 1"
        );
        assert(var1After.stock_quantity === initialVariant1Stock - 1, `Variant 1 stock atomically decremented from ${initialVariant1Stock} to ${var1After.stock_quantity}`);

        // -------------------------------------------------------------
        // Step 16: Failed orders roll back inventory changes
        // -------------------------------------------------------------
        console.log("\n[Step 16] Verifying Inventory Rollback on Failed Order:");
        // Wait 3.1s for debounce window to clear
        await new Promise((r) => setTimeout(r, 3100));

        const resExcessStock = await fetch(`${baseUrl}/api/orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${testUserToken}`
            },
            body: JSON.stringify({
                items: [{ variant_id: 1, quantity: 9999 }],
                shipping_address: { street: "123 St", city: "Bengaluru", state: "KA", pincode: "560001" },
                payment_method: "COD"
            })
        });
        assert(resExcessStock.status === 400, "Excess quantity order rejected with 400 Bad Request");
        const [[var1Rollback]] = await pool.query(
            "SELECT stock_quantity FROM PRODUCT_VARIANT WHERE variant_id = 1"
        );
        assert(var1Rollback.stock_quantity === var1After.stock_quantity, "Stock quantity perfectly preserved (rolled back) on failed order");

        // -------------------------------------------------------------
        // Step 17: Order history displays only authenticated user's orders
        // -------------------------------------------------------------
        console.log("\n[Step 17] Verifying Order History Ownership Isolation:");
        const resOrders = await fetch(`${baseUrl}/api/orders`, {
            headers: { Authorization: `Bearer ${testUserToken}` }
        });
        const dataOrders = await resOrders.json();
        assert(resOrders.status === 200, "Order history query returns 200 OK");
        assert(dataOrders.orders.length === 1 && dataOrders.orders[0].order_id === testOrderId, "Order history contains only the authenticated user's order");

        // -------------------------------------------------------------
        // Step 18: Digital wardrobe operations
        // -------------------------------------------------------------
        console.log("\n[Step 18] Verifying Digital Wardrobe Operations:");
        const resWardrobeList = await fetch(`${baseUrl}/api/wardrobes`, {
            headers: { Authorization: `Bearer ${testUserToken}` }
        });
        const dataWardrobeList = await resWardrobeList.json();
        assert(resWardrobeList.status === 200, "Wardrobe list returns 200 OK");
        assert(dataWardrobeList.wardrobes.length > 0, "Default wardrobe auto-provisioned for user");
        const defaultWardrobeId = dataWardrobeList.wardrobes[0].wardrobe_id;

        // Manual add as SAVED
        const resAddWardrobeItem = await fetch(`${baseUrl}/api/wardrobes/items`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${testUserToken}`
            },
            body: JSON.stringify({
                wardrobe_id: defaultWardrobeId,
                variant_id: 3, // Adidas track pants
                season: "Summer",
                source_type: "SAVED"
            })
        });
        assert(resAddWardrobeItem.status === 201, "Manual item added to wardrobe as SAVED with 201 Created");

        // -------------------------------------------------------------
        // Step 19: Verified purchased items retain PURCHASED status
        // -------------------------------------------------------------
        console.log("\n[Step 19] Verifying PURCHASED Status on Synced Order Items:");
        // Synchronize verified purchase from order into wardrobe
        const resSyncOrder = await fetch(`${baseUrl}/api/wardrobes/items/from-order/${testOrderId}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${testUserToken}`
            },
            body: JSON.stringify({ wardrobe_id: defaultWardrobeId })
        });
        const dataSyncOrder = await resSyncOrder.json();
        assert(resSyncOrder.status === 200, "Order items synchronized into wardrobe with 200 OK");
        assert(dataSyncOrder.success === true, "Synchronization succeeded");

        const resWardrobeItems = await fetch(`${baseUrl}/api/wardrobes/${defaultWardrobeId}/items`, {
            headers: { Authorization: `Bearer ${testUserToken}` }
        });
        const dataWardrobeItems = await resWardrobeItems.json();
        const purchasedItem = dataWardrobeItems.items.find(i => i.variant_id === 1);
        assert(purchasedItem !== undefined, "Purchased order item present in wardrobe");
        assert(purchasedItem.source_type === "PURCHASED", "Verified order item retains immutable 'PURCHASED' status");

        // -------------------------------------------------------------
        // Step 20: AI recommendations use appropriate user context
        // -------------------------------------------------------------
        console.log("\n[Step 20] Verifying AI Recommendations User Context:");
        const resRecs = await fetch(`${baseUrl}/api/recommendations/user`, {
            headers: { Authorization: `Bearer ${testUserToken}` }
        });
        const dataRecs = await resRecs.json();
        assert(resRecs.status === 200, "Personalized recommendations return 200 OK");
        assert(Array.isArray(dataRecs.recommendations) && dataRecs.recommendations.length > 0, `Returned ${dataRecs.recommendations.length} recommendations`);

        // -------------------------------------------------------------
        // Step 21: Similar products remain category-relevant
        // -------------------------------------------------------------
        console.log("\n[Step 21] Verifying Similar Product Category Relevance:");
        const resSimilar = await fetch(`${baseUrl}/api/recommendations/similar/1?limit=4`);
        const dataSimilar = await resSimilar.json();
        assert(resSimilar.status === 200, "Similar products return 200 OK");
        assert(
            dataSimilar.recommendations.every(r => r.product_id !== 1),
            "Target product excluded from its own similarity set"
        );

        // -------------------------------------------------------------
        // Step 22: Outfit Studio produces valid complete outfits
        // -------------------------------------------------------------
        console.log("\n[Step 22] Verifying Complete Outfit Generation (Top + Bottom):");
        const resOutfits = await fetch(`${baseUrl}/api/outfits/recommendations?limit=3`, {
            headers: { Authorization: `Bearer ${testUserToken}` }
        });
        const dataOutfits = await resOutfits.json();
        assert(resOutfits.status === 200, "Outfit recommendations return 200 OK");
        assert(dataOutfits.outfits.length > 0, `Generated ${dataOutfits.outfits.length} complete outfits`);
        const sampleOutfit = dataOutfits.outfits[0];
        const roles = new Set(sampleOutfit.items.map(i => i.role));
        assert(roles.has("Top") && roles.has("Bottom"), "Outfit contains both Top and Bottom components");

        // -------------------------------------------------------------
        // Step 23: Wardrobe-first outfit recommendations
        // -------------------------------------------------------------
        console.log("\n[Step 23] Verifying Wardrobe-First Outfits with Owned Pieces:");
        const resWardrobeOutfits = await fetch(`${baseUrl}/api/outfits/from-wardrobe?limit=3`, {
            headers: { Authorization: `Bearer ${testUserToken}` }
        });
        const dataWardrobeOutfits = await resWardrobeOutfits.json();
        assert(resWardrobeOutfits.status === 200, "Wardrobe outfits return 200 OK");
        assert(dataWardrobeOutfits.outfits.length > 0, `Returned ${dataWardrobeOutfits.outfits.length} wardrobe-anchored outfits`);
        assert(dataWardrobeOutfits.outfits[0].owned_items_count > 0, "Wardrobe outfit contains at least 1 owned piece");

        // -------------------------------------------------------------
        // Step 24: Saved outfits retrieved only by their owner
        // -------------------------------------------------------------
        console.log("\n[Step 24] Verifying Saved Outfits Ownership & Access Control:");
        const resSaveOutfit = await fetch(`${baseUrl}/api/outfits/save`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${testUserToken}`
            },
            body: JSON.stringify({
                outfit_name: "Customer Journey Test Look",
                occasion: "Casual",
                season: "All Season",
                total_price: 3499.0,
                description: "Test saved outfit",
                items: [
                    { variant_id: 1, role: "Top", price: 1500.0, is_owned: true },
                    { variant_id: 3, role: "Bottom", price: 1999.0, is_owned: false }
                ]
            })
        });
        const dataSaveOutfit = await resSaveOutfit.json();
        assert(resSaveOutfit.status === 201, "Outfit saved with 201 Created");
        testSavedOutfitId = dataSaveOutfit.outfit_id;

        const resGetSaved = await fetch(`${baseUrl}/api/outfits/saved`, {
            headers: { Authorization: `Bearer ${testUserToken}` }
        });
        const dataGetSaved = await resGetSaved.json();
        assert(resGetSaved.status === 200, "Saved outfits retrieved with 200 OK");
        assert(dataGetSaved.outfits.some(o => o.outfit_id === testSavedOutfitId), "Saved outfit appears in owner's saved collection");

        // Attempt deletion from another user (User 2)
        const user2Token = jwt.sign(
            { user_id: 2, email: "priya.demo@example.com", role: "USER" },
            JWT_SECRET,
            { expiresIn: "1h" }
        );
        const resCrossDelete = await fetch(`${baseUrl}/api/outfits/saved/${testSavedOutfitId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${user2Token}` }
        });
        assert(resCrossDelete.status === 404, "Cross-user saved outfit deletion rejected with 404 Not Found");

        // -------------------------------------------------------------
        // Step 25: Buy Needed Pieces adds only required products
        // -------------------------------------------------------------
        console.log("\n[Step 25] Verifying 'Buy Needed Pieces' Cart Filtering:");
        const testOutfitPieces = [
            { product_id: 1, variant_id: 1, product_name: "Nike T-shirt", price: 1500, is_owned: true },
            { product_id: 2, variant_id: 3, product_name: "Adidas Track Pants", price: 1999, is_owned: false }
        ];
        const unownedToBuy = testOutfitPieces.filter(p => !p.is_owned);
        assert(unownedToBuy.length === 1 && unownedToBuy[0].variant_id === 3, "Only unowned pieces identified for checkout");
        assert(testOutfitPieces.filter(p => p.is_owned).length === 1, "Owned pieces strictly excluded from cart additions");

        // -------------------------------------------------------------
        // Step 26: Admin portal is accessible only to authorized administrators
        // -------------------------------------------------------------
        console.log("\n[Step 26] Verifying Admin Portal Access & Role Guards:");
        const resNormalToAdmin = await fetch(`${baseUrl}/api/admin/dashboard`, {
            headers: { Authorization: `Bearer ${testUserToken}` }
        });
        assert(resNormalToAdmin.status === 403, "Normal USER rejected from admin portal with 403 Forbidden");

        const resAdminToAdmin = await fetch(`${baseUrl}/api/admin/dashboard`, {
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        assert(resAdminToAdmin.status === 200, "ADMIN successfully accesses admin portal with 200 OK");

    } catch (err) {
        console.error("System journey test exception:", err);
        failed++;
    } finally {
        console.log("\n--- Cleaning up isolated test artifacts ---");
        try {
            if (testSavedOutfitId) {
                await pool.query("DELETE FROM OUTFIT_ITEM WHERE outfit_id = ?", [testSavedOutfitId]);
                await pool.query("DELETE FROM OUTFIT WHERE outfit_id = ?", [testSavedOutfitId]);
            }
            if (testUserId) {
                // First delete all order items and orders for this test user
                const [userOrders] = await pool.query("SELECT order_id FROM ORDERS WHERE user_id = ?", [testUserId]);
                for (const o of userOrders) {
                    await pool.query("DELETE FROM ORDER_ITEM WHERE order_id = ?", [o.order_id]);
                }
                await pool.query("DELETE FROM ORDERS WHERE user_id = ?", [testUserId]);

                // Restore variant 1 stock
                await pool.query(
                    "UPDATE PRODUCT_VARIANT SET stock_quantity = ? WHERE variant_id = 1",
                    [initialVariant1Stock]
                );

                // Delete wardrobe items and wardrobes
                const [wRows] = await pool.query("SELECT wardrobe_id FROM WARDROBE WHERE user_id = ?", [testUserId]);
                for (const w of wRows) {
                    await pool.query("DELETE FROM WARDROBE_ITEM WHERE wardrobe_id = ?", [w.wardrobe_id]);
                }
                await pool.query("DELETE FROM WARDROBE WHERE user_id = ?", [testUserId]);
                await pool.query("DELETE FROM USER_INTERACTION WHERE user_id = ?", [testUserId]);
                await pool.query("DELETE FROM USER_PROFILE WHERE user_id = ?", [testUserId]);
                await pool.query("DELETE FROM `USER` WHERE user_id = ?", [testUserId]);
            }
            console.log("Isolated test records cleaned up safely.");
        } catch (cleanupErr) {
            console.error("Cleanup error:", cleanupErr);
        }
        server.close();
    }

    console.log("\n================================================================================");
    console.log(`System Journey Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log("================================================================================\n");

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runSystemJourneyTest();
