/**
 * FashionIQ Backend QA Suite: Outfit Engine, Input Validation & Data Isolation
 * File: backend/tests/test_outfit_qa.js
 *
 * Verifies:
 * - Authentication enforcement on personalized, wardrobe, and saved outfit endpoints (401)
 * - Outfit creation payload validation: missing name, minimum 2 pieces rule (400)
 * - Garment role taxonomy validation (Top, Bottom, Shoes, Outerwear, Accessory, Other) (400)
 * - Anti-duplication guard: duplicate variant IDs within the same outfit rejected (400)
 * - Successful transactional outfit persistence and item linking (201)
 * - Saved outfit retrieval and enrichment (200)
 * - Deletion parameter validation: non-numeric / zero IDs (400)
 * - Data isolation & IDOR prevention: User A cannot delete User B's saved outfit (404)
 * - Successful deletion of owned outfit (200)
 * - Public/guest accessibility of product looks and custom generator (200)
 */

const app = require("../server");
const {
    createTestServer,
    createToken,
    createAssertionCollector,
    mockDb,
} = require("./test_helpers");

async function runOutfitQaTests() {
    console.log("================================================================================");
    console.log("FashionIQ QA Test Suite 3: Outfit Engine & Saved Outfits QA");
    console.log("================================================================================\n");

    const { baseUrl, close } = await createTestServer(app);
    const { assert, summarize } = createAssertionCollector("Outfit Engine QA Suite");

    mockDb.install();

    const user1Token = createToken({ user_id: 1, email: "user1@example.com", role: "USER" });
    const user2Token = createToken({ user_id: 2, email: "user2@example.com", role: "USER" });

    try {
        // =====================================================================
        // Section 1: Authentication Guards (401)
        // =====================================================================
        console.log("--- 1. Authentication Guards on Protected Outfit Routes ---");

        // 1.1 GET /api/outfits/recommendations unauthenticated
        const resRecsUnauth = await fetch(`${baseUrl}/api/outfits/recommendations`);
        assert(resRecsUnauth.status === 401, "GET /api/outfits/recommendations requires authentication (401)");

        // 1.2 GET /api/outfits/from-wardrobe unauthenticated
        const resWardrobeUnauth = await fetch(`${baseUrl}/api/outfits/from-wardrobe`);
        assert(resWardrobeUnauth.status === 401, "GET /api/outfits/from-wardrobe requires authentication (401)");

        // 1.3 POST /api/outfits/save unauthenticated
        const resSaveUnauth = await fetch(`${baseUrl}/api/outfits/save`, { method: "POST" });
        assert(resSaveUnauth.status === 401, "POST /api/outfits/save requires authentication (401)");

        // 1.4 GET /api/outfits/saved unauthenticated
        const resGetSavedUnauth = await fetch(`${baseUrl}/api/outfits/saved`);
        assert(resGetSavedUnauth.status === 401, "GET /api/outfits/saved requires authentication (401)");

        // 1.5 DELETE /api/outfits/saved/:id unauthenticated
        const resDelUnauth = await fetch(`${baseUrl}/api/outfits/saved/10`, { method: "DELETE" });
        assert(resDelUnauth.status === 401, "DELETE /api/outfits/saved/:id requires authentication (401)");

        // =====================================================================
        // Section 2: Outfit Save Input Validation & Role Constraints
        // =====================================================================
        console.log("\n--- 2. Outfit Save Payload Validation & Role Constraints ---");

        // 2.1 Missing outfit_name
        const resNoName = await fetch(`${baseUrl}/api/outfits/save`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({
                items: [
                    { variant_id: 1, role: "Top" },
                    { variant_id: 2, role: "Bottom" },
                ],
            }),
        });
        assert(resNoName.status === 400, "Saving outfit without outfit_name rejected with 400 Bad Request");

        // 2.2 Missing items array
        const resNoItems = await fetch(`${baseUrl}/api/outfits/save`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({ outfit_name: "Summer Look" }),
        });
        assert(resNoItems.status === 400, "Saving outfit without items array rejected with 400 Bad Request");

        // 2.3 Insufficient items: 1 item only (minimum 2 pieces required)
        const resSingleItem = await fetch(`${baseUrl}/api/outfits/save`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({
                outfit_name: "Incomplete Outfit",
                items: [{ variant_id: 1, role: "Top" }],
            }),
        });
        assert(resSingleItem.status === 400, "Outfit with fewer than 2 items rejected with 400 Bad Request");
        const dataSingleItem = await resSingleItem.json();
        assert(dataSingleItem.message.includes("at least 2 clothing pieces"), "Error message notes at least 2 clothing pieces requirement");

        // 2.4 Invalid garment role (not in Top, Bottom, Shoes, Outerwear, Accessory, Other)
        const resInvalidRole = await fetch(`${baseUrl}/api/outfits/save`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({
                outfit_name: "Invalid Role Outfit",
                items: [
                    { variant_id: 1, role: "Top" },
                    { variant_id: 2, role: "Cape" }, // Invalid role
                ],
            }),
        });
        assert(resInvalidRole.status === 400, "Outfit item with invalid role rejected with 400 Bad Request");
        const dataInvalidRole = await resInvalidRole.json();
        assert(dataInvalidRole.message.includes("valid variant_id and role"), "Error message specifies valid role requirement");

        // 2.5 Item missing variant_id
        const resItemNoVariant = await fetch(`${baseUrl}/api/outfits/save`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({
                outfit_name: "Missing Variant ID Outfit",
                items: [
                    { variant_id: 1, role: "Top" },
                    { role: "Bottom" }, // Missing variant_id
                ],
            }),
        });
        assert(resItemNoVariant.status === 400, "Outfit item without variant_id rejected with 400 Bad Request");

        // 2.6 Anti-Duplication Guard: Duplicate variant IDs within the same outfit (400)
        const resDuplicateVariant = await fetch(`${baseUrl}/api/outfits/save`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({
                outfit_name: "Duplicate Variant Outfit",
                items: [
                    { variant_id: 5, role: "Top" },
                    { variant_id: 5, role: "Bottom" }, // Duplicate variant 5
                ],
            }),
        });
        assert(resDuplicateVariant.status === 400, "Duplicate variant IDs within same outfit rejected with 400 Bad Request");
        const dataDuplicateVariant = await resDuplicateVariant.json();
        assert(dataDuplicateVariant.message.includes("Duplicate variant IDs in the same outfit are not permitted"), "Anti-duplication error message is clear");

        // 2.7 Successful transactional outfit save (201)
        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("INSERT INTO OUTFIT (user_id, outfit_name"),
            () => [{ insertId: 42, affectedRows: 1 }]
        );
        mockDb.when(
            (sql) => sql.includes("INSERT INTO OUTFIT_ITEM"),
            () => [{ insertId: 101, affectedRows: 1 }]
        );
        const resValidSave = await fetch(`${baseUrl}/api/outfits/save`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({
                outfit_name: "Smart Casual Ensemble",
                occasion: "Casual",
                season: "Summer",
                total_price: 3499.00,
                description: "A lightweight summer combination",
                items: [
                    { variant_id: 10, role: "Top", price: 1499.00 },
                    { variant_id: 15, role: "Bottom", price: 2000.00 },
                ],
            }),
        });
        assert(resValidSave.status === 201, "Valid outfit save succeeds with 201 Created");
        const dataValidSave = await resValidSave.json();
        assert(dataValidSave.success === true, "Save response success is true");
        assert(dataValidSave.outfit_id === 42, "Returned outfit_id matches newly created ID");

        // =====================================================================
        // Section 3: Saved Outfits Retrieval & Verification (200)
        // =====================================================================
        console.log("\n--- 3. Saved Outfits Retrieval & Verification ---");

        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("FROM OUTFIT WHERE user_id = ?"),
            () => [[
                {
                    outfit_id: 42,
                    user_id: 1,
                    outfit_name: "Smart Casual Ensemble",
                    occasion: "Casual",
                    season: "Summer",
                    total_price: 3499.00,
                    description: "A lightweight summer combination",
                    created_at: new Date().toISOString(),
                }
            ]]
        );
        mockDb.when(
            (sql) => sql.includes("FROM OUTFIT_ITEM oi JOIN PRODUCT_VARIANT pv"),
            () => [[
                {
                    outfit_item_id: 1,
                    outfit_id: 42,
                    variant_id: 10,
                    role: "Top",
                    sequence: 1,
                    price: 1499.00,
                    product_id: 5,
                    product_name: "Linen Shirt",
                    brand_name: "Zara",
                    color: "White",
                    size: "M",
                },
                {
                    outfit_item_id: 2,
                    outfit_id: 42,
                    variant_id: 15,
                    role: "Bottom",
                    sequence: 2,
                    price: 2000.00,
                    product_id: 8,
                    product_name: "Chino Trousers",
                    brand_name: "H&M",
                    color: "Navy",
                    size: "32",
                }
            ]]
        );
        const resGetSaved = await fetch(`${baseUrl}/api/outfits/saved`, {
            headers: { Authorization: `Bearer ${user1Token}` },
        });
        assert(resGetSaved.status === 200, "GET /api/outfits/saved returns 200 OK for authenticated user");
        const dataGetSaved = await resGetSaved.json();
        assert(dataGetSaved.count === 1, "Returns 1 saved outfit");
        assert(dataGetSaved.outfits[0].items.length === 2, "Saved outfit contains 2 enriched clothing items");
        assert(dataGetSaved.outfits[0].items[0].product_name === "Linen Shirt", "Item details are correctly linked");

        // =====================================================================
        // Section 4: Outfit Deletion & Data Isolation (IDOR Checks)
        // =====================================================================
        console.log("\n--- 4. Outfit Deletion Validation & Data Isolation (IDOR) ---");

        // 4.1 Invalid outfit ID (non-numeric)
        const resDelBadId = await fetch(`${baseUrl}/api/outfits/saved/invalid-id`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${user1Token}` },
        });
        assert(resDelBadId.status === 400, "Deleting outfit with invalid ID rejected with 400 Bad Request");

        // 4.2 Non-existent outfit ID (404)
        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("DELETE FROM OUTFIT WHERE outfit_id = ? AND user_id = ?"),
            () => [{ affectedRows: 0 }]
        );
        const resDelNotFound = await fetch(`${baseUrl}/api/outfits/saved/9999`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${user1Token}` },
        });
        assert(resDelNotFound.status === 404, "Deleting non-existent outfit returns 404 Not Found");

        // 4.3 IDOR Guard: User 2 attempting to delete User 1's saved outfit (404 access denied)
        // SQL query filters by `outfit_id = ? AND user_id = ?`, so User 2 has affectedRows: 0
        const resIdorDelete = await fetch(`${baseUrl}/api/outfits/saved/42`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${user2Token}` }, // User 2 trying to delete User 1's outfit #42
        });
        assert(resIdorDelete.status === 404, "IDOR Guard: User 2 attempting to delete User 1's outfit returns 404 Not Found");
        const dataIdorDelete = await resIdorDelete.json();
        assert(dataIdorDelete.message.includes("does not belong to the user"), "Isolation message confirms user ownership verification");

        // 4.4 Successful deletion of owned outfit (200)
        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("DELETE FROM OUTFIT WHERE outfit_id = ? AND user_id = ?"),
            () => [{ affectedRows: 1 }]
        );
        const resDelSuccess = await fetch(`${baseUrl}/api/outfits/saved/42`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${user1Token}` },
        });
        assert(resDelSuccess.status === 200, "Deleting owned saved outfit succeeds with 200 OK");
        const dataDelSuccess = await resDelSuccess.json();
        assert(dataDelSuccess.success === true, "Deletion response indicates success: true");

        // =====================================================================
        // Section 5: Public / Optional Authentication Endpoints
        // =====================================================================
        console.log("\n--- 5. Public & Optional Auth Outfit Endpoints ---");

        // 5.1 GET /api/outfits/product/:productId is accessible without auth (returns 200 via fallback)
        const resProductOutfitsGuest = await fetch(`${baseUrl}/api/outfits/product/1`);
        assert(resProductOutfitsGuest.status === 200, "Product outfits accessible to guest without token (200 OK)");
        const dataProductOutfits = await resProductOutfitsGuest.json();
        assert(dataProductOutfits.success === true, "Product outfits response success is true");

        // 5.2 POST /api/outfits/generate dynamic custom outfits is accessible to guest (200 OK)
        const resGenerateGuest = await fetch(`${baseUrl}/api/outfits/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ occasion: "Casual", season: "Summer", limit: 3 }),
        });
        assert(resGenerateGuest.status === 200, "Dynamic outfit generation accessible to guest without token (200 OK)");
        const dataGenerate = await resGenerateGuest.json();
        assert(dataGenerate.success === true, "Custom outfit generator response success is true");

    } catch (err) {
        console.error("Test execution error in Outfit QA Suite:", err);
        assert(false, `Unexpected exception: ${err.message}`);
    } finally {
        mockDb.restore();
        await close();
    }

    const { failed } = summarize();
    return failed === 0;
}

if (require.main === module) {
    runOutfitQaTests().then((success) => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = runOutfitQaTests;
