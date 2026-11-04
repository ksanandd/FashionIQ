require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const http = require("http");
const jwt = require("jsonwebtoken");
const app = require("../server");

const JWT_SECRET = process.env.JWT_SECRET || "FashionIQ_YourOwnLongRandomSecret_2026";

// Generate test tokens
const userToken = jwt.sign(
    { user_id: 1, email: "anand.demo@example.com", role: "USER" },
    JWT_SECRET,
    { expiresIn: "1h" }
);

const adminToken = jwt.sign(
    { user_id: 3, email: "admin.demo@example.com", role: "ADMIN" },
    JWT_SECRET,
    { expiresIn: "1h" }
);

async function runTests() {
    console.log("=== FashionIQ Phase 6: Recommendation Integration Test Suite ===");

    // Start server on an ephemeral port
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

    try {
        // Test 1: GET /api/recommendations/similar/1
        console.log("\n1. Testing Similar Products endpoint:");
        const resSimilar = await fetch(`${baseUrl}/api/recommendations/similar/1`);
        const dataSimilar = await resSimilar.json();
        assert(resSimilar.status === 200, "HTTP status is 200");
        assert(dataSimilar.success === true, "Response success is true");
        assert(Array.isArray(dataSimilar.recommendations), "Recommendations is an array");
        assert(dataSimilar.count > 0, `Returned ${dataSimilar.count} similar items`);
        assert(
            dataSimilar.recommendations.every((r) => r.product_id !== 1),
            "Target product 1 is excluded from similar items"
        );
        assert(
            dataSimilar.recommendations.every((r) => r.product_id !== 2 && r.product_id !== 4),
            "Phase 6.1: Unrelated categories (bottoms, outerwear) are excluded from similar products"
        );

        // Test 2: GET /api/recommendations/user (Guest)
        console.log("\n2. Testing Guest Recommendations (Unauthenticated):");
        const resGuest = await fetch(`${baseUrl}/api/recommendations/user`);
        const dataGuest = await resGuest.json();
        assert(resGuest.status === 200, "HTTP status is 200");
        assert(dataGuest.success === true, "Response success is true");
        assert(Array.isArray(dataGuest.recommendations), "Recommendations is an array");
        assert(dataGuest.count > 0, `Returned ${dataGuest.count} catalog items`);

        // Test 3: GET /api/recommendations/user (Authenticated)
        console.log("\n3. Testing Authenticated User Personalized Recommendations:");
        const resUser = await fetch(`${baseUrl}/api/recommendations/user`, {
            headers: { Authorization: `Bearer ${userToken}` },
        });
        const dataUser = await resUser.json();
        assert(resUser.status === 200, "HTTP status is 200");
        assert(dataUser.success === true, "Response success is true");
        assert(dataUser.count > 0, `Returned ${dataUser.count} personalized recommendations`);

        // Test 4: GET /api/recommendations/wardrobe (Unauthenticated -> 401)
        console.log("\n4. Testing Wardrobe Authentication Guard:");
        const resWardrobeUnauth = await fetch(`${baseUrl}/api/recommendations/wardrobe`);
        assert(resWardrobeUnauth.status === 401, "Unauthenticated request returns 401");

        // Test 5: GET /api/recommendations/wardrobe (Authenticated)
        console.log("\n5. Testing Wardrobe Recommendations for Authenticated User:");
        const resWardrobe = await fetch(`${baseUrl}/api/recommendations/wardrobe`, {
            headers: { Authorization: `Bearer ${userToken}` },
        });
        const dataWardrobe = await resWardrobe.json();
        assert(resWardrobe.status === 200, "HTTP status is 200");
        assert(dataWardrobe.success === true, "Response success is true");
        assert(Array.isArray(dataWardrobe.recommendations), "Recommendations is an array");
        assert(
            dataWardrobe.recommendations.every((r) => r.product_id !== 1 && r.product_id !== 2),
            "Phase 6.1: Already owned products in wardrobe (1 and 2) are excluded from recommendations"
        );

        // Test 6: POST /api/recommendations/index (Role-based Authorization)
        console.log("\n6. Testing Indexing RBAC Protection:");
        const resIndexForbidden = await fetch(`${baseUrl}/api/recommendations/index`, {
            method: "POST",
            headers: { Authorization: `Bearer ${userToken}` },
        });
        assert(resIndexForbidden.status === 403, "Non-admin user rejected with 403 Forbidden");

        // Test 7: GET /api/recommendations/:userId Security & Legacy Compatibility
        console.log("\n7. Testing Security & RBAC for /api/recommendations/:userId:");
        const resLegacyUnauth = await fetch(`${baseUrl}/api/recommendations/1`);
        assert(resLegacyUnauth.status === 401, "Unauthenticated access to specific user ID returns 401");

        const resTamperOtherUser = await fetch(`${baseUrl}/api/recommendations/2`, {
            headers: { Authorization: `Bearer ${userToken}` },
        });
        assert(resTamperOtherUser.status === 403, "Normal user attempting to view user 2's recs returns 403 Forbidden");

        const resLegacyOwnUser = await fetch(`${baseUrl}/api/recommendations/1`, {
            headers: { Authorization: `Bearer ${userToken}` },
        });
        const dataLegacyOwn = await resLegacyOwnUser.json();
        assert(resLegacyOwnUser.status === 200, "User viewing own ID returns 200");
        assert(dataLegacyOwn.success === true, "Response success is true");
        assert(dataLegacyOwn.count > 0, `Returned ${dataLegacyOwn.count} items for own ID`);

        const resAdminViewOther = await fetch(`${baseUrl}/api/recommendations/2`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert(resAdminViewOther.status === 200, "Admin permitted to view recommendations for user 2");

        // Test 8: Offline Fallback Simulation
        console.log("\n8. Testing AI Microservice Offline Graceful Fallback:");
        // Temporarily change AI service URL to an unreachable address
        const originalUrl = process.env.AI_SERVICE_URL;
        process.env.AI_SERVICE_URL = "http://localhost:9999";

        const resFallbackSimilar = await fetch(`${baseUrl}/api/recommendations/similar/1`);
        const dataFallbackSimilar = await resFallbackSimilar.json();
        assert(resFallbackSimilar.status === 200, "Fallback returns 200 when AI service is down");
        assert(dataFallbackSimilar.source === "fallback", "Source correctly marked as fallback");
        assert(dataFallbackSimilar.recommendations.length > 0, "Fallback returned MySQL recommendations");

        const resFallbackUser = await fetch(`${baseUrl}/api/recommendations/user`, {
            headers: { Authorization: `Bearer ${userToken}` },
        });
        const dataFallbackUser = await resFallbackUser.json();
        assert(resFallbackUser.status === 200, "User fallback returns 200 when AI service is down");
        assert(dataFallbackUser.source === "fallback", "User source correctly marked as fallback");

        // Restore original URL
        process.env.AI_SERVICE_URL = originalUrl;

    } catch (err) {
        console.error("Test execution error:", err);
        failed++;
    } finally {
        server.close();
    }

    console.log(`\n======================================================`);
    console.log(`Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log(`======================================================\n`);

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runTests();
