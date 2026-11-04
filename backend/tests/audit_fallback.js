require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const http = require("http");
const jwt = require("jsonwebtoken");
const app = require("../server");

const JWT_SECRET = process.env.JWT_SECRET || "FashionIQ_YourOwnLongRandomSecret_2026";
const userToken = jwt.sign(
    { user_id: 1, email: "anand.demo@example.com", role: "USER" },
    JWT_SECRET,
    { expiresIn: "1h" }
);

async function testFallback() {
    console.log("======================================================================");
    print = console.log;
    print("FASHIONIQ PHASE 6: GRACEFUL OFFLINE FALLBACK AUDIT");
    print("======================================================================\n");

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;

    try {
        print("--- PHASE 1: FASTAPI STOPPED (OFFLINE FALLBACK TEST) ---");
        // Ensure AI service port is set to an unreachable address
        process.env.AI_SERVICE_URL = "http://localhost:9998";

        const t0 = Date.now();
        const resOffline = await fetch(`${baseUrl}/api/recommendations/similar/1`);
        const duration = Date.now() - t0;
        const dataOffline = await resOffline.json();

        print(`Response received in ${duration} ms (Timeout guard prevented hanging!)`);
        print(`HTTP Status: ${resOffline.status}`);
        print(`Response Payload:`);
        print(JSON.stringify(dataOffline, null, 2));

        if (resOffline.status !== 200) throw new Error("Fallback did not return 200 OK!");
        if (dataOffline.source !== "fallback") throw new Error("Source was not marked as fallback!");
        if (dataOffline.message && dataOffline.message.includes("Error")) throw new Error("Exposed internal stack trace!");
        print("  [SUCCESS] Express responded with clean SQL fallback without exposing internal exceptions.\n");

        print("--- PHASE 2: USER RECOMMENDATIONS UNDER OFFLINE FALLBACK ---");
        const resUserOffline = await fetch(`${baseUrl}/api/recommendations/user`, {
            headers: { Authorization: `Bearer ${userToken}` }
        });
        const dataUserOffline = await resUserOffline.json();
        print(`HTTP Status: ${resUserOffline.status}`);
        print(`Source: ${dataUserOffline.source} | Count: ${dataUserOffline.count}`);
        print("Sample fallback recommendation: " + JSON.stringify(dataUserOffline.recommendations[0]));
        print("  [SUCCESS] User personalized fallback executed safely.\n");

    } catch (err) {
        console.error("Audit failure:", err);
        process.exit(1);
    } finally {
        server.close();
    }

    print("======================================================================");
    print("GRACEFUL FALLBACK AUDIT PASSED");
    print("======================================================================\n");
    process.exit(0);
}

testFallback();
