/**
 * FashionIQ Backend QA Suite: Recommendations, Catalog Filters & User Profile QA
 * File: backend/tests/test_recommendations_catalog_qa.js
 *
 * Verifies:
 * - Recommendation authentication guards and IDOR protection on /api/recommendations/:userId (401, 403, 400)
 * - Admin privileged access to user recommendations (200)
 * - Similar product parameter validation and AI offline fallback (400, 200)
 * - Admin-only product vector indexing trigger guard (401, 403)
 * - Catalog filtering validation: category_id, brand_id, invalid price format, min_price > max_price (400)
 * - Category and Brand lookup validation and not found handling (400, 404, 200)
 * - User behavioral interaction logging validation and allowed types (401, 400, 201)
 * - User fashion profile and address validation (401, 400, 200)
 */

const app = require("../server");
const {
    createTestServer,
    createToken,
    createAssertionCollector,
    mockDb,
} = require("./test_helpers");

async function runRecommendationsCatalogQaTests() {
    console.log("================================================================================");
    console.log("FashionIQ QA Test Suite 5: Recommendations, Catalog & Profile QA");
    console.log("================================================================================\n");

    const { baseUrl, close } = await createTestServer(app);
    const { assert, summarize } = createAssertionCollector("Recommendations & Catalog QA Suite");

    mockDb.install();

    const user1Token = createToken({ user_id: 1, email: "user1@example.com", role: "USER" });
    const user2Token = createToken({ user_id: 2, email: "user2@example.com", role: "USER" });
    const adminToken = createToken({ user_id: 99, email: "admin@example.com", role: "ADMIN" });

    try {
        // =====================================================================
        // Section 1: Recommendation Security & IDOR Prevention
        // =====================================================================
        console.log("--- 1. Recommendation Authorization & IDOR Guards ---");

        // 1.1 Wardrobe recommendations unauthenticated -> 401
        const resWbRecUnauth = await fetch(`${baseUrl}/api/recommendations/wardrobe`);
        assert(resWbRecUnauth.status === 401, "GET /api/recommendations/wardrobe requires authentication (401)");

        // 1.2 Accessing specific user's recommendations unauthenticated -> 401
        const resUserRecUnauth = await fetch(`${baseUrl}/api/recommendations/1`);
        assert(resUserRecUnauth.status === 401, "GET /api/recommendations/:userId requires authentication (401)");

        // 1.3 Invalid user ID in recommendation URL -> 400
        const resBadUserId = await fetch(`${baseUrl}/api/recommendations/invalid`, {
            headers: { Authorization: `Bearer ${user1Token}` },
        });
        assert(resBadUserId.status === 400, "Invalid userId on /api/recommendations/:userId rejected with 400 Bad Request");

        // 1.4 IDOR Guard: User 1 attempting to view User 2's personalized recommendations (403 Forbidden)
        const resIdorRec = await fetch(`${baseUrl}/api/recommendations/2`, {
            headers: { Authorization: `Bearer ${user1Token}` }, // User 1 requesting User 2's data
        });
        assert(resIdorRec.status === 403, "IDOR Guard: User 1 attempting to access User 2's recommendations rejected with 403 Forbidden");
        const dataIdorRec = await resIdorRec.json();
        assert(dataIdorRec.message.includes("cannot view recommendations for another user"), "Error confirms privacy protection boundary");

        // 1.5 Admin permitted to inspect user recommendations (200 OK)
        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("FROM PRODUCT p JOIN PRODUCT_VARIANT pv"),
            () => [[{ product_id: 1, product_name: "Silk Shirt", price: 1999.00 }]]
        );
        const resAdminRec = await fetch(`${baseUrl}/api/recommendations/2`, {
            headers: { Authorization: `Bearer ${adminToken}` }, // ADMIN inspecting user 2
        });
        assert(resAdminRec.status === 200, "Admin permitted to inspect customer recommendations (200 OK)");

        // 1.6 Similar products invalid product ID (400)
        const resBadProdId = await fetch(`${baseUrl}/api/recommendations/similar/bad-id`);
        assert(resBadProdId.status === 400, "Similar products with invalid product ID rejected with 400 Bad Request");

        // 1.7 Similar products valid ID returns fallback when AI service is unavailable (200 OK)
        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("SELECT p.category_id, p.gender FROM PRODUCT p WHERE p.product_id = ?"),
            () => [[{ category_id: 1, gender: "Men" }]]
        );
        mockDb.when(
            (sql) => sql.includes("FROM PRODUCT p JOIN PRODUCT_VARIANT pv") && sql.includes("p.category_id = ?"),
            () => [[{ product_id: 2, product_name: "Chino Pants", price: 1499.00 }]]
        );
        const resSimilar = await fetch(`${baseUrl}/api/recommendations/similar/1`);
        assert(resSimilar.status === 200, "Similar products returns 200 OK with deterministic SQL fallback");
        const dataSimilar = await resSimilar.json();
        assert(dataSimilar.source === "fallback", "Response source is correctly tagged as fallback");

        // 1.8 Product indexing trigger authorization (POST /api/recommendations/index)
        const resIndexUnauth = await fetch(`${baseUrl}/api/recommendations/index`, { method: "POST" });
        assert(resIndexUnauth.status === 401, "Trigger indexing unauthenticated rejected with 401");

        const resIndexForbidden = await fetch(`${baseUrl}/api/recommendations/index`, {
            method: "POST",
            headers: { Authorization: `Bearer ${user1Token}` }, // Normal USER
        });
        assert(resIndexForbidden.status === 403, "Normal USER triggering indexing rejected with 403 Forbidden");

        // =====================================================================
        // Section 2: Catalog Filtering Validation (/api/products)
        // =====================================================================
        console.log("\n--- 2. Product Catalog Filter Validation ---");

        // 2.1 Invalid category_id filter
        const resFilterBadCat = await fetch(`${baseUrl}/api/products?category_id=-1`);
        assert(resFilterBadCat.status === 400, "Invalid category_id filter rejected with 400 Bad Request");

        // 2.2 Invalid brand_id filter
        const resFilterBadBrand = await fetch(`${baseUrl}/api/products?brand_id=abc`);
        assert(resFilterBadBrand.status === 400, "Invalid brand_id filter rejected with 400 Bad Request");

        // 2.3 Invalid price filter (non-numeric string)
        const resFilterBadPrice = await fetch(`${baseUrl}/api/products?min_price=free`);
        assert(resFilterBadPrice.status === 400, "Non-numeric min_price filter rejected with 400 Bad Request");

        // 2.4 min_price > max_price constraint
        const resPriceInversion = await fetch(`${baseUrl}/api/products?min_price=5000&max_price=1000`);
        assert(resPriceInversion.status === 400, "Filter where min_price > max_price rejected with 400 Bad Request");
        const dataPriceInversion = await resPriceInversion.json();
        assert(dataPriceInversion.message === "Minimum price cannot exceed maximum price", "Price inversion error message is explicit");

        // 2.5 Product detail by ID validation (invalid ID -> 400, not found -> 404)
        const resBadProdDetailId = await fetch(`${baseUrl}/api/products/invalid-id`);
        assert(resBadProdDetailId.status === 400, "GET /api/products/:id with invalid ID rejected with 400 Bad Request");

        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("FROM PRODUCT WHERE product_id = ?"),
            () => [[]]
        );
        const resProdNotFound = await fetch(`${baseUrl}/api/products/99999`);
        assert(resProdNotFound.status === 404, "GET /api/products/:id for non-existent product returns 404 Not Found");

        // =====================================================================
        // Section 3: Categories & Brands Validation
        // =====================================================================
        console.log("\n--- 3. Category & Brand Validation ---");

        // 3.1 Category invalid ID
        const resBadCatId = await fetch(`${baseUrl}/api/categories/xyz`);
        assert(resBadCatId.status === 400, "GET /api/categories/:id with invalid ID rejected with 400 Bad Request");

        // 3.2 Category not found
        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("FROM CATEGORY WHERE category_id = ?"),
            () => [[]]
        );
        const resCatNotFound = await fetch(`${baseUrl}/api/categories/999`);
        assert(resCatNotFound.status === 404, "GET /api/categories/:id for non-existent category returns 404 Not Found");

        // 3.3 Brand invalid ID
        const resBadBrandId = await fetch(`${baseUrl}/api/brands/xyz`);
        assert(resBadBrandId.status === 400, "GET /api/brands/:id with invalid ID rejected with 400 Bad Request");

        // 3.4 Brand not found
        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("FROM BRAND WHERE brand_id = ?"),
            () => [[]]
        );
        const resBrandNotFound = await fetch(`${baseUrl}/api/brands/999`);
        assert(resBrandNotFound.status === 404, "GET /api/brands/:id for non-existent brand returns 404 Not Found");

        // =====================================================================
        // Section 4: Behavioral Interactions Validation (/api/interactions)
        // =====================================================================
        console.log("\n--- 4. Product Interaction Logging Validation ---");

        // 4.1 Interaction without authentication -> 401
        const resInterUnauth = await fetch(`${baseUrl}/api/interactions`, { method: "POST" });
        assert(resInterUnauth.status === 401, "POST /api/interactions requires authentication (401)");

        // 4.2 Missing product_id
        const resInterNoProd = await fetch(`${baseUrl}/api/interactions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({ interaction_type: "LIKE" }),
        });
        assert(resInterNoProd.status === 400, "Interaction without product_id rejected with 400 Bad Request");

        // 4.3 Missing interaction_type
        const resInterNoType = await fetch(`${baseUrl}/api/interactions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({ product_id: 5 }),
        });
        assert(resInterNoType.status === 400, "Interaction without interaction_type rejected with 400 Bad Request");

        // 4.4 Invalid interaction_type (not in VIEW, LIKE, DISLIKE, ADD_TO_CART, PURCHASE)
        const resInterBadType = await fetch(`${baseUrl}/api/interactions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({ product_id: 5, interaction_type: "BOOKMARK" }),
        });
        assert(resInterBadType.status === 400, "Unsupported interaction_type rejected with 400 Bad Request");
        const dataBadType = await resInterBadType.json();
        assert(dataBadType.message.includes("VIEW, LIKE, DISLIKE, ADD_TO_CART, PURCHASE"), "Error lists allowed interaction types");

        // 4.5 Valid interaction recording (201)
        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("INSERT INTO USER_INTERACTION"),
            () => [{ insertId: 77, affectedRows: 1 }]
        );
        const resInterValid = await fetch(`${baseUrl}/api/interactions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({ product_id: 5, variant_id: 12, interaction_type: "LIKE" }),
        });
        assert(resInterValid.status === 201, "Valid product interaction returns 201 Created");
        const dataInter = await resInterValid.json();
        assert(dataInter.interaction_id === 77, "Response returns generated interaction_id");

        // =====================================================================
        // Section 5: User Profile & Address Validation (/api/users)
        // =====================================================================
        console.log("\n--- 5. User Fashion Profile & Address Validation ---");

        // 5.1 Profile retrieval unauthenticated -> 401
        const resProfileUnauth = await fetch(`${baseUrl}/api/users/profile`);
        assert(resProfileUnauth.status === 401, "GET /api/users/profile requires authentication (401)");

        // 5.2 Update profile unauthenticated -> 401
        const resUpdateProfileUnauth = await fetch(`${baseUrl}/api/users/profile`, { method: "PUT" });
        assert(resUpdateProfileUnauth.status === 401, "PUT /api/users/profile requires authentication (401)");

        // 5.3 Profile budget range validation: budget_range_min > budget_range_max (400)
        const resBadBudget = await fetch(`${baseUrl}/api/users/profile`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({
                budget_range_min: 10000,
                budget_range_max: 2000,
            }),
        });
        assert(resBadBudget.status === 400, "Profile with budget_range_min > budget_range_max rejected with 400 Bad Request");
        const dataBadBudget = await resBadBudget.json();
        assert(dataBadBudget.message === "Minimum budget cannot exceed maximum budget", "Budget inversion error message is explicit");

        // 5.4 Update address unauthenticated -> 401
        const resUpdateAddressUnauth = await fetch(`${baseUrl}/api/users/address`, { method: "PUT" });
        assert(resUpdateAddressUnauth.status === 401, "PUT /api/users/address requires authentication (401)");

        // 5.5 Update address missing required fields (400)
        const resBadAddress = await fetch(`${baseUrl}/api/users/address`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({ street: "123 Main St", city: "Bengaluru" }), // missing state, pincode
        });
        assert(resBadAddress.status === 400, "Address update missing state/pincode rejected with 400 Bad Request");
        const dataBadAddress = await resBadAddress.json();
        assert(dataBadAddress.message === "All address fields are required", "Address error message specifies all fields required");

        // 5.6 Valid address update (200)
        mockDb.clearHandlers();
        mockDb.when(
            (sql) => sql.includes("UPDATE `USER` SET street = ?"),
            () => [{ affectedRows: 1 }]
        );
        const resValidAddress = await fetch(`${baseUrl}/api/users/address`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({
                street: "123 MG Road",
                city: "Bengaluru",
                state: "Karnataka",
                pincode: "560001",
            }),
        });
        assert(resValidAddress.status === 200, "Valid address update returns 200 OK");
        const dataValidAddress = await resValidAddress.json();
        assert(dataValidAddress.success === true, "Address update confirms success: true");

    } catch (err) {
        console.error("Test execution error in Recommendations QA Suite:", err);
        assert(false, `Unexpected exception: ${err.message}`);
    } finally {
        mockDb.restore();
        await close();
    }

    const { failed } = summarize();
    return failed === 0;
}

if (require.main === module) {
    runRecommendationsCatalogQaTests().then((success) => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = runRecommendationsCatalogQaTests;
