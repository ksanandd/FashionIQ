/**
 * FashionIQ Backend QA Suite: Wardrobe Management, Security & Data Isolation
 * File: backend/tests/test_wardrobe_qa.js
 *
 * Verifies:
 * - Unauthenticated request rejection across all wardrobe endpoints (401)
 * - Wardrobe collection name validation, length limits, and per-user uniqueness (400, 409, 201)
 * - Wardrobe item input validation: variant IDs, quantity limits (1-50), season enum (400)
 * - Security & Anti-forgery: prevention of manual client injection of PURCHASED status (403)
 * - Foreign key & catalog integrity: variant existence and product-variant relationship (400)
 * - Multi-tenant isolation & IDOR prevention: User A cannot read, add to, or delete User B's wardrobe (404)
 * - Item deletion parameter validation and ownership verification (400, 404, 200)
 * - Order item synchronization permissions and handling (400, 404, 200)
 */

const app = require("../server");
const {
    createTestServer,
    createToken,
    createAssertionCollector,
    mockDb,
} = require("./test_helpers");

async function runWardrobeQaTests() {
    console.log("================================================================================");
    console.log("FashionIQ QA Test Suite 2: Wardrobe Management & Data Isolation");
    console.log("================================================================================\n");

    const { baseUrl, close } = await createTestServer(app);
    const { assert, summarize } = createAssertionCollector("Wardrobe Management QA Suite");

    mockDb.install();

    const user1Token = createToken({ user_id: 1, email: "user1@example.com", role: "USER" });
    const user2Token = createToken({ user_id: 2, email: "user2@example.com", role: "USER" });

    try {
        // =====================================================================
        // Section 1: Authentication Guards across All Endpoints (401)
        // =====================================================================
        console.log("--- 1. Authentication Guards on Wardrobe Routes ---");

        // 1.1 POST /api/wardrobes without auth
        const resPostWbUnauth = await fetch(`${baseUrl}/api/wardrobes`, { method: "POST" });
        assert(resPostWbUnauth.status === 401, "POST /api/wardrobes requires authentication (401)");

        // 1.2 GET /api/wardrobes without auth
        const resGetWbUnauth = await fetch(`${baseUrl}/api/wardrobes`);
        assert(resGetWbUnauth.status === 401, "GET /api/wardrobes requires authentication (401)");

        // 1.3 POST /api/wardrobes/items without auth
        const resPostItemUnauth = await fetch(`${baseUrl}/api/wardrobes/items`, { method: "POST" });
        assert(resPostItemUnauth.status === 401, "POST /api/wardrobes/items requires authentication (401)");

        // 1.4 GET /api/wardrobes/:id/items without auth
        const resGetItemsUnauth = await fetch(`${baseUrl}/api/wardrobes/1/items`);
        assert(resGetItemsUnauth.status === 401, "GET /api/wardrobes/:id/items requires authentication (401)");

        // 1.5 DELETE /api/wardrobes/items/:id without auth
        const resDeleteItemUnauth = await fetch(`${baseUrl}/api/wardrobes/items/1`, { method: "DELETE" });
        assert(resDeleteItemUnauth.status === 401, "DELETE /api/wardrobes/items/:id requires authentication (401)");

        // 1.6 POST /api/wardrobes/items/from-order/:id without auth
        const resFromOrderUnauth = await fetch(`${baseUrl}/api/wardrobes/items/from-order/1`, { method: "POST" });
        assert(resFromOrderUnauth.status === 401, "POST /api/wardrobes/items/from-order/:id requires authentication (401)");

        // =====================================================================
        // Section 2: Wardrobe Collection Creation Validation
        // =====================================================================
        console.log("\n--- 2. Wardrobe Collection Creation Validation ---");

        // 2.1 Missing wardrobe_name
        const resWbNoName = await fetch(`${baseUrl}/api/wardrobes`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({}),
        });
        assert(resWbNoName.status === 400, "Collection creation without wardrobe_name rejected with 400 Bad Request");

        // 2.2 Whitespace-only wardrobe_name
        const resWbBlankName = await fetch(`${baseUrl}/api/wardrobes`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({ wardrobe_name: "   " }),
        });
        assert(resWbBlankName.status === 400, "Collection creation with blank whitespace wardrobe_name rejected with 400");

        // 2.3 Name exceeding 100 characters
        const longName = "A".repeat(101);
        const resWbTooLong = await fetch(`${baseUrl}/api/wardrobes`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({ wardrobe_name: longName }),
        });
        assert(resWbTooLong.status === 400, "Collection name exceeding 100 chars rejected with 400 Bad Request");
        const dataTooLong = await resWbTooLong.json();
        assert(dataTooLong.message.includes("100 characters"), "Error message notes 100 character maximum limit");

        // 2.4 Duplicate wardrobe collection name for the same user (409)
        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("SELECT wardrobe_id FROM WARDROBE WHERE user_id = ? AND LOWER(wardrobe_name)"),
            () => [[{ wardrobe_id: 10 }]]
        );
        const resWbDup = await fetch(`${baseUrl}/api/wardrobes`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({ wardrobe_name: "Summer Capsule" }),
        });
        assert(resWbDup.status === 409, "Duplicate collection name for same user returns 409 Conflict");
        const dataDup = await resWbDup.json();
        assert(dataDup.message.includes("already have a wardrobe collection"), "Duplicate wardrobe error message is clear");

        // 2.5 Valid collection creation (201)
        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("SELECT wardrobe_id FROM WARDROBE WHERE user_id = ? AND LOWER(wardrobe_name)"),
            () => [[]]
        );
        mockDb.when(
            (sql) => sql.includes("INSERT INTO WARDROBE"),
            () => [{ insertId: 15, affectedRows: 1 }]
        );
        const resWbValid = await fetch(`${baseUrl}/api/wardrobes`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({ wardrobe_name: "Formal Workwear" }),
        });
        assert(resWbValid.status === 201, "Valid collection creation returns 201 Created");
        const dataValid = await resWbValid.json();
        assert(dataValid.wardrobe.wardrobe_id === 15, "Returned collection contains correct wardrobe_id");
        assert(dataValid.wardrobe.wardrobe_name === "Formal Workwear", "Returned collection has trimmed name");

        // =====================================================================
        // Section 3: Wardrobe Item Addition Validation & Security Guards
        // =====================================================================
        console.log("\n--- 3. Wardrobe Item Validation & Anti-Forgery Protection ---");

        // 3.1 Missing variant_id
        const resItemNoVariant = await fetch(`${baseUrl}/api/wardrobes/items`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({ quantity: 1, season: "Summer" }),
        });
        assert(resItemNoVariant.status === 400, "Adding item without variant_id rejected with 400 Bad Request");

        // 3.2 Invalid variant_id (negative or non-numeric)
        const resItemInvalidVariant = await fetch(`${baseUrl}/api/wardrobes/items`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({ variant_id: -5 }),
        });
        assert(resItemInvalidVariant.status === 400, "Negative variant_id rejected with 400 Bad Request");

        // 3.3 Invalid quantity (0 or > 50)
        const resItemZeroQty = await fetch(`${baseUrl}/api/wardrobes/items`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({ variant_id: 1, quantity: 0 }),
        });
        assert(resItemZeroQty.status === 400, "Quantity of 0 rejected with 400 Bad Request");

        const resItemExcessQty = await fetch(`${baseUrl}/api/wardrobes/items`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({ variant_id: 1, quantity: 51 }),
        });
        assert(resItemExcessQty.status === 400, "Quantity > 50 rejected with 400 Bad Request");

        // 3.4 Invalid season value
        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("SELECT wardrobe_id, wardrobe_name, created_at FROM WARDROBE"),
            () => [[{ wardrobe_id: 1, wardrobe_name: "My Wardrobe" }]]
        );
        mockDb.when(
            (sql) => sql.includes("SELECT pv.variant_id, pv.product_id, p.product_name"),
            () => [[{ variant_id: 1, product_id: 2, product_name: "Shirt", color: "Blue", size: "M" }]]
        );
        const resItemBadSeason = await fetch(`${baseUrl}/api/wardrobes/items`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({ variant_id: 1, season: "InvalidSeasonName" }),
        });
        assert(resItemBadSeason.status === 400, "Unsupported season value rejected with 400 Bad Request");
        const dataBadSeason = await resItemBadSeason.json();
        assert(dataBadSeason.message.includes("Allowed values"), "Error message specifies allowed season options");

        // 3.5 Anti-Forgery Guard: Client attempting to manually set source_type: "PURCHASED" (403)
        // Setup mock default wardrobe & variant existence so control reaches source_type check
        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("SELECT wardrobe_id, wardrobe_name, created_at FROM WARDROBE"),
            () => [[{ wardrobe_id: 1, wardrobe_name: "My Wardrobe" }]]
        );
        mockDb.when(
            (sql) => sql.includes("SELECT pv.variant_id, pv.product_id, p.product_name"),
            () => [[{ variant_id: 10, product_id: 2, product_name: "Linen Shirt", color: "Blue", size: "M" }]]
        );

        const resForgePurchased = await fetch(`${baseUrl}/api/wardrobes/items`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({ variant_id: 10, source_type: "PURCHASED" }),
        });
        assert(resForgePurchased.status === 403, "Security: Manual addition with source_type 'PURCHASED' rejected with 403 Forbidden");
        const dataForge = await resForgePurchased.json();
        assert(dataForge.message.includes("cannot be manually marked as 'PURCHASED'"), "Anti-forgery error message explains verified order restriction");

        // 3.6 Invalid source_type (e.g. "WISHLIST")
        const resItemBadSource = await fetch(`${baseUrl}/api/wardrobes/items`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({ variant_id: 10, source_type: "WISHLIST" }),
        });
        assert(resItemBadSource.status === 400, "Unsupported source_type rejected with 400 Bad Request");

        // 3.7 Non-existent variant ID (400)
        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("SELECT wardrobe_id, wardrobe_name, created_at FROM WARDROBE"),
            () => [[{ wardrobe_id: 1, wardrobe_name: "My Wardrobe" }]]
        );
        mockDb.when(
            (sql) => sql.includes("SELECT pv.variant_id, pv.product_id, p.product_name"),
            () => [[]]
        );
        const resNonExistentVariant = await fetch(`${baseUrl}/api/wardrobes/items`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({ variant_id: 99999 }),
        });
        assert(resNonExistentVariant.status === 400, "Non-existent variant ID rejected with 400 Bad Request");

        // 3.8 Product ID mismatch with variant's actual product (400)
        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("SELECT wardrobe_id, wardrobe_name, created_at FROM WARDROBE"),
            () => [[{ wardrobe_id: 1, wardrobe_name: "My Wardrobe" }]]
        );
        mockDb.when(
            (sql) => sql.includes("SELECT pv.variant_id, pv.product_id, p.product_name"),
            () => [[{ variant_id: 10, product_id: 2, product_name: "Linen Shirt", color: "Blue", size: "M" }]]
        );
        const resProductMismatch = await fetch(`${baseUrl}/api/wardrobes/items`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({ variant_id: 10, product_id: 99 }), // Mismatch: variant belongs to product 2, not 99
        });
        assert(resProductMismatch.status === 400, "Variant-to-product ID mismatch rejected with 400 Bad Request");
        const dataMismatch = await resProductMismatch.json();
        assert(dataMismatch.message.includes("does not belong to product"), "Mismatch error explains variant-product relationship conflict");

        // 3.9 Duplicate variant in same wardrobe collection (409)
        mockDb.when(
            (sql) => sql.includes("SELECT wardrobe_item_id FROM WARDROBE_ITEM WHERE wardrobe_id = ? AND variant_id = ?"),
            () => [[{ wardrobe_item_id: 50 }]]
        );
        const resDupItem = await fetch(`${baseUrl}/api/wardrobes/items`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({ variant_id: 10 }),
        });
        assert(resDupItem.status === 409, "Adding duplicate variant to same wardrobe collection rejected with 409 Conflict");

        // 3.10 Valid item addition (201)
        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("SELECT wardrobe_id, wardrobe_name, created_at FROM WARDROBE"),
            () => [[{ wardrobe_id: 1, wardrobe_name: "My Wardrobe" }]]
        );
        mockDb.when(
            (sql) => sql.includes("SELECT pv.variant_id, pv.product_id, p.product_name"),
            () => [[{ variant_id: 10, product_id: 2, product_name: "Linen Shirt", color: "Blue", size: "M" }]]
        );
        mockDb.when(
            (sql) => sql.includes("SELECT wardrobe_item_id FROM WARDROBE_ITEM WHERE wardrobe_id = ? AND variant_id = ?"),
            () => [[]]
        );
        mockDb.when(
            (sql) => sql.includes("INSERT INTO WARDROBE_ITEM"),
            () => [{ insertId: 75, affectedRows: 1 }]
        );
        const resValidItemAdd = await fetch(`${baseUrl}/api/wardrobes/items`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({ variant_id: 10, season: "Summer" }),
        });
        assert(resValidItemAdd.status === 201, "Valid item addition returns 201 Created");
        const dataValidAdd = await resValidItemAdd.json();
        assert(dataValidAdd.wardrobe_item_id === 75, "Response returns newly generated wardrobe_item_id");
        assert(dataValidAdd.source_type === "SAVED", "Saved items default to source_type SAVED");

        // =====================================================================
        // Section 4: Wardrobe Retrieval & Data Isolation (IDOR Checks)
        // =====================================================================
        console.log("\n--- 4. Multi-Tenant Isolation & IDOR Protection ---");

        // 4.1 Invalid wardrobe ID parameter format (non-integer string)
        const resBadWbId = await fetch(`${baseUrl}/api/wardrobes/not-a-number/items`, {
            headers: { Authorization: `Bearer ${user1Token}` },
        });
        assert(resBadWbId.status === 400, "Non-numeric wardrobe ID in URL rejected with 400 Bad Request");

        // 4.2 Non-existent wardrobe ID (404)
        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("SELECT wardrobe_id, wardrobe_name FROM WARDROBE WHERE wardrobe_id = ? AND user_id = ?"),
            () => [[]]
        );
        const resNotFoundWb = await fetch(`${baseUrl}/api/wardrobes/9999/items`, {
            headers: { Authorization: `Bearer ${user1Token}` },
        });
        assert(resNotFoundWb.status === 404, "Non-existent wardrobe ID returns 404 Not Found");

        // 4.3 IDOR Guard: User 2 attempting to view User 1's wardrobe (404 access denied)
        // SQL query explicitly checks `AND user_id = ?`, so User 2 receives empty rows
        const resIdorView = await fetch(`${baseUrl}/api/wardrobes/1/items`, {
            headers: { Authorization: `Bearer ${user2Token}` }, // User 2 requesting User 1's wardrobe #1
        });
        assert(resIdorView.status === 404, "IDOR Guard: User 2 attempting to view User 1's wardrobe returns 404 Not Found");
        const dataIdorView = await resIdorView.json();
        assert(dataIdorView.message.includes("Wardrobe not found or access denied"), "Privacy isolation: returns 404 access denied");

        // 4.4 Successful items retrieval with filters (200)
        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("SELECT wardrobe_id, wardrobe_name FROM WARDROBE WHERE wardrobe_id = ? AND user_id = ?"),
            () => [[{ wardrobe_id: 1, wardrobe_name: "Summer Outfits" }]]
        );
        mockDb.when(
            (sql) => sql.includes("FROM WARDROBE_ITEM wi"),
            () => [[
                {
                    wardrobe_item_id: 1,
                    wardrobe_id: 1,
                    variant_id: 10,
                    quantity: 1,
                    season: "Summer",
                    source_type: "SAVED",
                    product_id: 2,
                    product_name: "Linen Shirt",
                    price: 1499.00
                }
            ]]
        );
        const resGetItemsSuccess = await fetch(`${baseUrl}/api/wardrobes/1/items?season=Summer`, {
            headers: { Authorization: `Bearer ${user1Token}` },
        });
        assert(resGetItemsSuccess.status === 200, "Owner retrieves wardrobe items with filter (200 OK)");
        const dataItemsSuccess = await resGetItemsSuccess.json();
        assert(dataItemsSuccess.count === 1, "Returned items array matches filtered count");
        assert(dataItemsSuccess.items[0].product_name === "Linen Shirt", "Item details are correctly enriched");

        // =====================================================================
        // Section 5: Wardrobe Item Removal Validation & Ownership
        // =====================================================================
        console.log("\n--- 5. Item Deletion Validation & Ownership Verification ---");

        // 5.1 Invalid item ID parameter
        const resDelBadId = await fetch(`${baseUrl}/api/wardrobes/items/abc`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${user1Token}` },
        });
        assert(resDelBadId.status === 400, "Deleting wardrobe item with invalid ID rejected with 400 Bad Request");

        // 5.2 Non-existent item or item owned by another user (404)
        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("DELETE wi FROM WARDROBE_ITEM wi INNER JOIN WARDROBE w"),
            () => [{ affectedRows: 0 }]
        );
        const resDelNotOwned = await fetch(`${baseUrl}/api/wardrobes/items/99`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${user1Token}` },
        });
        assert(resDelNotOwned.status === 404, "Deleting item not owned by user returns 404 Not Found");
        const dataDelNotOwned = await resDelNotOwned.json();
        assert(dataDelNotOwned.message.includes("permission to remove it"), "Error message notes ownership permission boundary");

        // 5.3 Successful deletion of own wardrobe item (200)
        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("DELETE wi FROM WARDROBE_ITEM wi INNER JOIN WARDROBE w"),
            () => [{ affectedRows: 1 }]
        );
        const resDelSuccess = await fetch(`${baseUrl}/api/wardrobes/items/1`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${user1Token}` },
        });
        assert(resDelSuccess.status === 200, "Deleting owned wardrobe item succeeds with 200 OK");
        const dataDelSuccess = await resDelSuccess.json();
        assert(dataDelSuccess.success === true, "Deletion response indicates success");

        // =====================================================================
        // Section 6: Order Item Synchronization (Order -> Wardrobe)
        // =====================================================================
        console.log("\n--- 6. Synchronizing Order Items to Wardrobe ---");

        // 6.1 Invalid order ID parameter
        const resOrderSyncBadId = await fetch(`${baseUrl}/api/wardrobes/items/from-order/invalid`, {
            method: "POST",
            headers: { Authorization: `Bearer ${user1Token}` },
        });
        assert(resOrderSyncBadId.status === 400, "Syncing from invalid order ID rejected with 400 Bad Request");

        // 6.2 Order not found or owned by another user (404)
        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("SELECT order_id FROM `orders` WHERE order_id = ? AND user_id = ?"),
            () => [[]]
        );
        const resOrderNotFound = await fetch(`${baseUrl}/api/wardrobes/items/from-order/999`, {
            method: "POST",
            headers: { Authorization: `Bearer ${user1Token}` },
        });
        assert(resOrderNotFound.status === 404, "Syncing from non-owned or non-existent order returns 404 Not Found");

        // 6.3 Successful order synchronization (200)
        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("SELECT order_id FROM `orders` WHERE order_id = ? AND user_id = ?"),
            () => [[{ order_id: 10 }]]
        );
        mockDb.when(
            (sql) => sql.includes("SELECT variant_id, quantity FROM `order_item` WHERE order_id = ?"),
            () => [[{ variant_id: 5, quantity: 2 }, { variant_id: 8, quantity: 1 }]]
        );
        mockDb.when(
            (sql) => sql.includes("SELECT wardrobe_id, wardrobe_name, created_at FROM WARDROBE"),
            () => [[{ wardrobe_id: 1, wardrobe_name: "My Wardrobe" }]]
        );
        mockDb.when(
            (sql) => sql.includes("INSERT INTO WARDROBE_ITEM"),
            () => [{ affectedRows: 1 }]
        );
        const resOrderSyncSuccess = await fetch(`${baseUrl}/api/wardrobes/items/from-order/10`, {
            method: "POST",
            headers: { Authorization: `Bearer ${user1Token}` },
        });
        assert(resOrderSyncSuccess.status === 200, "Syncing purchased order to wardrobe succeeds with 200 OK");
        const dataOrderSync = await resOrderSyncSuccess.json();
        assert(dataOrderSync.added_count === 2, "Response confirms synchronization of both purchased items");

    } catch (err) {
        console.error("Test execution error in Wardrobe QA Suite:", err);
        assert(false, `Unexpected exception: ${err.message}`);
    } finally {
        mockDb.restore();
        await close();
    }

    const { failed } = summarize();
    return failed === 0;
}

if (require.main === module) {
    runWardrobeQaTests().then((success) => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = runWardrobeQaTests;
