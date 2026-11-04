require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const http = require("http");
const jwt = require("jsonwebtoken");
const app = require("../server");

const JWT_SECRET = process.env.JWT_SECRET || "FashionIQ_YourOwnLongRandomSecret_2026";

const user1Token = jwt.sign(
    { user_id: 1, email: "anand.demo@example.com", role: "USER" },
    JWT_SECRET,
    { expiresIn: "1h" }
);

const user2Token = jwt.sign(
    { user_id: 2, email: "priya.demo@example.com", role: "USER" },
    JWT_SECRET,
    { expiresIn: "1h" }
);

async function runTests() {
    console.log("=== FashionIQ Phase 7: Complete Outfit Engine Integration Test Suite ===");

    // Ephemeral test server
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

    let createdOutfitId = null;

    try {
        // Test 1: GET /api/outfits/recommendations (Unauthenticated -> 401)
        console.log("\n1. Testing Auth Guard on Personalized Outfits:");
        const resUnauth = await fetch(`${baseUrl}/api/outfits/recommendations`);
        assert(resUnauth.status === 401, "Unauthenticated request rejected with 401");

        // Test 2: GET /api/outfits/recommendations (Authenticated)
        console.log("\n2. Testing Authenticated Personalized Outfits:");
        const resRecs = await fetch(`${baseUrl}/api/outfits/recommendations?occasion=Casual&limit=3`, {
            headers: { Authorization: `Bearer ${user1Token}` },
        });
        const dataRecs = await resRecs.json();
        assert(resRecs.status === 200, "HTTP status is 200");
        assert(dataRecs.success === true, "Response success is true");
        assert(Array.isArray(dataRecs.outfits), "Outfits is an array");
        assert(dataRecs.outfits.length > 0, `Returned ${dataRecs.outfits.length} complete outfits`);
        assert(["ai", "fallback"].includes(dataRecs.source), `Source is valid: ${dataRecs.source}`);

        // Verify outfit composition
        const firstRec = dataRecs.outfits[0];
        assert(firstRec.items && firstRec.items.length >= 2, "Outfit contains at least 2 coordinated pieces");
        const roles = new Set(firstRec.items.map((i) => i.role));
        assert(roles.has("Top") && roles.has("Bottom"), "Outfit has both Top and Bottom");
        assert(firstRec.purchase_price > 0, `Outfit purchase price is ₹${firstRec.purchase_price}`);

        // Test 3: GET /api/outfits/from-wardrobe (Unauthenticated -> 401)
        console.log("\n3. Testing Auth Guard on Wardrobe Outfits:");
        const resWardrobeUnauth = await fetch(`${baseUrl}/api/outfits/from-wardrobe`);
        assert(resWardrobeUnauth.status === 401, "Unauthenticated request rejected with 401");

        // Test 4: GET /api/outfits/from-wardrobe (Authenticated)
        console.log("\n4. Testing Wardrobe-First Outfits for Authenticated User:");
        const resWardrobe = await fetch(`${baseUrl}/api/outfits/from-wardrobe?limit=4`, {
            headers: { Authorization: `Bearer ${user1Token}` },
        });
        const dataWardrobe = await resWardrobe.json();
        assert(resWardrobe.status === 200, "HTTP status is 200");
        assert(dataWardrobe.success === true, "Response success is true");
        assert(dataWardrobe.outfits.length > 0, `Returned ${dataWardrobe.outfits.length} wardrobe-anchored outfits`);

        // Verify owned items are flagged
        const firstWardrobeOutfit = dataWardrobe.outfits[0];
        assert(firstWardrobeOutfit.owned_items_count > 0, "Outfit correctly counts owned items");
        assert(firstWardrobeOutfit.items.some((i) => i.is_owned === true), "Contains items flagged is_owned: true");

        // Test 5: GET /api/outfits/product/:productId (Complete the Look)
        console.log("\n5. Testing 'Complete the Look' for Product 1:");
        const resProdOutfits = await fetch(`${baseUrl}/api/outfits/product/1?limit=3`);
        const dataProdOutfits = await resProdOutfits.json();
        assert(resProdOutfits.status === 200, "HTTP status is 200");
        assert(dataProdOutfits.success === true, "Response success is true");
        assert(dataProdOutfits.outfits.length > 0, `Returned ${dataProdOutfits.outfits.length} looks for product 1`);
        assert(
            dataProdOutfits.outfits.every((o) => o.items.some((it) => it.product_id === 1)),
            "Target product 1 is an anchor in every outfit"
        );

        // Test 6: POST /api/outfits/generate (Custom generation)
        console.log("\n6. Testing Dynamic Custom Outfit Generation:");
        const resGen = await fetch(`${baseUrl}/api/outfits/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                occasion: "Sports",
                season: "Summer",
                budget_max: 4000.0,
                limit: 2,
            }),
        });
        const dataGen = await resGen.json();
        assert(resGen.status === 200, "HTTP status is 200");
        assert(dataGen.success === true, "Response success is true");
        assert(dataGen.outfits.length > 0, `Generated ${dataGen.outfits.length} custom outfits`);
        assert(
            dataGen.outfits.every((o) => o.purchase_price <= 4000.0),
            "Every generated outfit respects budget <= ₹4,000"
        );

        // Test 7: POST /api/outfits/save (Validation & Save)
        console.log("\n7. Testing Save Outfit Flow:");
        const resSaveBad = await fetch(`${baseUrl}/api/outfits/save`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({
                outfit_name: "Bad Outfit",
                items: [{ variant_id: 1, role: "Top" }], // Less than 2 items
            }),
        });
        assert(resSaveBad.status === 400, "Rejects outfit with fewer than 2 pieces with 400");

        const resSave = await fetch(`${baseUrl}/api/outfits/save`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${user1Token}`,
            },
            body: JSON.stringify({
                outfit_name: "Athletic Morning Run Look",
                occasion: "Sports",
                season: "Summer",
                total_price: 3499.0,
                description: "White Nike Dri-FIT T-Shirt paired with Black Adidas Track Pants",
                items: [
                    { variant_id: 1, role: "Top", price: 1500.0, is_owned: true },
                    { variant_id: 3, role: "Bottom", price: 1999.0, is_owned: false },
                ],
            }),
        });
        const dataSave = await resSave.json();
        assert(resSave.status === 201, "HTTP status is 201 Created");
        assert(dataSave.success === true, "Response success is true");
        assert(dataSave.outfit_id > 0, `Created outfit with ID: ${dataSave.outfit_id}`);
        createdOutfitId = dataSave.outfit_id;

        // Test 8: GET /api/outfits/saved (Retrieve Saved Outfits)
        console.log("\n8. Testing Retrieval of User's Saved Outfits:");
        const resSaved = await fetch(`${baseUrl}/api/outfits/saved`, {
            headers: { Authorization: `Bearer ${user1Token}` },
        });
        const dataSaved = await resSaved.json();
        assert(resSaved.status === 200, "HTTP status is 200");
        assert(dataSaved.success === true, "Response success is true");
        assert(dataSaved.outfits.length > 0, `User 1 has ${dataSaved.outfits.length} saved outfits`);
        const found = dataSaved.outfits.find((o) => o.outfit_id === createdOutfitId);
        assert(found !== undefined, "Newly saved outfit is present in user's saved outfits");
        assert(found.items.length === 2, "Saved outfit has its 2 items loaded");

        // Test 9: DELETE /api/outfits/saved/:outfitId (Cross-User Security)
        console.log("\n9. Testing Cross-User Protection on Delete:");
        const resDeleteCrossUser = await fetch(`${baseUrl}/api/outfits/saved/${createdOutfitId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${user2Token}` }, // User 2 trying to delete User 1's outfit
        });
        assert(resDeleteCrossUser.status === 404, "User 2 cannot delete User 1's outfit (rejected with 404)");

        // Test 10: DELETE /api/outfits/saved/:outfitId (Owner Delete)
        console.log("\n10. Testing Owner Delete of Saved Outfit:");
        const resDeleteOwn = await fetch(`${baseUrl}/api/outfits/saved/${createdOutfitId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${user1Token}` },
        });
        assert(resDeleteOwn.status === 200, "Owner successfully deletes outfit with 200");
        createdOutfitId = null;

        // Test 11: Offline Fallback Graceful Simulation
        console.log("\n11. Testing AI Microservice Offline Fallback for Outfits:");
        const originalUrl = process.env.AI_SERVICE_URL;
        process.env.AI_SERVICE_URL = "http://localhost:9999"; // Unreachable

        const resFallback = await fetch(`${baseUrl}/api/outfits/recommendations`, {
            headers: { Authorization: `Bearer ${user1Token}` },
        });
        const dataFallback = await resFallback.json();
        assert(resFallback.status === 200, "Fallback returns 200 when AI microservice is offline");
        assert(dataFallback.source === "fallback", "Source marked as 'fallback'");
        assert(dataFallback.outfits.length > 0, `Fallback returned ${dataFallback.outfits.length} SQL outfits`);

        process.env.AI_SERVICE_URL = originalUrl;

    } catch (err) {
        console.error("Test execution error:", err);
        failed++;
    } finally {
        if (createdOutfitId) {
            // Clean up if test failed before delete
            await fetch(`${baseUrl}/api/outfits/saved/${createdOutfitId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${user1Token}` },
            }).catch(() => {});
        }
        server.close();
    }

    console.log(`\n======================================================`);
    console.log(`Outfit Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log(`======================================================\n`);

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runTests();
